import type { QuakeEvent, ResponsePlan } from "@/lib/types";

export type QuakeViewMode = "live" | "last5";

export interface QuakeSidebarProps {
  quake: QuakeEvent;
  latestQuakes?: QuakeEvent[];
  liveQuake?: QuakeEvent | null;
  viewMode?: QuakeViewMode;
  plan: ResponsePlan | null;
  planGenerated: boolean;
  isGenerating: boolean;
  planVerified: boolean;
  planSaved: boolean;
  briefingPlaying: boolean;
  briefingLoading?: boolean;
  quakeLoading?: boolean;
  planError?: string | null;
  offlineMode?: boolean;
  onSwitchToLive?: () => void;
  onSwitchToLast5?: () => void;
  onSelectQuake?: (q: QuakeEvent) => void;
  onRefreshQuakes?: () => void;
  onGeneratePlan: () => void;
  onRetryPlan?: () => void;
  onToggleBriefing: () => void;
  onVerifyPlan: () => void;
  onSavePlan: () => void;
}
