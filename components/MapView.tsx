"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { QuakeEvent, RiskZone, Station, Route } from "@/lib/types";
import { radiusKmToMeters } from "@/lib/mapUtils";

export type MapViewProps = {
  quake: QuakeEvent;
  zones: RiskZone[];
  stations: Station[];
  routes: Route[];
  showPlan: boolean;
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

export function MapView({
  quake,
  zones,
  stations,
  routes,
  showPlan,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<unknown>(null);
  const quakeMarkerRef = useRef<L.Marker | null>(null);
  const zoneCirclesRef = useRef<L.Circle[]>([]);
  const routePolylinesRef = useRef<L.Polyline[]>([]);
  const stationMarkersRef = useRef<L.Marker[]>([]);
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
    })();
    return () => {
      cancelled = true;
      setMapReady(false);
      quakeMarkerRef.current?.remove();
      quakeMarkerRef.current = null;
      zoneCirclesRef.current.forEach((c) => c.remove());
      zoneCirclesRef.current = [];
      routePolylinesRef.current.forEach((p) => p.remove());
      routePolylinesRef.current = [];
      stationMarkersRef.current.forEach((m) => m.remove());
      stationMarkersRef.current = [];
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
    routePolylinesRef.current.forEach((p) => p.remove());
    routePolylinesRef.current = [];
    stationMarkersRef.current.forEach((m) => m.remove());
    stationMarkersRef.current = [];
  }, []);

  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;

    removePlanLayers();

    if (!showPlan) return;

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
