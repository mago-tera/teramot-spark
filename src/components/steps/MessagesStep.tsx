import { useState } from "react";
import { ScoredLead, GeneratedMessages } from "@/hooks/useWizard";
import { Copy, RefreshCw, UserRound, ArrowLeft, MessageSquare } from "lucide-react";
import { generateGroupMessages, generateAIMessages } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  scoredLeads: ScoredLead[];
  setScoredLeads: (l: ScoredLead[]) => void;
  onComplete: () => void;
}

type Mode = "objective" | "group" | "personalized";

export function MessagesStep({ scoredLeads, setScoredLeads, onComplete }: Props) {
  const [mode, setMode] = useState<Mode>("objective");
  const [objective, setObjective] = useState("");
  const [whatToCommunicate, setWhatToCommunicate] = useState("");

  // Group mode state
  const [canal, setCanal] = useState<"linkedin" | "email">("linkedin");
  const [generatingGroup, setGeneratingGroup] = useState(false);
  const [groupMessages, setGroupMessages] = useState<GeneratedMessages | null>(null);

  // Personalized mode state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const selectedLead = scoredLeads.find((l) => l.id === selectedId);
  const sortedLeads = [...scoredLeads].sort((a, b) => {
    const order = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };
    return order[a.quartile] - order[b.quartile];
  });

  const canProceed = objective.trim().length > 0 && whatToCommunicate.trim().length > 0;

  const generateForGroup = async () => {
    setGeneratingGroup(true);
    try {
      const representative = sortedLeads[0];
      const messages = await generateGroupMessages(representative, "Q2", canal, objective, whatToCommunicate);
      setGroupMessages(messages);
    } catch (e: any) {
      console.error("Error generating group messages:", e);
      toast.error(e.message || "Error generando mensajes");
    } finally {
      setGeneratingGroup(false);
    }
  };

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

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(null), 1500);
  };

  // ─── STEP 1: Objective ───
  if (mode === "objective") {
    return (
      <div className="space-y-8 max-w-2xl mx-auto pt-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Generar Comunicación</h2>
          <p className="text-sm text-muted-foreground">
            Elegí el tipo de comunicación y definí tu mensaje.
          </p>
        </div>

        {/* Mode selection first */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setSelectedMode("group")}
            className={`glass-card p-6 text-left space-y-3 transition-all group border ${
              selectedMode === "group" ? "border-primary/40 bg-primary/5" : "border-white/[0.06] hover:border-primary/20"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Comunicación grupal</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Un mensaje único para todas las listas. 
                Ideal para campañas masivas con un mensaje unificado.
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground/70 pt-1">
              {scoredLeads.length} leads
            </p>
          </button>

          <button
            onClick={() => setSelectedMode("personalized")}
            className={`glass-card p-6 text-left space-y-3 transition-all group border ${
              selectedMode === "personalized" ? "border-primary/40 bg-primary/5" : "border-white/[0.06] hover:border-primary/20"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserRound className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Personalizado por lead</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Mensajes únicos para cada prospecto, 
                adaptados a su cargo, empresa e industria.
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground/70 pt-1">
              {scoredLeads.length} leads disponibles
            </p>
          </button>
        </div>

        {/* Objective and message fields */}
        {selectedMode && (
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

            {canProceed && (
              <button
                onClick={() => {
                  if (selectedMode === "group") setMode("group");
                  else {
                    setMode("personalized");
                    setSelectedId(sortedLeads[0]?.id || null);
                  }
                }}
                className="w-full px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                Continuar →
              </button>
            )}
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

  // ─── GROUP MODE: single message for all ───
  if (mode === "group") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("objective")} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Comunicación grupal</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Un mensaje para toda la lista · {scoredLeads.length} leads
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

        <div className="glass-card overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">Mensaje para toda la lista</span>
              <span className="text-xs text-muted-foreground">{scoredLeads.length} leads</span>
            </div>
            {!groupMessages ? (
              <button
                onClick={generateForGroup}
                disabled={generatingGroup}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {generatingGroup ? (
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
            ) : (
              <button
                onClick={() => { setGroupMessages(null); generateForGroup(); }}
                disabled={generatingGroup}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Regenerar
              </button>
            )}
          </div>

          {groupMessages && (
            <div className="p-4 space-y-3">
              {[
                { key: "linkedin", label: "LinkedIn (máx 300 chars)", value: groupMessages.linkedin, maxChars: 300 },
                { key: "email_asunto", label: "Asunto email", value: groupMessages.email_asunto },
                { key: "email_cuerpo", label: "Cuerpo email", value: groupMessages.email_cuerpo },
                { key: "followup_d4", label: "Follow-up día 4", value: groupMessages.followup_d4 },
                { key: "cierre_d9", label: "Cierre día 9", value: groupMessages.cierre_d9 },
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
                      <button onClick={() => copyText(msg.value, `group-${msg.key}`)} className="p-1 rounded hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors">
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
        <button onClick={() => setMode("objective")} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors">
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
