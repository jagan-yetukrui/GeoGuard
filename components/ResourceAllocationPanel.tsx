"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QuakeEvent, ResponsePlan } from "@/lib/types";
import { calculateResources } from "@/lib/api";
import type { ResourceCalculateResponse } from "@/lib/api";
import { Loader2, ChevronDown, ChevronUp, AlertTriangle, Droplets, Package, Home, Users, MapPin } from "lucide-react";

const ZONE_OPTIONS = [
  { value: "red", label: "Red (high risk)" },
  { value: "orange", label: "Orange (medium risk)" },
  { value: "green", label: "Green (low risk)" },
];

const RESOURCE_LABELS: Record<string, string> = {
  water_liters_per_day: "Water (L/day)",
  medical_kits: "Medical kits",
  shelter_spaces: "Shelter spaces",
  calories_per_day: "Calories/day",
  blankets: "Blankets",
  mobile_chargers: "Mobile chargers",
  radios: "Radios",
  rescue_teams: "Rescue teams",
  ambulances: "Ambulances",
};

function bboxFromEpicenter(lat: number, lng: number, radiusKm: number): { bbox: number[] } {
  const degPerKm = 1 / 111;
  const d = radiusKm * degPerKm * 1.2;
  return {
    bbox: [lng - d, lat - d, lng + d, lat + d],
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function getRadiusKm(zoneType: string, plan?: ResponsePlan | null, quake?: QuakeEvent | null): number {
  if (plan?.riskZones?.length) {
    const level = zoneType === "red" ? "high" : zoneType === "orange" ? "medium" : "low";
    const zone = plan.riskZones.find((z) => z.level === level);
    if (zone?.radiusKm != null) return zone.radiusKm;
  }
  // Magnitude-based fallback when no plan (M2.5 → ~2/9/23 km, M6 → ~12/35/90 km)
  const mag = quake?.magnitude ?? 4.0;
  const depthKm = quake?.depth ?? 10;
  const magFactor = clamp((mag - 3.5) / 4, 0, 1);
  const shallowFactor = clamp((70 - depthKm) / 70, 0, 1);
  const amp = 0.75 + 0.35 * shallowFactor + 0.1;
  const baseHigh = 2 + 6 * magFactor;
  const baseMed = 8 + 18 * magFactor;
  const baseLow = 20 + 45 * magFactor;
  const high = clamp(Math.round(baseHigh * amp * 10) / 10, 0.1, 25);
  const med = clamp(Math.round(baseMed * amp * 10) / 10, 0.1, 80);
  const low = clamp(Math.round(baseLow * amp * 10) / 10, 0.1, 180);
  return zoneType === "red" ? high : zoneType === "orange" ? med : low;
}

interface ResourceAllocationPanelProps {
  quake: QuakeEvent;
  plan?: ResponsePlan | null;
}

export function ResourceAllocationPanel({ quake, plan }: ResourceAllocationPanelProps) {
  const [zoneType, setZoneType] = useState<string>("red");
  const [timeSinceMinutes, setTimeSinceMinutes] = useState(60);
  const [result, setResult] = useState<ResourceCalculateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);

  const onCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const lat = quake.coordinates?.lat ?? 0;
    const lng = quake.coordinates?.lng ?? 0;
    const radiusKm = getRadiusKm(zoneType, plan, quake);
    const geometry = bboxFromEpicenter(lat, lng, radiusKm);

    try {
      const res = await calculateResources({
        zoneType,
        geometry,
        time_since_event_minutes: timeSinceMinutes,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Service unavailable");
    } finally {
      setLoading(false);
    }
  }, [quake, zoneType, timeSinceMinutes, plan]);

  useEffect(() => {
    if (quake?.coordinates) {
      onCalculate();
    }
  }, [plan, zoneType, timeSinceMinutes, quake?.coordinates?.lat, quake?.coordinates?.lng, quake?.magnitude, quake?.depth, onCalculate]);

  const resources = result?.resources_required ?? {};
  const shortages = result?.shortages ?? {};
  const mainKeys = result?.main_needs ?? ["water_liters_per_day", "medical_kits", "shelter_spaces"];
  const secondaryKeys = result?.secondary_needs ?? ["calories_per_day", "blankets", "mobile_chargers", "radios", "rescue_teams", "ambulances"];

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader
        className="cursor-pointer select-none p-4"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Resource Allocation</CardTitle>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3 p-4 pt-0">
          <div>
            <label className="mb-1 block text-xs font-medium">Zone type</label>
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={zoneType}
              onChange={(e) => setZoneType(e.target.value)}
            >
              {ZONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">
              Time since event (minutes)
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={timeSinceMinutes}
              onChange={(e) => setTimeSinceMinutes(Number(e.target.value) || 0)}
            />
          </div>

          <Button
            className="w-full"
            disabled={loading}
            onClick={onCalculate}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Calculating…
              </>
            ) : (
              "Calculate resources"
            )}
          </Button>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && !loading && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-sm">
                {result.population_estimated != null && (
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4 text-muted-foreground" />
                    <span className="font-medium">{result.population_estimated.toLocaleString()}</span>
                    <span className="text-muted-foreground">people</span>
                  </span>
                )}
                {result.population_density_people_per_km2 != null && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4 text-muted-foreground" />
                    <span className="font-medium">{result.population_density_people_per_km2.toLocaleString()}</span>
                    <span className="text-muted-foreground">/km²</span>
                  </span>
                )}
                {result.area_km2 != null && (
                  <span className="text-muted-foreground">
                    {result.area_km2.toLocaleString()} km²
                  </span>
                )}
              </div>

              <div>
                <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Main needs</h5>
                <div className="grid grid-cols-2 gap-2">
                  {mainKeys.map((key) => {
                    const val = resources[key];
                    if (val == null) return null;
                    const icon = key === "water_liters_per_day" ? Droplets : key === "medical_kits" ? Package : Home;
                    const Icon = icon;
                    return (
                      <div key={key} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                        <Icon className="size-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground truncate">{RESOURCE_LABELS[key] ?? key}</p>
                          <p className="font-medium">{(val as number).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecondary((s) => !s)}
                >
                  <span>Supporting needs</span>
                  {showSecondary ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showSecondary && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {secondaryKeys.map((key) => {
                      const val = resources[key];
                      if (val == null) return null;
                      return (
                        <div key={key} className="flex items-center gap-2 rounded-lg border border-border bg-muted/10 p-2">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground truncate">{RESOURCE_LABELS[key] ?? key}</p>
                            <p className="text-sm font-medium">{(val as number).toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {(shortages.medical || shortages.shelter) && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">Shortages</p>
                    <ul className="list-inside list-disc text-amber-700 dark:text-amber-300">
                      {shortages.medical && <li>Medical capacity</li>}
                      {shortages.shelter && <li>Shelter capacity</li>}
                    </ul>
                  </div>
                </div>
              )}

              {result.deployment_priority && result.deployment_priority.length > 0 && (
                <div>
                  <h5 className="mb-1 text-xs font-medium">Deployment priority</h5>
                  <div className="flex flex-wrap gap-1">
                    {result.deployment_priority.map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs">
                        {p.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.recommended_actions && result.recommended_actions.length > 0 && (
                <div>
                  <h5 className="mb-1 text-xs font-medium">Recommended actions</h5>
                  <ul className="list-inside list-disc space-y-0.5 text-sm">
                    {result.recommended_actions.map((a, i) => (
                      <li key={i}>{a.replace(/_/g, " ")}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.uncertainty_notes && (
                <p className="text-xs text-muted-foreground">{result.uncertainty_notes}</p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
