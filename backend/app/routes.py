from fastapi import APIRouter, HTTPException

from app.plates import (
    distance_km_to_plate,
    get_boundaries_geojson,
    plate_motion_proxy_mm_yr as get_plate_motion_proxy,
)
from app.recommend import generate_routes, generate_stations
from app.schemas import (
    AnalyzeBody,
    AnalyzeResponse,
    BriefBody,
    BriefResponse,
    ChatBody,
    ChatResponse,
    SummaryBody,
    SummaryResponse,
    TriageBody,
    TriageResponse,
    VoiceIntroBody,
    VoiceIntroResponse,
    VoiceBody,
    VoiceResponse,
    ExplanationOut,
    PlanBody,
    PlanResponse,
    QuakeOut,
    ZoneOut,
    HelpStationOut,
    SafePointOut,
    InfraNodeOut,
    RouteOut,
)
from app.usgs import get_live_quake
from app.zoning import compute_zoning

router = APIRouter(prefix="/api")


def _plan_zoning_fallback(mag, depth_km, plate_km, lat, lng, motion_proxy):
    """Return (zones list, explanation dict) for circle fallback and narrative."""
    damage_score, zones, confidence, explanation = compute_zoning(
        mag, depth_km, plate_km, lat, lng, plate_motion_proxy_mm_yr=motion_proxy
    )
    return zones, explanation


@router.get("/plates/geojson")
def plates_geojson():
    """Return plate boundaries as GeoJSON FeatureCollection (same source as distance_km_to_plate)."""
    return get_boundaries_geojson()


@router.get("/quake/list")
def quake_list(limit: int = 5):
    """Return latest N quakes from USGS all_day feed (newest first). Same source as /quake/live."""
    from app.usgs import get_latest_quakes
    quakes = get_latest_quakes(limit=min(20, max(1, limit)))
    return [
        QuakeOut(
            id=q["id"],
            place=q["place"],
            time=q["time"],
            mag=q["mag"],
            depth_km=q["depth_km"],
            lat=q["lat"],
            lng=q["lng"],
        )
        for q in quakes
    ]


@router.get("/quake/live")
def quake_live():
    q = get_live_quake()
    if not q:
        raise HTTPException(status_code=503, detail="No live quake data available")
    return QuakeOut(
        id=q["id"],
        place=q["place"],
        time=q["time"],
        mag=q["mag"],
        depth_km=q["depth_km"],
        lat=q["lat"],
        lng=q["lng"],
    )


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(body: AnalyzeBody):
    if body.quake_id:
        from app.usgs import get_quake_by_id
        q = get_quake_by_id(body.quake_id)
        if not q:
            raise HTTPException(status_code=400, detail="Quake not found in cache")
        lat, lng = q["lat"], q["lng"]
        mag = q["mag"]
        depth_km = q["depth_km"]
    else:
        if body.lat is None or body.lng is None:
            raise HTTPException(status_code=400, detail="lat and lng required when quake_id not provided")
        lat, lng = body.lat, body.lng
        mag = body.mag if body.mag is not None else 5.0
        depth_km = body.depth_km if body.depth_km is not None else 10.0
        q = {
            "id": "custom",
            "place": "Custom location",
            "time": "",
            "mag": mag,
            "depth_km": depth_km,
            "lat": lat,
            "lng": lng,
        }

    plate_km = distance_km_to_plate(lat, lng)
    if plate_km is not None:
        plate_km = min(plate_km, 20000.0)
    motion_proxy = get_plate_motion_proxy(plate_km)
    damage_score, zones, confidence, explanation = compute_zoning(
        mag, depth_km, plate_km, lat, lng, plate_motion_proxy_mm_yr=motion_proxy
    )
    return AnalyzeResponse(
        quake=QuakeOut(
            id=q["id"],
            place=q["place"],
            time=q["time"],
            mag=q["mag"],
            depth_km=q["depth_km"],
            lat=q["lat"],
            lng=q["lng"],
        ),
        plate_distance_km=plate_km,
        damage_score=damage_score,
        confidence=confidence,
        zones=[ZoneOut(level=z["level"], radius_km=z["radius_km"], center=z["center"]) for z in zones],
        explanation=ExplanationOut(
            **explanation,
            plate_distance_km=plate_km,
            plate_motion_source="MORVEL-style proxy (see UNAVCO for point velocities)" if motion_proxy is not None else None,
        ),
    )


@router.post("/plan", response_model=PlanResponse)
def plan(body: PlanBody):
    from app.usgs import get_quake_by_id
    from app.historical import find_similar_quakes
    from app.grid import compute_risk_grid, RESOLUTION_KM, _cell_centers
    from app.polygonize import polygonize as polygonize_grid
    from app.overpass import fetch_infra_nodes, get_density_proxy, get_density_per_cell

    q = get_quake_by_id(body.quake_id)
    if not q:
        get_live_quake()
        q = get_quake_by_id(body.quake_id)
    if not q:
        raise HTTPException(status_code=400, detail="Quake not found; fetch live quake first or try again")
    lat, lng = q["lat"], q["lng"]
    mag = q["mag"]
    depth_km = q["depth_km"]
    plate_km = distance_km_to_plate(lat, lng)
    if plate_km is not None:
        plate_km = min(plate_km, 20000.0)
    motion_proxy = get_plate_motion_proxy(plate_km)
    infra_nodes_list, infra_ok = fetch_infra_nodes(lat, lng)
    infra_count = len(infra_nodes_list)
    density_proxy = get_density_proxy(lat, lng, infra_nodes_list)
    centers = _cell_centers(lat, lng)
    density_per_cell, density_method = get_density_per_cell(centers, lat, lng, RESOLUTION_KM)
    if not infra_ok:
        grid_explanation_note = "infra unavailable (Overpass failed)"
    else:
        grid_explanation_note = None
    similar = find_similar_quakes(lat, lng, mag, depth_km, plate_km, k=5)
    cells, damage_score, confidence, grid_explanation, factor_breakdown = compute_risk_grid(
        lat, lng, mag, depth_km, plate_km, similar,
        density_proxy=density_proxy, infra_count=infra_count,
        density_per_cell=density_per_cell if density_per_cell else None,
    )
    if grid_explanation_note:
        grid_explanation["notes"] = (grid_explanation.get("notes") or "") + " " + grid_explanation_note
    if density_method:
        grid_explanation["density_method"] = density_method
    elif infra_ok:
        grid_explanation["density_method"] = "overpass_infra_count"
    else:
        grid_explanation["density_method"] = "placeholder"
    zones_geojson, safe_points_list = polygonize_grid(cells, RESOLUTION_KM)
    safe_points_out = [SafePointOut(lat=p["lat"], lng=p["lng"], reason=p["reason"]) for p in safe_points_list]

    zones, explanation_zoning = _plan_zoning_fallback(mag, depth_km, plate_km, lat, lng, motion_proxy)
    high_km = next(z["radius_km"] for z in zones if z["level"] == "high")
    med_km = next(z["radius_km"] for z in zones if z["level"] == "medium")

    max_stations = 6
    if body.constraints and body.constraints.max_stations is not None:
        max_stations = min(12, max(3, body.constraints.max_stations))
    stations = generate_stations(
        lat, lng, high_km, med_km, max_stations=max_stations,
        zones_geojson=zones_geojson, infra_nodes=infra_nodes_list,
    )
    route_dicts = generate_routes(lat, lng, high_km, stations)

    explanation = ExplanationOut(
        why_radii=explanation_zoning["why_radii"],
        key_factors=explanation_zoning["key_factors"],
        caveat=explanation_zoning["caveat"],
        plate_distance_km=grid_explanation.get("plate_distance_km"),
        plate_motion_source="MORVEL-style proxy (see UNAVCO for point velocities)" if motion_proxy is not None else None,
        density_method=grid_explanation.get("density_method"),
        infra_count=grid_explanation.get("infra_count"),
        similar_quakes_used=grid_explanation.get("similar_quakes_used"),
        notes=grid_explanation.get("notes"),
    )

    if damage_score > 75:
        priority_actions = [
            "Activate mass casualty triage and emergency medical response.",
            "Establish incident command and secure critical infrastructure.",
            "Deploy search and rescue to high-risk zone perimeter.",
            "Open shelters and direct evacuations from high-risk areas.",
            "Restore communications and coordinate with regional EOC.",
        ]
    else:
        priority_actions = [
            "Establish incident command and assess damage.",
            "Conduct structural inspections in medium-risk zone.",
            "Restore communications and power where safe.",
            "Coordinate with shelters and supply depots.",
            "Monitor aftershocks and update risk zones.",
        ]

    summary = (
        f"M{mag:.1f} event at {depth_km:.0f} km depth. "
        f"Damage score {damage_score}/100 (confidence: {confidence}). "
        f"{len(stations)} help stations and {len(route_dicts)} routes identified."
    )

    from datetime import datetime, timezone
    generated_at = datetime.now(timezone.utc).isoformat()

    return PlanResponse(
        zones=[ZoneOut(level=z["level"], radius_km=z["radius_km"], center=z["center"]) for z in zones],
        help_stations=[HelpStationOut(**s) for s in stations],
        routes=[RouteOut(name=r["name"], points=r["points"], reason=r["reason"]) for r in route_dicts],
        priority_actions=priority_actions,
        summary=summary,
        generated_at=generated_at,
        ai_summary=None,
        plate_distance_km=plate_km,
        damage_score=damage_score,
        confidence=confidence,
        explanation=explanation,
        plate_motion_proxy_mm_yr=motion_proxy,
        zones_geojson=zones_geojson,
        safe_points=safe_points_out,
        infra_nodes=[InfraNodeOut(name=n["name"], type=n["type"], lat=n["lat"], lng=n["lng"]) for n in infra_nodes_list],
    )


@router.post("/brief", response_model=BriefResponse)
def brief(body: BriefBody):
    from app.brief import generate_brief
    result = generate_brief(body.plan)
    if not result:
        raise HTTPException(
            status_code=503,
            detail="Brief unavailable. Set GEMINI_API_KEY to enable.",
        )
    summary, priority_actions, public_message = result
    return BriefResponse(
        summary=summary,
        priority_actions=priority_actions,
        public_message=public_message,
    )


@router.post("/voice", response_model=VoiceResponse)
def voice(body: VoiceBody):
    from app.settings import get_elevenlabs_api_key
    from app.voice import VoiceAPIError, text_to_speech_base64
    if not get_elevenlabs_api_key():
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY missing. Set it in backend/.env and restart.",
        )
    try:
        result = text_to_speech_base64(body.text)
    except VoiceAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    if not result:
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY missing.",
        )
    audio_b64, content_type = result
    return VoiceResponse(audio_base64=audio_b64, content_type=content_type)


@router.post("/assistant/triage", response_model=TriageResponse)
def assistant_triage(body: TriageBody):
    """Emergency triage: risk level, next steps, follow-up questions. Decision support only."""
    from app.settings import get_gemini_api_key
    from app.assistant import run_triage
    if not get_gemini_api_key():
        raise HTTPException(status_code=503, detail="Set GEMINI_API_KEY to enable assistant.")
    result = run_triage(
        situation_type=body.situation_type,
        user_notes=body.user_notes or "",
        lat=body.lat,
        lng=body.lng,
        quake_context=body.quake_context,
        answers_so_far=body.answers_so_far,
    )
    if not result:
        raise HTTPException(status_code=503, detail="Triage unavailable.")
    return TriageResponse(
        risk_level=result["risk_level"],
        next_steps=result.get("next_steps", []),
        questions=result.get("questions", []),
    )


@router.post("/assistant/summary", response_model=SummaryResponse)
def assistant_summary(body: SummaryBody):
    """Generate 911-ready script from triage + answers. Decision support only."""
    from app.settings import get_gemini_api_key
    from app.assistant import generate_911_summary
    if not get_gemini_api_key():
        raise HTTPException(status_code=503, detail="Set GEMINI_API_KEY to enable assistant.")
    script = generate_911_summary(
        situation_type=body.situation_type,
        risk_level=body.risk_level,
        user_notes=body.user_notes or "",
        location_text=body.location_text or "",
        answers=body.answers,
        num_people=body.num_people,
        best_access=body.best_access or "",
    )
    if not script:
        raise HTTPException(status_code=503, detail="Summary unavailable.")
    return SummaryResponse(script_911=script)


@router.post("/assistant/voice-intro", response_model=VoiceIntroResponse)
def assistant_voice_intro(body: VoiceIntroBody):
    """Generate a short spoken intro for the voice 911 assistant using live disaster data."""
    from app.settings import get_gemini_api_key
    from app.assistant import generate_voice_intro
    if not get_gemini_api_key():
        raise HTTPException(status_code=503, detail="Set GEMINI_API_KEY to enable voice assistant.")
    script = generate_voice_intro(
        quake_place=body.quake_place or "",
        quake_mag=body.quake_mag,
        depth_km=body.depth_km,
        plan_summary=body.plan_summary or "",
        priority_actions=body.priority_actions,
    )
    if not script:
        raise HTTPException(status_code=503, detail="Voice intro unavailable.")
    return VoiceIntroResponse(script=script)


@router.get("/chat/health")
def chat_health():
    """Return whether chat is configured (key loaded, model). Never exposes the key."""
    from app.settings import get_gemini_api_key
    from app.chat import GEMINI_MODEL
    key = get_gemini_api_key()
    return {
        "configured": bool(key),
        "key_loaded": bool(key),
        "model": GEMINI_MODEL,
    }


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatBody):
    from app.settings import get_gemini_api_key
    from app.chat import chat_with_disaster_context
    key = get_gemini_api_key()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Set GEMINI_API_KEY to enable chat.",
        )
    reply = chat_with_disaster_context(
        body.message,
        quake_place=body.quake_place,
        quake_mag=body.quake_mag,
        quake_depth_km=body.quake_depth_km,
        plan_summary=body.plan_summary,
        priority_actions=body.priority_actions,
        damage_score=body.damage_score,
        confidence=body.confidence,
    )
    if not reply:
        raise HTTPException(status_code=503, detail="Chat unavailable.")
    return ChatResponse(reply=reply)
