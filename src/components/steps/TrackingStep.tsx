import { useState, useEffect } from "react";
import { CampaignConfig, ScoredLead } from "@/hooks/useWizard";
import { saveCampaign, saveLeads, createApolloSequence } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, ExternalLink, BarChart3, TrendingUp, Users, Send, MessageSquare, Target } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

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

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

export function TrackingStep({ config, scoredLeads, campaignId }: Props) {
  const [campaignName, setCampaignName] = useState("Cambiale el nombre che!");
  const [loomLinks, setLoomLinks] = useState({ Q1: "", Q2: "", Q3: "", Q4: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [sharedLists, setSharedLists] = useState<SharedListInfo[]>([]);

  const fetchLists = () => {
    if (!campaignId) return;
    supabase
      .from("lists")
      .select("id, name, lead_count, shared, enviados, respondidos, conversiones")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setSharedLists(data);
      });
  };

  useEffect(() => {
    fetchLists();
    if (!campaignId) return;
    const channel = supabase
      .channel(`tracking-lists-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lists", filter: `campaign_id=eq.${campaignId}` }, () => {
        fetchLists();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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

  // Aggregated metrics
  const totalLeads = sharedLists.reduce((s, l) => s + l.lead_count, 0);
  const totalEnviados = sharedLists.reduce((s, l) => s + l.enviados, 0);
  const totalRespondidos = sharedLists.reduce((s, l) => s + l.respondidos, 0);
  const totalConversiones = sharedLists.reduce((s, l) => s + l.conversiones, 0);
  const responseRate = totalEnviados > 0 ? ((totalRespondidos / totalEnviados) * 100).toFixed(1) : "0";
  const conversionRate = totalEnviados > 0 ? ((totalConversiones / totalEnviados) * 100).toFixed(1) : "0";

  const sharedOnly = sharedLists.filter((l) => l.shared);

  // Chart data
  const barData = sharedOnly.map((l) => ({
    name: l.name || "Sin nombre",
    enviados: l.enviados,
    respondidos: l.respondidos,
    conversiones: l.conversiones,
  }));

  const funnelData = [
    { name: "Leads", value: totalLeads },
    { name: "Enviados", value: totalEnviados },
    { name: "Respondidos", value: totalRespondidos },
    { name: "Conversiones", value: totalConversiones },
  ].filter((d) => d.value > 0);

  const chartConfig = {
    enviados: { label: "Enviados", color: "hsl(var(--primary))" },
    respondidos: { label: "Respondidos", color: "hsl(var(--chart-2, 160 60% 45%))" },
    conversiones: { label: "Conversiones", color: "hsl(var(--chart-3, 30 80% 55%))" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Tracking de campaña</h2>
        <p className="text-sm text-muted-foreground mt-1">Dashboard de métricas y vistas compartidas.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Leads</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Send className="w-4 h-4" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Enviados</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalEnviados}</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="w-4 h-4" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Respondidos</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalRespondidos}</p>
          <p className="text-[10px] text-muted-foreground">{responseRate}% tasa</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target className="w-4 h-4" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Conversiones</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalConversiones}</p>
          <p className="text-[10px] text-muted-foreground">{conversionRate}% tasa</p>
        </div>
      </div>

      {/* Charts */}
      {sharedOnly.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bar chart per view */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Métricas por vista</h3>
            </div>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="enviados" fill="var(--color-enviados)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="respondidos" fill="var(--color-respondidos)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversiones" fill="var(--color-conversiones)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>

          {/* Funnel / Pie */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Funnel general</h3>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={funnelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {funnelData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Shared views list */}
      {sharedOnly.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-muted/20 p-5 space-y-4">
          <h3 className="text-sm font-medium text-foreground">Vistas compartidas</h3>
          <div className="space-y-3">
            {sharedOnly.map((list) => {
              const listResponseRate = list.enviados > 0 ? ((list.respondidos / list.enviados) * 100).toFixed(1) : "0";
              const listConversionRate = list.enviados > 0 ? ((list.conversiones / list.enviados) * 100).toFixed(1) : "0";
              return (
                <div key={list.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{list.name || "Sin nombre"}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {list.lead_count} leads
                      </span>
                    </div>
                    {/* Metrics bar */}
                    <div className="flex gap-4 mt-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        📤 {list.enviados} enviados
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        💬 {list.respondidos} resp. ({listResponseRate}%)
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        🎯 {list.conversiones} conv. ({listConversionRate}%)
                      </span>
                    </div>
                    {/* Mini progress bar */}
                    {list.lead_count > 0 && (
                      <div className="flex gap-0.5 mt-2 h-1.5 rounded-full overflow-hidden bg-muted/50 max-w-xs">
                        <div
                          className="bg-primary/80 rounded-l-full transition-all"
                          style={{ width: `${(list.enviados / list.lead_count) * 100}%` }}
                        />
                        <div
                          className="bg-[hsl(var(--chart-2,160_60%_45%))] transition-all"
                          style={{ width: `${(list.respondidos / list.lead_count) * 100}%` }}
                        />
                        <div
                          className="bg-[hsl(var(--chart-3,30_80%_55%))] rounded-r-full transition-all"
                          style={{ width: `${(list.conversiones / list.lead_count) * 100}%` }}
                        />
                      </div>
                    )}
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
              );
            })}
          </div>
        </div>
      )}

      {sharedOnly.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 p-8 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay vistas compartidas aún.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Compartí una lista desde el paso de Listas para ver métricas acá.</p>
        </div>
      )}

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
