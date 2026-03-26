import { useState, useEffect } from "react";
import { CampaignConfig, ScoredLead } from "@/hooks/useWizard";
import { supabase } from "@/integrations/supabase/client";
import { Copy, ExternalLink, BarChart3, TrendingUp, Users, Send, MessageSquare, Target } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

interface Props {
  config: CampaignConfig;
  scoredLeads: ScoredLead[];
  campaignId: string | null;
}

interface OutreachInfo {
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
];

const chartConfig = {
  enviados: { label: "Enviados", color: "hsl(var(--primary))" },
  respondidos: { label: "Respondidos", color: "hsl(var(--chart-2, 160 60% 45%))" },
  conversiones: { label: "Conversiones", color: "hsl(var(--chart-3, 30 80% 55%))" },
};

export function TrackingStep({ config, scoredLeads, campaignId }: Props) {
  const [outreaches, setOutreaches] = useState<OutreachInfo[]>([]);

  const fetchOutreaches = () => {
    if (!campaignId) return;
    supabase
      .from("lists")
      .select("id, name, lead_count, shared, enviados, respondidos, conversiones")
      .eq("campaign_id", campaignId)
      .eq("shared", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setOutreaches(data);
      });
  };

  useEffect(() => {
    fetchOutreaches();
    if (!campaignId) return;
    const channel = supabase
      .channel(`tracking-outreaches-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lists", filter: `campaign_id=eq.${campaignId}` }, () => {
        fetchOutreaches();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaignId]);

  const copyLink = (listId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/list/${listId}`);
    toast.success("Link copiado");
  };

  // Aggregated metrics
  const totalLeads = outreaches.reduce((s, l) => s + l.lead_count, 0);
  const totalEnviados = outreaches.reduce((s, l) => s + l.enviados, 0);
  const totalRespondidos = outreaches.reduce((s, l) => s + l.respondidos, 0);
  const totalConversiones = outreaches.reduce((s, l) => s + l.conversiones, 0);
  const responseRate = totalEnviados > 0 ? ((totalRespondidos / totalEnviados) * 100).toFixed(1) : "0";
  const conversionRate = totalEnviados > 0 ? ((totalConversiones / totalEnviados) * 100).toFixed(1) : "0";

  // Chart data
  const barData = outreaches.map((l) => ({
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Tracking de campaña</h2>
        <p className="text-sm text-muted-foreground mt-1">Dashboard de métricas de outreach a nivel campaña.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={<Users className="w-4 h-4" />} label="Leads" value={totalLeads} />
        <KPICard icon={<Send className="w-4 h-4" />} label="Enviados" value={totalEnviados} />
        <KPICard icon={<MessageSquare className="w-4 h-4" />} label="Respondidos" value={totalRespondidos} sub={`${responseRate}% tasa`} />
        <KPICard icon={<Target className="w-4 h-4" />} label="Conversiones" value={totalConversiones} sub={`${conversionRate}% tasa`} />
      </div>

      {/* Charts */}
      {outreaches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Métricas por outreach</h3>
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

          {funnelData.length > 1 && (
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">Funnel general</h3>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={funnelData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={3} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}>
                      {funnelData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Outreach list */}
      {outreaches.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-muted/20 p-5 space-y-4">
          <h3 className="text-sm font-medium text-foreground">Outreaches activos</h3>
          <div className="space-y-3">
            {outreaches.map((outreach) => {
              const oResponseRate = outreach.enviados > 0 ? ((outreach.respondidos / outreach.enviados) * 100).toFixed(1) : "0";
              const oConversionRate = outreach.enviados > 0 ? ((outreach.conversiones / outreach.enviados) * 100).toFixed(1) : "0";
              return (
                <div key={outreach.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{outreach.name || "Sin nombre"}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {outreach.lead_count} leads
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1.5">
                      <span className="text-[10px] text-muted-foreground">📤 {outreach.enviados} enviados</span>
                      <span className="text-[10px] text-muted-foreground">💬 {outreach.respondidos} resp. ({oResponseRate}%)</span>
                      <span className="text-[10px] text-muted-foreground">🎯 {outreach.conversiones} conv. ({oConversionRate}%)</span>
                    </div>
                    {outreach.lead_count > 0 && (
                      <div className="flex gap-0.5 mt-2 h-1.5 rounded-full overflow-hidden bg-muted/50 max-w-xs">
                        <div className="bg-primary/80 rounded-l-full transition-all" style={{ width: `${(outreach.enviados / outreach.lead_count) * 100}%` }} />
                        <div className="bg-[hsl(var(--chart-2,160_60%_45%))] transition-all" style={{ width: `${(outreach.respondidos / outreach.lead_count) * 100}%` }} />
                        <div className="bg-[hsl(var(--chart-3,30_80%_55%))] rounded-r-full transition-all" style={{ width: `${(outreach.conversiones / outreach.lead_count) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={() => copyLink(outreach.id)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Copiar link">
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <a href={`/shared/list/${outreach.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-muted transition-colors" title="Abrir outreach">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outreaches.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 p-8 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay outreaches aún.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Creá un outreach desde una lista para ver métricas acá.</p>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
