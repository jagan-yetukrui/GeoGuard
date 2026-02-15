"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuakeSidebarProps } from "@/components/QuakeSidebar.types";
import { PlanPanel } from "@/components/PlanPanel";
import { PatriotAssistantPanel } from "@/components/PatriotAssistantPanel";
import { ResourceAllocationPanel } from "@/components/ResourceAllocationPanel";
import { LovedOnesNotifyPanel } from "@/components/LovedOnesNotifyPanel";
import { SafeRoutesPanel } from "@/components/SafeRoutesPanel";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, PlayCircle, ShieldCheck, Save, List, Zap, RefreshCw, Heart, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onRouteSelect,
  onRouteZoom,
  selectedRouteId,
}: QuakeSidebarProps) {
  const formattedTime = quake.timestamp
    ? new Date(quake.timestamp).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
  return (
    <aside className="flex h-full w-full flex-col gap-5 overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="GeoGuard"
          width={218}
          height={218}
          className="size-16 shrink-0 object-cover"
          priority
        />
        <div className="-ml-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">Geo</span>
              <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">Guard</span>
            </h1>
            {offlineMode && (
              <Badge variant="secondary" className="text-xs">
                Offline mode
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/90">
            Earthquake Response & Safety <span className="text-rose-500/70">♥</span>
          </p>
        </div>
      </div>

      {onSwitchToLive && onSwitchToLast5 && (
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border/80 bg-muted/40 p-0.5 shadow-sm">
            <button
              type="button"
              onClick={onSwitchToLive}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200",
                viewMode === "live"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Zap className="size-3.5" />
              Live
            </button>
            <button
              type="button"
              onClick={onSwitchToLast5}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200",
                viewMode === "last5"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              title="Refresh quakes"
            >
              <RefreshCw className={cn("size-4", quakeLoading && "animate-spin")} />
            </button>
          )}
        </div>
      )}

      {viewMode === "last5" && latestQuakes.length > 0 && onSelectQuake && (
        <Card className="rounded-2xl border border-border/80 bg-card/95 shadow-sm card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Latest 5</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-6 pt-0">
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {latestQuakes.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onSelectQuake(q)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      quake.id === q.id
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/20"
                        : "border-border/80 hover:bg-muted/50"
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

      <Card className="rounded-2xl border border-border/80 bg-card/95 shadow-sm card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {viewMode === "live" ? "Live event" : "Selected event"}
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
          className="w-full rounded-xl font-semibold shadow-md transition-all hover:shadow-lg"
          onClick={onGeneratePlan}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Heart className="size-4 animate-heart-rotate fill-rose-500 text-rose-500" />
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
          <Card className="overflow-hidden rounded-2xl border border-rose-200/60 bg-gradient-to-b from-rose-50/30 to-card shadow-sm dark:border-rose-900/30 dark:from-rose-950/20 dark:to-card">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4">
                <Heart className="size-10 animate-heart-rotate fill-rose-500 text-rose-500" />
                <p className="text-sm font-medium text-rose-700/90 dark:text-rose-300/90">
                  Building your plan with care…
                </p>
                <div className="flex w-full gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 flex-1 rounded-full bg-rose-300/70 dark:bg-rose-700/50 animate-pulse-bar"
                      style={{ animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {planGenerated && plan && !isGenerating && (
          <PlanPanel plan={plan} quake={quake} verified={planVerified} />
        )}
      </AnimatePresence>

      {plan && (
        <SafeRoutesPanel
          plan={plan}
          selectedRouteId={selectedRouteId}
          onRouteSelect={onRouteSelect}
          onRouteZoom={onRouteZoom}
        />
      )}

      <div className="mt-4 space-y-4">
        <PatriotAssistantPanel quake={quake} plan={plan} selectedQuake={quake} />
        <ResourceAllocationPanel quake={quake} plan={plan} />
        <LovedOnesNotifyPanel quake={quake} plan={plan} />
        <Card className="overflow-hidden rounded-2xl border border-rose-200/60 bg-gradient-to-b from-rose-50/50 to-card shadow-sm card-hover dark:border-rose-900/30 dark:from-rose-950/20 dark:to-card">
          <CardHeader className="border-b border-rose-100/50 bg-rose-50/30 p-4 dark:border-rose-900/20 dark:bg-rose-950/20">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-7 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
                <Heart className="size-3.5 fill-current" />
              </span>
              Find my gf/bf
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 rounded-xl border border-rose-200/50 bg-white/80 p-3 dark:border-rose-800/30 dark:bg-rose-950/20">
              <MapPin className="size-5 shrink-0 text-rose-500" />
              <div>
                <p className="text-sm font-medium text-foreground">She is in Alexandria</p>
                <p className="text-xs text-muted-foreground">Your girlfriend&apos;s location</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}
