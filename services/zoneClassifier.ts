import * as turf from "@turf/turf";
import type {
  EarthquakeEvent,
  InfrastructureNode,
  ZonePolygons,
  ClassificationResult,
  ClassifiedItem,
  RedZoneOutput,
  OrangeZoneOutput,
  GreenZoneOutput,
  ZoneKind,
  GeoJSONPolygon,
} from "./zoneClassifier.types";

const TOP_N = 5;

function toTurfPolygon(p: GeoJSONPolygon): turf.helpers.Polygon {
  return p as unknown as turf.helpers.Polygon;
}

function getZoneForPoint(lng: number, lat: number, zones: ZonePolygons): ZoneKind | null {
  const point = turf.point([lng, lat]);
  if (turf.booleanPointInPolygon(point, toTurfPolygon(zones.red))) return "red";
  if (turf.booleanPointInPolygon(point, toTurfPolygon(zones.orange))) return "orange";
  if (turf.booleanPointInPolygon(point, toTurfPolygon(zones.green))) return "green";
  return null;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const from = turf.point([lng1, lat1]);
  const to = turf.point([lng2, lat2]);
  return turf.distance(from, to, { units: "kilometers" });
}

function toClassifiedItem(n: InfrastructureNode, distance_km?: number): ClassifiedItem {
  return {
    id: n.id,
    name: n.name,
    type: n.type,
    latitude: n.latitude,
    longitude: n.longitude,
    building_density_score: n.building_density_score,
    structural_risk_score: n.structural_risk_score,
    distance_km,
  };
}

function rankAndTakeTop5(
  nodes: InfrastructureNode[],
  epicenterLat: number,
  epicenterLng: number,
  limit: number = TOP_N
): ClassifiedItem[] {
  if (nodes.length === 0) return [];
  const scored = nodes.map((node) => ({
    node,
    distanceKm: distanceKm(epicenterLat, epicenterLng, node.latitude, node.longitude),
  }));
  const maxDist = Math.max(...scored.map((x) => x.distanceKm), 1);
  scored.sort((a, b) => {
    const scoreA =
      (1 - a.node.structural_risk_score) * 0.4 +
      (1 - a.node.building_density_score) * 0.3 +
      (a.distanceKm / maxDist) * 0.3;
    const scoreB =
      (1 - b.node.structural_risk_score) * 0.4 +
      (1 - b.node.building_density_score) * 0.3 +
      (b.distanceKm / maxDist) * 0.3;
    return scoreB - scoreA;
  });
  return scored.slice(0, limit).map(({ node, distanceKm: d }) => toClassifiedItem(node, d));
}

const RED_OPEN_TYPES: InfrastructureNode["type"][] = [
  "park",
  "open_field",
  "playground",
  "stadium",
  "public_square",
];

const GREEN_OPEN_TYPES: InfrastructureNode["type"][] = [
  "park",
  "open_field",
  "playground",
  "stadium",
  "public_square",
];

export function classifyInfrastructureByZone(
  quake: EarthquakeEvent,
  zonePolygons: ZonePolygons,
  infrastructure: InfrastructureNode[]
): ClassificationResult {
  const epicenterLat = quake.latitude;
  const epicenterLng = quake.longitude;
  const byZone: Record<ZoneKind, InfrastructureNode[]> = {
    red: [],
    orange: [],
    green: [],
  };

  for (const node of infrastructure) {
    const zone = getZoneForPoint(node.longitude, node.latitude, zonePolygons);
    if (zone) byZone[zone].push(node);
  }

  const redOpen = byZone.red.filter((n) => RED_OPEN_TYPES.includes(n.type));
  const orangeHospitals = byZone.orange.filter((n) => n.type === "hospital");
  const greenOpen = byZone.green.filter((n) => GREEN_OPEN_TYPES.includes(n.type));
  const greenCamps = byZone.green.filter((n) => n.type === "camp");
  const greenHospitals = byZone.green.filter((n) => n.type === "hospital");

  return {
    quake_id: quake.quake_id,
    zones: {
      red: {
        open_areas: rankAndTakeTop5(redOpen, epicenterLat, epicenterLng),
      },
      orange: {
        hospitals: rankAndTakeTop5(orangeHospitals, epicenterLat, epicenterLng),
      },
      green: {
        open_areas: rankAndTakeTop5(greenOpen, epicenterLat, epicenterLng),
        camps: rankAndTakeTop5(greenCamps, epicenterLat, epicenterLng),
        hospitals: rankAndTakeTop5(greenHospitals, epicenterLat, epicenterLng),
      },
    },
  };
}

import { createGeoJSONCircle } from "../lib/mapUtils";

export const mockEarthquake: EarthquakeEvent = {
  quake_id: "mock-quake-1",
  latitude: 37.6542,
  longitude: -122.5134,
  magnitude: 6.2,
  depth: 10,
};

export const mockZonePolygons: ZonePolygons = {
  red: createGeoJSONCircle(
    { lat: mockEarthquake.latitude, lng: mockEarthquake.longitude },
    15 * 1000,
    32
  ),
  orange: createGeoJSONCircle(
    { lat: mockEarthquake.latitude, lng: mockEarthquake.longitude },
    40 * 1000,
    32
  ),
  green: createGeoJSONCircle(
    { lat: mockEarthquake.latitude, lng: mockEarthquake.longitude },
    70 * 1000,
    32
  ),
};

export const mockInfrastructure: InfrastructureNode[] = [
  { id: "1", name: "Central Park", type: "park", latitude: 37.68, longitude: -122.45, building_density_score: 0.2, structural_risk_score: 0.1 },
  { id: "2", name: "Riverside Field", type: "open_field", latitude: 37.66, longitude: -122.52, building_density_score: 0.0, structural_risk_score: 0.0 },
  { id: "3", name: "County General Hospital", type: "hospital", latitude: 37.72, longitude: -122.48, building_density_score: 0.7, structural_risk_score: 0.4 },
  { id: "4", name: "Evac Camp Alpha", type: "camp", latitude: 37.82, longitude: -122.35, building_density_score: 0.1, structural_risk_score: 0.05 },
  { id: "5", name: "Municipal Stadium", type: "stadium", latitude: 37.67, longitude: -122.5, building_density_score: 0.3, structural_risk_score: 0.25 },
  { id: "6", name: "City Square", type: "public_square", latitude: 37.77, longitude: -122.42, building_density_score: 0.4, structural_risk_score: 0.2 },
];

export function runExample(): ClassificationResult {
  return classifyInfrastructureByZone(mockEarthquake, mockZonePolygons, mockInfrastructure);
}
