export interface Coordinates {
  lat: number;
  lng: number;
}

export interface QuakeEvent {
  id: string;
  magnitude: number;
  depth: number; // km
  locationName: string;
  timestamp: string; // ISO
  coordinates: Coordinates;
}

export type RiskLevel = "high" | "medium" | "low";

export interface RiskZone {
  id: string;
  level: RiskLevel;
  label: string;
  description: string;
  radiusKm: number;
  bounds?: { ne: Coordinates; sw: Coordinates };
}

export type StationType = "hospital" | "supply" | "shelter" | "command";

export interface Station {
  id: string;
  name: string;
  type: StationType;
  coordinates: Coordinates;
  distanceKm?: number;
}

export interface Route {
  id: string;
  name: string;
  from: string;
  to: string;
  waypoints: Coordinates[];
  durationMinutes?: number;
  distanceKm?: number;
  category?: string; // hospital, shelter, fire_station, police
}

export interface PlanExplanation {
  why_radii: string;
  key_factors: string[];
  caveat: string;
  plate_distance_km?: number | null;
  density_method?: string | null;
  infra_count?: number | null;
  similar_quakes_used?: number | null;
  notes?: string | null;
}

export interface SafePoint {
  lat: number;
  lng: number;
  reason: string;
}

export interface InfraNode {
  name: string;
  type: string;
  lat: number;
  lng: number;
}

export interface ZonePoi {
  name: string;
  type: string;
  lat: number;
  lng: number;
  zoneLevel: "high" | "medium" | "low";
}

export interface ZonesGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { level: string };
    geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
  }>;
}

export interface ResponsePlan {
  summary: string;
  riskZones: RiskZone[];
  stations: Station[];
  routes: Route[];
  priorityActions: string[];
  plateDistanceKm?: number | null;
  damageScore?: number | null;
  confidence?: "low" | "medium" | "high" | null;
  explanation?: PlanExplanation | null;
  plateMotionProxyMmYr?: number | null;
  zonesGeoJSON?: ZonesGeoJSON | null;
  safePoints?: SafePoint[] | null;
  infraNodes?: InfraNode[] | null;
  zonePois?: { high: ZonePoi[]; medium: ZonePoi[]; low: ZonePoi[] } | null;
  userLocation?: { lat: number; lng: number } | null;
  hotspotsSummary?: string | null;
}
