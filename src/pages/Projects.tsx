import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, ChevronRight, Zap, Clock, CheckCircle2, Pencil, Check, LogOut, UserPlus, Share2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Campaign {
  id: string;
  name: string | null;
  profile: string;
  quantity: number;
  frequency: string;
  status: string;
  geo_mix: Record<string, number>;
  created_at: string;
  user_id: string | null;
}

interface CampaignMember {
  campaign_id: string;
}

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  configuracion: { label: "Configurando", icon: <Clock className="w-3.5 h-3.5" />, color: "text-warning bg-warning/10" },
  buscando: { label: "Buscando leads", icon: <Zap className="w-3.5 h-3.5" />, color: "text-primary bg-primary/10" },
  scoring: { label: "Scoring", icon: <Zap className="w-3.5 h-3.5" />, color: "text-primary bg-primary/10" },
  mensajes: { label: "Generando mensajes", icon: <Zap className="w-3.5 h-3.5" />, color: "text-primary bg-primary/10" },
  activa: { label: "Activa", icon: <Zap className="w-3.5 h-3.5 animate-pulse" />, color: "text-success bg-success/10" },
  completada: { label: "Completada", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-muted-foreground bg-muted" },
  tracking: { label: "Tracking", icon: <Zap className="w-3.5 h-3.5" />, color: "text-primary bg-primary/10" },
};

export default function Projects() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sharedCampaigns, setSharedCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [shareDialogId, setShareDialogId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadCampaigns();
  }, [user]);

  const loadCampaigns = async () => {
    // Own campaigns
    const { data: own } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    setCampaigns((own as Campaign[]) || []);

    // Shared campaigns (via campaign_members)
    const { data: memberships } = await supabase
      .from("campaign_members")
      .select("campaign_id")
      .eq("user_id", user!.id);

    if (memberships && memberships.length > 0) {
      const ids = memberships.map((m: CampaignMember) => m.campaign_id);
      const { data: shared } = await supabase
        .from("campaigns")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      setSharedCampaigns((shared as Campaign[]) || []);
    } else {
      setSharedCampaigns([]);
    }

    setLoading(false);
  };

  const geoSummary = (mix: Record<string, number>) =>
    Object.entries(mix)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k} ${v}%`)
      .join(", ");

  const updateName = async (id: string, name: string) => {
    await supabase.from("campaigns").update({ name }).eq("id", id);
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    setEditingId(null);
  };

  const shareCampaign = async () => {
    if (!shareDialogId || !shareEmail.trim()) return;
    setSharing(true);

    // Find user by email in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", shareEmail.trim().toLowerCase())
      .single();

    if (!profile) {
      alert("No se encontró un usuario con ese email. Debe estar registrado en la app.");
      setSharing(false);
      return;
    }

    const { error } = await supabase.from("campaign_members").insert({
      campaign_id: shareDialogId,
      user_id: profile.id,
      role: "viewer",
    });

    if (error) {
      if (error.code === "23505") {
        alert("Este usuario ya tiene acceso a esta campaña.");
      } else {
        alert("Error al compartir: " + error.message);
      }
    } else {
      alert("Campaña compartida exitosamente.");
    }

    setShareEmail("");
    setShareDialogId(null);
    setSharing(false);
  };

  const CampaignCard = ({ c, isShared = false }: { c: Campaign; isShared?: boolean }) => {
    const st = STATUS_MAP[c.status] || STATUS_MAP.configuracion;
    return (
      <div
        key={c.id}
        onClick={() => { if (editingId !== c.id) navigate(`/campaign/${c.id}`); }}
        className="glass-card glass-card-hover w-full p-5 flex items-center gap-5 text-left transition-all group cursor-pointer"
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-3">
            {editingId === c.id ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") updateName(c.id, editingName); }}
                  className="glass-input text-sm py-1 px-2 w-56"
                  autoFocus
                />
                <button onClick={() => updateName(c.id, editingName)} className="p-1 rounded hover:bg-white/10 text-success">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-medium text-foreground truncate">
                  {c.name || c.profile}
                </h3>
                {!isShared && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setEditingName(c.name || c.profile); }}
                    className="p-1 rounded hover:bg-white/10 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>
              {st.icon}
              {st.label}
            </span>
            {isShared && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 bg-white/5 px-2 py-0.5 rounded-full">
                <Share2 className="w-3 h-3" /> Compartida
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {c.quantity} leads · {geoSummary(c.geo_mix as Record<string, number>)}
          </p>
        </div>

        {!isShared && (
          <button
            onClick={(e) => { e.stopPropagation(); setShareDialogId(c.id); }}
            className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
            title="Compartir"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        )}

        <div className="text-xs text-muted-foreground/60 shrink-0">
          {new Date(c.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full">
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

        {/* User info + logout */}
        <div className="px-4 py-4 border-t border-white/[0.08]">
          <div className="flex items-center gap-3 mb-3">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium">
                {user?.email?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">{user?.user_metadata?.full_name || user?.email}</p>
              <p className="text-[10px] text-muted-foreground/60 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

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
        ) : campaigns.length === 0 && sharedCampaigns.length === 0 ? (
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
          <div className="space-y-8">
            {/* Own campaigns */}
            {campaigns.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground/60 px-1">Mis campañas</h3>
                {campaigns.map((c) => (
                  <CampaignCard key={c.id} c={c} />
                ))}
              </div>
            )}

            {/* Shared campaigns */}
            {sharedCampaigns.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground/60 px-1">Campañas de un Tera-player</h3>
                {sharedCampaigns.map((c) => (
                  <CampaignCard key={c.id} c={c} isShared />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Share dialog */}
      <AlertDialog open={!!shareDialogId} onOpenChange={(open) => !open && setShareDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Compartir campaña</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresá el email del usuario @teramot.com con quien querés compartir esta campaña.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            placeholder="usuario@teramot.com"
            className="glass-input w-full text-sm py-2 px-3"
            onKeyDown={(e) => { if (e.key === "Enter") shareCampaign(); }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={shareCampaign} disabled={sharing || !shareEmail.trim()}>
              {sharing ? "Compartiendo..." : "Compartir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
