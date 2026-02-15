"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Route } from "@/lib/types";
import { motion } from "framer-motion";
import { Navigation, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SafeRoutesPanelProps {
  routes: Route[];
  onRouteSelect: (routeId: string, route: Route) => void;
  onRouteZoom?: (route: Route) => void;
  selectedRouteId?: string;
}

export function SafeRoutesPanel({
  routes,
  onRouteSelect,
  onRouteZoom,
  selectedRouteId,
}: SafeRoutesPanelProps) {
  // Filter for demo location escape routes (marked with [DEMO LOCATION])
  const escapeRoutes = routes.filter((r) => r.reason?.includes("[DEMO LOCATION]"));

  if (escapeRoutes.length === 0) {
    return null;
  }

  // Extract shelter info from route names and reasons
  const shelterOptions = escapeRoutes.slice(0, 3).map((route) => {
    // Parse distance from reason text: "(...) km"
    const distanceMatch = route.reason?.match(/(\d+(?:\.\d+)?)\s*km/);
    const distance = distanceMatch ? parseFloat(distanceMatch[1]) : null;

    // Determine shelter type from reason
    const typeMap: Record<string, { type: string; icon: string; color: string }> = {
      medical: { type: "Medical", icon: "🏥", color: "bg-red-500" },
      shelter: { type: "Shelter", icon: "🏢", color: "bg-blue-500" },
      comms: { type: "Emergency", icon: "📡", color: "bg-amber-500" },
      supply: { type: "Depot", icon: "📦", color: "bg-green-500" },
    };

    let shelterType = typeMap["shelter"];
    if (route.name.includes("hospital")) shelterType = typeMap["medical"];
    if (route.name.includes("fire")) shelterType = typeMap["comms"];
    if (route.name.includes("police")) shelterType = typeMap["comms"];

    return {
      routeId: route.id,
      route,
      name: route.name.replace("Direct escape to ", "").replace("Escape with deflection to ", "").replace("Alternate shelter: ", ""),
      distance,
      type: shelterType.type,
      icon: shelterType.icon,
      isAlternate: route.name.includes("Alternate"),
      isDeflection: route.name.includes("deflection"),
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <Card className="rounded-2xl border border-emerald-200/50 bg-emerald-50/30 p-4 shadow-sm">
        <CardHeader className="p-0 pb-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-emerald-900">Safe Escape Routes</CardTitle>
              <p className="mt-0.5 text-xs text-emerald-700">Click to view and zoom</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-0">
          {shelterOptions.map((shelter) => (
            <motion.button
              key={shelter.routeId}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                onRouteSelect(shelter.routeId, shelter.route);
                onRouteZoom?.(shelter.route);
              }}
              className={cn(
                "w-full rounded-lg border-2 p-2.5 text-left transition-all",
                selectedRouteId === shelter.routeId
                  ? "border-emerald-500 bg-emerald-100/50 shadow-md"
                  : "border-emerald-200/50 bg-white hover:border-emerald-300 hover:bg-emerald-50/50"
              )}
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-base shrink-0">{shelter.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs text-gray-900 line-clamp-1">
                    {shelter.name}
                  </p>
                  <p className="text-xs text-gray-600">{shelter.type}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {shelter.distance && (
                      <span className="text-xs font-medium text-emerald-700">
                        {shelter.distance} km
                      </span>
                    )}
                    {shelter.isDeflection && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 py-0 px-1.5 h-5">
                        Deflection
                      </Badge>
                    )}
                    {shelter.isAlternate && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 py-0 px-1.5 h-5">
                        Backup
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {selectedRouteId === shelter.routeId && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
                  <Navigation className="size-3" />
                  Route highlighted
                </div>
              )}
            </motion.button>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
