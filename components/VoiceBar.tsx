"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceBarProps {
  briefingPlaying: boolean;
  onToggleBriefing: () => void;
}

export function VoiceBar({ briefingPlaying, onToggleBriefing }: VoiceBarProps) {
  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">
            Emergency Briefing
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleBriefing}
            className="shrink-0"
          >
            {briefingPlaying ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
        </div>
        {briefingPlaying && (
          <div
            className={cn(
              "mt-2 flex items-center gap-2 text-xs text-muted-foreground"
            )}
          >
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
            Playing…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
