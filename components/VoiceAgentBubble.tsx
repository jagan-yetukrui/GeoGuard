"use client";

import { Button } from "@/components/ui/button";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoiceAgentBubbleProps {
  onClick: () => void;
  open: boolean;
}

export function VoiceAgentBubble({ onClick, open }: VoiceAgentBubbleProps) {
  return (
    <Button
      type="button"
      variant="default"
      size="icon"
      className={cn(
        "fixed bottom-6 right-[5.5rem] z-50 size-14 rounded-full shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/25",
        open && "scale-0 opacity-0 pointer-events-none"
      )}
      onClick={onClick}
      aria-label="Open voice agent"
    >
      <Radio className="size-7" />
    </Button>
  );
}
