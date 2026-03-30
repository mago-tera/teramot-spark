import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, ChevronRight, ChevronDown, Zap, Clock, CheckCircle2, Pencil, Check, ArrowLeft, Trash2, UserPlus, Users, X } from "lucide-react";
import { ShareEntityDialog } from "@/components/ShareEntityDialog";
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
  const [shareCampaignId, setShareCampaignId] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; user_id: string; role: string; email: string; full_name: string | null }[]>([]);
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

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

    // Load project members
    if (proj) {
      const { data: mems } = await supabase
        .from("project_members")
        .select("id, user_id, role")
        .eq("project_id", projectId!);
      if (mems && mems.length > 0) {
        const userIds = mems.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        setMembers(mems.map((m: any) => ({
          ...m,
          email: profileMap.get(m.user_id)?.email || "",
          full_name: profileMap.get(m.user_id)?.full_name || null,
        })));
      } else {
        setMembers([]);
      }
    }

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

  const addMember = async () => {
    if (!addMemberEmail.trim() || !projectId) return;
    setAddingMember(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("email", addMemberEmail.trim().toLowerCase())
        .single();
      if (!profile) {
        toast.error("No se encontró un usuario con ese email.");
        return;
      }
      const { error } = await supabase.from("project_members").insert({
        project_id: projectId,
        user_id: profile.id,
        role: "viewer",
      });
      if (error) {
        toast.error(error.code === "23505" ? "Este usuario ya tiene acceso." : error.message);
        return;
      }
      setMembers((prev) => [...prev, { id: crypto.randomUUID(), user_id: profile.id, role: "viewer", email: profile.email, full_name: profile.full_name }]);
      setAddMemberEmail("");
      toast.success("Usuario agregado al proyecto.");
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (memberId: string) => {
    await supabase.from("project_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.success("Usuario removido del proyecto.");
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
          {isOwner && (
            <button
              onClick={() => setShowNewDialog(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <span className="w-7 h-7 rounded-md flex items-center justify-center text-xs border border-dashed border-muted-foreground/30">
                <Plus className="w-3.5 h-3.5" />
              </span>
              <span>Nueva campaña</span>
            </button>
          )}
        </nav>
      </aside>

      <main className="flex-1 p-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{project?.name || "Campañas"}</h2>
              <p className="text-sm text-muted-foreground mt-1">Campañas de prospección de este proyecto.</p>
            </div>
            {isOwner && (
              <button
                onClick={() => setShowMembers(!showMembers)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>Usuarios con acceso</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMembers ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>

          {/* Collapsible members section */}
          {isOwner && showMembers && (
            <div className="mt-4 glass-card p-5 space-y-4">
              {members.length > 0 && (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                          {(m.full_name || m.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          {m.full_name && <p className="text-sm text-foreground truncate">{m.full_name}</p>}
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeMember(m.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
                        title="Quitar acceso"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                  className="glass-input flex-1 text-sm py-2 px-3"
                  onKeyDown={(e) => { if (e.key === "Enter") addMember(); }}
                />
                <button
                  onClick={addMember}
                  disabled={addingMember || !addMemberEmail.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {addingMember ? "..." : "Agregar"}
                </button>
              </div>
            </div>
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
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {new Date(c.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  {isOwner && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShareCampaignId(c.id); }}
                        className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground/40 hover:text-foreground"
                        title="Compartir campaña"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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

      {/* Share campaign dialog */}
      {shareCampaignId && (
        <ShareEntityDialog
          open={!!shareCampaignId}
          onOpenChange={(open) => !open && setShareCampaignId(null)}
          entityType="campaña"
          entityId={shareCampaignId}
          memberTable="campaign_members"
          fkColumn="campaign_id"
        />
      )}

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
