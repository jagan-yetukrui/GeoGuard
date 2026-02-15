"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QuakeEvent, ResponsePlan } from "@/lib/types";
import { patriotAssist, getVoice } from "@/lib/api";
import type { PatriotAssistResponse } from "@/lib/api";
import { haversineKm } from "@/lib/mapUtils";
import { Loader2, Copy, Volume2, ChevronDown, ChevronUp, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const CITIZEN_BUTTONS: { label: string; promptId: string }[] = [
  { label: "Situation Summary", promptId: "situation_summary" },
];

const RESPONDER_BUTTONS: { label: string; promptId: string }[] = [
  { label: "Assign My Role", promptId: "responder_role_assignment" },
];

interface PatriotAssistantPanelProps {
  quake: QuakeEvent;
  plan?: ResponsePlan | null;
  selectedQuake?: QuakeEvent | null;
}

/** Offset epicenter by ~25% of high zone radius toward NE. Ensures demo point is inside red zone. */
function getDemoLocationInRedZone(
  epicenterLat: number,
  epicenterLng: number,
  highRadiusKm: number
): { lat: number; lng: number } {
  const offsetKm = highRadiusKm * 0.25;
  const degPerKmLat = 1 / 111;
  const degPerKmLng =
    1 / (111 * Math.max(0.01, Math.cos((epicenterLat * Math.PI) / 180)));
  const bearing = (45 * Math.PI) / 180;
  return {
    lat: epicenterLat + offsetKm * degPerKmLat * Math.cos(bearing),
    lng: epicenterLng + offsetKm * degPerKmLng * Math.sin(bearing),
  };
}

function buildContext(quake: QuakeEvent, plan?: ResponsePlan | null): Record<string, unknown> {
  const { lat: epicenterLat, lng: epicenterLng } = quake.coordinates ?? { lat: 0, lng: 0 };
  const area = quake.locationName || "affected area";

  const highRadiusKm = plan?.riskZones?.find((z) => z.level === "high")?.radiusKm ?? 8;
  const medRadiusKm = plan?.riskZones?.find((z) => z.level === "medium")?.radiusKm ?? 25;
  const lowRadiusKm = plan?.riskZones?.find((z) => z.level === "low")?.radiusKm ?? 60;

  const demo = getDemoLocationInRedZone(epicenterLat, epicenterLng, highRadiusKm);
  const distanceKm = haversineKm(epicenterLat, epicenterLng, demo.lat, demo.lng);

  let user_zone: "high" | "medium" | "low" | "outside" = "high";
  if (distanceKm <= highRadiusKm) user_zone = "high";
  else if (distanceKm <= medRadiusKm) user_zone = "medium";
  else if (distanceKm <= lowRadiusKm) user_zone = "low";
  else user_zone = "outside";

  const user_location = `Demo: ${distanceKm.toFixed(1)} km NE of epicenter in ${area} (${demo.lat.toFixed(4)}, ${demo.lng.toFixed(4)})`;

  const ctx: Record<string, unknown> = {
    quake: {
      id: quake.id,
      mag: quake.magnitude,
      place: quake.locationName,
      time: quake.timestamp,
      lat: epicenterLat,
      lng: epicenterLng,
      depth_km: quake.depth,
    },
    user_location,
    user_location_coords: { lat: demo.lat, lng: demo.lng },
    user_zone,
    distance_from_epicenter_km: Math.round(distanceKm * 10) / 10,
    demo_mode: true,
    area,
  };
  if (plan) {
    ctx.plan = {
      summary: plan.summary,
      priority_actions: plan.priorityActions,
      damage_score: plan.damageScore,
      confidence: plan.confidence,
    };
    ctx.zones = plan.riskZones?.map((z) => ({ level: z.level, label: z.label })) ?? [];
    ctx.infrastructure =
      plan.infraNodes?.map((n) => ({ name: n.name, type: n.type, lat: n.lat, lng: n.lng })) ?? [];
    ctx.population = "estimated from zone";
    ctx.routes = plan.routes?.length ?? 0;
    if (plan.hotspotsSummary) {
      ctx.hotspots = plan.hotspotsSummary;
    }
  } else {
    ctx.zones = [];
    ctx.infrastructure = [];
  }
  return ctx;
}

export function PatriotAssistantPanel({
  quake,
  plan,
  selectedQuake,
}: PatriotAssistantPanelProps) {
  const [mode, setMode] = useState<"citizen" | "responder">("citizen");
  const [result, setResult] = useState<PatriotAssistResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const q = selectedQuake ?? quake;

  const onAssist = useCallback(
    async (promptId: string, contextExtra?: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const context = { ...buildContext(q, plan), ...contextExtra };
        const res = await patriotAssist(promptId, context);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Service unavailable");
      } finally {
        setLoading(false);
      }
    },
    [q, plan]
  );

  const onCopy = useCallback(() => {
    if (!result) return;
    const text = [
      result.title,
      result.summary,
      ...(result.do_now?.length ? ["Do now:", ...result.do_now] : []),
      ...(result.steps?.length ? ["Steps:", ...result.steps] : []),
      ...(result.warnings?.length ? ["Warnings:", ...result.warnings] : []),
    ].join("\n");
    void navigator.clipboard.writeText(text);
  }, [result]);

  const onPlayVoice = useCallback(async () => {
    if (!result || voiceLoading) return;
    setVoiceLoading(true);
    try {
      const toSpeak = result.summary || result.title || "No content.";
      const v = await getVoice(toSpeak);
      const binary = atob(v.audio_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: v.content_type });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setVoiceLoading(false);
    }
  }, [result, voiceLoading]);

  const buttons = mode === "citizen" ? CITIZEN_BUTTONS : RESPONDER_BUTTONS;

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader
        className="cursor-pointer select-none p-4"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Patriot Assistant</CardTitle>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3 p-4 pt-0">
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setMode("citizen")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                mode === "citizen"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="size-3.5" />
              Citizen
            </button>
            <button
              type="button"
              onClick={() => setMode("responder")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                mode === "responder"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Shield className="size-3.5" />
              Responder
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {buttons.map((b) => (
              <Button
                key={b.promptId + b.label}
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={loading}
                onClick={() => onAssist(b.promptId)}
              >
                {b.label}
              </Button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Generating…</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && !loading && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium">{result.title}</h4>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={onCopy}>
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={onPlayVoice}
                    disabled={voiceLoading}
                  >
                    {voiceLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{result.summary}</p>
              {result.do_now && result.do_now.length > 0 && (
                <div>
                  <h5 className="mb-1 text-xs font-medium">Do now</h5>
                  <ul className="list-inside list-disc space-y-0.5 text-sm">
                    {result.do_now.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.steps && result.steps.length > 0 && (
                <div>
                  <h5 className="mb-1 text-xs font-medium">Steps</h5>
                  <ol className="list-inside list-decimal space-y-0.5 text-sm">
                    {result.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}
              {result.warnings && result.warnings.length > 0 && (
                <div>
                  <h5 className="mb-1 text-xs font-medium text-amber-600">Warnings</h5>
                  <ul className="list-inside list-disc space-y-0.5 text-sm text-amber-700 dark:text-amber-400">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {result.confidence} confidence
                </Badge>
                {result.sources_used && result.sources_used.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Sources: {result.sources_used.slice(0, 2).join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
