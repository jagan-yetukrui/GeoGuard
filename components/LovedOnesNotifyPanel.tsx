"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuakeEvent, ResponsePlan } from "@/lib/types";
import { ChevronDown, ChevronUp, Heart, Sparkles } from "lucide-react";

const CONTACTS = ["Mom", "Dad", "Rao"];

const MOCK_MESSAGES: Record<string, string> = {
  stuck_red_zone:
    "URGENT: Jagan is in the area of impact near the earthquake ({area}). May need help. Time: {timestamp}. Use this link to see his location: {locationLink} — Call emergency services if in immediate danger.",
  evacuating:
    "Update: Jagan is evacuating to a shelter in {area}. Time: {timestamp}. Use this link to see his location: {locationLink} — Call emergency services if in immediate danger.",
  safe_shelter:
    "Jagan is safe at a shelter following the earthquake in {area}. Time: {timestamp}. Use this link to see his location: {locationLink}",
  safe_hospital:
    "Jagan is safe at a hospital in {area}. Time: {timestamp}. Use this link to see his location: {locationLink}",
  safe_elsewhere:
    "Jagan is safe in {area}. Time: {timestamp}. Use this link to see his location: {locationLink}",
};

const STATUSES = [
  { id: "stuck_red_zone", label: "In danger (red zone)" },
  { id: "evacuating", label: "Evacuating to shelter" },
  { id: "safe_shelter", label: "Safe at shelter" },
  { id: "safe_hospital", label: "Safe at hospital" },
  { id: "safe_elsewhere", label: "Safe elsewhere" },
] as const;

const VALENTINE_HINTS = [
  "💕 They’ll want to know you’re okay—reach out as soon as you can.",
  "💝 A quick message can ease worries. Keep it short and clear.",
  "💗 Share your location so they can check on you.",
  "💖 In emergencies, loved ones worry most. Stay calm and stay connected.",
];

interface LovedOnesNotifyPanelProps {
  quake: QuakeEvent;
  plan?: ResponsePlan | null;
}

export function LovedOnesNotifyPanel({ quake, plan }: LovedOnesNotifyPanelProps) {
  const [status, setStatus] = useState("stuck_red_zone");
  const [expanded, setExpanded] = useState(false);

  const { message, locationLink } = useMemo(() => {
    const template = MOCK_MESSAGES[status] ?? MOCK_MESSAGES.safe_elsewhere;
    const area = quake.locationName || "affected area";
    const { lat, lng } = quake.coordinates;
    const link = `https://www.google.com/maps?q=${lat},${lng}`;
    const msg = template
      .replace("{timestamp}", new Date().toLocaleString())
      .replace("{area}", area)
      .replace("{locationLink}", link);
    return { message: msg, locationLink: link };
  }, [status, quake.locationName, quake.coordinates]);

  const hintIndex = useMemo(() => Math.floor(Math.random() * VALENTINE_HINTS.length), []);

  return (
    <Card className="overflow-hidden rounded-2xl border border-rose-200/60 bg-gradient-to-b from-rose-50/50 to-card shadow-sm card-hover dark:border-rose-900/30 dark:from-rose-950/20 dark:to-card">
      <CardHeader
        className="cursor-pointer select-none border-b border-rose-100/50 bg-rose-50/30 p-4 dark:border-rose-900/20 dark:bg-rose-950/20"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-7 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
                <Heart className="size-3.5 fill-current" />
              </span>
              Notify Loved Ones
            </CardTitle>
            <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-400/80">
              Keep them in the loop—they care about you 💕
            </p>
          </div>
          {expanded ? <ChevronUp className="size-4 text-rose-500" /> : <ChevronDown className="size-4 text-rose-500" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4 p-4 pt-4">
          <div className="flex items-start gap-2 rounded-xl border border-rose-200/50 bg-rose-50/40 px-3 py-2 dark:border-rose-800/30 dark:bg-rose-950/30">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
            <p className="text-xs text-rose-700/90 dark:text-rose-300/90">
              {VALENTINE_HINTS[hintIndex]}
            </p>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
              <span>My status</span>
              <span className="text-rose-500/70">— pick what fits</span>
            </label>
            <select
              className="w-full rounded-xl border border-rose-200/60 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300/50 dark:border-rose-800/40 dark:focus:ring-rose-700/30"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Copy & send to your people 💌
            </p>
            {CONTACTS.map((name) => (
              <div key={name}>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-700/90 dark:text-rose-300/90">
                  <Heart className="size-3" />
                  {name}
                </p>
                <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 text-sm text-foreground dark:border-rose-800/30 dark:bg-rose-950/20">
                  {message.split(locationLink)[0]}
                  <a
                    href={locationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-600 underline decoration-rose-300 break-all hover:text-rose-700 dark:text-rose-400 dark:decoration-rose-600"
                  >
                    {locationLink}
                  </a>
                  {message.split(locationLink)[1]}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
