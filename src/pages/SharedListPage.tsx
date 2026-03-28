import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Circle, Search, Copy, Check, ChevronDown, Sparkles, Save, Loader2, UserPlus } from "lucide-react";
import { ShareEntityDialog } from "@/components/ShareEntityDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SharedLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  country: string | null;
  email: string | null;
  linkedin_url: string | null;
  score: number | null;
  quartile: string | null;
  calificacion: string | null;
  responsable: string | null;
  canal: string | null;
  agregado: boolean;
  enviado: boolean;
  respondido: boolean;
  conversion: boolean;
}

interface ListInfo {
  id: string;
  name: string;
  copy_sugerido: string;
  copy_sugerido_subject: string;
  filtros_compartidos: {
    calificacion?: string | null;
    responsable?: string | null;
    canal?: string | null;
  };
}

const QUARTILE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  Q1: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", label: "Top Fit" },
  Q2: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20", label: "Buen Fit" },
  Q3: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Fit Moderado" },
  Q4: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", label: "Fit Bajo" },
};

const COUNTRY_COLORS: Record<string, string> = {
  Argentina: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  Colombia: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
  Chile: "bg-red-500/15 text-red-300 border-red-500/20",
  México: "bg-green-500/15 text-green-300 border-green-500/20",
  Brasil: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  USA: "bg-purple-500/15 text-purple-300 border-purple-500/20",
};

interface OutreachViewProps {
  listId: string;
}

export function OutreachView({ listId }: OutreachViewProps) {
  const [listInfo, setListInfo] = useState<ListInfo | null>(null);
  const [leads, setLeads] = useState<SharedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkedin, setCopiedLinkedin] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [editingSubject, setEditingSubject] = useState(false);
  const [editingCopy, setEditingCopy] = useState(false);
  const [copyDraft, setCopyDraft] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!listId) return;

    (async () => {
      const { data: list, error: listErr } = await supabase
        .from("lists")
        .select("id, name, copy_sugerido, copy_sugerido_subject, filtros_compartidos")
        .eq("id", listId)
        .single();

      if (listErr || !list) {
        setError("No tenés acceso a esta lista o no existe.");
        setLoading(false);
        return;
      }

      setListInfo({
        ...list,
        copy_sugerido_subject: (list as any).copy_sugerido_subject || "",
        filtros_compartidos: (list.filtros_compartidos as any) || {},
      });
      setSubject((list as any).copy_sugerido_subject || "");

      const { data: leadsData } = await supabase
        .from("leads")
        .select("*")
        .eq("list_id", listId)
        .order("score", { ascending: false });

      if (leadsData) {
        const filters = (list.filtros_compartidos as any) || {};
        const filtered = leadsData.filter((l) => {
          if (filters.canal && l.canal !== filters.canal) return false;
          return true;
        });
        setLeads(filtered as SharedLead[]);
      }
      setLoading(false);
    })();
  }, [listId]);

  const toggleField = async (leadId: string, field: "agregado" | "enviado" | "respondido" | "conversion") => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const newVal = !lead[field];
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, [field]: newVal } : l)));
    const { error } = await supabase.from("leads").update({ [field]: newVal }).eq("id", leadId);
    if (error) {
      toast.error("Error al guardar");
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, [field]: !newVal } : l)));
    }
  };

  const copyLinkedin = (url: string, leadId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkedin(leadId);
    toast.success("LinkedIn copiado");
    setTimeout(() => setCopiedLinkedin(null), 1500);
  };

  const copyMessageForLead = (lead: SharedLead) => {
    if (!listInfo?.copy_sugerido) return;
    const name = lead.first_name || "{{Nombre}}";
    const message = listInfo.copy_sugerido.replace(/\[Nombre\]/gi, name);
    let fullText = "";
    if (subject) {
      fullText = `Subject: ${subject.replace(/\[Nombre\]/gi, name)}\n\n${message}`;
    } else {
      fullText = message;
    }
    navigator.clipboard.writeText(fullText);
    setCopiedId(lead.id);
    toast.success("Mensaje copiado");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const saveSubject = async () => {
    if (!listId) return;
    setEditingSubject(false);
    await supabase.from("lists").update({ copy_sugerido_subject: subject } as any).eq("id", listId);
    if (listInfo) setListInfo({ ...listInfo, copy_sugerido_subject: subject });
    toast.success("Subject guardado");
  };

  const saveCopy = async () => {
    if (!listId) return;
    await supabase.from("lists").update({ copy_sugerido: copyDraft }).eq("id", listId);
    if (listInfo) setListInfo({ ...listInfo, copy_sugerido: copyDraft });
    setEditingCopy(false);
    toast.success("Copy guardado");
  };

  const aiEditCopy = async () => {
    if (!aiInstruction.trim() || !listInfo) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("edit-message", {
        body: { currentText: editingCopy ? copyDraft : listInfo.copy_sugerido, instruction: aiInstruction, field: "email_cuerpo" },
      });
      if (error) throw error;
      if (data?.text) {
        setCopyDraft(data.text);
        setEditingCopy(true);
        setAiInstruction("");
        toast.success("Copy editado con IA");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al editar con IA");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (error || !listInfo) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <p className="text-lg text-foreground font-semibold">Acceso denegado</p>
          <p className="text-sm text-muted-foreground">{error || "No se pudo cargar la lista."}</p>
        </div>
      </div>
    );
  }

  const filters = listInfo.filtros_compartidos;
  const activeFilters = [
    filters.canal && `Canal: ${filters.canal}`,
  ].filter(Boolean);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? leads.filter((l) =>
        `${l.first_name} ${l.last_name} ${l.title} ${l.company} ${l.email} ${l.country}`.toLowerCase().includes(q)
      )
    : leads;

  const stats = {
    total: leads.length,
    enviados: leads.filter((l) => l.enviado).length,
    respondidos: leads.filter((l) => l.respondido).length,
    conversiones: leads.filter((l) => l.conversion).length,
  };

  const hasCopy = !!listInfo.copy_sugerido;
  const canal = filters.canal?.toLowerCase() || "";
  const showEmail = canal !== "linkedin";
  const showLinkedin = canal !== "mail";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{listInfo.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{leads.length} leads</p>
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Filtros:</span>
              {activeFilters.map((f) => (
                <span key={f} className="text-xs px-2 py-0.5 rounded-full border border-border/40 bg-muted/20 text-foreground">{f}</span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShareOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-border/40 bg-muted/20 hover:bg-muted/40 text-foreground transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Agregar usuarios
        </button>
        <ShareEntityDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          entityType="lista"
          entityId={listId!}
          memberTable="list_members"
          fkColumn="list_id"
        />
      </div>



      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Enviados", value: stats.enviados, color: "text-blue-400" },
          { label: "Respondidos", value: stats.respondidos, color: "text-amber-400" },
          { label: "Conversiones", value: stats.conversiones, color: "text-green-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/40 bg-muted/10 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, empresa, cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40">
                {[
                  "Nombre", "Cargo", "Empresa", "País",
                  ...(showEmail ? ["Email"] : []),
                  ...(showLinkedin ? ["LinkedIn"] : []),
                  "Score",
                  ...(hasCopy ? ["Mensaje"] : []),
                  ...(canal === "linkedin" ? ["Agregado"] : []),
                  "Enviado", "Respondido", "Conversión"
                ].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, i) => {
                const qs = QUARTILE_STYLES[lead.quartile || "Q4"] || QUARTILE_STYLES.Q4;
                return (
                  <tr key={lead.id} className={`border-b border-border/20 ${i % 2 === 0 ? "bg-muted/5" : ""} hover:bg-muted/10 transition-colors`}>
                    <td className="px-3 py-2.5 text-foreground font-medium whitespace-nowrap">{lead.first_name} {lead.last_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate">{lead.title}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{lead.company}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${COUNTRY_COLORS[lead.country || ""] || "text-muted-foreground"}`}>{lead.country}</span>
                    </td>
                    {showEmail && (
                      <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{lead.email || "—"}</td>
                    )}
                    {showLinkedin && (
                      <td className="px-3 py-2.5">
                        {lead.linkedin_url ? (
                          <div className="flex items-center gap-1.5">
                            <a href={lead.linkedin_url.startsWith("http") ? lead.linkedin_url : `https://${lead.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-[10px] font-mono truncate underline max-w-[120px]">
                              Perfil
                            </a>
                            <button
                              onClick={() => copyLinkedin(lead.linkedin_url!, lead.id)}
                              className="p-0.5 rounded hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                              title="Copiar URL de LinkedIn"
                            >
                              {copiedLinkedin === lead.id
                                ? <Check className="w-3 h-3 text-green-400" />
                                : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : <span className="text-muted-foreground text-[10px]">—</span>}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-3 py-1.5 rounded text-xs font-medium border whitespace-nowrap ${qs.bg} ${qs.text} ${qs.border}`}>{qs.label}</span>
                    </td>
                    {hasCopy && (
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => copyMessageForLead(lead)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-border/40 bg-muted/20 hover:bg-muted/40 text-foreground transition-colors whitespace-nowrap"
                          title="Copiar mensaje personalizado"
                        >
                          {copiedId === lead.id
                            ? <><Check className="w-3 h-3 text-green-400" /> Copiado</>
                            : <><Copy className="w-3 h-3" /> Copiar</>}
                        </button>
                      </td>
                    )}
                    {canal === "linkedin" && (
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => toggleField(lead.id, "agregado")} className="transition-colors">
                          {lead.agregado
                            ? <CheckCircle2 className="w-5 h-5 text-violet-400" />
                            : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-violet-400/60" />}
                        </button>
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => toggleField(lead.id, "enviado")} className="transition-colors">
                        {lead.enviado
                          ? <CheckCircle2 className="w-5 h-5 text-blue-400" />
                          : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-blue-400/60" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => toggleField(lead.id, "respondido")} className="transition-colors">
                        {lead.respondido
                          ? <CheckCircle2 className="w-5 h-5 text-amber-400" />
                          : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-amber-400/60" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => toggleField(lead.id, "conversion")} className="transition-colors">
                        {lead.conversion
                          ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                          : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-green-400/60" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>

      {/* Copy sugerido + Subject - Collapsible - at bottom */}
      {hasCopy && (
        <Collapsible open={copyOpen} onOpenChange={setCopyOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full rounded-xl border border-border/40 bg-muted/20 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Copy Sugerido</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${copyOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-xl border border-border/40 bg-muted/10 p-4 space-y-4">
            {/* Subject */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">Subject:</span>
              {editingSubject ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ej: Hola [Nombre], te escribo por..."
                    className="flex-1 bg-muted/30 border border-border/40 rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveSubject(); if (e.key === "Escape") setEditingSubject(false); }}
                  />
                  <button onClick={saveSubject} className="px-2 py-1 rounded text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    Guardar
                  </button>
                  <button onClick={() => setEditingSubject(false)} className="px-2 py-1 rounded text-[11px] border border-border/40 text-muted-foreground hover:text-foreground transition-colors">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-foreground">{subject || <span className="text-muted-foreground italic">Sin subject</span>}</span>
                  <button onClick={() => setEditingSubject(true)} className="text-[10px] text-primary hover:text-primary/80 transition-colors underline">
                    {subject ? "Editar" : "Agregar"}
                  </button>
                </div>
              )}
            </div>

            {/* Copy body */}
            {editingCopy ? (
              <div className="space-y-3">
                <textarea
                  value={copyDraft}
                  onChange={(e) => setCopyDraft(e.target.value)}
                  rows={8}
                  className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-y"
                />
                <div className="flex items-center gap-2">
                  <button onClick={saveCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Save className="w-3 h-3" /> Guardar
                  </button>
                  <button onClick={() => { setEditingCopy(false); setCopyDraft(""); }} className="px-3 py-1.5 rounded-lg text-xs border border-border/40 text-muted-foreground hover:text-foreground transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{listInfo.copy_sugerido}</p>
                <button
                  onClick={() => { setCopyDraft(listInfo.copy_sugerido); setEditingCopy(true); }}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors underline"
                >
                  Editar manualmente
                </button>
              </div>
            )}

            {/* AI edit */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <input
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder="Ej: Hacelo más corto, cambiá el tono a informal..."
                className="flex-1 bg-muted/30 border border-border/40 rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                onKeyDown={(e) => { if (e.key === "Enter" && !aiLoading) aiEditCopy(); }}
                disabled={aiLoading}
              />
              <button
                onClick={aiEditCopy}
                disabled={aiLoading || !aiInstruction.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Editar con IA
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      </div>
    </div>
  );
}

// Default export for route usage
export default function SharedListPage() {
  const { listId } = useParams();
  if (!listId) return null;
  return (
    <div className="min-h-screen" style={{ background: "hsl(240 15% 6%)" }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <OutreachView listId={listId} />
      </div>
    </div>
  );
}
