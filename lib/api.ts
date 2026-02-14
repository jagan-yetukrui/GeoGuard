import type {
  QuakeEvent,
  ResponsePlan,
  RiskZone,
  Station,
  Route,
  ChatMessage,
  ChatbotResponse,
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
export async function chatWithBot(
  message: string,
  quakeId?: string,
  plan?: ResponsePlan,
  chatHistory?: ChatMessage[]
): Promise<ChatbotResponse> {
  // Convert plan to backend format if available
  const planData = plan
    ? {
        summary: plan.summary,
        damage_score: plan.damageScore,
        priority_actions: plan.priorityActions,
        zones: plan.riskZones?.map((z) => ({
          level: z.level,
          radius_km: z.radiusKm,
        })),
        help_stations: plan.stations?.map((s) => ({
          name: s.name,
          type: s.type,
          lat: s.coordinates.lat,
          lng: s.coordinates.lng,
        })),
        zones_geojson: plan.zonesGeoJSON,
      }
    : undefined;

  return fetchApi<ChatbotResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      quake_id: quakeId,
      plan: planData,
      chat_history: chatHistory?.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });
}