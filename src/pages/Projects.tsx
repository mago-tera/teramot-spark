import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ChevronRight, Zap, Clock, CheckCircle2 } from "lucide-react";

interface Campaign {
  id: string;
  name: string | null;
  profile: string;
  quantity: number;
  frequency: string;
  status: string;
  geo_mix: Record<string, number>;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  configuracion: { label: "Configurando", icon: <Clock className="w-3.5 h-3.5" />, color: "text-warning bg-warning/10" },
  buscando: { label: "Buscando leads", icon: <Zap className="w-3.5 h-3.5" />, color: "text-primary bg-primary/10" },
  scoring: { label: "Scoring", icon: <Zap className="w-3.5 h-3.5" />, color: "text-primary bg-primary/10" },
  mensajes: { label: "Generando mensajes", icon: <Zap className="w-3.5 h-3.5" />, color: "text-primary bg-primary/10" },
  activa: { label: "Activa", icon: <Zap className="w-3.5 h-3.5 animate-pulse" />, color: "text-success bg-success/10" },
  completada: { label: "Completada", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-muted-foreground bg-muted" },
};

export default function Projects() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setCampaigns((data as Campaign[]) || []);
        setLoading(false);
      });
  }, []);

  const geoSummary = (mix: Record<string, number>) =>
    Object.entries(mix)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k} ${v}%`)
      .join(", ");

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar branding */}
      <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col border-r border-white/[0.08]" style={{ background: "hsl(240 15% 6%)" }}>
        <div className="px-5 py-6 border-b border-white/[0.08]">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            <span className="text-primary">Teramot</span>{" "}
            <span className="text-muted-foreground font-normal text-sm">Prospecting</span>
          </h1>
        </div>
        <nav className="flex-1 px-3 py-4">
          <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm bg-primary/15 text-foreground">
            <span className="w-7 h-7 rounded-md flex items-center justify-center text-xs bg-primary text-primary-foreground">📁</span>
            <span>Projects</span>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Campañas de prospección</h2>
            <p className="text-sm text-muted-foreground mt-1">Gestiona y lanza tus campañas activas.</p>
          </div>
          <button
            onClick={() => navigate("/campaign/new")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Nueva campaña
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass-card p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-2xl">🚀</div>
            <h3 className="text-lg font-medium text-foreground">No hay campañas aún</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Creá tu primera campaña de prospección para comenzar a generar leads calificados.
            </p>
            <button
              onClick={() => navigate("/campaign/new")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              Crear campaña
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const st = STATUS_MAP[c.status] || STATUS_MAP.configuracion;
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/campaign/${c.id}`)}
                  className="glass-card glass-card-hover w-full p-5 flex items-center gap-5 text-left transition-all group"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {c.name || c.profile}
                      </h3>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.icon}
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.quantity} leads · {c.frequency === "once" ? "Una vez" : c.frequency === "weekly" ? "Semanal" : "Mensual"} · {geoSummary(c.geo_mix as Record<string, number>)}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground/60 shrink-0">
                    {new Date(c.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
