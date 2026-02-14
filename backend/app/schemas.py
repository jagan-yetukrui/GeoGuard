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
    plate_distance_km: float | None = None
    plate_motion_source: str | None = None  # e.g. "MORVEL-style proxy (see UNAVCO for point velocities)"
    density_method: str | None = None
    infra_count: int | None = None
    similar_quakes_used: int | None = None
    notes: str | None = None


class SafePointOut(BaseModel):
    lat: float
    lng: float
    reason: str


class InfraNodeOut(BaseModel):
    name: str
    type: str
    lat: float
    lng: float


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


class RouteOut(BaseModel):
    name: str
    points: list[list[float]]  # [[lng, lat], ...]
    reason: str


class PlanConstraints(BaseModel):
    max_stations: int | None = 6


class PlanBody(BaseModel):
    quake_id: str
    constraints: PlanConstraints | None = None


class BriefBody(BaseModel):
    plan: dict[str, Any]  # summary, damage_score, priority_actions, etc.


class BriefResponse(BaseModel):
    summary: str
    priority_actions: list[str]
    public_message: str


class VoiceBody(BaseModel):
    text: str


class VoiceResponse(BaseModel):
    audio_base64: str
    content_type: str = "audio/mpeg"


class PlanResponse(BaseModel):
    zones: list[ZoneOut]
    help_stations: list[HelpStationOut]
    routes: list[RouteOut]
    priority_actions: list[str]
    summary: str
    generated_at: str
    ai_summary: str | None = None
    plate_distance_km: float | None = None
    damage_score: int | None = None
    confidence: Literal["low", "medium", "high"] | None = None
    explanation: ExplanationOut | None = None
    plate_motion_proxy_mm_yr: float | None = None
    zones_geojson: dict[str, Any] | None = None
    safe_points: list[SafePointOut] | None = None
    infra_nodes: list[InfraNodeOut] | None = None

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatbotQueryBody(BaseModel):
    message: str
    quake_id: str | None = None
    plan: dict[str, Any] | None = None
    chat_history: list[ChatMessage] | None = None


class ChatbotResponse(BaseModel):
    message: str
    error: str | None = None
    quick_actions: list[str] | None = None


class VoiceInputBody(BaseModel):
    audio_base64: str
    context: str | None = None


class VoiceInputResponse(BaseModel):
    transcribed_text: str
    error: str | None = None