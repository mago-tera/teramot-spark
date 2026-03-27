import { useState, useEffect } from "react";
import { CampaignConfig, ScoredLead } from "@/hooks/useWizard";
import { supabase } from "@/integrations/supabase/client";
import { Copy, ExternalLink, BarChart3, TrendingUp, Users, Send, MessageSquare, Target, Mail, Linkedin } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ChartTooltip } from "@/components/ui/chart";
import { toast } from "sonner";

interface Props {
  config: CampaignConfig;
  scoredLeads: ScoredLead[];
  campaignId: string | null;
}

interface LeadMetrics {
  enviado: boolean;
  respondido: boolean;
  conversion: boolean;
  canal: string | null;
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

export function TrackingStep({ config, scoredLeads, campaignId }: Props) {
  const [leads, setLeads] = useState<LeadMetrics[]>([]);
  const [outreaches, setOutreaches] = useState<OutreachInfo[]>([]);

  const fetchData = () => {
    if (!campaignId) return;
    // Fetch all leads for this campaign
    supabase
      .from("leads")
      .select("enviado, respondido, conversion, canal")
      .eq("campaign_id", campaignId)
      .then(({ data }) => {
        if (data) setLeads(data);
      });
    // Fetch outreaches (shared lists)
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
    fetchData();
    if (!campaignId) return;
    const ch1 = supabase
      .channel(`tracking-leads-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `campaign_id=eq.${campaignId}` }, () => fetchData())
      .subscribe();
    const ch2 = supabase
      .channel(`tracking-lists-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lists", filter: `campaign_id=eq.${campaignId}` }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [campaignId]);

  const copyLink = (listId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/list/${listId}`);
    toast.success("Link copiado");
  };

  // Campaign-wide metrics from ALL leads
  const totalLeads = leads.length;
  const totalEnviados = leads.filter((l) => l.enviado).length;
  const totalRespondidos = leads.filter((l) => l.respondido).length;
  const totalConversiones = leads.filter((l) => l.conversion).length;
  const responseRate = totalEnviados > 0 ? ((totalRespondidos / totalEnviados) * 100).toFixed(1) : "0";
  const conversionRate = totalEnviados > 0 ? ((totalConversiones / totalEnviados) * 100).toFixed(1) : "0";

  // Channel breakdown
  const channelMetrics = (channel: string) => {
    const filtered = leads.filter((l) => l.canal?.toLowerCase() === channel);
    const env = filtered.filter((l) => l.enviado).length;
    const resp = filtered.filter((l) => l.respondido).length;
    const conv = filtered.filter((l) => l.conversion).length;
    return {
      total: filtered.length,
      enviados: env,
      respondidos: resp,
      conversiones: conv,
      responseRate: env > 0 ? ((resp / env) * 100).toFixed(1) : "0",
      conversionRate: env > 0 ? ((conv / env) * 100).toFixed(1) : "0",
    };
  };

  const emailMetrics = channelMetrics("email");
  const linkedinMetrics = channelMetrics("linkedin");

  // Funnel chart
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
        <p className="text-sm text-muted-foreground mt-1">Métricas generales de todos los leads de la campaña.</p>
      </div>

      {/* General KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={<Users className="w-4 h-4" />} label="Leads" value={totalLeads} />
        <KPICard icon={<Send className="w-4 h-4" />} label="Enviados" value={totalEnviados} />
        <KPICard icon={<MessageSquare className="w-4 h-4" />} label="Respondidos" value={totalRespondidos} sub={`${responseRate}% tasa`} />
        <KPICard icon={<Target className="w-4 h-4" />} label="Conversiones" value={totalConversiones} sub={`${conversionRate}% tasa`} />
      </div>

      {/* Channel breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChannelCard
          icon={<Mail className="w-4 h-4" />}
          label="Email"
          metrics={emailMetrics}
        />
        <ChannelCard
          icon={<Linkedin className="w-4 h-4" />}
          label="LinkedIn"
          metrics={linkedinMetrics}
        />
      </div>

      {/* Funnel */}
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

      {leads.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 p-8 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay leads en esta campaña aún.</p>
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

interface ChannelMetrics {
  total: number;
  enviados: number;
  respondidos: number;
  conversiones: number;
  responseRate: string;
  conversionRate: string;
}

function ChannelCard({ icon, label, metrics }: { icon: React.ReactNode; label: string; metrics: ChannelMetrics }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-medium text-foreground">{label}</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-auto">
          {metrics.total} leads
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-0.5">
          <p className="text-lg font-bold text-foreground">{metrics.enviados}</p>
          <p className="text-[10px] text-muted-foreground">Enviados</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-lg font-bold text-foreground">{metrics.respondidos}</p>
          <p className="text-[10px] text-muted-foreground">Respondidos ({metrics.responseRate}%)</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-lg font-bold text-foreground">{metrics.conversiones}</p>
          <p className="text-[10px] text-muted-foreground">Conversiones ({metrics.conversionRate}%)</p>
        </div>
      </div>
      {metrics.total > 0 && (
        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-muted/50">
          <div className="bg-primary/80 rounded-l-full transition-all" style={{ width: `${(metrics.enviados / metrics.total) * 100}%` }} />
          <div className="bg-[hsl(var(--chart-2,160_60%_45%))] transition-all" style={{ width: `${(metrics.respondidos / metrics.total) * 100}%` }} />
          <div className="bg-[hsl(var(--chart-3,30_80%_55%))] rounded-r-full transition-all" style={{ width: `${(metrics.conversiones / metrics.total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
