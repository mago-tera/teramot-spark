import { useState, useEffect, useRef } from "react";
import { CampaignConfig, ScoredLead } from "@/hooks/useWizard";
import { supabase } from "@/integrations/supabase/client";
import { Copy, ExternalLink, BarChart3, TrendingUp, Users, Send, MessageSquare, Target, Mail, Linkedin, ChevronDown, Pencil, Check, X, ArrowLeft } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ChartTooltip } from "@/components/ui/chart";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OutreachView } from "@/pages/SharedListPage";

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
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [viewingOutreachId, setViewingOutreachId] = useState<string | null>(null);

  const fetchData = () => {
    if (!campaignId) return;
    supabase
      .from("leads")
      .select("enviado, respondido, conversion, canal")
      .eq("campaign_id", campaignId)
      .then(({ data }) => {
        if (data) setLeads(data);
      });
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

  // If viewing an outreach inline, show iframe
  if (viewingOutreachId) {
    const outreach = outreaches.find((o) => o.id === viewingOutreachId);
    return (
      <div className="space-y-3">
        <button
          onClick={() => setViewingOutreachId(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al dashboard
        </button>
        <div className="rounded-xl border border-border/40 overflow-hidden" style={{ height: "calc(100vh - 140px)" }}>
          <iframe
            src={`/shared/list/${viewingOutreachId}`}
            className="w-full h-full border-0"
            title={outreach?.name || "Outreach"}
          />
        </div>
      </div>
    );
  }

  const totalLeads = leads.length;
  const totalEnviados = leads.filter((l) => l.enviado).length;
  const totalRespondidos = leads.filter((l) => l.respondido).length;
  const totalConversiones = leads.filter((l) => l.conversion).length;
  const responseRate = totalEnviados > 0 ? ((totalRespondidos / totalEnviados) * 100).toFixed(1) : "0";
  const conversionRate = totalEnviados > 0 ? ((totalConversiones / totalEnviados) * 100).toFixed(1) : "0";

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

      {/* Outreaches collapsible - ABOVE dashboard */}
      {outreaches.length > 0 && (
        <Collapsible open={outreachOpen} onOpenChange={setOutreachOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full rounded-xl border border-border/40 bg-muted/20 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Outreaches activos</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {outreaches.length}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${outreachOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {outreaches.map((outreach) => (
              <OutreachRow
                key={outreach.id}
                outreach={outreach}
                onCopyLink={copyLink}
                onView={() => setViewingOutreachId(outreach.id)}
                onNameUpdated={fetchData}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* General KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={<Users className="w-4 h-4" />} label="Leads" value={totalLeads} />
        <KPICard icon={<Send className="w-4 h-4" />} label="Enviados" value={totalEnviados} />
        <KPICard icon={<MessageSquare className="w-4 h-4" />} label="Respondidos" value={totalRespondidos} sub={`${responseRate}% tasa`} />
        <KPICard icon={<Target className="w-4 h-4" />} label="Conversiones" value={totalConversiones} sub={`${conversionRate}% tasa`} />
      </div>

      {/* Channel breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChannelCard icon={<Mail className="w-4 h-4" />} label="Email" metrics={emailMetrics} />
        <ChannelCard icon={<Linkedin className="w-4 h-4" />} label="LinkedIn" metrics={linkedinMetrics} />
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

      {leads.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 p-8 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay leads en esta campaña aún.</p>
        </div>
      )}
    </div>
  );
}

/* ── Outreach row with editable name ── */
function OutreachRow({ outreach, onCopyLink, onView, onNameUpdated }: {
  outreach: OutreachInfo;
  onCopyLink: (id: string) => void;
  onView: () => void;
  onNameUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(outreach.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const saveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === outreach.name) {
      setEditing(false);
      setEditName(outreach.name);
      return;
    }
    await supabase.from("lists").update({ name: trimmed }).eq("id", outreach.id);
    toast.success("Nombre actualizado");
    setEditing(false);
    onNameUpdated();
  };

  const oResponseRate = outreach.enviados > 0 ? ((outreach.respondidos / outreach.enviados) * 100).toFixed(1) : "0";
  const oConversionRate = outreach.enviados > 0 ? ((outreach.conversiones / outreach.enviados) * 100).toFixed(1) : "0";

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditing(false); setEditName(outreach.name); } }}
                className="text-sm font-medium text-foreground bg-muted/50 border border-border rounded px-2 py-0.5 w-48"
              />
              <button onClick={saveName} className="p-1 rounded hover:bg-muted transition-colors text-primary">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setEditing(false); setEditName(outreach.name); }} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button onClick={onView} className="text-sm font-medium text-foreground truncate hover:text-primary transition-colors hover:underline">
                {outreach.name || "Sin nombre"}
              </button>
              <button onClick={() => { setEditing(true); setEditName(outreach.name); }} className="p-1 rounded hover:bg-muted transition-colors" title="Editar nombre">
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {outreach.lead_count} leads
              </span>
            </>
          )}
        </div>
        <div className="flex gap-4 mt-1.5">
          <span className="text-[10px] text-muted-foreground">📤 {outreach.enviados} enviados</span>
          <span className="text-[10px] text-muted-foreground">💬 {outreach.respondidos} resp. ({oResponseRate}%)</span>
          <span className="text-[10px] text-muted-foreground">🎯 {outreach.conversiones} conv. ({oConversionRate}%)</span>
        </div>
      </div>
      <div className="flex items-center gap-1 ml-3">
        <button onClick={() => onCopyLink(outreach.id)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Copiar link">
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button onClick={onView} className="p-1.5 rounded hover:bg-muted transition-colors" title="Ver outreach">
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

/* ── KPI Card ── */
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

/* ── Channel Card ── */
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
