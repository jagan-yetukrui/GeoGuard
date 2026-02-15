"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuakeSidebarProps } from "@/components/QuakeSidebar.types";
import { PlanPanel } from "@/components/PlanPanel";
import type { RiskLevel } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, FileText, PlayCircle, ShieldCheck, Save, List, Zap, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function RiskBadge({ level }: { level: RiskLevel }) {
  const classByLevel = {
    high: "bg-red-500/10 text-red-700 border-red-200",
    medium: "bg-amber-500/10 text-amber-700 border-amber-200",
    low: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
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

export function QuakeSidebar({
  quake,
  latestQuakes = [],
  liveQuake = null,
  viewMode = "live",
  plan,
  planGenerated,
  isGenerating,
  planVerified,
  planSaved,
  briefingPlaying,
  briefingLoading = false,
  quakeLoading = false,
  planError = null,
  offlineMode = false,
  onSwitchToLive,
  onSwitchToLast5,
  onSelectQuake,
  onRefreshQuakes,
  onGeneratePlan,
  onRetryPlan,
  onToggleBriefing,
  onVerifyPlan,
  onSavePlan,
}: QuakeSidebarProps) {
  const formattedTime = quake.timestamp
    ? new Date(quake.timestamp).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
  const riskZones = plan?.riskZones ?? [];

  return (
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-center gap-4">
        <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/50">
          <Image
            src="/logo.png"
            alt="GeoGuard"
            width={256}
            height={256}
            className="size-full object-cover"
            priority
          />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight leading-tight">
              <span className="text-blue-600">Geo</span>
              <span className="text-emerald-600">Guard</span>
            </h1>
            {offlineMode && (
              <Badge variant="secondary" className="text-xs">
                Offline mode
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Event details</p>
        </div>
      </div>

      {onSwitchToLive && onSwitchToLast5 && (
        <div className="flex items-center justify-center gap-2">
          <div className="flex rounded-lg border border-border bg-blue-100 p-0.5">
            <button
              type="button"
              onClick={onSwitchToLive}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "live"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
              )}
            >
              <Zap className="size-3.5" />
              Live
            </button>
            <button
              type="button"
              onClick={onSwitchToLast5}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "last5"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
              )}
            >
              <List className="size-3.5" />
              Last 5
            </button>
          </div>
          {onRefreshQuakes && (
            <button
              type="button"
              onClick={onRefreshQuakes}
              disabled={quakeLoading}
              className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50 transition-colors"
              title="Refresh quakes"
            >
              <RefreshCw className={cn("size-4", quakeLoading && "animate-spin")} />
            </button>
          )}
        </div>
      )}

      {viewMode === "last5" && latestQuakes.length > 0 && onSelectQuake && (
        <Card className="rounded-2xl border-2 border-green-200 shadow-sm bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Latest 5</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-6 pt-0">
            <ul className="space-y-1">
              {latestQuakes.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onSelectQuake(q)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      quake.id === q.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="font-medium">M{q.magnitude}</span>
                    <span className="ml-2 text-muted-foreground">
                      {q.locationName}
                    </span>
                    <span className="ml-1 block truncate text-muted-foreground">
                      {q.timestamp
                        ? new Date(q.timestamp).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-2 border-blue-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-blue-900">
            {viewMode === "live" ? "Live Event" : "Selected Event"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-6 pt-0 text-sm">
          {quakeLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-3 w-full max-w-[200px] rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-foreground">
                  M{quake.magnitude}
                </span>
                <span className="text-muted-foreground">
                  {quake.depth} km depth · {quake.locationName}
                </span>
              </div>
              <p className="text-muted-foreground">{formattedTime}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-2 border-amber-200 shadow-sm bg-gradient-to-br from-amber-50 to-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-amber-900">Risk Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 p-6 pt-0">
          {riskZones.length > 0 ? (
            riskZones.map((z) => (
              <RiskBadge key={z.id} level={z.level} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              Generate plan to see risk zones
            </p>
          )}
        </CardContent>
      </Card>

      {planError && (
        <Card className="rounded-2xl border-destructive/50 border border-border bg-destructive/5 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-foreground">{planError}</p>
            {onRetryPlan && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={onRetryPlan}
              >
                Retry
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <Button
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          onClick={onGeneratePlan}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <FileText className="size-4" />
              Generate Response Plan
            </>
          )}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {isGenerating && !plan && (
          <Card className="rounded-2xl border border-border shadow-sm">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        )}
        {planGenerated && plan && !isGenerating && (
          <PlanPanel plan={plan} quake={quake} verified={planVerified} />
        )}
      </AnimatePresence>
    </aside>
  );
}
