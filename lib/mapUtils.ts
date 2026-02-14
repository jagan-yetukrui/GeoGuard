import type { Coordinates } from "./types";

/** GeoJSON Polygon (single ring, closed). */
export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: [number[][]];
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
