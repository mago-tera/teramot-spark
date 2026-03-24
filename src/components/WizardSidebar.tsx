import { StepInfo } from "@/hooks/useWizard";
import { Check, ArrowLeft, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  steps: StepInfo[];
  currentStep: number;
  onStepClick: (id: number) => void;
  isInsideList: boolean;
}

export function WizardSidebar({ steps, currentStep, onStepClick, isInsideList }: Props) {
  const navigate = useNavigate();
  const { id: campaignId, projectId } = useParams();

  const deleteCampaign = async () => {
    if (!campaignId || campaignId === "new") return;
    if (!confirm("¿Estás seguro de que querés eliminar esta campaña? Se borrarán todos los leads y listas asociados.")) return;
    await supabase.from("leads").delete().eq("campaign_id", campaignId);
    await supabase.from("lists").delete().eq("campaign_id", campaignId);
    await supabase.from("campaigns").delete().eq("id", campaignId);
    toast.success("Campaña eliminada");
    navigate(projectId ? `/project/${projectId}` : "/");
  };

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col border-r border-white/[0.08]" style={{ background: "hsl(240 15% 6%)" }}>
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/[0.08]">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          <span className="text-primary">Teramot</span>{" "}
          <span className="text-muted-foreground font-normal text-sm">Prospecting</span>
        </h1>
      </div>

      {/* Back to projects */}
      <button
        onClick={() => navigate(projectId ? `/project/${projectId}` : "/")}
        className="flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground hover:text-foreground border-b border-white/[0.06] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a Campañas
      </button>

      {/* Steps */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isComplete = step.status === "complete";
          const isPending = step.status === "pending";

          if (isPending && step.id >= 2) return null;
          if (step.id === 1 && !isInsideList && currentStep !== 1) return null;

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.id)}
              disabled={isPending && step.id >= 2}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-primary/15 text-foreground"
                  : isComplete
                  ? "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                  : isPending && step.id >= 2
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
            >
              <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs shrink-0 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                  ? "bg-success/20 text-success"
                  : "bg-white/[0.04] text-muted-foreground/50"
              }`}>
                {isComplete ? <Check className="w-3.5 h-3.5" /> : step.icon}
              </span>
              <span className="truncate">{step.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Delete campaign */}
      {campaignId && campaignId !== "new" && (
        <div className="px-4 py-3 border-t border-white/[0.08]">
          <button
            onClick={deleteCampaign}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar campaña
          </button>
        </div>
      )}

      {/* Connection status */}
      <div className="px-4 py-4 border-t border-white/[0.08] space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2">Conexiones</p>
        <ConnectionBadge name="Apollo" connected={false} />
        <ConnectionBadge name="Notion" connected={false} />
      </div>
    </aside>
  );
}

function ConnectionBadge({ name, connected }: { name: string; connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-success" : "bg-muted-foreground/40"}`} />
      <span className="text-muted-foreground">{name}</span>
      <span className={`ml-auto text-[10px] ${connected ? "text-success" : "text-muted-foreground/50"}`}>
        {connected ? "Activo" : "Pendiente"}
      </span>
    </div>
  );
}
