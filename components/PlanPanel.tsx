"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { QuakeEvent, ResponsePlan, RiskLevel } from "@/lib/types";
import { motion } from "framer-motion";
import { ShieldCheck, MapPin, Route, ListOrdered, Info } from "lucide-react";
import { cn } from "@/lib/utils";

function RiskBadge({ level }: { level: RiskLevel }) {
  const classByLevel = {
    high: "bg-red-50 text-red-900 border-red-300 font-semibold dark:bg-red-500/30 dark:text-red-100 dark:border-red-600",
    medium:
      "bg-amber-50 text-amber-900 border-amber-300 font-semibold dark:bg-amber-500/30 dark:text-amber-100 dark:border-amber-600",
    low: "bg-green-50 text-green-900 border-green-300 font-semibold dark:bg-green-500/30 dark:text-green-100 dark:border-green-600",
  };
  const ariaLabel = `Risk level: ${level}`;
  return (
    <Badge
      variant={level === "high" ? "destructive" : "outline"}
      className={cn(
        "transition-all duration-200",
        level === "medium" && classByLevel.medium,
        level === "low" && classByLevel.low,
        level === "high" && classByLevel.high
      )}
      aria-label={ariaLabel}
      role="status"
    >
      {level.toUpperCase()}
    </Badge>
  );
}

interface PlanPanelProps {
  plan: ResponsePlan;
  quake?: QuakeEvent | null;
  verified?: boolean;
}

export function PlanPanel({ plan, quake, verified = false }: PlanPanelProps) {
  const hasWhy = Boolean(
    plan.explanation || plan.plateDistanceKm != null || plan.confidence
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
      role="region"
      aria-label="Emergency response plan"
    >
      <Card className="rounded-lg border-2 border-primary shadow-md bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-lg font-bold text-primary">📋 Response Plan</CardTitle>
            <Badge
              variant="outline"
              className="border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200 font-semibold"
            >
              Risk Analysis
            </Badge>
            {verified && (
              <Badge
                variant="secondary"
                className="gap-1 bg-green-50 text-green-900 border-green-300 font-semibold dark:bg-green-500/20 dark:text-green-200"
              >
                <ShieldCheck className="size-4" />
                ✓ Verified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3 dark:bg-amber-500/10 dark:border-amber-600" role="alert">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">⚠️ Decision Support Tool</p>
            <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">Not an official evacuation order. Consult local emergency management.</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {plan.summary}
          </p>

          {hasWhy && (
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4" role="contentinfo">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                <Info className="size-5" />
                📊 Analysis Details
              </h4>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {quake && (
                  <>
                    <div>
                      <dt className="text-muted-foreground">Magnitude</dt>
                      <dd className="font-medium">M{quake.magnitude}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Depth</dt>
                      <dd className="font-medium">{quake.depth} km</dd>
                    </div>
                  </>
                )}
                {plan.plateDistanceKm != null && (
                  <div>
                    <dt className="text-muted-foreground">Distance to plate boundary</dt>
                    <dd className="font-medium">{plan.plateDistanceKm.toFixed(0)} km</dd>
                  </div>
                )}
                {plan.damageScore != null && (
                  <div>
                    <dt className="text-muted-foreground">Damage score</dt>
                    <dd className="font-medium">{plan.damageScore}/100</dd>
                  </div>
                )}
                {plan.confidence && (
                  <div>
                    <dt className="text-muted-foreground">Confidence</dt>
                    <dd>
                      <Badge variant="outline" className="text-xs">
                        {plan.confidence}
                      </Badge>
                    </dd>
                  </div>
                )}
                {plan.plateMotionProxyMmYr != null && (
                  <div>
                    <dt className="text-muted-foreground">Plate motion proxy</dt>
                    <dd className="font-medium">~{plan.plateMotionProxyMmYr} mm/yr</dd>
                  </div>
                )}
                {plan.explanation?.density_method && (
                  <div>
                    <dt className="text-muted-foreground">Density method</dt>
                    <dd className="font-medium">{plan.explanation.density_method}</dd>
                  </div>
                )}
                {plan.explanation?.infra_count != null && (
                  <div>
                    <dt className="text-muted-foreground">Infra nodes</dt>
                    <dd className="font-medium">{plan.explanation.infra_count}</dd>
                  </div>
                )}
                {plan.explanation?.similar_quakes_used != null && (
                  <div>
                    <dt className="text-muted-foreground">Similar quakes used</dt>
                    <dd className="font-medium">{plan.explanation.similar_quakes_used}</dd>
                  </div>
                )}
              </dl>
              {plan.explanation?.notes && (
                <p className="mt-2 text-xs text-muted-foreground">{plan.explanation.notes}</p>
              )}
              {plan.explanation && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {plan.explanation.why_radii}
                </p>
              )}
              {plan.explanation?.caveat && (
                <p className="mt-2 text-xs italic text-muted-foreground">
                  {plan.explanation.caveat}
                </p>
              )}
            </div>
          )}

          <div className="border-t-2 border-border pt-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="size-5" />
              🔴 Risk Zones
            </h4>
            <ul className="space-y-3">
              {plan.riskZones.map((z) => (
                <li
                  key={z.id}
                  className="flex flex-wrap items-start gap-3 text-sm p-3 rounded-lg bg-secondary/40 border border-border"
                >
                  <RiskBadge level={z.level} />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{z.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{z.description}</p>
                    <p className="text-xs text-muted-foreground font-medium mt-1">Radius: {z.radiusKm}km</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t-2 border-border pt-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="size-5" />
              🏥 Recommended Stations
            </h4>
            <ul className="space-y-2 text-sm">
              {plan.stations.map((s) => (
                <li key={s.id} className="flex items-start gap-3 p-2 rounded hover:bg-secondary/30">
                  <span className="text-lg">📍</span>
                  <div>
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.type.charAt(0).toUpperCase() + s.type.slice(1)}{s.distanceKm != null && ` · ${s.distanceKm}km away`}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t-2 border-border pt-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Route className="size-5" />
              🛣️ Recommended Routes
            </h4>
            <ul className="space-y-2 text-sm">
              {plan.routes.map((r) => (
                <li key={r.id} className="flex items-start gap-3 p-2 rounded hover:bg-secondary/30">
                  <span className="text-lg">→</span>
                  <div>
                    <p className="font-semibold text-foreground">{r.name}</p>
                    {r.durationMinutes != null && <p className="text-xs text-muted-foreground">⏱️ {r.durationMinutes} min</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t-2 border-border pt-4 bg-primary/5 p-4 rounded-lg">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <ListOrdered className="size-5" />
              📌 Priority Actions
            </h4>
            <ol className="space-y-2 text-sm">
              {plan.priorityActions.map((action, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-bold text-primary flex-shrink-0">{i + 1}.</span>
                  <span className="text-foreground">{action}</span>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
