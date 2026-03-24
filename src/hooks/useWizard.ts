import { useState, useCallback } from "react";

export type StepStatus = "pending" | "active" | "complete";

export interface StepInfo {
  id: number;
  label: string;
  icon: string;
  status: StepStatus;
}

export interface CampaignConfig {
  profile: "Data Analyst" | "Data Leader / CDO / Head of BI" | "Ambos" | "";
  geoMix: Record<string, number>;
  frequency: "once" | "weekly" | "monthly";
  quantity: number;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  industry: string;
  country: string;
  seniority: string;
  email: string;
  linkedinUrl: string;
  headcount: number;
  apolloId?: string;
}

export interface ScoredLead extends Lead {
  scores: {
    industryScore: number;
    growthScore: number;
    seniorityScore: number;
    painScore: number;
  };
  total: number;
  quartile: "Q1" | "Q2" | "Q3" | "Q4";
  messages?: GeneratedMessages;
}

export interface GeneratedMessages {
  linkedin: string;
  email_asunto: string;
  email_cuerpo: string;
  followup_d4: string;
  cierre_d9: string;
}

const INITIAL_STEPS: StepInfo[] = [
  { id: 0, label: "Configuración", icon: "⚙", status: "active" },
  { id: 1, label: "Búsqueda Apollo", icon: "🔍", status: "pending" },
  { id: 2, label: "Scoring", icon: "📊", status: "pending" },
  { id: 3, label: "Mensajes con IA", icon: "✉", status: "pending" },
  { id: 4, label: "Tracking", icon: "📈", status: "pending" },
];

export function useWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<StepInfo[]>(INITIAL_STEPS);
  const [config, setConfig] = useState<CampaignConfig>({
    profile: "",
    geoMix: { Argentina: 0, Colombia: 0, Chile: 0, México: 0, Brasil: 0, USA: 0 },
    frequency: "once",
    quantity: 50,
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [scoredLeads, setScoredLeads] = useState<ScoredLead[]>([]);

  const completeStep = useCallback((stepId: number) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id === stepId) return { ...s, status: "complete" as StepStatus };
        if (s.id === stepId + 1) return { ...s, status: "active" as StepStatus };
        return s;
      })
    );
    setCurrentStep(stepId + 1);
  }, []);

  const goToStep = useCallback((stepId: number) => {
    const canGo = steps[stepId]?.status !== "pending";
    if (canGo) setCurrentStep(stepId);
  }, [steps]);

  return {
    currentStep,
    steps,
    config,
    setConfig,
    leads,
    setLeads,
    scoredLeads,
    setScoredLeads,
    completeStep,
    goToStep,
  };
}
