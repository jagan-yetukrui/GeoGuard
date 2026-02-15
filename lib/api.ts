import type {
  QuakeEvent,
  ResponsePlan,
  RiskZone,
  Station,
  Route,
} from "./types";

const DEFAULT_BASE = "http://localhost:8000";

export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE;
}

async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const base = getBaseUrl().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        message = typeof body.detail === "string" ? body.detail : body.detail[0]?.msg ?? message;
      }
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

interface QuakeOut {
  id: string;
  place: string;
  time: string;
  mag: number;
  depth_km: number;
  lat: number;
  lng: number;
}

function mapQuake(q: QuakeOut): QuakeEvent {
  return {
    id: q.id,
    magnitude: q.mag,
    depth: q.depth_km,
    locationName: q.place,
    timestamp: q.time || new Date().toISOString(),
    coordinates: { lat: q.lat, lng: q.lng },
  };
}

interface ZoneOut {
  level: "high" | "medium" | "low";
  radius_km: number;
  center: { lat: number; lng: number };
}

interface HelpStationOut {
  name: string;
  lat: number;
  lng: number;
  type: "medical" | "shelter" | "comms" | "supply";
  reason: string;
}

const STATION_TYPE_MAP: Record<string, "hospital" | "supply" | "shelter" | "command"> = {
  medical: "hospital",
  shelter: "shelter",
  comms: "command",
  supply: "supply",
};

function mapZone(z: ZoneOut, index: number): RiskZone {
  const labels: Record<string, string> = {
    high: "Epicenter radius",
    medium: "Strong shaking",
    low: "Felt area",
  };
  const descriptions: Record<string, string> = {
    high: `Within ${z.radius_km} km of epicenter. Structural damage likely.`,
    medium: `Up to ${z.radius_km} km. Non-structural damage possible.`,
    low: `Up to ${z.radius_km} km. Light shaking, minimal impact.`,
  };
  return {
    id: `zone-${index + 1}`,
    level: z.level,
    label: labels[z.level] ?? z.level,
    description: descriptions[z.level] ?? "",
    radiusKm: z.radius_km,
  };
}

function mapStation(s: HelpStationOut, index: number): Station {
  const type = STATION_TYPE_MAP[s.type] ?? "supply";
  return {
    id: `st-${index + 1}`,
    name: s.name,
    type,
    coordinates: { lat: s.lat, lng: s.lng },
  };
}

function mapRoute(r: RouteOut, index: number): Route {
  const waypoints = (r.points ?? []).map(([lng, lat]) => ({ lat, lng }));
  return {
    id: `route-${index + 1}`,
    name: r.name ?? `Route ${index + 1}`,
    from: "Epicenter",
    to: waypoints.length > 1 ? "Station" : "Waypoint",
    waypoints,
    category: r.category ?? undefined,
  };
}

interface ExplanationOut {
  why_radii: string;
  key_factors: string[];
  caveat: string;
}

interface RouteOut {
  name: string;
  points: number[][];
  reason: string;
  category?: string | null;
}

interface SafePointOut {
  lat: number;
  lng: number;
  reason: string;
}

interface InfraNodeOut {
  name: string;
  type: string;
  lat: number;
  lng: number;
}

interface ZonePoiOut {
  name: string;
  type: string;
  lat: number;
  lng: number;
  zone_level: "high" | "medium" | "low";
}

interface PlanResponse {
  zones: ZoneOut[];
  help_stations: HelpStationOut[];
  routes: RouteOut[];
  priority_actions: string[];
  summary: string;
  generated_at: string;
  plate_distance_km?: number | null;
  damage_score?: number | null;
  confidence?: "low" | "medium" | "high" | null;
  explanation?: ExplanationOut | null;
  plate_motion_proxy_mm_yr?: number | null;
  zones_geojson?: unknown | null;
  safe_points?: SafePointOut[] | null;
  infra_nodes?: InfraNodeOut[] | null;
  zone_pois?: { high: ZonePoiOut[]; medium: ZonePoiOut[]; low: ZonePoiOut[] } | null;
  user_location?: { lat: number; lng: number } | null;
  hotspots_summary?: string | null;
}

export async function getLiveQuake(): Promise<QuakeEvent> {
  const data = await fetchApi<QuakeOut>("/api/quake/live");
  return mapQuake(data);
}

/** Latest N quakes from same USGS feed as live (newest first). */
export async function getLatestQuakes(limit: number = 5): Promise<QuakeEvent[]> {
  const list = await fetchApi<QuakeOut[]>(`/api/quake/list?limit=${Math.min(20, Math.max(1, limit))}`);
  return list.map((q) => mapQuake(q));
}

export async function generatePlan(quakeId: string): Promise<ResponsePlan> {
  const data = await fetchApi<PlanResponse>("/api/plan", {
    method: "POST",
    body: JSON.stringify({ quake_id: quakeId }),
  });
  const riskZones: RiskZone[] = data.zones.map((z, i) => mapZone(z, i));
  const stations: Station[] = data.help_stations.map((s, i) => mapStation(s, i));
  const routes: Route[] = (data.routes ?? []).map((r, i) => mapRoute(r, i));
  return {
    summary: data.summary,
    riskZones,
    stations,
    routes,
    priorityActions: data.priority_actions ?? [],
    plateDistanceKm: data.plate_distance_km ?? undefined,
    damageScore: data.damage_score ?? undefined,
    confidence: data.confidence ?? undefined,
    explanation: data.explanation ?? undefined,
    plateMotionProxyMmYr: data.plate_motion_proxy_mm_yr ?? undefined,
    zonesGeoJSON: (data.zones_geojson as ResponsePlan["zonesGeoJSON"]) ?? undefined,
    safePoints: data.safe_points ?? undefined,
    infraNodes: data.infra_nodes ?? undefined,
    zonePois: data.zone_pois
      ? {
          high: data.zone_pois.high.map((p) => ({ name: p.name, type: p.type, lat: p.lat, lng: p.lng, zoneLevel: p.zone_level })),
          medium: data.zone_pois.medium.map((p) => ({ name: p.name, type: p.type, lat: p.lat, lng: p.lng, zoneLevel: p.zone_level })),
          low: data.zone_pois.low.map((p) => ({ name: p.name, type: p.type, lat: p.lat, lng: p.lng, zoneLevel: p.zone_level })),
        }
      : undefined,
    userLocation: data.user_location ?? undefined,
    hotspotsSummary: data.hotspots_summary ?? undefined,
  };
}

export interface BriefResponse {
  summary: string;
  priority_actions: string[];
  public_message: string;
}

export async function getBrief(plan: {
  summary?: string;
  priority_actions?: string[];
  damage_score?: number;
}): Promise<BriefResponse> {
  return fetchApi<BriefResponse>("/api/brief", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export interface VoiceResponse {
  audio_base64: string;
  content_type: string;
}

export async function getVoice(text: string): Promise<VoiceResponse> {
  return fetchApi<VoiceResponse>("/api/voice", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export interface ChatContext {
  quake_place?: string;
  quake_mag?: number;
  quake_depth_km?: number;
  plan_summary?: string;
  priority_actions?: string[];
  damage_score?: number;
  confidence?: string;
}

export interface ChatResponse {
  reply: string;
}

export async function getChatResponse(
  message: string,
  context?: ChatContext
): Promise<ChatResponse> {
  return fetchApi<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      quake_place: context?.quake_place,
      quake_mag: context?.quake_mag,
      quake_depth_km: context?.quake_depth_km,
      plan_summary: context?.plan_summary,
      priority_actions: context?.priority_actions,
      damage_score: context?.damage_score,
      confidence: context?.confidence,
    }),
  });
}

export type TriageRiskLevel = "critical" | "urgent" | "stable";

export interface TriageResponse {
  risk_level: TriageRiskLevel;
  next_steps: string[];
  questions: string[];
}

export async function getTriage(params: {
  situation_type: string;
  user_notes?: string;
  lat?: number;
  lng?: number;
  quake_context?: string;
  answers_so_far?: Record<string, string>;
}): Promise<TriageResponse> {
  return fetchApi<TriageResponse>("/api/assistant/triage", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface AssistantSummaryResponse {
  script_911: string;
}

export async function get911Summary(params: {
  situation_type: string;
  risk_level: string;
  user_notes?: string;
  location_text?: string;
  answers?: Record<string, string>;
  num_people?: number;
  best_access?: string;
}): Promise<AssistantSummaryResponse> {
  return fetchApi<AssistantSummaryResponse>("/api/assistant/summary", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface VoiceIntroResponse {
  script: string;
}

export async function getVoiceIntro(params: {
  quake_place?: string;
  quake_mag?: number;
  depth_km?: number;
  plan_summary?: string;
  priority_actions?: string[];
}): Promise<VoiceIntroResponse> {
  return fetchApi<VoiceIntroResponse>("/api/assistant/voice-intro", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Patriot AI prompt IDs from Emergency_response_prompt.json */
export type PatriotPromptId = "situation_summary" | "responder_role_assignment";

export interface PatriotAssistResponse {
  title: string;
  summary: string;
  steps: string[];
  warnings: string[];
  do_now: string[];
  confidence: "low" | "medium" | "high";
  sources_used: string[];
  scripts?: Record<string, string>;
  checklists?: Array<{ title: string; items: string[] }>;
}

export async function patriotAssist(
  promptId: PatriotPromptId | string,
  context: Record<string, unknown>
): Promise<PatriotAssistResponse> {
  return fetchApi<PatriotAssistResponse>("/api/patriot/assist", {
    method: "POST",
    body: JSON.stringify({ prompt_id: promptId, context }),
  });
}

export interface CommTemplate {
  id: string;
  title: string;
  channel: string;
  audience: string;
  priority: string;
}

export async function getCommTemplates(): Promise<CommTemplate[]> {
  return fetchApi<CommTemplate[]>("/api/communications/templates");
}

export interface CommGenerateResponse {
  template_id: string;
  message: string;
  channel: string;
  audience: string;
  priority: string;
}

export async function generateCommMessage(
  templateId: string,
  context: Record<string, string>
): Promise<CommGenerateResponse> {
  return fetchApi<CommGenerateResponse>("/api/communications/generate", {
    method: "POST",
    body: JSON.stringify({ template_id: templateId, context }),
  });
}

export interface ResourceCalculateResponse {
  resources_required: Record<string, number>;
  main_needs?: string[];
  secondary_needs?: string[];
  resources_available_proxy: Record<string, string | number>;
  shortages: Record<string, boolean>;
  recommended_actions: string[];
  deployment_priority: string[];
  confidence: "low" | "medium" | "high";
  uncertainty_notes: string;
  population_estimated?: number;
  area_km2?: number;
  population_density_people_per_km2?: number;
}

export async function calculateResources(params: {
  zoneType: string;
  geometry: { bbox?: number[]; coordinates?: unknown; type?: string };
  time_since_event_minutes?: number;
  vulnerability?: Record<string, number>;
}): Promise<ResourceCalculateResponse> {
  return fetchApi<ResourceCalculateResponse>("/api/resources/calculate", {
    method: "POST",
    body: JSON.stringify({
      zoneType: params.zoneType,
      geometry: params.geometry,
      time_since_event_minutes: params.time_since_event_minutes ?? 0,
      vulnerability: params.vulnerability,
    }),
  });
}
