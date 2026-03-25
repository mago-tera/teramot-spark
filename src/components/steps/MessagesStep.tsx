import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Plus, ArrowLeft, Trash2 } from "lucide-react";
import { CommunicationEditor } from "@/components/steps/CommunicationEditor";

interface Communication {
  id: string;
  campaign_id: string;
  name: string;
  linkedin: string;
  email_asunto: string;
  email_cuerpo: string;
  created_at: string;
}

interface Props {
  campaignId: string | null;
}

export function MessagesStep({ campaignId }: Props) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCommunications = useCallback(async () => {
    if (!campaignId) { setLoading(false); return; }
    const { data } = await supabase
      .from("communications")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });
    setCommunications((data as Communication[]) || []);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { loadCommunications(); }, [loadCommunications]);

  const generateMessages = async () => {
    if (!prompt.trim() || !campaignId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-messages", {
        body: { contact: {}, canal: "email", objective: prompt, whatToCommunicate: prompt, mode: "generic", quartile: "Q2" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const msgs = data.messages;
      const name = prompt.length > 60 ? prompt.slice(0, 57) + "..." : prompt;

      const { data: row, error: insertErr } = await supabase.from("communications").insert({
        campaign_id: campaignId,
        name,
        linkedin: msgs.linkedin || "",
        email_asunto: msgs.email_asunto || "",
        email_cuerpo: msgs.email_cuerpo || "",
      }).select().single();

      if (insertErr) throw insertErr;

      setCommunications((prev) => [row as Communication, ...prev]);
      setSelectedId((row as Communication).id);
      setShowGenerator(false);
      setPrompt("");
      toast.success("Comunicación generada");
    } catch (e: any) {
      console.error("Error generating:", e);
      toast.error(e.message || "Error generando comunicación");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("communications").delete().eq("id", id);
    if (error) { toast.error("Error eliminando"); setDeletingId(null); return; }
    setCommunications((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDeletingId(null);
    toast.success("Comunicación eliminada");
  };

  const handleUpdate = async (updated: Communication) => {
    setCommunications((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const selected = communications.find((c) => c.id === selectedId);

  if (!campaignId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Creá una campaña primero para generar comunicaciones.
      </div>
    );
  }

  // ─── Viewing a specific communication ───
  if (selected) {
    return (
      <CommunicationEditor
        communication={selected}
        onBack={() => setSelectedId(null)}
        onUpdate={handleUpdate}
      />
    );
  }

  // ─── Generator view ───
  if (showGenerator) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto pt-8">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowGenerator(false)} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-2xl font-semibold text-foreground">Nueva Comunicación</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              ¿Qué querés comunicar?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: Quiero agendar demos de 15 min mostrando cómo Teramot reduce el tiempo de construcción de infraestructura de datos..."
              className="glass-input w-full min-h-[120px] text-sm resize-none"
            />
          </div>

          <button
            onClick={generateMessages}
            disabled={generating || !prompt.trim()}
            className="w-full px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse [animation-delay:300ms]" />
                </span>
                Generando...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                Generar comunicación
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── Communications list ───
  return (
    <div className="space-y-6 max-w-2xl mx-auto pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Comunicaciones</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {communications.length} comunicación{communications.length !== 1 ? "es" : ""} generada{communications.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowGenerator(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Nueva comunicación
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : communications.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-4">
          <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <div>
            <p className="text-foreground font-medium">Sin comunicaciones aún</p>
            <p className="text-sm text-muted-foreground mt-1">Generá tu primera comunicación para esta campaña</p>
          </div>
          <button
            onClick={() => setShowGenerator(true)}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Generar comunicación
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {communications.map((comm) => (
            <div
              key={comm.id}
              className="glass-card p-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.04] transition-colors group"
              onClick={() => setSelectedId(comm.id)}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{comm.name || "Sin nombre"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(comm.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(comm.id); }}
                disabled={deletingId === comm.id}
                className="p-2 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
