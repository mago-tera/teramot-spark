import { useState } from "react";
import { CampaignConfig, ScoredLead } from "@/hooks/useWizard";
import { saveCampaign, saveLeads, createApolloSequence } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  config: CampaignConfig;
  scoredLeads: ScoredLead[];
}

const BENCHMARKS = [
  { metric: "Open rate email", target: "> 40%", status: "pending" },
  { metric: "Click rate video", target: "> 5%", status: "pending" },
  { metric: "Reply rate email", target: "> 3%", status: "pending" },
  { metric: "Reply rate LinkedIn", target: "> 15%", status: "pending" },
  { metric: "Demos agendadas", target: "> 2%", status: "pending" },
];

const CHECKPOINTS = [3, 5, 7, 10, 14, 21, "Cierre"];

export function TrackingStep({ config, scoredLeads }: Props) {
  const now = new Date();
  const defaultName = `Teramot-Q1-${now.toLocaleString("es", { month: "short" })}-${now.getFullYear()}`;
  const [campaignName, setCampaignName] = useState(defaultName);
  const [loomLinks, setLoomLinks] = useState({ Q1: "", Q2: "", Q3: "", Q4: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const campaign = await saveCampaign(config, campaignName, loomLinks);
      await saveLeads(campaign.id, scoredLeads);
      setSaved(true);
      toast.success("Campaña guardada exitosamente");
    } catch (e: any) {
      console.error("Error saving campaign:", e);
      toast.error(e.message || "Error guardando campaña");
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const result = await createApolloSequence(campaignName, scoredLeads);
      setLaunched(true);
      toast.success(result.message || "Secuencia creada en Apollo");
    } catch (e: any) {
      console.error("Error launching sequence:", e);
      toast.error(e.message || "Error creando secuencia en Apollo");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Tracking de campaña</h2>
        <p className="text-sm text-muted-foreground mt-1">Configura el seguimiento y benchmarks.</p>
      </div>

      {/* Campaign name */}
      <div className="glass-card p-5 space-y-3">
        <label className="text-xs text-muted-foreground">Nombre de campaña</label>
        <input
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          className="glass-input w-full font-mono text-sm"
        />
      </div>

      {/* Loom links */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Links de Loom por cuartil</h3>
        <div className="grid grid-cols-2 gap-3">
          {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
            <div key={q} className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{q}</label>
              <input
                placeholder="https://loom.com/..."
                value={loomLinks[q]}
                onChange={(e) => setLoomLinks({ ...loomLinks, [q]: e.target.value })}
                className="glass-input w-full text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Benchmarks */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Benchmarks</h3>
        <div className="space-y-2">
          {BENCHMARKS.map((b) => (
            <div key={b.metric} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <span className="text-xs text-foreground">{b.metric}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">{b.target}</span>
                <span className="text-xs">🟡</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Timeline de checkpoints</h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {CHECKPOINTS.map((day, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center">
                  <span className="text-[10px] font-mono text-muted-foreground">{typeof day === "number" ? `D${day}` : day}</span>
                </div>
              </div>
              {i < CHECKPOINTS.length - 1 && <div className="w-8 h-px bg-white/10" />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-success/20 text-success border border-success/30"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
          }`}
        >
          {saving ? "Guardando..." : saved ? "✓ Campaña guardada" : "💾 Guardar campaña"}
        </button>

        {saved && (
          <button
            onClick={handleLaunch}
            disabled={launching || launched}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              launched
                ? "bg-success/20 text-success border border-success/30"
                : "bg-warning/90 text-black hover:bg-warning transition-colors shadow-lg shadow-warning/20"
            }`}
          >
            {launching ? "Creando secuencia..." : launched ? "✓ Secuencia creada en Apollo" : "🚀 Lanzar en Apollo"}
          </button>
        )}
      </div>
    </div>
  );
}
