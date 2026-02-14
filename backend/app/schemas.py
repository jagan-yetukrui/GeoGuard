from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class QuakeOut(BaseModel):
    id: str
    place: str
    time: str
    mag: float
    depth_km: float
    lat: float
    lng: float


class ZoneOut(BaseModel):
    level: Literal["high", "medium", "low"]
    radius_km: float
    center: dict[str, float]


class ExplanationOut(BaseModel):
    why_radii: str
    key_factors: list[str]
    caveat: str


class AnalyzeBody(BaseModel):
    quake_id: str | None = None
    lat: float | None = None
    lng: float | None = None
    mag: float | None = None
    depth_km: float | None = None


class AnalyzeResponse(BaseModel):
    quake: QuakeOut
    plate_distance_km: float | None
    damage_score: int
    confidence: Literal["low", "medium", "high"]
    zones: list[ZoneOut]
    explanation: ExplanationOut


class HelpStationOut(BaseModel):
    name: str
    lat: float
    lng: float
    type: Literal["medical", "shelter", "comms", "supply"]
    reason: str


class PlanConstraints(BaseModel):
    max_stations: int | None = 6


class PlanBody(BaseModel):
    quake_id: str
    constraints: PlanConstraints | None = None


class PlanResponse(BaseModel):
    zones: list[ZoneOut]
    help_stations: list[HelpStationOut]
    routes: list[list[list[float]]]
    priority_actions: list[str]
    summary: str
    generated_at: str
    ai_summary: str | None = None
