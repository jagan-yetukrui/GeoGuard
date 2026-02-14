"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type L from "leaflet";
import "leaflet/dist/leaflet.css";
import type {
  QuakeEvent,
  RiskZone,
  Station,
  Route,
  ZonesGeoJSON,
  SafePoint,
  InfraNode,
  ZonePoi,
} from "@/lib/types";
import {
  radiusKmToMeters,
  bboxAround,
  clipGeoJSONToBbox,
} from "@/lib/mapUtils";

export type MapViewProps = {
  quake: QuakeEvent;
  zones: RiskZone[];
  stations: Station[];
  routes: Route[];
  showPlan: boolean;
  zonesGeoJSON?: ZonesGeoJSON | null;
  safePoints?: SafePoint[] | null;
  infraNodes?: InfraNode[] | null;
  zonePois?: { high: ZonePoi[]; medium: ZonePoi[]; low: ZonePoi[] } | null;
};

const ZONE_COLORS: Record<
  string,
  { fill: string; fillOpacity: number; line: string; weight: number }
> = {
  high: {
    fill: "#ef4444",
    fillOpacity: 0.15,
    line: "rgba(239, 68, 68, 0.6)",
    weight: 2,
  },
  medium: {
    fill: "#f59e0b",
    fillOpacity: 0.15,
    line: "rgba(245, 158, 11, 0.6)",
    weight: 2,
  },
  low: {
    fill: "#10b981",
    fillOpacity: 0.15,
    line: "rgba(16, 185, 129, 0.6)",
    weight: 2,
  },
};

const STATION_TYPE_LABELS: Record<string, string> = {
  hospital: "Hospital",
  clinic: "Clinic",
  ambulance: "Ambulance",
  fire_station: "Fire station",
  police: "Police",
  shelter: "Shelter",
  park: "Park",
  open_area: "Open area",
  supply: "Supply depot",
  command: "Command post",
  medical: "Medical",
};

const ZONE_POI_TYPE_LABELS: Record<string, string> = {
  hospital: "Hospital",
  shelter: "Shelter",
  park: "Park",
  open_area: "Open area",
};

const ZONE_POI_ZONE_LABELS: Record<string, string> = {
  high: "Red zone",
  medium: "Yellow zone",
  low: "Green zone",
};

/** Lucide-style outline SVG paths (24x24 viewBox). */
const LOCATION_TYPE_ICONS: Record<string, string> = {
  hospital:
    '<path d="M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a1 1 0 0 1 1 1v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a1 1 0 0 1-1-1V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a1 1 0 0 1-1 1z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  clinic:
    '<path d="M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a1 1 0 0 1 1 1v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a1 1 0 0 1-1-1V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a1 1 0 0 1-1 1z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  ambulance:
    '<path d="M10 8h4M10 12h4M8 16h8M6 20h12l2-4V10l-2-2h-4V6H8L6 8v8z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  fire_station:
    '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  police:
    '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="17" r="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 17h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="17" r="2" stroke="currentColor" stroke-width="2" fill="none"/>',
  shelter:
    '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  park:
    '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  open_area:
    '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="1" stroke="currentColor" stroke-width="2" fill="none"/>',
  medical:
    '<path d="M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a1 1 0 0 1 1 1v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a1 1 0 0 1-1-1V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a1 1 0 0 1-1 1z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  supply:
    '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="3.29 7 12 12 20.71 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  command:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

const DEFAULT_LOCATION_ICON =
  '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

/** Glow color per location type (outline + soft glow, no boxes). */
const TYPE_GLOW_COLORS: Record<string, string> = {
  hospital: "#eab308",
  clinic: "#10b981",
  ambulance: "#dc2626",
  fire_station: "#ef4444",
  police: "#3b82f6",
  shelter: "#f97316",
  park: "#22c55e",
  open_area: "#14b8a6",
  medical: "#eab308",
  supply: "#64748b",
  command: "#8b5cf6",
};

const DEFAULT_GLOW = "#64748b";

function getIconForType(type: string): string {
  const key = (type || "").toLowerCase().replace(/\s+/g, "_");
  return LOCATION_TYPE_ICONS[key] ?? LOCATION_TYPE_ICONS[key.replace(/-/g, "_")] ?? DEFAULT_LOCATION_ICON;
}

function getGlowColorForType(type: string): string {
  const key = (type || "").toLowerCase().replace(/\s+/g, "_");
  return TYPE_GLOW_COLORS[key] ?? TYPE_GLOW_COLORS[key.replace(/-/g, "_")] ?? DEFAULT_GLOW;
}

function createZonePoiMarkerElement(zoneLevel: "high" | "medium" | "low", type: string): HTMLDivElement {
  const color = getGlowColorForType(type);
  const icon = getIconForType(type);
  const el = document.createElement("div");
  el.className = "zone-poi-marker";
  el.style.width = "28px";
  el.style.height = "28px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.filter = `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 10px ${color}80)`;
  el.style.color = color;
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
  return el;
}

function createQuakeMarkerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "quake-marker";
  el.innerHTML = `
    <span class="quake-marker-outer"></span>
    <span class="quake-marker-inner"></span>
  `;
  return el;
}

function createStationMarkerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "station-marker";
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8c0 4.5-6 12-6 12s-6-7.5-6-12a6 6 0 0 1 12 0"/>
      <circle cx="12" cy="8" r="2"/>
    </svg>
  `;
  return el;
}

function createSafePointElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "safe-point-marker";
  el.style.width = "12px";
  el.style.height = "12px";
  el.style.borderRadius = "50%";
  el.style.background = "rgba(34, 197, 94, 0.8)";
  el.style.border = "2px solid #16a34a";
  return el;
}

function createInfraMarkerElement(type: string): HTMLDivElement {
  const icon = getIconForType(type);
  const glowColor = getGlowColorForType(type);
  const el = document.createElement("div");
  el.className = "infra-marker";
  el.style.width = "32px";
  el.style.height = "32px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.filter = `drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 12px ${glowColor}99)`;
  el.style.color = glowColor;
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
  return el;
}

export function MapView({
  quake,
  zones,
  stations,
  routes,
  showPlan,
  zonesGeoJSON,
  safePoints,
  infraNodes,
  zonePois,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<unknown>(null);
  const quakeMarkerRef = useRef<L.Marker | null>(null);
  const zoneCirclesRef = useRef<L.Circle[]>([]);
  const zoneGeoJSONRef = useRef<L.GeoJSON | null>(null);
  const plateBoundariesRef = useRef<L.GeoJSON | null>(null);
  const routePolylinesRef = useRef<L.Polyline[]>([]);
  const stationMarkersRef = useRef<L.Marker[]>([]);
  const safePointMarkersRef = useRef<L.Marker[]>([]);
  const infraMarkersRef = useRef<L.Marker[]>([]);
  const zonePoisMarkersRef = useRef<L.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [plateDataReady, setPlateDataReady] = useState(false);
  const plateGeoJSONRef = useRef<GeoJSON.FeatureCollection | null>(null);

  const center: [number, number] = [
    quake.coordinates.lat,
    quake.coordinates.lng,
  ];

  const DEFAULT_ZOOM = 9;
  const PLATE_CLIP_RADIUS_KM = 600;
  const FIT_PADDING_PX = 40;
  const MAX_ZOOM = 15;
  /** Allow 13 zoom-out steps from max: 15 → 2. */
  const MIN_ZOOM = MAX_ZOOM - 13;
  /** Max lat or lng span for fitBounds; avoid fitting to near-global extent. */
  const MAX_FIT_SPAN_DEG = 45;

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      leafletRef.current = L;
      if (cancelled) return;
      const DefaultIcon = L.Icon.Default;
      if (DefaultIcon?.prototype && "_getIconUrl" in DefaultIcon.prototype) {
        delete (DefaultIcon.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      }
      DefaultIcon?.mergeOptions({
        iconRetinaUrl: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>",
        iconUrl: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>",
        shadowUrl: "",
      });
      const map = L.map(containerRef.current!, {
        maxBounds: L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180)),
        maxBoundsViscosity: 1,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        worldCopyJump: false,
      }).setView(center, DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        noWrap: true,
      }).addTo(map);
      if (cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;
      setMapReady(true);
      const baseUrl =
        typeof window !== "undefined"
          ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000")
          : "http://localhost:8000";
      fetch(`${String(baseUrl).replace(/\/$/, "")}/api/plates/geojson`)
        .then((res) => (res.ok ? res.json() : null))
        .then((geojson: GeoJSON.FeatureCollection | null) => {
          if (cancelled) return;
          if (geojson?.features?.length) {
            plateGeoJSONRef.current = geojson;
            setPlateDataReady(true);
          }
        })
        .catch(() => {});
    })();
    return () => {
      cancelled = true;
      setMapReady(false);
      quakeMarkerRef.current?.remove();
      quakeMarkerRef.current = null;
      zoneCirclesRef.current.forEach((c) => c.remove());
      zoneCirclesRef.current = [];
      zoneGeoJSONRef.current?.remove();
      zoneGeoJSONRef.current = null;
      plateBoundariesRef.current?.remove();
      plateBoundariesRef.current = null;
      routePolylinesRef.current.forEach((p) => p.remove());
      routePolylinesRef.current = [];
      stationMarkersRef.current.forEach((m) => m.remove());
      stationMarkersRef.current = [];
      safePointMarkersRef.current.forEach((m) => m.remove());
      safePointMarkersRef.current = [];
      infraMarkersRef.current.forEach((m) => m.remove());
      infraMarkersRef.current = [];
      zonePoisMarkersRef.current.forEach((m) => m.remove());
      zonePoisMarkersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      leafletRef.current = null;
    };
  }, []);

  // Center on quake; zoom 9 when no plan. Do NOT include plate boundaries in any fit.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!showPlan) {
      map.setView(center, DEFAULT_ZOOM);
    }
  }, [mapReady, center[0], center[1], showPlan]);

  // Plate boundaries: clip to local bbox (600km), only show when zoom >= 6
  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current;
    if (!L || !map || !mapReady || !plateDataReady || !plateGeoJSONRef.current) return;
    plateBoundariesRef.current?.remove();
    plateBoundariesRef.current = null;
    const zoom = map.getZoom();
    if (zoom < 6) return;
    const bbox = bboxAround(center[0], center[1], PLATE_CLIP_RADIUS_KM);
    const raw = plateGeoJSONRef.current;
    if (!raw) return;
    const clipped = clipGeoJSONToBbox(raw, bbox);
    if (!clipped.features.length) return;
    const layer = L.geoJSON(clipped as GeoJSON.FeatureCollection, {
      style: () => ({ color: "#94a3b8", weight: 1, opacity: 0.45 }),
    });
    layer.addTo(map);
    plateBoundariesRef.current = layer;
  }, [mapReady, plateDataReady, center[0], center[1]]);

  // When map zoom changes, show/hide plate layer (only at zoom >= 6)
  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current;
    if (!L || !map || !mapReady || !plateGeoJSONRef.current) return;
    const handler = () => {
      const zoom = map.getZoom();
      const plateData = plateGeoJSONRef.current;
      if (zoom >= 6 && !plateBoundariesRef.current && plateData) {
        const bbox = bboxAround(center[0], center[1], PLATE_CLIP_RADIUS_KM);
        const clipped = clipGeoJSONToBbox(plateData, bbox);
        if (clipped.features.length) {
          const layer = L.geoJSON(clipped as GeoJSON.FeatureCollection, {
            style: () => ({ color: "#94a3b8", weight: 1, opacity: 0.45 }),
          });
          layer.addTo(map);
          plateBoundariesRef.current = layer;
        }
      } else if (zoom < 6 && plateBoundariesRef.current) {
        plateBoundariesRef.current.remove();
        plateBoundariesRef.current = null;
      }
    };
    map.on("zoomend", handler);
    return () => {
      map.off("zoomend", handler);
    };
  }, [mapReady, plateDataReady, center[0], center[1]]);

  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    if (!L || !mapRef.current || !mapReady) return;
    const map = mapRef.current;
    quakeMarkerRef.current?.remove();
    const el = createQuakeMarkerElement();
    const marker = L.marker(center, {
      icon: L.divIcon({
        html: el.outerHTML,
        className: "leaflet-quake-marker",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map);
    quakeMarkerRef.current = marker;
  }, [mapReady, center[0], center[1]]);

  const removePlanLayers = useCallback(() => {
    zoneCirclesRef.current.forEach((c) => c.remove());
    zoneCirclesRef.current = [];
    zoneGeoJSONRef.current?.remove();
    zoneGeoJSONRef.current = null;
    routePolylinesRef.current.forEach((p) => p.remove());
    routePolylinesRef.current = [];
    stationMarkersRef.current.forEach((m) => m.remove());
    stationMarkersRef.current = [];
    safePointMarkersRef.current.forEach((m) => m.remove());
    safePointMarkersRef.current = [];
    infraMarkersRef.current.forEach((m) => m.remove());
    infraMarkersRef.current = [];
    zonePoisMarkersRef.current.forEach((m) => m.remove());
    zonePoisMarkersRef.current = [];
  }, []);

  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;

    removePlanLayers();

    if (!showPlan) return;

    const useGeoJSON = zonesGeoJSON?.features?.length;
    if (useGeoJSON && zonesGeoJSON) {
      const layer = L.geoJSON(zonesGeoJSON as GeoJSON.FeatureCollection, {
        style: (feature) => {
          const level = feature?.properties?.level ?? "low";
          const colors = ZONE_COLORS[level] ?? ZONE_COLORS.low;
          return {
            color: colors.line,
            fillColor: colors.fill,
            fillOpacity: colors.fillOpacity,
            weight: colors.weight,
          };
        },
      });
      layer.addTo(map);
      zoneGeoJSONRef.current = layer;
    } else {
      zones.forEach((zone) => {
        const colors = ZONE_COLORS[zone.level] ?? ZONE_COLORS.low;
        const circle = L.circle(center, {
          radius: radiusKmToMeters(zone.radiusKm),
          color: colors.line,
          fillColor: colors.fill,
          fillOpacity: colors.fillOpacity,
          weight: colors.weight,
        }).addTo(map);
        zoneCirclesRef.current.push(circle);
      });
    }

    (safePoints ?? []).forEach((p) => {
      const el = createSafePointElement();
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          html: el.outerHTML,
          className: "leaflet-safe-point",
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
      }).addTo(map);
      marker.bindTooltip(`<strong>Safe staging</strong><br/>${p.reason}`, {
        direction: "top",
        opacity: 0.95,
      });
      safePointMarkersRef.current.push(marker);
    });

    (infraNodes ?? []).forEach((node) => {
      const el = createInfraMarkerElement(node.type);
      const marker = L.marker([node.lat, node.lng], {
        icon: L.divIcon({
          html: el.outerHTML,
          className: "leaflet-infra-marker",
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        }),
      }).addTo(map);
      const typeLabel = STATION_TYPE_LABELS[node.type] ?? node.type.replace(/_/g, " ");
      marker.bindTooltip(`<strong>${node.name}</strong><br/>${typeLabel}`, {
        direction: "top",
        opacity: 0.95,
      });
      infraMarkersRef.current.push(marker);
    });

    (["high", "medium", "low"] as const).forEach((level) => {
      const list = zonePois?.[level] ?? [];
      list.forEach((poi) => {
        const el = createZonePoiMarkerElement(poi.zoneLevel, poi.type);
        const marker = L.marker([poi.lat, poi.lng], {
          icon: L.divIcon({
            html: el.outerHTML,
            className: "leaflet-zone-poi-marker",
            iconSize: [28, 28],
            iconAnchor: [14, 28],
          }),
        }).addTo(map);
        const typeLabel = ZONE_POI_TYPE_LABELS[poi.type] ?? poi.type;
        const zoneLabel = ZONE_POI_ZONE_LABELS[poi.zoneLevel] ?? poi.zoneLevel;
        marker.bindTooltip(
          `<strong>${poi.name}</strong><br/>${typeLabel} · ${zoneLabel}`,
          { direction: "top", opacity: 0.95 }
        );
        zonePoisMarkersRef.current.push(marker);
      });
    });

    routes.forEach((route) => {
      if (!route.waypoints.length) return;
      const latLngs: [number, number][] = route.waypoints.map((w) => [
        w.lat,
        w.lng,
      ]);
      const polyline = L.polyline(latLngs, {
        color: "rgba(55, 65, 81, 0.9)",
        weight: 3,
        opacity: 0.9,
      }).addTo(map);
      routePolylinesRef.current.push(polyline);
    });

    stations.forEach((station) => {
      const el = createStationMarkerElement();
      const reason = STATION_TYPE_LABELS[station.type] ?? station.type;
      const marker = L.marker([station.coordinates.lat, station.coordinates.lng], {
        icon: L.divIcon({
          html: el.outerHTML,
          className: "leaflet-station-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        }),
      }).addTo(map);
      marker.bindTooltip(
        `<strong>${station.name}</strong><br/><span class="text-muted-foreground">${reason}</span>`,
        {
          direction: "top",
          offset: [0, -24],
          opacity: 0.95,
        }
      );
      stationMarkersRef.current.push(marker);
    });

    // Fit bounds to quake + zones + stations only (never plate boundaries)
    const bounds = L.latLngBounds(center as [number, number], center as [number, number]);
    stations.forEach((s) => bounds.extend([s.coordinates.lat, s.coordinates.lng]));
    if (zoneGeoJSONRef.current) {
      try {
        bounds.extend(zoneGeoJSONRef.current.getBounds());
      } catch {
        bounds.extend(center as [number, number]);
      }
    } else {
      zoneCirclesRef.current.forEach((c) => {
        try {
          bounds.extend(c.getBounds());
        } catch {
          bounds.extend(center as [number, number]);
        }
      });
    }
    routes.forEach((r) => {
      r.waypoints.forEach((w) => bounds.extend([w.lat, w.lng]));
    });
    try {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const spanLat = Math.abs(ne.lat - sw.lat);
      const spanLng = Math.abs(ne.lng - sw.lng);
      if (spanLat > MAX_FIT_SPAN_DEG || spanLng > MAX_FIT_SPAN_DEG) {
        map.setView(center, DEFAULT_ZOOM);
      } else {
        map.fitBounds(bounds, {
          padding: [FIT_PADDING_PX, FIT_PADDING_PX],
          maxZoom: MAX_ZOOM - 1,
        });
      }
    } catch {
      map.setView(center, DEFAULT_ZOOM);
    }
  }, [
    mapReady,
    showPlan,
    quake.coordinates.lat,
    quake.coordinates.lng,
    zones,
    zonesGeoJSON,
    safePoints,
    infraNodes,
    zonePois,
    stations,
    routes,
    removePlanLayers,
  ]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-2xl border border-border shadow-sm"
    />
  );
}
