import type { Coordinates } from "./types";

/** Great-circle distance in km between two points (WGS84). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** GeoJSON Polygon (single ring, closed). */
export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: [number[][]];
}

/** Bounding box in degrees (south, north, west, east). */
export interface LatLngBbox {
  south: number;
  north: number;
  west: number;
  east: number;
}

/** Bounding box around a point with given radius in km. */
export function bboxAround(
  lat: number,
  lng: number,
  radiusKm: number
): LatLngBbox {
  const degPerKmLat = 1 / 111;
  const degPerKmLng = 1 / (111 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  const dLat = radiusKm * degPerKmLat;
  const dLng = radiusKm * degPerKmLng;
  return {
    south: lat - dLat,
    north: lat + dLat,
    west: lng - dLng,
    east: lng + dLng,
  };
}

/** True if (lat, lng) is inside bbox. */
function pointInBbox(lat: number, lng: number, b: LatLngBbox): boolean {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

/** True if any vertex of the GeoJSON geometry is inside the bbox. */
export function geoJSONFeatureIntersectsBbox(
  feature: GeoJSON.Feature,
  bbox: LatLngBbox
): boolean {
  const g = feature.geometry;
  if (!g || g.type === "Point") return false;
  if (g.type === "LineString") {
    return g.coordinates.some((c) => pointInBbox(c[1], c[0], bbox));
  }
  if (g.type === "MultiLineString") {
    return g.coordinates.some((part) =>
      part.some((c) => pointInBbox(c[1], c[0], bbox))
    );
  }
  return false;
}

/** Filter GeoJSON FeatureCollection to features intersecting the bbox. */
export function clipGeoJSONToBbox(
  fc: GeoJSON.FeatureCollection,
  bbox: LatLngBbox
): GeoJSON.FeatureCollection {
  const features = (fc.features || []).filter((f) =>
    geoJSONFeatureIntersectsBbox(f, bbox)
  );
  return { type: "FeatureCollection", features };
}

/**
 * Converts radius in km to meters.
 */
export function radiusKmToMeters(km: number): number {
  return km * 1000;
}

/**
 * Creates a GeoJSON Polygon approximating a circle.
 * Ring is in GeoJSON order: [lng, lat], closed (first point = last point).
 */
export function createGeoJSONCircle(
  center: Coordinates,
  radiusMeters: number,
  numPoints = 64
): GeoJSONPolygon {
  const { lat, lng } = center;
  const points: number[][] = [];
  const latRad = (lat * Math.PI) / 180;
  const angularDistance = radiusMeters / 6371000;

  for (let i = 0; i <= numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(angle)
    );
    const pointLng =
      lng +
      (180 / Math.PI) *
        Math.atan2(
          Math.sin(angle) * Math.sin(angularDistance) * Math.cos(latRad),
          Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(pointLat)
        );
    points.push([pointLng, (pointLat * 180) / Math.PI]);
  }

  return {
    type: "Polygon",
    coordinates: [points],
  };
}
