from fastapi import APIRouter, HTTPException

from app.plates import (
    distance_km_to_plate,
    get_boundaries_geojson,
    plate_motion_proxy_mm_yr as get_plate_motion_proxy,
)
from app.recommend import generate_routes, generate_stations
from app.safe_routes import (
    find_nearest_shelter,
    generate_routes_by_category_with_roads,
    get_demo_user_location,
)
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
    ZonePoiOut,
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
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from app.usgs import get_quake_by_id
    from app.historical import find_similar_quakes
    from app.grid import compute_risk_grid, RESOLUTION_KM, _cell_centers
    from app.circularize import circular_zones_geojson
    from app.overpass import fetch_infra_nodes, get_density_proxy
    from app.places import fetch_places_infra

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

    # Run Overpass, Google Places, and historical in parallel
    infra_nodes_list: list = []
    infra_ok = False
    places_list: list = []
    places_ok = False
    similar: list = []
    with ThreadPoolExecutor(max_workers=3) as ex:
        f_infra = ex.submit(fetch_infra_nodes, lat, lng)
        f_places = ex.submit(fetch_places_infra, lat, lng, 50.0)
        f_similar = ex.submit(find_similar_quakes, lat, lng, mag, depth_km, plate_km, 5)
        infra_nodes_list, infra_ok = f_infra.result()
        places_list, places_ok = f_places.result()
        similar = f_similar.result()

    if places_ok and places_list:
        seen = {(round(n["lat"], 5), round(n["lng"], 5)) for n in infra_nodes_list}
        for p in places_list:
            if p.get("type") in ("hospital", "fire_station", "police", "shelter"):
                key = (round(p["lat"], 5), round(p["lng"], 5))
                if key not in seen:
                    seen.add(key)
                    infra_nodes_list.append({"name": p["name"], "type": p["type"], "lat": p["lat"], "lng": p["lng"]})
        infra_nodes_list.sort(key=lambda n: (n["lat"], n["lng"]))
    from app.landmask import filter_land_points
    from app.utils import dedupe_medical_same_location, dedupe_by_name_and_location
    infra_nodes_list = dedupe_medical_same_location(infra_nodes_list)
    infra_nodes_list = dedupe_by_name_and_location(infra_nodes_list)
    infra_nodes_list = filter_land_points(infra_nodes_list, lat_key="lat", lng_key="lng")
    infra_count = len(infra_nodes_list)
    density_proxy = get_density_proxy(lat, lng, infra_nodes_list)
    # Skip density_per_cell (2 Overpass calls) for speed; use proxy only
    density_per_cell = None
    density_method = ""
    if not infra_ok:
        grid_explanation_note = "infra unavailable (Overpass failed)"
    else:
        grid_explanation_note = None
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

    zones, explanation_zoning = _plan_zoning_fallback(mag, depth_km, plate_km, lat, lng, motion_proxy)
    high_km = next(z["radius_km"] for z in zones if z["level"] == "high")
    med_km = next(z["radius_km"] for z in zones if z["level"] == "medium")
    low_km = next(z["radius_km"] for z in zones if z["level"] == "low")

    zones_geojson = circular_zones_geojson(lat, lng, high_km, med_km, low_km)
    # Only real locations are shown; grid-derived safe points are not real POIs, so return none
    safe_points_out: list[SafePointOut] = []

    # Filter infra and places to within green zone (low_km) only
    from app.utils import add_nearest_fallback_infra, haversine_km
    infra_nodes_all = infra_nodes_list
    infra_nodes_list = [n for n in infra_nodes_list if haversine_km(lat, lng, n["lat"], n["lng"]) <= low_km]
    # When a category (hospital, fire_station, police, shelter) has none in zone, add nearest 2 from outside
    infra_nodes_list = add_nearest_fallback_infra(
        infra_nodes_list, infra_nodes_all, lat, lng, low_km, per_category=2
    )
    places_list = [p for p in places_list if haversine_km(lat, lng, p["lat"], p["lng"]) <= low_km]

    zone_pois_dict: dict[str, list[ZonePoiOut]] | None = None
    try:
        from app.zone_pois import compute_zone_pois
        raw_zone_pois = compute_zone_pois(
            zones_geojson, lat, lng, high_km, med_km, low_km,
            pre_fetched_infra=infra_nodes_list,
            pre_fetched_places=places_list,
        )
        zone_pois_dict = {
            level: [ZonePoiOut(name=p["name"], type=p["type"], lat=p["lat"], lng=p["lng"], zone_level=level) for p in raw_zone_pois[level]]
            for level in ("high", "medium", "low")
        }
    except Exception:
        zone_pois_dict = None

    max_stations = 6
    if body.constraints and body.constraints.max_stations is not None:
        max_stations = min(12, max(3, body.constraints.max_stations))
    stations = generate_stations(
        lat, lng, high_km, med_km, max_stations=max_stations,
        zones_geojson=zones_geojson, infra_nodes=infra_nodes_list,
    )
    route_dicts = generate_routes(lat, lng, high_km, stations)

    # Compute hotspots before route generation (for safest-destination scoring)
    hotspots_cells_list: list = []
    hotspots_summary_str: str | None = None
    hotspots_polygons_list: list = []
    hotspots_debug = False
    try:
        from app.hotspots import compute_hotspot_grid, hotspot_cells_to_polygons
        from app.settings import settings
        hotspots_cells_list, hotspots_summary_str = compute_hotspot_grid(
            lat, lng, high_km, med_km, infra_nodes_list
        )
        hotspots_debug = getattr(settings, "hotspots_debug", False)
        if hotspots_cells_list and hotspots_debug:
            hotspots_polygons_list = hotspot_cells_to_polygons(hotspots_cells_list)
    except Exception:
        pass

    # Always use demo location; generate category routes (hospital, shelter, fire_station, police)
    demo_user_lat, demo_user_lng = get_demo_user_location(lat, lng, high_km)
    user_location_out = {"lat": demo_user_lat, "lng": demo_user_lng}
    category_routes = generate_routes_by_category_with_roads(
        demo_user_lat, demo_user_lng, infra_nodes_list, hotspots_cells_list
    )
    for r in category_routes:
        r["reason"] = "[DEMO LOCATION] " + r["reason"]
        route_dicts.append(r)
    demo_nearest_shelter = find_nearest_shelter(
        demo_user_lat, demo_user_lng, stations
    )
    safe_points_out.append(
        SafePointOut(
            lat=demo_user_lat,
            lng=demo_user_lng,
            reason=(
                f"Simulated user location in red zone, {demo_nearest_shelter['distance_km']}km from {demo_nearest_shelter['name']}"
                if demo_nearest_shelter
                else "Simulated user location in red zone"
            ),
        )
    )

    explanation_notes = grid_explanation.get("notes") or ""
    if len(stations) == 0:
        explanation_notes = (explanation_notes + " No real help stations (hospitals, shelters, etc.) found on land in this area—check zone POIs or expand search.").strip()

    explanation = ExplanationOut(
        why_radii=explanation_zoning["why_radii"],
        key_factors=explanation_zoning["key_factors"],
        caveat=explanation_zoning["caveat"],
        plate_distance_km=grid_explanation.get("plate_distance_km"),
        plate_motion_source="MORVEL-style proxy (see UNAVCO for point velocities)" if motion_proxy is not None else None,
        density_method=grid_explanation.get("density_method"),
        infra_count=grid_explanation.get("infra_count"),
        similar_quakes_used=grid_explanation.get("similar_quakes_used"),
        notes=explanation_notes or None,
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

    # Exclude from infra_nodes any that appear in zone_pois (avoid duplicate markers on map)
    infra_for_response = infra_nodes_list
    if zone_pois_dict:
        zone_poi_coords = set()
        for level in ("high", "medium", "low"):
            for p in zone_pois_dict.get(level, []):
                zone_poi_coords.add((round(p.lat, 5), round(p.lng, 5)))
        infra_for_response = [
            n for n in infra_nodes_list
            if (round(n["lat"], 5), round(n["lng"], 5)) not in zone_poi_coords
        ]

    return PlanResponse(
        zones=[ZoneOut(level=z["level"], radius_km=z["radius_km"], center=z["center"]) for z in zones],
        help_stations=[HelpStationOut(**s) for s in stations],
        routes=[
            RouteOut(
                name=r["name"],
                points=r["points"],
                reason=r["reason"],
                category=r.get("category"),
            )
            for r in route_dicts
        ],
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
        infra_nodes=[InfraNodeOut(name=n["name"], type=n["type"], lat=n["lat"], lng=n["lng"]) for n in infra_for_response],
        zone_pois=zone_pois_dict,
        user_location=user_location_out,
        hotspots_summary=hotspots_summary_str,
        hotspots_cells=hotspots_cells_list if hotspots_debug else None,
        hotspots_polygons=hotspots_polygons_list if hotspots_debug else None,
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
        raise HTTPException(
            status_code=503,
            detail="Set GEMINI_API_KEY and ELEVENLABS_API_KEY in backend/.env to enable voice assistant.",
        )
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
