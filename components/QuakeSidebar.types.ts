import type { QuakeEvent, ResponsePlan } from "@/lib/types";

export interface QuakeSidebarProps {
  quake: QuakeEvent;
  plan: ResponsePlan | null;
  planGenerated: boolean;
  isGenerating: boolean;
  planVerified: boolean;
  planSaved: boolean;
  briefingPlaying: boolean;
  quakeLoading?: boolean;
  planError?: string | null;
  offlineMode?: boolean;
  onGeneratePlan: () => void;
  onRetryPlan?: () => void;
  onToggleBriefing: () => void;
  onVerifyPlan: () => void;
  onSavePlan: () => void;
}
