"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuakeSidebarProps } from "@/components/QuakeSidebar.types";
import { PlanPanel } from "@/components/PlanPanel";
import { VoiceBar } from "@/components/VoiceBar";
import type { RiskLevel } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, FileText, PlayCircle, ShieldCheck, Save, List, Zap, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function RiskBadge({ level }: { level: RiskLevel }) {
  const classByLevel = {
    high: "bg-red-50 text-red-900 border-red-300 font-semibold",
    medium: "bg-amber-50 text-amber-900 border-amber-300 font-semibold",
    low: "bg-green-50 text-green-900 border-green-300 font-semibold",
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
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6 bg-background" role="complementary" aria-label="Emergency response details and controls">
      <div className="flex items-center gap-4 pb-2 border-b border-border">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-2 ring-primary/20">
          <Image
            src="/logo.png"
            alt="GeoGuard Logo"
            width={96}
            height={96}
            className="size-full object-contain p-1"
            priority
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              GeoGuard
            </h1>
            {offlineMode && (
              <Badge variant="secondary" className="text-xs font-medium">
                ⚠ Offline mode
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground font-medium">Real-time Emergency Response Intelligence</p>
        </div>
      </div>

      <Card className="rounded-lg border border-border shadow-sm bg-card" role="region" aria-label="View mode selector">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">View Mode</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-secondary/30 p-0.5">
              <button
                type="button"
                onClick={onSwitchToLive}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-all",
                  viewMode === "live"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background"
                )}
                aria-pressed={viewMode === "live"}
                aria-label="View live earthquake event"
              >
                <Zap className="size-4" />
                Live
              </button>
              <button
                type="button"
                onClick={onSwitchToLast5}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-all",
                  viewMode === "last5"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background"
                )}
                aria-pressed={viewMode === "last5"}
                aria-label="View last 5 earthquake events"
              >
                <List className="size-4" />
                Last 5
              </button>
            </div>
            {onRefreshQuakes && (
              <button
                type="button"
                onClick={onRefreshQuakes}
                disabled={quakeLoading}
                className="rounded px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
                title="Refresh earthquake data"
                aria-label="Refresh earthquake data"
                aria-busy={quakeLoading}
              >
                <RefreshCw className={cn("size-4", quakeLoading && "animate-spin")} />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {viewMode === "last5" && latestQuakes.length > 0 && onSelectQuake && (
        <Card className="rounded-lg border border-border shadow-sm bg-card" role="region" aria-label="Recent earthquakes list">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📋 Latest 5 Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-4 pt-0">
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {latestQuakes.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onSelectQuake(q)}
                    className={cn(
                      "w-full rounded-lg border-2 px-3 py-2 text-left text-xs transition-all",
                      quake.id === q.id
                        ? "border-primary bg-primary/10 text-foreground font-semibold"
                        : "border-border hover:border-border/80 hover:bg-secondary/50"
                    )}
                    aria-selected={quake.id === q.id}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-primary">M{q.magnitude}</span>
                      <span className="truncate text-muted-foreground">
                        {q.locationName}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground block mt-1">
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

      <Card className="rounded-lg border border-border shadow-sm bg-card" role="region" aria-label="Event details">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {viewMode === "live" ? "🔴 Live Event" : "📍 Selected Event"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 text-sm">
          {quakeLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-5 w-20 rounded bg-muted" />
              <div className="h-4 w-full max-w-[200px] rounded bg-muted" />
              <div className="h-4 w-32 rounded bg-muted" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-primary aria-label='Magnitude'">M{quake.magnitude}</span>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{quake.locationName}</p>
                  <p className="text-xs text-muted-foreground">{quake.depth} km depth</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-medium bg-secondary/40 p-2 rounded">
                ⏰ {formattedTime}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg border border-border shadow-sm bg-card" role="region" aria-label="Risk summary">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📊 Risk Zones</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 p-4 pt-0">
          {riskZones.length > 0 ? (
            riskZones.map((z) => (
              <div key={z.id} className="flex flex-col gap-1">
                <RiskBadge level={z.level} />
                <span className="text-xs text-muted-foreground">{z.radiusKm}km radius</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground font-medium">Generate a response plan to assess risk zones</p>
          )}
        </CardContent>
      </Card>

      {planError && (
        <Card className="rounded-lg border-2 border-destructive bg-destructive/5 shadow-sm" role="alert">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive">⚠️ Error generating plan</p>
            <p className="text-xs text-foreground mt-1">{planError}</p>
            {onRetryPlan && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={onRetryPlan}
              >
                Retry
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 my-2">
        <Button
          className="w-full rounded-lg h-11 font-semibold text-base"
          onClick={onGeneratePlan}
          disabled={isGenerating}
          aria-busy={isGenerating}
          aria-label={isGenerating ? "Generating response plan" : "Generate response plan"}
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-5 animate-spin mr-2" />
              Generating Plan…
            </>
          ) : (
            <>
              <FileText className="size-5 mr-2" />
              Generate Response Plan
            </>
          )}
        </Button>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg font-semibold"
            onClick={onToggleBriefing}
            disabled={briefingLoading || !planGenerated}
            aria-busy={briefingLoading}
            aria-label={briefingLoading ? "Generating audio briefing" : "Play audio briefing"}
          >
            {briefingLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            {briefingLoading ? "Generating…" : "🔊 Briefing"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg font-semibold"
            onClick={onVerifyPlan}
            disabled={!planGenerated}
            aria-label="Verify and validate response plan"
          >
            <ShieldCheck className="size-4" />
            ✓ Verify
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full rounded-lg font-semibold"
          onClick={onSavePlan}
          disabled={!planGenerated}
          aria-label={planSaved ? "Plan saved" : "Save response plan"}
        >
          <Save className="size-4" />
          {planSaved ? "✓ Saved" : "💾 Save"}
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

      <VoiceBar
        briefingPlaying={briefingPlaying}
        onToggleBriefing={onToggleBriefing}
      />
    </aside>
  );
}
