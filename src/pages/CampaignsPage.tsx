import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, ChevronRight, Zap, Clock, CheckCircle2, Pencil, Check, ArrowLeft, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

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
  project_id: string | null;
}

interface ProjectData {
  id: string;
  name: string;
  user_id: string;
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

export default function CampaignsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  const isOwner = project?.user_id === user?.id;

  useEffect(() => {
    if (!projectId) return;
    loadData();
  }, [projectId]);

  const loadData = async () => {
    const { data: proj } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId!)
      .single();
    setProject(proj as ProjectData | null);

    const { data: camps } = await supabase
      .from("campaigns")
      .select("*")
      .eq("project_id", projectId!)
      .order("created_at", { ascending: false });
    setCampaigns((camps as Campaign[]) || []);
    setLoading(false);
  };

  const createCampaign = async () => {
    if (!newCampaignName.trim()) return;
    setCreatingCampaign(true);
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          name: newCampaignName.trim(),
          profile: "",
          user_id: user!.id,
          project_id: projectId,
          status: "configuracion",
        })
        .select()
        .single();
      if (error) { toast.error("Error al crear campaña"); return; }
      setShowNewDialog(false);
      setNewCampaignName("");
      navigate(`/project/${projectId}/campaign/${data.id}`);
    } finally {
      setCreatingCampaign(false);
    }
  };

  const updateName = async (id: string, name: string) => {
    await supabase.from("campaigns").update({ name }).eq("id", id);
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    setEditingId(null);
  };

  const deleteCampaign = async () => {
    if (!deleteId) return;
    await supabase.from("leads").delete().eq("campaign_id", deleteId);
    await supabase.from("lists").delete().eq("campaign_id", deleteId);
    await supabase.from("campaigns").delete().eq("id", deleteId);
    setCampaigns((prev) => prev.filter((c) => c.id !== deleteId));
    setDeleteId(null);
    toast.success("Campaña eliminada");
  };

  const geoSummary = (mix: Record<string, number>) =>
    Object.entries(mix)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k} ${v}%`)
      .join(", ");

  return (
    <div className="flex min-h-screen w-full">
      <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col border-r border-white/[0.08]" style={{ background: "hsl(240 15% 6%)" }}>
        <div className="px-5 py-6 border-b border-white/[0.08]">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            <span className="text-primary">Teramot</span>{" "}
            <span className="text-muted-foreground font-normal text-sm">Prospecting</span>
          </h1>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground hover:text-foreground border-b border-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a Proyectos
        </button>
        <nav className="flex-1 px-3 py-4">
          <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm bg-primary/15 text-foreground">
            <span className="w-7 h-7 rounded-md flex items-center justify-center text-xs bg-primary text-primary-foreground">📋</span>
            <span className="truncate">{project?.name || "Campañas"}</span>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </div>
        </nav>
      </aside>

      <main className="flex-1 p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{project?.name || "Campañas"}</h2>
            <p className="text-sm text-muted-foreground mt-1">Campañas de prospección de este proyecto.</p>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowNewDialog(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              Nueva campaña
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="glass-card p-5 animate-pulse h-24" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass-card p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-2xl">🚀</div>
            <h3 className="text-lg font-medium text-foreground">No hay campañas aún</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Creá tu primera campaña de prospección para comenzar a generar leads calificados.
            </p>
            {isOwner && (
              <button
                onClick={() => setShowNewDialog(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
              >
                <Plus className="w-4 h-4" />
                Crear campaña
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const st = STATUS_MAP[c.status] || STATUS_MAP.configuracion;
              return (
                <div
                  key={c.id}
                  onClick={() => { if (editingId !== c.id) navigate(`/project/${projectId}/campaign/${c.id}`); }}
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
                          {isOwner && (
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
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {new Date(c.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  {isOwner && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="text-xs text-muted-foreground/60 shrink-0">
                    {new Date(c.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar campaña</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todos los leads y listas asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New campaign dialog */}
      <AlertDialog open={showNewDialog} onOpenChange={(open) => { if (!open) { setShowNewDialog(false); setNewCampaignName(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nueva campaña</AlertDialogTitle>
            <AlertDialogDescription>
              Ponele un nombre a tu campaña para empezar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <input
              type="text"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              placeholder="Ej: Outreach Data Leaders Q2"
              className="glass-input w-full text-sm py-2 px-3"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && newCampaignName.trim()) createCampaign(); }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={createCampaign} disabled={creatingCampaign || !newCampaignName.trim()}>
              {creatingCampaign ? "Creando..." : "Crear campaña"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
