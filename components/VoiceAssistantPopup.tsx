"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getChatResponse, getVoice, type ChatContext } from "@/lib/api";
import type { QuakeEvent, ResponsePlan } from "@/lib/types";
import { X, Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoiceAssistantPopupProps {
  open: boolean;
  onClose: () => void;
  quake: QuakeEvent;
  plan: ResponsePlan | null;
  anchorBottom: number;
  anchorRight: number;
}

export function VoiceAssistantPopup({
  open,
  onClose,
  quake,
  plan,
  anchorBottom = 100,
  anchorRight = 24,
}: VoiceAssistantPopupProps) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const chatContext: ChatContext = {
    quake_place: quake.locationName,
    quake_mag: quake.magnitude,
    quake_depth_km: quake.depth,
    plan_summary: plan?.summary ?? undefined,
    priority_actions: plan?.priorityActions ?? undefined,
    damage_score: plan?.damageScore ?? undefined,
    confidence: plan?.confidence ?? undefined,
  };

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const askAndSpeakRef = useRef<(q: string) => void>(() => {});
  const askAndSpeak = useCallback(
    async (question: string) => {
      if (!question.trim()) return;
      setError(null);
      setThinking(true);
      try {
        const res = await getChatResponse(question.trim(), chatContext);
        setLastReply(res.reply);
        setThinking(false);
        const v = await getVoice(res.reply);
        const binary = atob(v.audio_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: v.content_type });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        setSpeaking(true);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setSpeaking(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setSpeaking(false);
        };
        await audio.play();
      } catch (e) {
        setThinking(false);
        setError(e instanceof Error ? e.message : "Voice assistant unavailable");
      }
    },
    [chatContext]
  );
  askAndSpeakRef.current = askAndSpeak;

  useEffect(() => {
    if (!open) return;
    const SpeechRecognitionAPI =
      typeof window !== "undefined" &&
      (window.SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition);
    if (!SpeechRecognitionAPI) return;
    const recognition = new (window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) askAndSpeakRef.current(transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.abort();
      } catch {}
      recognitionRef.current = null;
    };
  }, [open]);

  const toggleMic = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setError(null);
      recognitionRef.current.start();
      setListening(true);
    }
  }, [listening]);

  useEffect(() => {
    if (!open) {
      stopAudio();
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
      setListening(false);
    }
  }, [open, stopAudio]);

  if (!open) return null;

  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

  return (
    <>
      {/* No full-screen overlay - just the popup */}
      <div
        className="fixed z-50 w-72 rounded-xl border border-border bg-card shadow-xl"
        style={{
          bottom: anchorBottom,
          right: anchorRight,
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Voice assistant</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-full"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <div className="p-3 space-y-2">
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Uses your mic + ElevenLabs. Ask about the current event.
          </p>
          {hasSpeechRecognition ? (
            <Button
              type="button"
              variant={listening ? "destructive" : "default"}
              size="sm"
              className="w-full gap-2"
              onClick={toggleMic}
              disabled={thinking || speaking}
            >
              {listening ? (
                <>
                  <MicOff className="size-4" />
                  Listening… tap to stop
                </>
              ) : thinking ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Thinking…
                </>
              ) : speaking ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Speaking…
                </>
              ) : (
                <>
                  <Mic className="size-4" />
                  Tap to speak
                </>
              )}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Use a browser that supports voice input (e.g. Chrome).
            </p>
          )}
          {lastReply && (
            <p className="line-clamp-3 text-xs text-muted-foreground border-t border-border pt-2">
              {lastReply}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
