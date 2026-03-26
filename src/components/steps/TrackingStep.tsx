import { useState, useEffect } from "react";
import { CampaignConfig, ScoredLead } from "@/hooks/useWizard";
import { saveCampaign, saveLeads, createApolloSequence } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";

interface Props {
  config: CampaignConfig;
  scoredLeads: ScoredLead[];
  campaignId: string | null;
}

interface SharedListInfo {
  id: string;
  name: string;
  lead_count: number;
  shared: boolean;
  enviados: number;
  respondidos: number;
  conversiones: number;
}

const BENCHMARKS = [
  { metric: "Open rate email", target: "> 40%", status: "pending" },
  { metric: "Click rate video", target: "> 5%", status: "pending" },
  { metric: "Reply rate email", target: "> 3%", status: "pending" },
  { metric: "Reply rate LinkedIn", target: "> 15%", status: "pending" },
  { metric: "Demos agendadas", target: "> 2%", status: "pending" },
];

const CHECKPOINTS = [3, 5, 7, 10, 14, 21, "Cierre"];

export function TrackingStep({ config, scoredLeads, campaignId }: Props) {
  const [campaignName, setCampaignName] = useState("Cambiale el nombre che!");
  const [loomLinks, setLoomLinks] = useState({ Q1: "", Q2: "", Q3: "", Q4: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [sharedLists, setSharedLists] = useState<SharedListInfo[]>([]);

  // Fetch all lists for this campaign
  useEffect(() => {
    if (!campaignId) return;
    supabase
      .from("lists")
      .select("id, name, lead_count, shared, enviados, respondidos, conversiones")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setSharedLists(data);
      });
  }, [campaignId]);

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

  const copyLink = (listId: string) => {
    const link = `${window.location.origin}/shared/list/${listId}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Tracking de campaña</h2>
        <p className="text-sm text-muted-foreground mt-1">Configura el seguimiento y benchmarks.</p>
      </div>

      {/* Shared list URLs */}
      {sharedLists.length > 0 && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-medium text-foreground">Vistas compartidas</h3>
          <div className="space-y-3">
            {sharedLists.map((list) => (
              <div key={list.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{list.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {list.lead_count} leads
                    </span>
                    {list.shared && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        Pública
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground truncate mt-1">
                    {window.location.origin}/shared/list/{list.id}
                  </p>
                  {/* Mini metrics */}
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      📤 {list.enviados} enviados
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      💬 {list.respondidos} respondidos
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      🎯 {list.conversiones} conversiones
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <button
                    onClick={() => copyLink(list.id)}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Copiar link"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <a
                    href={`/shared/list/${list.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Abrir vista"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


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
