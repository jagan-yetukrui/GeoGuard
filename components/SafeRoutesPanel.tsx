"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResponsePlan, Route } from "@/lib/types";
import { ChevronDown, ChevronUp, ExternalLink, Route as RouteIcon, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  hospital: "Hospital",
  shelter: "Shelter",
  fire_station: "Fire station",
  police: "Police",
};

/** Build Google Maps directions URL from route waypoints (origin → destination). */
function getGoogleMapsDirectionsUrl(route: Route): string | null {
  const waypoints = route.waypoints ?? [];
  if (waypoints.length < 2) return null;
  const origin = waypoints[0];
  const destination = waypoints[waypoints.length - 1];
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

interface SafeRoutesPanelProps {
  plan?: ResponsePlan | null;
  selectedRouteId?: string;
  onRouteSelect?: (routeId: string, route: Route) => void;
  onRouteZoom?: (route: Route) => void;
}

export function SafeRoutesPanel({
  plan,
  selectedRouteId,
  onRouteSelect,
  onRouteZoom,
}: SafeRoutesPanelProps) {
  const allRoutes = plan?.routes ?? [];
  const hasUserLocation = !!plan?.userLocation;
  // When user set location: show only category routes (one per hospital, shelter, etc.)
  const routes = hasUserLocation
    ? allRoutes.filter((r) => r.category)
    : allRoutes;
  const [expanded, setExpanded] = useState(routes.length > 0);

  if (routes.length === 0) return null;

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader
        className="cursor-pointer select-none p-4"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <RouteIcon className="size-4 text-emerald-500" />
              Routes
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hasUserLocation
                ? "Safest route to each location (1 per category)"
                : "Routes to nearest shelters"}
            </p>
          </div>
          <span className="shrink-0">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 p-4 pt-0">
          {routes.map((route) => {
            const directionsUrl = getGoogleMapsDirectionsUrl(route);
            const categoryLabel = route.category
              ? CATEGORY_LABELS[route.category] ?? route.category
              : null;
            return (
              <div
                key={route.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border p-3 transition-colors",
                  selectedRouteId === route.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/30"
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-sm"
                  onClick={() => onRouteSelect?.(route.id, route)}
                >
                  {categoryLabel && (
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {categoryLabel}
                    </span>
                  )}
                  <p className="font-medium truncate">{route.name}</p>
                  {route.distanceKm != null && (
                    <p className="text-xs text-muted-foreground">
                      {route.distanceKm.toFixed(1)} km
                      {route.durationMinutes != null && ` · ~${route.durationMinutes} min`}
                    </p>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {onRouteZoom && (
                    <button
                      type="button"
                      onClick={() => onRouteZoom(route)}
                      className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Zoom to route on map"
                    >
                      <ZoomIn className="size-4" />
                    </button>
                  )}
                  {directionsUrl && (
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Get directions in Google Maps"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
