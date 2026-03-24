import { useState } from "react";
import { ScoredLead, GeneratedMessages } from "@/hooks/useWizard";
import { Copy, RefreshCw, Users, UserRound, ArrowLeft, Send, MessageSquare } from "lucide-react";
import { generateAIMessages, generateGroupMessages } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  scoredLeads: ScoredLead[];
  setScoredLeads: (l: ScoredLead[]) => void;
  onComplete: () => void;
}

type Mode = null | "objective" | "generic" | "personalized";

const QUARTILE_COLORS = { Q1: "text-cyan-400", Q2: "text-green-400", Q3: "text-amber-400", Q4: "text-rose-400" };
const QUARTILE_BG = { Q1: "bg-cyan-500/10 border-cyan-500/20", Q2: "bg-green-500/10 border-green-500/20", Q3: "bg-amber-500/10 border-amber-500/20", Q4: "bg-rose-500/10 border-rose-500/20" };
const QUARTILE_LABELS = { Q1: "Top Fit", Q2: "Buen Fit", Q3: "Fit Moderado", Q4: "Fit Bajo" };

export function MessagesStep({ scoredLeads, setScoredLeads, onComplete }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [objective, setObjective] = useState("");
  const [whatToCommunicate, setWhatToCommunicate] = useState("");

  // Personalized mode state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canal, setCanal] = useState<"linkedin" | "email">("linkedin");
  const [generating, setGenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Generic mode state
  const [generatingGroup, setGeneratingGroup] = useState<string | null>(null);
  const [groupMessages, setGroupMessages] = useState<Record<string, GeneratedMessages>>({});

  const selectedLead = scoredLeads.find((l) => l.id === selectedId);

  const sortedLeads = [...scoredLeads].sort((a, b) => {
    const order = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };
    return order[a.quartile] - order[b.quartile];
  });

  const quartileGroups = (["Q1", "Q2", "Q3", "Q4"] as const).map((q) => ({
    quartile: q,
    leads: sortedLeads.filter((l) => l.quartile === q),
  })).filter((g) => g.leads.length > 0);

  const generateForLead = async (leadId: string) => {
    setGenerating(leadId);
    try {
      const lead = scoredLeads.find((l) => l.id === leadId)!;
      const messages = await generateAIMessages(lead, canal, objective, whatToCommunicate);
      setScoredLeads(scoredLeads.map((l) => (l.id === leadId ? { ...l, messages } : l)));
    } catch (e: any) {
      console.error("Error generating messages:", e);
      toast.error(e.message || "Error generando mensajes");
    } finally {
      setGenerating(null);
    }
  };

  const generateForGroup = async (quartile: string) => {
    setGeneratingGroup(quartile);
    try {
      const groupLeads = sortedLeads.filter((l) => l.quartile === quartile);
      const representative = groupLeads[0];
      const messages = await generateGroupMessages(representative, quartile, canal, objective, whatToCommunicate);
      setGroupMessages((prev) => ({ ...prev, [quartile]: messages }));
    } catch (e: any) {
      console.error("Error generating group messages:", e);
      toast.error(e.message || "Error generando mensajes");
    } finally {
      setGeneratingGroup(null);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(null), 1500);
  };

  const canProceed = objective.trim().length > 0 && whatToCommunicate.trim().length > 0;

  // ─── INITIAL: Choose mode ───
  if (mode === null) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto pt-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Generar Comunicación</h2>
          <p className="text-sm text-muted-foreground">
            Antes de generar los mensajes, necesitamos entender qué querés comunicar.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              ¿Cuál es tu objetivo con este outreach?
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ej: Agendar una demo de 15 minutos con decision makers de equipos de datos..."
              className="glass-input w-full min-h-[80px] text-sm resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              ¿Qué querés comunicar?
            </label>
            <textarea
              value={whatToCommunicate}
              onChange={(e) => setWhatToCommunicate(e.target.value)}
              placeholder="Ej: Mostrar cómo Teramot reduce el tiempo de construcción de infraestructura de datos de semanas a horas..."
              className="glass-input w-full min-h-[80px] text-sm resize-none"
            />
          </div>
        </div>

        {canProceed && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => setMode("generic")}
              className="glass-card glass-card-hover p-6 text-left space-y-3 transition-all group border border-white/[0.06] hover:border-primary/30"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Por grupo de fit</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Genera un mensaje genérico por cada nivel de fit (Top, Buen, Moderado, Bajo). 
                  Ideal para campañas masivas donde el tono varía según el nivel de afinidad.
                </p>
              </div>
              <div className="flex gap-1.5 pt-1">
                {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => {
                  const count = scoredLeads.filter((l) => l.quartile === q).length;
                  if (count === 0) return null;
                  return (
                    <span key={q} className={`px-2 py-0.5 rounded text-[10px] border ${QUARTILE_BG[q]} ${QUARTILE_COLORS[q]}`}>
                      {QUARTILE_LABELS[q]} ({count})
                    </span>
                  );
                })}
              </div>
            </button>

            <button
              onClick={() => {
                setMode("personalized");
                setSelectedId(sortedLeads[0]?.id || null);
              }}
              className="glass-card glass-card-hover p-6 text-left space-y-3 transition-all group border border-white/[0.06] hover:border-primary/30"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <UserRound className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Personalizado por lead</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Genera mensajes únicos para cada prospecto individual, 
                  adaptados a su cargo, empresa e industria. Ideal para outreach de alto valor.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground/70 pt-1">
                {scoredLeads.length} leads disponibles
              </p>
            </button>
          </div>
        )}

        {!canProceed && (
          <div className="text-center pt-4">
            <p className="text-xs text-muted-foreground/60">
              Completá ambos campos para continuar con la generación
            </p>
          </div>
        )}
      </div>
    );
  }

  // ─── GENERIC MODE: by quartile group ───
  if (mode === "generic") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode(null)} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Comunicación por grupo de fit</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Un mensaje por nivel de afinidad · Objetivo: {objective.slice(0, 60)}{objective.length > 60 ? "..." : ""}
            </p>
          </div>
          <div className="ml-auto flex rounded-lg border border-white/10 overflow-hidden">
            {(["linkedin", "email"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCanal(c)}
                className={`px-3 py-1.5 text-[11px] capitalize transition-colors ${
                  canal === c ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {quartileGroups.map(({ quartile, leads: groupLeads }) => {
            const msgs = groupMessages[quartile];
            return (
              <div key={quartile} className={`glass-card border ${QUARTILE_BG[quartile]} overflow-hidden`}>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${QUARTILE_COLORS[quartile]}`}>
                      {QUARTILE_LABELS[quartile]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {groupLeads.length} leads
                    </span>
                  </div>
                  {!msgs && (
                    <button
                      onClick={() => generateForGroup(quartile)}
                      disabled={generatingGroup === quartile}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {generatingGroup === quartile ? (
                        <>
                          <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground pulse-dot" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground pulse-dot" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground pulse-dot" />
                          </span>
                          Generando...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3 h-3" />
                          Generar mensajes
                        </>
                      )}
                    </button>
                  )}
                  {msgs && (
                    <button
                      onClick={() => {
                        setGroupMessages((prev) => { const n = { ...prev }; delete n[quartile]; return n; });
                        generateForGroup(quartile);
                      }}
                      disabled={generatingGroup === quartile}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Regenerar
                    </button>
                  )}
                </div>

                {msgs && (
                  <div className="border-t border-white/[0.06] p-4 space-y-3">
                    {[
                      { key: "linkedin", label: "LinkedIn (máx 300 chars)", value: msgs.linkedin, maxChars: 300 },
                      { key: "email_asunto", label: "Asunto email", value: msgs.email_asunto },
                      { key: "email_cuerpo", label: "Cuerpo email", value: msgs.email_cuerpo },
                      { key: "followup_d4", label: "Follow-up día 4", value: msgs.followup_d4 },
                      { key: "cierre_d9", label: "Cierre día 9", value: msgs.cierre_d9 },
                    ].map((msg) => (
                      <div key={msg.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{msg.label}</span>
                          <div className="flex items-center gap-1">
                            {msg.maxChars && (
                              <span className={`text-[10px] font-mono ${msg.value.length > msg.maxChars ? "text-destructive" : "text-muted-foreground"}`}>
                                {msg.value.length}/{msg.maxChars}
                              </span>
                            )}
                            <button onClick={() => copyText(msg.value, `${quartile}-${msg.key}`)} className="p-1 rounded hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                          {msg.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onComplete}
          className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          Continuar al tracking →
        </button>
      </div>
    );
  }

  // ─── PERSONALIZED MODE ───
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setMode(null)} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Comunicación personalizada</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Objetivo: {objective.slice(0, 80)}{objective.length > 80 ? "..." : ""}
          </p>
        </div>
      </div>

      <div className="flex gap-4 h-[600px]">
        {/* Lead list */}
        <div className="w-72 shrink-0 glass-card overflow-y-auto">
          <div className="p-3 border-b border-white/[0.06]">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Leads ({sortedLeads.length})</p>
          </div>
          {sortedLeads.slice(0, 30).map((lead) => (
            <button
              key={lead.id}
              onClick={() => setSelectedId(lead.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-white/[0.03] transition-colors ${
                selectedId === lead.id ? "bg-primary/10" : "hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono ${QUARTILE_COLORS[lead.quartile]}`}>{QUARTILE_LABELS[lead.quartile]}</span>
                <span className="text-xs text-foreground truncate">{lead.firstName} {lead.lastName}</span>
                {lead.messages && <span className="ml-auto text-[10px] text-success">✓</span>}
              </div>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{lead.title} @ {lead.company}</p>
            </button>
          ))}
        </div>

        {/* Message preview */}
        <div className="flex-1 glass-card overflow-y-auto">
          {selectedLead ? (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">{selectedLead.firstName} {selectedLead.lastName}</h3>
                  <p className="text-xs text-muted-foreground">{selectedLead.title} @ {selectedLead.company}</p>
                </div>
                <div className="flex rounded-lg border border-white/10 overflow-hidden">
                  {(["linkedin", "email"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCanal(c)}
                      className={`px-3 py-1.5 text-[11px] capitalize transition-colors ${
                        canal === c ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {!selectedLead.messages ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  {generating === selectedLead.id ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
                      </span>
                      Generando mensajes con IA...
                    </div>
                  ) : (
                    <button
                      onClick={() => generateForLead(selectedLead.id)}
                      className="px-5 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      ✨ Generar mensajes
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {[
                    { key: "linkedin", label: "LinkedIn (máx 300 chars)", value: selectedLead.messages.linkedin, maxChars: 300 },
                    { key: "email_asunto", label: "Asunto email", value: selectedLead.messages.email_asunto },
                    { key: "email_cuerpo", label: "Cuerpo email", value: selectedLead.messages.email_cuerpo },
                    { key: "followup_d4", label: "Follow-up día 4", value: selectedLead.messages.followup_d4 },
                    { key: "cierre_d9", label: "Cierre día 9", value: selectedLead.messages.cierre_d9 },
                  ].map((msg) => (
                    <div key={msg.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{msg.label}</span>
                        <div className="flex items-center gap-1">
                          {msg.maxChars && (
                            <span className={`text-[10px] font-mono ${msg.value.length > msg.maxChars ? "text-destructive" : "text-muted-foreground"}`}>
                              {msg.value.length}/{msg.maxChars}
                            </span>
                          )}
                          <button onClick={() => copyText(msg.value, msg.key)} className="p-1 rounded hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                        {msg.value}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      setScoredLeads(scoredLeads.map((l) => (l.id === selectedLead.id ? { ...l, messages: undefined } : l)));
                      generateForLead(selectedLead.id);
                    }}
                    disabled={generating === selectedLead.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Seleccioná un lead para ver sus mensajes
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onComplete}
        className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
      >
        Continuar al tracking →
      </button>
    </div>
  );
}
