/** GeoJSON Polygon (single ring, closed). Coordinates in [lng, lat] order. */
export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: [number[][]];
}

export interface EarthquakeEvent {
  quake_id: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depth: number;
}

export type InfrastructureType =
  | "hospital"
  | "park"
  | "school"
  | "stadium"
  | "parking_lot"
  | "open_field"
  | "government_building"
  | "camp"
  | "clinic"
  | "playground"
  | "public_square";

export interface InfrastructureNode {
  id: string;
  name: string;
  type: InfrastructureType;
  latitude: number;
  longitude: number;
  building_density_score: number;
  structural_risk_score: number;
}

export interface ZonePolygons {
  red: GeoJSONPolygon;
  orange: GeoJSONPolygon;
  green: GeoJSONPolygon;
}

export interface ClassifiedItem {
  id: string;
  name: string;
  type: InfrastructureType;
  latitude: number;
  longitude: number;
  building_density_score?: number;
  structural_risk_score?: number;
  distance_km?: number;
}

export interface RedZoneOutput {
  open_areas: ClassifiedItem[];
}

export interface OrangeZoneOutput {
  hospitals: ClassifiedItem[];
}

export interface GreenZoneOutput {
  open_areas: ClassifiedItem[];
  camps: ClassifiedItem[];
  hospitals: ClassifiedItem[];
}

export interface ClassificationResult {
  quake_id: string;
  zones: {
    red: RedZoneOutput;
    orange: OrangeZoneOutput;
    green: GreenZoneOutput;
  };
}

export type ZoneKind = "red" | "orange" | "green";
