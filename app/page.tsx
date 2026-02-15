"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { MapView } from "@/components/MapView";
import type { MapViewHandle } from "@/components/MapView";
import { QuakeSidebar } from "@/components/QuakeSidebar";
import { DisasterChat } from "@/components/DisasterChat";
import { VoiceAgentBubble } from "@/components/VoiceAgentBubble";
import { VoiceAssistantPopup } from "@/components/VoiceAssistantPopup";
import { mockQuakeEvent } from "@/lib/mockData";
import { getLiveQuake, getLatestQuakes, generatePlan, getBrief, getVoice } from "@/lib/api";
import type { QuakeEvent, ResponsePlan } from "@/lib/types";
import type { QuakeViewMode } from "@/components/QuakeSidebar.types";

export default function Home() {
  const [liveQuake, setLiveQuake] = useState<QuakeEvent | null>(null);
  const [latestQuakes, setLatestQuakes] = useState<QuakeEvent[]>([]);
  const [viewMode, setViewMode] = useState<QuakeViewMode>("live");
  const [selectedQuake, setSelectedQuake] = useState<QuakeEvent>(mockQuakeEvent);
  const [plan, setPlan] = useState<ResponsePlan | null>(null);
  const [planGenerated, setPlanGenerated] = useState(false);
  const [quakeLoading, setQuakeLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [quakeError, setQuakeError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [briefingPlaying, setBriefingPlaying] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [planVerified, setPlanVerified] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false);
  const [highlightedRouteId, setHighlightedRouteId] = useState<string>();
  const mapRef = useRef<MapViewHandle>(null);

  const loadQuakes = useCallback(async () => {
    setQuakeLoading(true);
    setQuakeError(null);
    setOfflineMode(false);
    try {
      const [live, list] = await Promise.all([getLiveQuake(), getLatestQuakes(5)]);
      setLiveQuake(live);
      setLatestQuakes(list);
      setSelectedQuake((prev) => {
        if (viewMode === "live") return live;
        const same = list.find((q) => q.id === prev.id);
        return same ?? list[0] ?? live;
      });
    } catch (e) {
      setLiveQuake(mockQuakeEvent);
      setLatestQuakes([]);
      setSelectedQuake(mockQuakeEvent);
      setOfflineMode(true);
      setQuakeError(e instanceof Error ? e.message : "Failed to load quakes");
    } finally {
      setQuakeLoading(false);
    }
  }, [viewMode]);

  useEffect(() => {
    loadQuakes();
  }, []);

  const onSwitchToLive = useCallback(() => {
    setViewMode("live");
    if (liveQuake) setSelectedQuake(liveQuake);
  }, [liveQuake]);

  const onSwitchToLast5 = useCallback(() => {
    setViewMode("last5");
    if (latestQuakes.length && !latestQuakes.find((q) => q.id === selectedQuake.id)) {
      setSelectedQuake(latestQuakes[0]);
    }
  }, [latestQuakes, selectedQuake.id]);

  const onSelectQuake = useCallback((q: QuakeEvent) => {
    setSelectedQuake(q);
  }, []);

  const onGeneratePlan = useCallback(async () => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const responsePlan = await generatePlan(selectedQuake.id);
      setPlan(responsePlan);
      setPlanGenerated(true);
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Failed to generate plan");
    } finally {
      setPlanLoading(false);
    }
  }, [selectedQuake.id]);

  const onRetryPlan = useCallback(() => {
    setPlanError(null);
    onGeneratePlan();
  }, [onGeneratePlan]);

  const onToggleBriefing = useCallback(async () => {
    if (!plan || briefingLoading) return;
    setBriefingLoading(true);
    setPlanError(null);
    try {
      const b = await getBrief({
        summary: plan.summary,
        priority_actions: plan.priorityActions,
        damage_score: plan.damageScore ?? undefined,
      });
      const v = await getVoice(b.summary || b.public_message);
      const binary = atob(v.audio_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: v.content_type });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setBriefingPlaying(true);
      audio.onended = () => {
        setBriefingPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setBriefingPlaying(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Briefing unavailable");
    } finally {
      setBriefingLoading(false);
    }
  }, [plan, briefingLoading]);

  const onVerifyPlan = useCallback(() => {
    setPlanVerified(true);
  }, []);

  const onSavePlan = useCallback(() => {
    setPlanSaved(true);
  }, []);

  return (
    <main className="flex h-full min-h-screen w-full flex-col lg:flex-row">
      <div className="h-[40vh] w-full shrink-0 lg:h-full lg:w-[70%] lg:min-w-0">
        <MapView
          ref={mapRef}
          quake={selectedQuake}
          zones={plan?.riskZones ?? []}
          stations={plan?.stations ?? []}
          routes={plan?.routes ?? []}
          showPlan={planGenerated}
          zonesGeoJSON={plan?.zonesGeoJSON}
          safePoints={plan?.safePoints}
          infraNodes={plan?.infraNodes}
          zonePois={plan?.zonePois}
          highlightedRouteId={highlightedRouteId}
          userLocation={plan?.userLocation}
        />
      </div>
      <div className="w-full shrink-0 border-t border-border lg:h-full lg:w-[30%] lg:min-w-[320px] lg:border-l lg:border-t-0">
        <QuakeSidebar
          quake={selectedQuake}
          latestQuakes={latestQuakes}
          liveQuake={liveQuake}
          viewMode={viewMode}
          plan={planGenerated ? plan : null}
          planGenerated={planGenerated}
          isGenerating={planLoading}
          planVerified={planVerified}
          planSaved={planSaved}
          briefingPlaying={briefingPlaying}
          briefingLoading={briefingLoading}
          quakeLoading={quakeLoading}
          planError={planError}
          offlineMode={offlineMode}
          onSwitchToLive={onSwitchToLive}
          onSwitchToLast5={onSwitchToLast5}
          onSelectQuake={onSelectQuake}
          onRefreshQuakes={loadQuakes}
          onGeneratePlan={onGeneratePlan}
          onRetryPlan={onRetryPlan}
          onToggleBriefing={onToggleBriefing}
          onVerifyPlan={onVerifyPlan}
          onSavePlan={onSavePlan}
          onRouteSelect={(routeId) => setHighlightedRouteId(routeId)}
          onRouteZoom={(route) => mapRef.current?.fitToRoute(route)}
          selectedRouteId={highlightedRouteId}
        />
      </div>
      <VoiceAgentBubble
        onClick={() => setVoiceAssistantOpen((v) => !v)}
        open={false}
      />
      <DisasterChat selectedQuake={selectedQuake} plan={plan} />
      <VoiceAssistantPopup
        open={voiceAssistantOpen}
        onClose={() => setVoiceAssistantOpen(false)}
        quake={selectedQuake}
        plan={plan}
        anchorBottom={100}
        anchorRight={88}
      />
    </main>
  );
}
