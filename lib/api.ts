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

function mapRoute(points: number[][], index: number, stations: Station[]): Route {
  const names = ["Epicenter to station", "Epicenter to station", "High zone patrol"];
  const waypoints = points.map(([lng, lat]) => ({ lat, lng }));
  const fromLabel = index === 2 ? "Epicenter" : "Epicenter";
  const toLabel = index < 2 && stations[index] ? stations[index].name : "High zone ring";
  return {
    id: `route-${index + 1}`,
    name: names[index] ?? `Route ${index + 1}`,
    from: fromLabel,
    to: toLabel,
    waypoints,
  };
}

interface PlanResponse {
  zones: ZoneOut[];
  help_stations: HelpStationOut[];
  routes: number[][][];
  priority_actions: string[];
  summary: string;
  generated_at: string;
}

export async function getLiveQuake(): Promise<QuakeEvent> {
  const data = await fetchApi<QuakeOut>("/api/quake/live");
  return mapQuake(data);
}

export async function generatePlan(quakeId: string): Promise<ResponsePlan> {
  const data = await fetchApi<PlanResponse>("/api/plan", {
    method: "POST",
    body: JSON.stringify({ quake_id: quakeId }),
  });
  const riskZones: RiskZone[] = data.zones.map((z, i) => mapZone(z, i));
  const stations: Station[] = data.help_stations.map((s, i) => mapStation(s, i));
  const routes: Route[] = data.routes.map((r, i) => mapRoute(r, i, stations));
  return {
    summary: data.summary,
    riskZones,
    stations,
    routes,
    priorityActions: data.priority_actions,
  };
}
