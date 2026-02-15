"use client";

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
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
import { getInfraIcon } from "@/lib/mapIcons";

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
  highlightedRouteId?: string;
  userLocation?: { lat: number; lng: number } | null;
};

export interface MapViewHandle {
  fitToRoute: (route: Route) => void;
}

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

const ZONE_POI_TYPE_LABELS: Record<string, string> = {
  hospital: "Hospital",
  shelter: "Shelter",
  park: "Park",
  open_area: "Open area",
};

const INFRA_TYPE_LABELS: Record<string, string> = {
  hospital: "Hospital",
  clinic: "Clinic",
  ambulance: "Ambulance",
  fire_station: "Fire station",
  police: "Police station",
  shelter: "Shelter",
  park: "Park",
  open_area: "Open area",
};

const ZONE_POI_ZONE_LABELS: Record<string, string> = {
  high: "Red zone",
  medium: "Yellow zone",
  low: "Green zone",
};

function createZonePoiMarkerElement(
  poiType: string,
  _zoneLevel: "high" | "medium" | "low"
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "zone-poi-marker";
  el.style.width = "24px";
  el.style.height = "24px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.innerHTML = getInfraIcon(poiType)
    .replace('width="24"', 'width="24"')
    .replace('height="24"', 'height="24"');
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

function createStationMarkerElement(type: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "station-marker";
  el.style.width = "24px";
  el.style.height = "24px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.innerHTML = getInfraIcon(type)
    .replace('width="24"', 'width="24"')
    .replace('height="24"', 'height="24"');
  return el;
}

function createUserLocationElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "user-location-marker";
  el.style.width = "24px";
  el.style.height = "24px";
  el.style.borderRadius = "50%";
  el.style.background = "rgba(59, 130, 246, 0.3)";
  el.style.border = "3px solid #2563eb";
  el.style.boxShadow = "0 0 0 2px white";
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
  el.style.width = "24px";
  el.style.height = "24px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.innerHTML = getInfraIcon(type)
    .replace('width="24"', 'width="24"')
    .replace('height="24"', 'height="24"');
  return el;
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({
  quake,
  zones,
  stations,
  routes,
  showPlan,
  zonesGeoJSON,
  safePoints,
  infraNodes,
  zonePois,
  highlightedRouteId,
  userLocation,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const leafletRef = useRef<unknown>(null);
  const quakeMarkerRef = useRef<L.Marker | null>(null);
  const zoneCirclesRef = useRef<L.Circle[]>([]);
  const zoneGeoJSONRef = useRef<L.GeoJSON | null>(null);
  const plateBoundariesRef = useRef<L.GeoJSON | null>(null);
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

  useImperativeHandle(ref, () => ({
    fitToRoute(route: Route) {
      const map = mapRef.current;
      const L = leafletRef.current as typeof import("leaflet") | null;
      if (!map || !L || !route.waypoints?.length) return;
      const latLngs: [number, number][] = route.waypoints.map((w) => [w.lat, w.lng]);
      const bounds = L.latLngBounds(latLngs);
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
    },
  }), [center[0], center[1]]);

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
      routePolylineRef.current?.remove();
      routePolylineRef.current = null;
      plateBoundariesRef.current?.remove();
      plateBoundariesRef.current = null;
      stationMarkersRef.current.forEach((m) => m.remove());
      stationMarkersRef.current = [];
      safePointMarkersRef.current.forEach((m) => m.remove());
      safePointMarkersRef.current = [];
      infraMarkersRef.current.forEach((m) => m.remove());
      infraMarkersRef.current = [];
      zonePoisMarkersRef.current.forEach((m) => m.remove());
      zonePoisMarkersRef.current = [];
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
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

  // Plate boundaries: always visible. Clip radius scales with zoom (larger when zoomed out).
  const updatePlateLayer = useCallback(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current;
    if (!L || !map || !mapReady || !plateDataReady || !plateGeoJSONRef.current) return;
    const zoom = map.getZoom();
    const radiusKm = zoom < 5 ? 8000 : zoom < 7 ? 2000 : PLATE_CLIP_RADIUS_KM;
    const bbox = bboxAround(center[0], center[1], radiusKm);
    const raw = plateGeoJSONRef.current;
    if (!raw) return;
    const clipped = clipGeoJSONToBbox(raw, bbox);
    if (!clipped.features.length) return;
    plateBoundariesRef.current?.remove();
    plateBoundariesRef.current = null;
    const weight = zoom < 5 ? 1.5 : 1;
    const opacity = zoom < 5 ? 0.6 : 0.45;
    const layer = L.geoJSON(clipped as GeoJSON.FeatureCollection, {
      style: () => ({ color: "#64748b", weight, opacity }),
    });
    layer.addTo(map);
    plateBoundariesRef.current = layer;
  }, [mapReady, plateDataReady, center[0], center[1]]);

  useEffect(() => {
    if (!mapReady || !plateDataReady) return;
    updatePlateLayer();
  }, [mapReady, plateDataReady, center[0], center[1], updatePlateLayer]);

  // Refresh plate layer on zoom/pan so clip radius and style update
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !plateDataReady) return;
    const handler = () => updatePlateLayer();
    map.on("zoomend", handler);
    map.on("moveend", handler);
    return () => {
      map.off("zoomend", handler);
      map.off("moveend", handler);
    };
  }, [mapReady, plateDataReady, updatePlateLayer]);

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

  // User location marker ("Your location")
  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    userLocationMarkerRef.current?.remove();
    userLocationMarkerRef.current = null;
    if (userLocation) {
      const el = createUserLocationElement();
      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          html: el.outerHTML,
          className: "leaflet-user-location",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);
      marker.bindTooltip("Your location", { direction: "top", permanent: false });
      userLocationMarkerRef.current = marker;
    }
    return () => {
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
    };
  }, [mapReady, userLocation?.lat, userLocation?.lng]);

  const removePlanLayers = useCallback(() => {
    zoneCirclesRef.current.forEach((c) => c.remove());
    zoneCirclesRef.current = [];
    zoneGeoJSONRef.current?.remove();
    zoneGeoJSONRef.current = null;
    routePolylineRef.current?.remove();
    routePolylineRef.current = null;
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
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        }),
      }).addTo(map);
      const typeLabel = INFRA_TYPE_LABELS[node.type] ?? node.type;
      marker.bindTooltip(`<strong>${node.name}</strong><br/>${typeLabel}`, {
        direction: "top",
        opacity: 0.95,
      });
      infraMarkersRef.current.push(marker);
    });

    (["high", "medium", "low"] as const).forEach((level) => {
      const list = zonePois?.[level] ?? [];
      list.forEach((poi) => {
        const el = createZonePoiMarkerElement(poi.type, poi.zoneLevel);
        const marker = L.marker([poi.lat, poi.lng], {
          icon: L.divIcon({
            html: el.outerHTML,
            className: "leaflet-zone-poi-marker",
            iconSize: [24, 24],
            iconAnchor: [12, 12],
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

    // Draw highlighted route polyline only
    routePolylineRef.current?.remove();
    routePolylineRef.current = null;
    if (highlightedRouteId) {
      const route = routes.find((r) => r.id === highlightedRouteId);
      if (route?.waypoints?.length) {
        const latLngs: [number, number][] = route.waypoints.map((w) => [w.lat, w.lng]);
        const polyline = L.polyline(latLngs, {
          color: "rgba(59, 130, 246, 0.9)",
          weight: 4,
          opacity: 0.9,
        }).addTo(map);
        routePolylineRef.current = polyline;
      }
    }

    stations.forEach((station) => {
      const el = createStationMarkerElement(station.type);
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
    highlightedRouteId,
    removePlanLayers,
  ]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-2xl border border-border shadow-sm"
    />
  );
});
