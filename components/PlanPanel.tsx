"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { QuakeEvent, ResponsePlan, RiskLevel } from "@/lib/types";
import { motion } from "framer-motion";
import { ShieldCheck, MapPin, Route, ListOrdered, Info } from "lucide-react";
import { cn } from "@/lib/utils";

function RiskBadge({ level }: { level: RiskLevel }) {
  const classByLevel = {
    high: "bg-red-500/10 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-800",
    medium:
      "bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-800",
    low: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-800",
  };
  return (
    <Badge
      variant={level === "high" ? "destructive" : "outline"}
      className={cn(
        level === "medium" && classByLevel.medium,
        level === "low" && classByLevel.low
      )}
    >
      {level}
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
    >
      <Card className="rounded-2xl border border-border p-6 shadow-sm">
        <CardHeader className="p-0 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Response Plan</CardTitle>
            <Badge
              variant="outline"
              className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
            >
              Heuristic risk zones
            </Badge>
            {verified && (
              <Badge
                variant="secondary"
                className="gap-1 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
              >
                <ShieldCheck className="size-3" />
                Verified Plan
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-0">
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
            Decision support tool. Not an official evacuation order.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {plan.summary}
          </p>

          {hasWhy && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Info className="size-4 text-muted-foreground" />
                Why these zones?
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

          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <MapPin className="size-4 text-muted-foreground" />
              Risk zones
            </h4>
            <ul className="space-y-2">
              {plan.riskZones.map((z) => (
                <li
                  key={z.id}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <RiskBadge level={z.level} />
                  <span className="font-medium">{z.label}</span>
                  <span className="text-muted-foreground">— {z.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <MapPin className="size-4 text-muted-foreground" />
              Recommended stations
            </h4>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {plan.stations.map((s) => (
                <li key={s.id}>
                  <span className="font-medium text-foreground">{s.name}</span> (
                  {s.type})
                  {s.distanceKm != null && ` · ${s.distanceKm} km`}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Route className="size-4 text-muted-foreground" />
              Recommended routes
            </h4>
            <ul className="space-y-2 text-sm">
              {plan.routes.map((r) => (
                <li key={r.id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{r.name}</span>
                  {r.durationMinutes != null && ` · ${r.durationMinutes} min`}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ListOrdered className="size-4 text-muted-foreground" />
              Priority actions
            </h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              {plan.priorityActions.map((action, i) => (
                <li key={i} className="pl-1">
                  {action}
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
