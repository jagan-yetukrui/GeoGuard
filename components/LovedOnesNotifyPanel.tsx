"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuakeEvent, ResponsePlan } from "@/lib/types";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";

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

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader
        className="cursor-pointer select-none p-4"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Heart className="size-4 text-rose-500" />
            Notify Loved Ones
          </CardTitle>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4 p-4 pt-0">
          <div>
            <label className="mb-1 block text-xs font-medium">My status</label>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {CONTACTS.map((name) => (
              <div key={name}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{name}</p>
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-foreground">
                  {message.split(locationLink)[0]}
                  <a
                    href={locationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline break-all"
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
