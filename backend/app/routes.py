from fastapi import APIRouter, HTTPException

from app.plates import distance_km_to_plate
from app.recommend import generate_routes, generate_stations
from app.schemas import (
    AnalyzeBody,
    AnalyzeResponse,
    ExplanationOut,
    PlanBody,
    PlanResponse,
    QuakeOut,
    ZoneOut,
    HelpStationOut,
)
from app.usgs import get_live_quake
from app.zoning import compute_zoning

router = APIRouter(prefix="/api")


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
    damage_score, zones, confidence, explanation = compute_zoning(
        mag, depth_km, plate_km, lat, lng
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
        explanation=ExplanationOut(**explanation),
    )


@router.post("/plan", response_model=PlanResponse)
def plan(body: PlanBody):
    from app.usgs import get_quake_by_id
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
    damage_score, zones, confidence, _ = compute_zoning(mag, depth_km, plate_km, lat, lng)
    high_km = next(z["radius_km"] for z in zones if z["level"] == "high")
    med_km = next(z["radius_km"] for z in zones if z["level"] == "medium")

    max_stations = 6
    if body.constraints and body.constraints.max_stations is not None:
        max_stations = min(12, max(3, body.constraints.max_stations))
    stations = generate_stations(lat, lng, high_km, med_km, max_stations=max_stations)
    route_geoms = generate_routes(lat, lng, high_km, stations)

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
        f"{len(stations)} help stations and {len(route_geoms)} routes identified."
    )

    from datetime import datetime, timezone
    generated_at = datetime.now(timezone.utc).isoformat()

    return PlanResponse(
        zones=[ZoneOut(level=z["level"], radius_km=z["radius_km"], center=z["center"]) for z in zones],
        help_stations=[HelpStationOut(**s) for s in stations],
        routes=route_geoms,
        priority_actions=priority_actions,
        summary=summary,
        generated_at=generated_at,
        ai_summary=None,
    )
