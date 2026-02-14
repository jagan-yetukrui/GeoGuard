"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getTriage, get911Summary, getVoice } from "@/lib/api";
import type { QuakeEvent, ResponsePlan } from "@/lib/types";
import type { TriageRiskLevel } from "@/lib/api";
import {
  X,
  Phone,
  Copy,
  Volume2,
  AlertTriangle,
  Heart,
  Route,
  Stethoscope,
  FileText,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SITUATION_OPTIONS = [
  { id: "injured", label: "I'm Injured", icon: Heart },
  { id: "trapped", label: "I'm Trapped", icon: AlertTriangle },
  { id: "evac_route", label: "I Need Evac Route", icon: Route },
  { id: "medical_steps", label: "Medical Steps", icon: Stethoscope },
] as const;

const DISCLAIMER =
  "Not a substitute for emergency services. If you are in immediate danger, call local emergency services.";

export interface EmergencyAssistantProps {
  open: boolean;
  onClose: () => void;
  quake: QuakeEvent;
  plan: ResponsePlan | null;
}

type Step = "scenario" | "triage" | "summary";

export function EmergencyAssistant({
  open,
  onClose,
  quake,
  plan,
}: EmergencyAssistantProps) {
  const [step, setStep] = useState<Step>("scenario");
  const [situationType, setSituationType] = useState<string>("");
  const [triageResult, setTriageResult] = useState<{
    risk_level: TriageRiskLevel;
    next_steps: string[];
    questions: string[];
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [script911, setScript911] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const quakeContext = plan
    ? `M${quake.magnitude} at ${quake.locationName}, depth ${quake.depth} km. ${plan.summary}`
    : `M${quake.magnitude} at ${quake.locationName}`;
  const locationText = quake.locationName || "Unknown";
  const bestAccess = plan?.stations?.[0]?.name
    ? `Nearest help: ${plan.stations[0].name}`
    : "";

  const runTriage = useCallback(
    async (situation: string, answersSoFar: Record<string, string> = {}) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTriage({
          situation_type: situation,
          lat: quake.coordinates?.lat,
          lng: quake.coordinates?.lng,
          quake_context: quakeContext,
          answers_so_far: answersSoFar,
        });
        setTriageResult(res);
        setStep("triage");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Triage unavailable");
      } finally {
        setLoading(false);
      }
    },
    [quake, quakeContext]
  );

  const onSelectScenario = useCallback(
    (id: string) => {
      setSituationType(id);
      setAnswers({});
      setTriageResult(null);
      setScript911(null);
      runTriage(id, {});
    },
    [runTriage]
  );

  const onAnswerQuestion = useCallback((question: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [question]: value }));
  }, []);

  const onGenerate911Summary = useCallback(async () => {
    if (!triageResult) return;
    setLoading(true);
    setError(null);
    try {
      const res = await get911Summary({
        situation_type: situationType,
        risk_level: triageResult.risk_level,
        location_text: locationText,
        answers,
        best_access: bestAccess || undefined,
      });
      setScript911(res.script_911);
      setStep("summary");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Summary unavailable");
    } finally {
      setLoading(false);
    }
  }, [triageResult, situationType, locationText, answers, bestAccess]);

  const copyScript = useCallback(() => {
    if (!script911) return;
    navigator.clipboard.writeText(script911);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [script911]);

  const playVoice = useCallback(
    async (text: string) => {
      if (voicePlaying) return;
      setVoicePlaying(true);
      try {
        const v = await getVoice(text);
        const binary = atob(v.audio_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: v.content_type });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          setVoicePlaying(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setVoicePlaying(false);
          URL.revokeObjectURL(url);
        };
        await audio.play();
      } catch {
        setVoicePlaying(false);
      }
    },
    [voicePlaying]
  );

  const handleClose = useCallback(() => {
    setStep("scenario");
    setSituationType("");
    setTriageResult(null);
    setScript911(null);
    setAnswers({});
    setError(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const stepNumber =
    step === "scenario" ? 1 : step === "triage" ? 2 : 3;
  const stepLabel =
    step === "scenario"
      ? "Choose scenario"
      : step === "triage"
        ? "Next steps & questions"
        : "911 script";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div
        className={cn(
          "flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        )}
      >
        {/* Disclaimer banner */}
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-900">
          {DISCLAIMER}
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Emergency Assistant</span>
            <span className="text-xs text-muted-foreground">
              Step {stepNumber} — {stepLabel}
            </span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === "scenario" && (
            <>
              <p className="text-sm text-muted-foreground">
                Select your situation. You’ll get immediate steps and optional follow-up questions.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SITUATION_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    className="h-auto flex-col gap-2 py-4"
                    onClick={() => onSelectScenario(id)}
                    disabled={loading}
                  >
                    <Icon className="size-6" />
                    <span>{label}</span>
                  </Button>
                ))}
              </div>
              {loading && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Getting next steps…</span>
                </div>
              )}
            </>
          )}

          {step === "triage" && triageResult && (
            <>
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium",
                  triageResult.risk_level === "critical" &&
                    "border-red-300 bg-red-50 text-red-800",
                  triageResult.risk_level === "urgent" &&
                    "border-amber-300 bg-amber-50 text-amber-800",
                  triageResult.risk_level === "stable" &&
                    "border-emerald-300 bg-emerald-50 text-emerald-800"
                )}
              >
                Risk: {triageResult.risk_level}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Immediate actions</h3>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {triageResult.next_steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              {triageResult.questions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Quick questions</h3>
                  <div className="space-y-2">
                    {triageResult.questions.map((q, i) => (
                        <div key={i} className="rounded-lg border border-border p-2">
                          <p className="text-sm font-medium">{q}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {["Yes", "No", "Unsure"].map((opt) => (
                              <Button
                                key={opt}
                                type="button"
                                size="sm"
                                variant={
                                  answers[q] === opt ? "default" : "outline"
                                }
                                onClick={() => onAnswerQuestion(q, opt)}
                              >
                                {opt}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={onGenerate911Summary}
                  disabled={loading}
                  className="gap-2"
                >
                  <FileText className="size-4" />
                  Generate 911 Summary
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => playVoice(triageResult.next_steps.join(". "))}
                  disabled={voicePlaying}
                  className="gap-2"
                >
                  {voicePlaying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Volume2 className="size-4" />
                  )}
                  Play Voice Guidance
                </Button>
              </div>
            </>
          )}

          {step === "summary" && script911 && (
            <>
              <div>
                <h3 className="mb-2 text-sm font-semibold">911-ready script</h3>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  {script911}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={copyScript} className="gap-2">
                  <Copy className="size-4" />
                  {copied ? "Copied!" : "Copy 911 Script"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => playVoice(script911)}
                  disabled={voicePlaying}
                  className="gap-2"
                >
                  {voicePlaying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Volume2 className="size-4" />
                  )}
                  Play Voice
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Footer: Call 911 + Notify contacts */}
        <div className="shrink-0 border-t border-border bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="tel:911"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Phone className="size-4" />
              Call Emergency Services (911)
            </a>
            <span className="text-xs text-muted-foreground">
              On desktop: dial 911 or your local emergency number.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 gap-2"
            onClick={() => {
              /* Mock: could integrate Twilio later */
              alert("Notify Emergency Contacts: Add phone numbers in settings. (Demo: not sent.)");
            }}
          >
            Notify Emergency Contacts
          </Button>
        </div>
      </div>
    </div>
  );
}
