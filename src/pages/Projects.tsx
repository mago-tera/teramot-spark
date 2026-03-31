import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, ChevronRight, Pencil, Check, LogOut, Trash2, UserPlus, FolderOpen, Send, Mail, Linkedin, Menu, X } from "lucide-react";
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

interface Project {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

interface MyOutreach {
  id: string;
  name: string;
  campaign_id: string;
  canal: string | null;
  lead_count: number;
  enviados: number;
  respondidos: number;
  conversiones: number;
  created_at: string;
}

export default function Projects() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [myOutreaches, setMyOutreaches] = useState<MyOutreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"projects" | "outreaches">("projects");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [filter, setFilter] = useState<"mine" | "others">("mine");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [shareDialogId, setShareDialogId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // New project dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadProjects();
    loadMyOutreaches();
  }, [user]);

  const loadProjects = async () => {
    const { data: all } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    const own = (all || []).filter((p) => p.user_id === user!.id);
    const shared = (all || []).filter((p) => p.user_id !== user!.id);
    setProjects(own as Project[]);
    setSharedProjects(shared as Project[]);
    setLoading(false);
  };

  const loadMyOutreaches = async () => {
    if (!user) return;
    // Get list IDs where user is a member
    const { data: memberships } = await supabase
      .from("list_members")
      .select("list_id")
      .eq("user_id", user.id);
    
    if (!memberships || memberships.length === 0) {
      setMyOutreaches([]);
      return;
    }

    const listIds = memberships.map((m) => m.list_id);
    const { data: lists } = await supabase
      .from("lists")
      .select("id, name, campaign_id, lead_count, enviados, respondidos, conversiones, created_at, filtros_compartidos")
      .in("id", listIds)
      .eq("shared", true)
      .order("created_at", { ascending: false });

    if (lists) {
      setMyOutreaches(lists.map((l) => ({
        id: l.id,
        name: l.name,
        campaign_id: l.campaign_id,
        canal: (l.filtros_compartidos as any)?.canal || null,
        lead_count: l.lead_count,
        enviados: l.enviados,
        respondidos: l.respondidos,
        conversiones: l.conversiones,
        created_at: l.created_at,
      })));
    }
  };

  const createProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({ name: newName.trim(), user_id: user!.id })
        .select()
        .single();
      if (error) { toast.error("Error al crear proyecto"); return; }

      if (newInviteEmail.trim()) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", newInviteEmail.trim().toLowerCase())
          .single();
        if (profile) {
          await supabase.from("project_members").insert({
            project_id: data.id,
            user_id: profile.id,
            role: "viewer",
          });
          toast.success("Proyecto creado e invitación enviada");
        } else {
          toast.success("Proyecto creado. No se encontró usuario con ese email.");
        }
      } else {
        toast.success("Proyecto creado");
      }

      setShowNewDialog(false);
      setNewName("");
      setNewInviteEmail("");
      navigate(`/project/${data.id}`);
    } finally {
      setCreating(false);
    }
  };

  const updateName = async (id: string, name: string) => {
    await supabase.from("projects").update({ name }).eq("id", id);
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    setEditingId(null);
  };

  const deleteProject = async () => {
    if (!deleteId) return;
    await supabase.from("projects").delete().eq("id", deleteId);
    setProjects((prev) => prev.filter((p) => p.id !== deleteId));
    setDeleteId(null);
    toast.success("Proyecto eliminado");
  };

  const shareProject = async () => {
    if (!shareDialogId || !shareEmail.trim()) return;
    setSharing(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", shareEmail.trim().toLowerCase())
      .single();

    if (!profile) {
      toast.error("No se encontró un usuario con ese email.");
      setSharing(false);
      return;
    }

    const { error } = await supabase.from("project_members").insert({
      project_id: shareDialogId,
      user_id: profile.id,
      role: "viewer",
    });

    if (error) {
      toast.error(error.code === "23505" ? "Este usuario ya tiene acceso." : error.message);
    } else {
      toast.success("Proyecto compartido exitosamente.");
    }
    setShareEmail("");
    setShareDialogId(null);
    setSharing(false);
  };

  const displayed = filter === "mine" ? projects : sharedProjects;

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col border-r border-white/[0.08]" style={{ background: "hsl(240 15% 6%)" }}>
        <div className="px-5 py-6 border-b border-white/[0.08]">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            <span className="text-primary">Teramot</span>{" "}
            <span className="text-muted-foreground font-normal text-sm">Prospecting</span>
          </h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button
            onClick={() => setTab("projects")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              tab === "projects" ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            }`}
          >
            <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs ${
              tab === "projects" ? "bg-primary text-primary-foreground" : "bg-white/[0.04] text-muted-foreground"
            }`}>
              <FolderOpen className="w-4 h-4" />
            </span>
            <span>Proyectos</span>
            {tab === "projects" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
          </button>
          <button
            onClick={() => setTab("outreaches")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              tab === "outreaches" ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            }`}
          >
            <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs ${
              tab === "outreaches" ? "bg-primary text-primary-foreground" : "bg-white/[0.04] text-muted-foreground"
            }`}>
              <Send className="w-4 h-4" />
            </span>
            <span>Mis Outreaches</span>
            {myOutreaches.length > 0 && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{myOutreaches.length}</span>
            )}
          </button>
        </nav>

        {/* User */}
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

      {/* Main */}
      <main className="flex-1 p-8 max-w-5xl">
        {tab === "projects" ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Proyectos</h2>
                <p className="text-sm text-muted-foreground mt-1">Gestiona tus proyectos de prospección.</p>
              </div>
              <button
                onClick={() => setShowNewDialog(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4" />
                Nuevo proyecto
              </button>
            </div>

            {/* Switcher */}
            <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/[0.04] w-fit">
              <button
                onClick={() => setFilter("mine")}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filter === "mine" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mis proyectos
              </button>
              <button
                onClick={() => setFilter("others")}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filter === "others" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Compartidos conmigo
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="glass-card p-5 animate-pulse h-20" />)}
              </div>
            ) : displayed.length === 0 ? (
              <div className="glass-card p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <FolderOpen className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-foreground">
                  {filter === "mine" ? "No tenés proyectos aún" : "No te compartieron proyectos"}
                </h3>
                {filter === "mine" && (
                  <button
                    onClick={() => setShowNewDialog(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    Crear proyecto
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {displayed.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => { if (editingId !== p.id) navigate(`/project/${p.id}`); }}
                    className="glass-card glass-card-hover w-full p-5 flex items-center gap-5 text-left transition-all group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FolderOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingId === p.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") updateName(p.id, editingName); }}
                            className="glass-input text-sm py-1 px-2 w-56"
                            autoFocus
                          />
                          <button onClick={() => updateName(p.id, editingName)} className="p-1 rounded hover:bg-white/10 text-success">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-foreground truncate">{p.name}</h3>
                          {filter === "mine" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingId(p.id); setEditingName(p.name); }}
                              className="p-1 rounded hover:bg-white/10 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(p.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                        {filter === "others" && " · Compartido"}
                      </p>
                    </div>

                    {filter === "mine" && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShareDialogId(p.id); }}
                          className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground/40 hover:text-foreground"
                          title="Compartir"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
                          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Mis Outreaches tab */
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground">Mis Outreaches</h2>
              <p className="text-sm text-muted-foreground mt-1">Outreaches que te asignaron para gestionar.</p>
            </div>

            {myOutreaches.length === 0 ? (
              <div className="glass-card p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Send className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-foreground">No tenés outreaches asignados</h3>
                <p className="text-sm text-muted-foreground">Cuando alguien te asigne un outreach, aparecerá acá.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myOutreaches.map((o) => {
                  const responseRate = o.enviados > 0 ? ((o.respondidos / o.enviados) * 100).toFixed(0) : "0";
                  return (
                    <div
                      key={o.id}
                      onClick={() => navigate(`/shared/list/${o.id}`)}
                      className="glass-card glass-card-hover w-full p-5 flex items-center gap-5 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        {o.canal?.toLowerCase() === "linkedin" ? (
                          <Linkedin className="w-5 h-5 text-primary" />
                        ) : (
                          <Mail className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-foreground truncate">{o.name || "Sin nombre"}</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {o.canal || "Sin canal"}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {o.lead_count} leads
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">📤 {o.enviados} enviados</span>
                          <span className="text-[10px] text-muted-foreground">💬 {o.respondidos} resp. ({responseRate}%)</span>
                          <span className="text-[10px] text-muted-foreground">🎯 {o.conversiones} conv.</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {new Date(o.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Share dialog */}
      <AlertDialog open={!!shareDialogId} onOpenChange={(open) => !open && setShareDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Compartir proyecto</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresá el email del usuario con quien querés compartir este proyecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            placeholder="usuario@teramot.com"
            className="glass-input w-full text-sm py-2 px-3"
            onKeyDown={(e) => { if (e.key === "Enter") shareProject(); }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={shareProject} disabled={sharing || !shareEmail.trim()}>
              {sharing ? "Compartiendo..." : "Compartir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proyecto</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todas las campañas, listas y leads asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New project dialog */}
      <AlertDialog open={showNewDialog} onOpenChange={(open) => { if (!open) { setShowNewDialog(false); setNewName(""); setNewInviteEmail(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nuevo proyecto</AlertDialogTitle>
            <AlertDialogDescription>
              Dale un nombre a tu proyecto y opcionalmente invitá a alguien del equipo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Nombre del proyecto</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Expansión LATAM Q2"
                className="glass-input w-full text-sm py-2 px-3"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createProject(); }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5" />
                Invitar a alguien
                <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">(opcional)</span>
              </label>
              <input
                type="email"
                value={newInviteEmail}
                onChange={(e) => setNewInviteEmail(e.target.value)}
                placeholder="usuario@teramot.com"
                className="glass-input w-full text-sm py-2 px-3"
                onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createProject(); }}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={createProject} disabled={creating || !newName.trim()}>
              {creating ? "Creando..." : "Crear proyecto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
