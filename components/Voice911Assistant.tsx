"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  getVoiceIntro,
  getChatResponse,
  getVoice,
  type ChatContext,
} from "@/lib/api";
import type { QuakeEvent, ResponsePlan } from "@/lib/types";
import {
  X,
  Volume2,
  Mic,
  MicOff,
  Send,
  Loader2,
  RotateCcw,
  Square,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DISCLAIMER =
  "Not a substitute for emergency services. If you are in immediate danger, call local emergency services.";

export interface Voice911AssistantProps {
  open: boolean;
  onClose: () => void;
  quake: QuakeEvent;
  plan: ResponsePlan | null;
}

export function Voice911Assistant({
  open,
  onClose,
  quake,
  plan,
}: Voice911AssistantProps) {
  const [introPlaying, setIntroPlaying] = useState(false);
  const [replyPlaying, setReplyPlaying] = useState(false);
  const [loadingIntro, setLoadingIntro] = useState(false);
  const [loadingReply, setLoadingReply] = useState(false);
  const [input, setInput] = useState("");
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
    setIntroPlaying(false);
    setReplyPlaying(false);
  }, []);

  const playAudio = useCallback(
    async (text: string, onPlaying: () => void, onDone: () => void) => {
      stopAudio();
      try {
        const v = await getVoice(text);
        const binary = atob(v.audio_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: v.content_type });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        onPlaying();
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          onDone();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          onDone();
        };
        await audio.play();
      } catch {
        onDone();
      }
    },
    [stopAudio]
  );

  const playLiveBrief = useCallback(async () => {
    setError(null);
    setLoadingIntro(true);
    try {
      const res = await getVoiceIntro({
        quake_place: quake.locationName,
        quake_mag: quake.magnitude,
        depth_km: quake.depth,
        plan_summary: plan?.summary ?? undefined,
        priority_actions: plan?.priorityActions ?? undefined,
      });
      await playAudio(res.script, setIntroPlaying, setIntroPlaying);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Voice brief unavailable");
    } finally {
      setLoadingIntro(false);
    }
  }, [quake, plan, playAudio]);

  const askAndSpeak = useCallback(
    async (question: string) => {
      if (!question.trim() || loadingReply) return;
      setError(null);
      setLoadingReply(true);
      try {
        const res = await getChatResponse(question.trim(), chatContext);
        setLastReply(res.reply);
        await playAudio(res.reply, setReplyPlaying, setReplyPlaying);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Assistant unavailable");
      } finally {
        setLoadingReply(false);
      }
    },
    [chatContext, loadingReply, playAudio]
  );

  const onSend = useCallback(() => {
    const q = input.trim();
    if (!q) return;
    setInput("");
    askAndSpeak(q);
  }, [input, askAndSpeak]);

  const onRepeatLast = useCallback(() => {
    if (lastReply && !replyPlaying && !introPlaying) {
      playAudio(lastReply, setReplyPlaying, setReplyPlaying);
    }
  }, [lastReply, replyPlaying, introPlaying, playAudio]);

  useEffect(() => {
    if (!open) return;
    const SpeechRecognitionAPI =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition);
    if (!SpeechRecognitionAPI) return;
    const recognition = new (window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) {
        setInput(transcript);
        askAndSpeak(transcript);
      }
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [open, askAndSpeak]);

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
    if (!open) stopAudio();
    return () => stopAudio();
  }, [open, stopAudio]);

  if (!open) return null;

  const isPlaying = introPlaying || replyPlaying;
  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-900">
          {DISCLAIMER}
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Radio className="size-5 text-primary" />
            <span className="font-semibold">Voice 911 Assistant</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              stopAudio();
              onClose();
            }}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Live data: M{quake.magnitude} at {quake.locationName}
            {plan ? " · Plan loaded" : ""}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={playLiveBrief}
              disabled={loadingIntro || isPlaying}
            >
              {loadingIntro ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Volume2 className="size-4" />
              )}
              Play live situation brief
            </Button>
            <p className="text-xs text-muted-foreground">
              Hear current event and key steps in a calm voice (ElevenLabs).
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium">Ask anything — response is spoken aloud</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSend()}
                placeholder="e.g. What should I do first? Is it safe to go outside?"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                disabled={loadingReply || isPlaying}
              />
              {hasSpeechRecognition && (
                <Button
                  type="button"
                  variant={listening ? "destructive" : "outline"}
                  size="icon"
                  onClick={toggleMic}
                  disabled={loadingReply || isPlaying}
                  aria-label={listening ? "Stop listening" : "Speak"}
                >
                  {listening ? (
                    <MicOff className="size-4" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                onClick={onSend}
                disabled={!input.trim() || loadingReply || isPlaying}
                aria-label="Send"
              >
                {loadingReply ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
            {hasSpeechRecognition && (
              <p className="mt-1 text-xs text-muted-foreground">
                Or tap the mic to speak your question.
              </p>
            )}
          </div>

          {(introPlaying || replyPlaying) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Speaking…
            </div>
          )}

          {lastReply && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Last response</p>
              <p className="whitespace-pre-wrap text-sm">{lastReply}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 gap-1.5"
                onClick={onRepeatLast}
                disabled={isPlaying}
              >
                <RotateCcw className="size-3.5" />
                Repeat
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            {isPlaying && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={stopAudio}
              >
                <Square className="size-3.5" />
                Stop
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
