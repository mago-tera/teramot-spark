import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Send, MessageSquare, Target, BarChart3, TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface Props {
  listId: string;
  listName: string;
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

export function ListTracking({ listId, listName }: Props) {
  const [metrics, setMetrics] = useState({ total: 0, enviados: 0, respondidos: 0, conversiones: 0 });

  const fetchMetrics = async () => {
    const { data } = await supabase
      .from("leads")
      .select("enviado, respondido, conversion")
      .eq("list_id", listId);
    if (!data) return;
    setMetrics({
      total: data.length,
      enviados: data.filter((l) => l.enviado).length,
      respondidos: data.filter((l) => l.respondido).length,
      conversiones: data.filter((l) => l.conversion).length,
    });
  };

  useEffect(() => {
    fetchMetrics();
    const channel = supabase
      .channel(`list-tracking-${listId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `list_id=eq.${listId}` }, () => {
        fetchMetrics();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [listId]);

  const { total, enviados, respondidos, conversiones } = metrics;
  const responseRate = enviados > 0 ? ((respondidos / enviados) * 100).toFixed(1) : "0";
  const conversionRate = enviados > 0 ? ((conversiones / enviados) * 100).toFixed(1) : "0";

  const funnelData = [
    { name: "Leads", value: total },
    { name: "Enviados", value: enviados },
    { name: "Respondidos", value: respondidos },
    { name: "Conversiones", value: conversiones },
  ].filter((d) => d.value > 0);

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Tracking — {listName}</h3>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={<Users className="w-4 h-4" />} label="Leads" value={total} />
        <KPICard icon={<Send className="w-4 h-4" />} label="Enviados" value={enviados} />
        <KPICard icon={<MessageSquare className="w-4 h-4" />} label="Respondidos" value={respondidos} sub={`${responseRate}% tasa`} />
        <KPICard icon={<Target className="w-4 h-4" />} label="Conversiones" value={conversiones} sub={`${conversionRate}% tasa`} />
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Progreso del outreach</span>
            <span>{enviados}/{total} contactados</span>
          </div>
          <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted/30">
            <div className="bg-primary/80 rounded-l-full transition-all" style={{ width: `${(enviados / total) * 100}%` }} />
            <div className="bg-[hsl(var(--chart-2,160_60%_45%))] transition-all" style={{ width: `${(respondidos / total) * 100}%` }} />
            <div className="bg-[hsl(var(--chart-3,30_80%_55%))] rounded-r-full transition-all" style={{ width: `${(conversiones / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Funnel chart */}
      {funnelData.length > 1 && (
        <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Funnel</span>
          </div>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={funnelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
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
      )}

      {total === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Todavía no hay datos de tracking. Los usuarios del outreach irán cargando el progreso.
        </p>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
