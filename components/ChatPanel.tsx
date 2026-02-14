"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Loader, Volume2, Mic } from "lucide-react";
import { chatWithBot, getVoice } from "@/lib/api";
import type { ResponsePlan, ChatMessage, ChatbotResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  quakeId?: string;
  plan?: ResponsePlan;
  isActive?: boolean;
}

export function ChatPanel({ quakeId, plan, isActive = true }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [listeningToRequest, setListeningToRequest] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading || !isActive) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message
    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    setLoading(true);
    try {
      const response = await chatWithBot(userMessage, quakeId, plan, messages);

      if (response.message) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: response.message,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Auto-play response voice if available
        if (response.message && response.message.length > 0) {
          try {
            const voiceResp = await getVoice(response.message);
            if (voiceResp.audio_base64 && audioRef.current) {
              audioRef.current.src = `data:${voiceResp.content_type};base64,${voiceResp.audio_base64}`;
              setTimeout(() => {
                audioRef.current?.play().catch(() => {
                  // Silent fail if autoplay not allowed
                });
              }, 200);
            }
          } catch {
            // Voice generation failed, continue without audio
          }
        }
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          error instanceof Error
            ? `Error: ${error.message}`
            : "Unable to get a response. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = async () => {
    if (listeningToRequest || loading || !isActive) return;

    // Check for Web Speech API support
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      alert(
        "Voice input not supported in your browser. Please use the text input instead."
      );
      return;
    }

    setListeningToRequest(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let transcript = "";

    recognition.onstart = () => {
      // Microphone active
    };

    recognition.onresult = (event: any) => {
      transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (event.results[event.results.length - 1].isFinal) {
        // Final result - process it
        if (transcript.trim()) {
          setInput(transcript.trim());
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setListeningToRequest(false);
    };

    recognition.onend = () => {
      setListeningToRequest(false);
    };

    try {
      recognition.start();
    } catch {
      setListeningToRequest(false);
    }
  };

  const handlePlayResponse = (text: string) => {
    if (voiceLoading) return;
    setVoiceLoading(true);
    getVoice(text)
      .then((resp) => {
        if (audioRef.current && resp.audio_base64) {
          audioRef.current.src = `data:${resp.content_type};base64,${resp.audio_base64}`;
          audioRef.current.play();
        }
      })
      .catch((error) => {
        console.error("Voice playback error:", error);
      })
      .finally(() => {
        setVoiceLoading(false);
      });
  };

  return (
    <Card className={cn("h-full flex flex-col rounded-2xl border shadow-sm", !isActive && "opacity-50")}>
      <CardHeader className="border-b">
        <CardTitle className="text-lg">Emergency Assistant</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Ask for guidance on what to do and how to react
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 p-4 gap-4">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-2">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  {!isActive
                    ? "Generate a response plan first"
                    : "Ask me anything about the emergency response"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  E.g., "What should I do now?", "Where are the nearest shelters?",
                  "How do I get to safety?"
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-2 animate-in fade-in slide-in-from-bottom-2",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-xs px-3 py-2 rounded-lg text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <p>{msg.content}</p>
                  {msg.role === "assistant" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-6 px-2 text-xs"
                      onClick={() => handlePlayResponse(msg.content)}
                      disabled={voiceLoading}
                    >
                      <Volume2 className="size-3 mr-1" />
                      {voiceLoading ? "Playing..." : "Play"}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-2">
              <div className="bg-muted px-3 py-2 rounded-lg">
                <Loader className="size-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex gap-2 items-center">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Ask for guidance..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={loading || !isActive}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleVoiceInput}
              variant={listeningToRequest ? "default" : "outline"}
              disabled={loading || !isActive}
              title="Voice input"
            >
              <Mic
                className={cn(
                  "size-4",
                  listeningToRequest && "animate-pulse text-red-500"
                )}
              />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={handleSendMessage}
            disabled={loading || !input.trim() || !isActive}
          >
            {loading ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </CardContent>

      {/* Hidden audio element for playback */}
      <audio
        ref={audioRef}
        onEnded={() => setVoiceLoading(false)}
        style={{ display: "none" }}
      />
    </Card>
  );
}
