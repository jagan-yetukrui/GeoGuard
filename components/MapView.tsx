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
} from "@/lib/types";
import { radiusKmToMeters } from "@/lib/mapUtils";

export type MapViewProps = {
  quake: QuakeEvent;
  zones: RiskZone[];
  stations: Station[];
  routes: Route[];
  showPlan: boolean;
  zonesGeoJSON?: ZonesGeoJSON | null;
  safePoints?: SafePoint[] | null;
  infraNodes?: InfraNode[] | null;
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
  supply: "Supply depot",
  shelter: "Shelter",
  command: "Command post",
};

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
  const el = document.createElement("div");
  el.className = "infra-marker";
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    </svg>
  `;
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
  const [mapReady, setMapReady] = useState(false);

  const center: [number, number] = [
    quake.coordinates.lat,
    quake.coordinates.lng,
  ];

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
      const map = L.map(containerRef.current!).setView(center, 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      if (cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;
      setMapReady(true);
      // Plate boundaries layer (same source as backend distance_km_to_plate)
      const base = typeof window !== "undefined" && (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000");
      fetch(`${base.replace(/\/$/, "")}/api/plates/geojson`)
        .then((res) => (res.ok ? res.json() : null))
        .then((geojson: GeoJSON.FeatureCollection | null) => {
          if (cancelled || !mapRef.current || !geojson?.features?.length) return;
          const L = leafletRef.current as typeof import("leaflet") | null;
          if (!L) return;
          const layer = L.geoJSON(geojson as Parameters<L["geoJSON"]>[0], {
            style: () => ({ color: "#dc2626", weight: 1, opacity: 0.8 }),
          });
          layer.addTo(mapRef.current!);
          plateBoundariesRef.current = layer;
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(center, mapRef.current.getZoom());
  }, [center[0], center[1]]);

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
  }, []);

  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;

    removePlanLayers();

    if (!showPlan) return;

    const useGeoJSON = zonesGeoJSON?.features?.length;
    if (useGeoJSON && zonesGeoJSON) {
      const layer = L.geoJSON(zonesGeoJSON as Parameters<L["geoJSON"]>[0], {
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
          iconSize: [20, 20],
          iconAnchor: [10, 20],
        }),
      }).addTo(map);
      marker.bindTooltip(`<strong>${node.name}</strong><br/>${node.type}`, {
        direction: "top",
        opacity: 0.95,
      });
      infraMarkersRef.current.push(marker);
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
  }, [
    mapReady,
    showPlan,
    quake.coordinates.lat,
    quake.coordinates.lng,
    zones,
    zonesGeoJSON,
    safePoints,
    infraNodes,
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
