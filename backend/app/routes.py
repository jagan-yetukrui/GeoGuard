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
    ChatbotQueryBody,
    ChatbotResponse,
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
    from app.voice import text_to_speech_base64
    result = text_to_speech_base64(body.text)
    if not result:
        raise HTTPException(
            status_code=503,
            detail="Voice unavailable. Set ELEVENLABS_API_KEY to enable.",
        )
    audio_b64, content_type = result
    return VoiceResponse(audio_base64=audio_b64, content_type=content_type)

@router.post("/chat", response_model=ChatbotResponse)
def chat(body: ChatbotQueryBody):
    """
    Chatbot endpoint for general queries about current earthquake situation.
    Provides actionable suggestions based on damage assessment and response plan.
    
    Args:
        message: User's question or request
        quake_id: ID of the earthquake (optional, loads from cache)
        plan: Full response plan data (optional)
        chat_history: Previous messages for context (optional)
    
    Returns:
        ChatbotResponse with message, any errors, and quick actions if available
    """
    from app.chatbot import get_chatbot_response, get_emergency_suggestions
    from app.usgs import get_quake_by_id
    
    quake_data = None
    damage_score = None
    zones = None
    
    # Load quake context if ID provided
    if body.quake_id:
        q = get_quake_by_id(body.quake_id)
        if q:
            quake_data = {
                "id": q.get("id"),
                "place": q.get("place"),
                "time": q.get("time"),
                "mag": q.get("mag"),
                "depth_km": q.get("depth_km"),
                "lat": q.get("lat"),
                "lng": q.get("lng"),
            }
    
    # Extract plan context
    plan_data = body.plan
    if plan_data:
        damage_score = plan_data.get("damage_score")
        zones = plan_data.get("zones", [])
        if not zones:
            # Build zones from zones_geojson if available
            geojson = plan_data.get("zones_geojson")
            if geojson and "features" in geojson:
                zones = [
                    {
                        "level": f.get("properties", {}).get("level", "unknown"),
                        "radius_km": f.get("properties", {}).get("radius_km", 0),
                    }
                    for f in geojson["features"]
                ]
    
    # Convert chat_history to dict format for chatbot
    chat_history = None
    if body.chat_history:
        chat_history = [{"role": m.role, "content": m.content} for m in body.chat_history]
    
    # Get AI response
    response_text, error = get_chatbot_response(
        user_message=body.message,
        quake_data=quake_data,
        plan_data=plan_data,
        damage_score=damage_score,
        zones=zones,
        chat_history=chat_history,
    )
    
    # Get quick actions if high severity
    quick_actions = None
    if damage_score and damage_score > 5:
        severity = "critical" if damage_score > 7 else "high"
        quick_actions = get_emergency_suggestions(severity=severity, quake_data=quake_data)[:3]
    
    return ChatbotResponse(
        message=response_text if not error else "I'm having trouble processing your request. Try: Check your location, Follow marked routes, or Contact emergency services.",
        error=error,
        quick_actions=quick_actions,
    )