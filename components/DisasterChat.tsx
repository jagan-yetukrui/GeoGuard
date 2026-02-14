"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getChatResponse } from "@/lib/api";
import type { QuakeEvent, ResponsePlan } from "@/lib/types";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DisasterChatProps {
  selectedQuake: QuakeEvent;
  plan: ResponsePlan | null;
  onOpenChange?: (open: boolean) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export function DisasterChat({ selectedQuake, plan, onOpenChange }: DisasterChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setOpenAndNotify = useCallback(
    (value: boolean) => {
      setOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange]
  );

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      const context = {
        quake_place: selectedQuake.locationName,
        quake_mag: selectedQuake.magnitude,
        quake_depth_km: selectedQuake.depth,
        plan_summary: plan?.summary ?? undefined,
        priority_actions: plan?.priorityActions ?? undefined,
        damage_score: plan?.damageScore ?? undefined,
        confidence: plan?.confidence ?? undefined,
      };
      const res = await getChatResponse(text, context);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: res.reply,
          timestamp: Date.now(),
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chat unavailable";
      const friendly =
        msg.includes("GEMINI_API_KEY") || msg.includes("503")
          ? "Chat isn’t available. Add GEMINI_API_KEY to backend/.env and restart the backend server."
          : msg;
      setError(friendly);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="icon"
        className={cn(
          "fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg transition-all",
          open && "scale-0 opacity-0 pointer-events-none"
        )}
        onClick={() => setOpenAndNotify(true)}
        aria-label="Open disaster chat"
      >
        <MessageCircle className="size-7" />
      </Button>

      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl transition-all duration-200",
          "w-[min(420px,calc(100vw-3rem))]",
          open ? "h-[min(520px,70vh)] opacity-100" : "h-0 w-0 min-w-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
          <span className="font-semibold text-foreground">911-style disaster assistant</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            onClick={() => setOpenAndNotify(false)}
            aria-label="Close chat"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-3 space-y-3"
        >
          {messages.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">
              Ask about the current event, evacuation, first aid, or next steps. Answers use this quake and plan data.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-xl px-3 py-2 text-sm max-w-[90%]",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted text-foreground"
              )}
            >
              {m.text}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm px-3 py-2">
              <Loader2 className="size-4 animate-spin" />
              <span>Getting suggestions…</span>
            </div>
          )}
        </div>
        {error && (
          <div className="shrink-0 px-3 py-1.5 text-destructive text-xs bg-destructive/10">
            {error}
          </div>
        )}
        <div className="shrink-0 flex gap-2 p-3 border-t border-border">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask a question…"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            disabled={sending}
          />
          <Button
            type="button"
            size="icon"
            className="shrink-0"
            onClick={send}
            disabled={sending || !input.trim()}
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
