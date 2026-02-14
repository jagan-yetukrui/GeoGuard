"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Radio, X } from "lucide-react";
import { cn } from "@/lib/utils";

const WAVE_BARS = 12;

export interface VoiceFloatingButtonProps {
  onOpenVoiceAssistant: () => void;
  chatOpen: boolean;
}

export function VoiceFloatingButton({
  onOpenVoiceAssistant,
  chatOpen,
}: VoiceFloatingButtonProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popupOpen) return;
    const handle = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-voice-button]")
      ) {
        setPopupOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [popupOpen]);

  return (
    <div className="fixed bottom-6 right-[5.5rem] z-50 flex flex-col items-center">
      <Button
        data-voice-button
        type="button"
        variant="default"
        size="icon"
        className={cn(
          "size-14 rounded-full shadow-lg transition-all",
          chatOpen && "scale-0 opacity-0 pointer-events-none"
        )}
        onClick={() => setPopupOpen((o) => !o)}
        aria-label="Voice assistant"
      >
        <Radio className="size-7" />
      </Button>

      {popupOpen && (
        <div
          ref={popupRef}
          className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-border bg-card p-4 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 pb-3">
            <span className="text-sm font-semibold text-foreground">
              Voice 911 Assistant
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 rounded-full"
              onClick={() => setPopupOpen(false)}
              aria-label="Close"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          {/* Music wave bars */}
          <div className="flex items-end justify-center gap-1 py-4 h-12">
            {Array.from({ length: WAVE_BARS }).map((_, i) => (
              <span
                key={i}
                className="voice-wave-bar h-10 w-1.5 rounded-full bg-primary"
                style={{
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground pb-3">
            Hear live brief & ask questions with voice
          </p>

          <Button
            type="button"
            className="w-full rounded-lg"
            size="sm"
            onClick={() => {
              setPopupOpen(false);
              onOpenVoiceAssistant();
            }}
          >
            Open Voice Assistant
          </Button>
        </div>
      )}
    </div>
  );
}
