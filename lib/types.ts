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
}

export interface ResponsePlan {
  summary: string;
  riskZones: RiskZone[];
  stations: Station[];
  routes: Route[];
  priorityActions: string[];
}
