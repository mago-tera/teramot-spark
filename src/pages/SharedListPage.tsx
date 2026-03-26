import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Circle, Search, Copy, Check } from "lucide-react";

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

export default function SharedListPage() {
  const { listId } = useParams();
  const [listInfo, setListInfo] = useState<ListInfo | null>(null);
  const [leads, setLeads] = useState<SharedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkedin, setCopiedLinkedin] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [editingSubject, setEditingSubject] = useState(false);

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
          if (filters.calificacion && l.calificacion !== filters.calificacion) return false;
          if (filters.responsable && l.responsable !== filters.responsable) return false;
          if (filters.canal && l.canal !== filters.canal) return false;
          return true;
        });
        setLeads(filtered as SharedLead[]);
      }
      setLoading(false);
    })();
  }, [listId]);

  const toggleField = async (leadId: string, field: "enviado" | "respondido" | "conversion") => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(240 15% 6%)" }}>
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (error || !listInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(240 15% 6%)" }}>
        <div className="text-center space-y-3">
          <p className="text-lg text-foreground font-semibold">Acceso denegado</p>
          <p className="text-sm text-muted-foreground">{error || "No se pudo cargar la lista."}</p>
        </div>
      </div>
    );
  }

  const filters = listInfo.filtros_compartidos;
  const activeFilters = [
    filters.calificacion && `Aprobado: ${filters.calificacion}`,
    filters.responsable && `Responsable: ${filters.responsable}`,
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

  return (
    <div className="min-h-screen" style={{ background: "hsl(240 15% 6%)" }}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{listInfo.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{leads.length} leads</p>
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Filtros:</span>
              {activeFilters.map((f) => (
                <span key={f} className="text-xs px-2 py-0.5 rounded-full border border-white/[0.1] bg-white/[0.04] text-foreground">{f}</span>
              ))}
            </div>
          )}
        </div>

        {/* Copy sugerido + Subject */}
        {hasCopy && (
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">Copy Sugerido</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{listInfo.copy_sugerido}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Subject:</span>
              {editingSubject ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ej: Hola [Nombre], te escribo por..."
                    className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveSubject(); if (e.key === "Escape") setEditingSubject(false); }}
                  />
                  <button onClick={saveSubject} className="px-2 py-1 rounded text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    Guardar
                  </button>
                  <button onClick={() => setEditingSubject(false)} className="px-2 py-1 rounded text-[11px] border border-white/10 text-muted-foreground hover:text-foreground transition-colors">
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
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Enviados", value: stats.enviados, color: "text-blue-400" },
            { label: "Respondidos", value: stats.respondidos, color: "text-amber-400" },
            { label: "Conversiones", value: stats.conversiones, color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="glass-card p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
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
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Nombre", "Cargo", "Empresa", "País", "Email", "LinkedIn", "Score",
                    ...(hasCopy ? ["Mensaje"] : []),
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
                    <tr key={lead.id} className={`border-b border-white/[0.03] ${i % 2 === 0 ? "bg-white/[0.01]" : ""} hover:bg-white/[0.03] transition-colors`}>
                      <td className="px-3 py-2.5 text-foreground font-medium whitespace-nowrap">{lead.first_name} {lead.last_name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate">{lead.title}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{lead.company}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] border ${COUNTRY_COLORS[lead.country || ""] || "text-muted-foreground"}`}>{lead.country}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{lead.email || "—"}</td>
                      {/* LinkedIn with copy */}
                      <td className="px-3 py-2.5">
                        {lead.linkedin_url ? (
                          <div className="flex items-center gap-1.5">
                            <a href={lead.linkedin_url.startsWith("http") ? lead.linkedin_url : `https://${lead.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-[10px] font-mono truncate underline max-w-[120px]">
                              Perfil
                            </a>
                            <button
                              onClick={() => copyLinkedin(lead.linkedin_url!, lead.id)}
                              className="p-0.5 rounded hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                              title="Copiar URL de LinkedIn"
                            >
                              {copiedLinkedin === lead.id
                                ? <Check className="w-3 h-3 text-green-400" />
                                : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : <span className="text-muted-foreground text-[10px]">—</span>}
                      </td>
                      {/* Score */}
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-3 py-1.5 rounded text-xs font-medium border whitespace-nowrap ${qs.bg} ${qs.text} ${qs.border}`}>{qs.label}</span>
                      </td>
                      {/* Mensaje (copy sugerido per lead) */}
                      {hasCopy && (
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => copyMessageForLead(lead)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground transition-colors whitespace-nowrap"
                            title="Copiar mensaje personalizado"
                          >
                            {copiedId === lead.id
                              ? <><Check className="w-3 h-3 text-green-400" /> Copiado</>
                              : <><Copy className="w-3 h-3" /> Copiar</>}
                          </button>
                        </td>
                      )}
                      {/* Enviado */}
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => toggleField(lead.id, "enviado")} className="transition-colors">
                          {lead.enviado
                            ? <CheckCircle2 className="w-5 h-5 text-blue-400" />
                            : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-blue-400/60" />}
                        </button>
                      </td>
                      {/* Respondido */}
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => toggleField(lead.id, "respondido")} className="transition-colors">
                          {lead.respondido
                            ? <CheckCircle2 className="w-5 h-5 text-amber-400" />
                            : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-amber-400/60" />}
                        </button>
                      </td>
                      {/* Conversión */}
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
        </div>
      </div>
    </div>
  );
}
