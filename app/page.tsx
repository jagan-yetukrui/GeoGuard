"use client";

import { useState, useCallback, useEffect } from "react";
import { MapView } from "@/components/MapView";
import { QuakeSidebar } from "@/components/QuakeSidebar";
import { mockQuakeEvent } from "@/lib/mockData";
import { getLiveQuake, generatePlan } from "@/lib/api";
import type { QuakeEvent, ResponsePlan } from "@/lib/types";

export default function Home() {
  const [quake, setQuake] = useState<QuakeEvent>(mockQuakeEvent);
  const [plan, setPlan] = useState<ResponsePlan | null>(null);
  const [planGenerated, setPlanGenerated] = useState(false);
  const [quakeLoading, setQuakeLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [quakeError, setQuakeError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [briefingPlaying, setBriefingPlaying] = useState(false);
  const [planVerified, setPlanVerified] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);

  const loadLiveQuake = useCallback(async () => {
    setQuakeLoading(true);
    setQuakeError(null);
    setOfflineMode(false);
    try {
      const live = await getLiveQuake();
      setQuake(live);
    } catch (e) {
      setQuake(mockQuakeEvent);
      setOfflineMode(true);
      setQuakeError(e instanceof Error ? e.message : "Failed to load live quake");
    } finally {
      setQuakeLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveQuake();
  }, [loadLiveQuake]);

  const onGeneratePlan = useCallback(async () => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const responsePlan = await generatePlan(quake.id);
      setPlan(responsePlan);
      setPlanGenerated(true);
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Failed to generate plan");
    } finally {
      setPlanLoading(false);
    }
  }, [quake.id]);

  const onRetryPlan = useCallback(() => {
    setPlanError(null);
    onGeneratePlan();
  }, [onGeneratePlan]);

  const onToggleBriefing = useCallback(() => {
    setBriefingPlaying((p) => !p);
  }, []);

  const onVerifyPlan = useCallback(() => {
    setPlanVerified(true);
  }, []);

  const onSavePlan = useCallback(() => {
    setPlanSaved(true);
  }, []);

  return (
    <main className="flex h-full min-h-screen w-full flex-col lg:flex-row">
      <div className="h-[40vh] w-full shrink-0 lg:h-full lg:w-[70%] lg:min-w-0 lg:p-4">
        <MapView
          quake={quake}
          zones={plan?.riskZones ?? []}
          stations={plan?.stations ?? []}
          routes={plan?.routes ?? []}
          showPlan={planGenerated}
        />
      </div>
      <div className="w-full shrink-0 border-t border-border lg:h-full lg:w-[30%] lg:min-w-[320px] lg:border-l lg:border-t-0">
        <QuakeSidebar
          quake={quake}
          plan={planGenerated ? plan : null}
          planGenerated={planGenerated}
          isGenerating={planLoading}
          planVerified={planVerified}
          planSaved={planSaved}
          briefingPlaying={briefingPlaying}
          quakeLoading={quakeLoading}
          planError={planError}
          offlineMode={offlineMode}
          onGeneratePlan={onGeneratePlan}
          onRetryPlan={onRetryPlan}
          onToggleBriefing={onToggleBriefing}
          onVerifyPlan={onVerifyPlan}
          onSavePlan={onSavePlan}
        />
      </div>
    </main>
  );
}
