import { useState } from "react";
import { ScoredLead, GeneratedMessages } from "@/hooks/useWizard";
import { Copy, RefreshCw } from "lucide-react";

interface Props {
  scoredLeads: ScoredLead[];
  setScoredLeads: (l: ScoredLead[]) => void;
  onComplete: () => void;
}

function generateMockMessages(lead: ScoredLead, canal: "linkedin" | "email"): GeneratedMessages {
  return {
    linkedin: `${lead.firstName}, vi que en ${lead.company} manejan datos de ${lead.industry}. En Teramot ayudamos a limpiar y modelar datos empresariales con IA — ¿te interesa ver cómo funciona en 15 min?`,
    email_asunto: `${lead.company}: modelado de datos sin fricción`,
    email_cuerpo: `Hola ${lead.firstName},\n\nSoy del equipo de Teramot. Trabajamos con empresas de ${lead.industry} que necesitan datos limpios y bien modelados para tomar mejores decisiones.\n\nNuestra plataforma usa IA para sanitizar y estructurar datos empresariales en minutos, no semanas.\n\n¿Tenés 15 minutos esta semana para una demo rápida?`,
    followup_d4: `${lead.firstName}, te escribí hace unos días sobre cómo Teramot puede ayudar a ${lead.company} con el modelado de datos. ¿Te interesa agendar una llamada corta?`,
    cierre_d9: `Último mensaje, ${lead.firstName}. Si el timing no es el correcto, sin problema. Dejo el link por si querés explorar: teramot.com`,
  };
}

export function MessagesStep({ scoredLeads, setScoredLeads, onComplete }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(scoredLeads[0]?.id || null);
  const [canal, setCanal] = useState<"linkedin" | "email">("linkedin");
  const [generating, setGenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const selectedLead = scoredLeads.find((l) => l.id === selectedId);

  const generateForLead = (leadId: string) => {
    setGenerating(leadId);
    setTimeout(() => {
      const lead = scoredLeads.find((l) => l.id === leadId)!;
      const messages = generateMockMessages(lead, canal);
      setScoredLeads(scoredLeads.map((l) => (l.id === leadId ? { ...l, messages } : l)));
      setGenerating(null);
    }, 1500);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const sortedLeads = [...scoredLeads].sort((a, b) => {
    const order = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };
    return order[a.quartile] - order[b.quartile];
  });

  const QUARTILE_COLORS = { Q1: "text-cyan-400", Q2: "text-green-400", Q3: "text-amber-400", Q4: "text-rose-400" };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Generación de mensajes con IA</h2>
        <p className="text-sm text-muted-foreground mt-1">Seleccioná un lead para generar mensajes personalizados.</p>
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
                <span className={`text-[10px] font-mono ${QUARTILE_COLORS[lead.quartile]}`}>{lead.quartile}</span>
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
                <div className="flex items-center gap-2">
                  {/* Canal toggle */}
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
                      Generando mensajes...
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
                          <button
                            onClick={() => copyText(msg.value, msg.key)}
                            className="p-1 rounded hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                          >
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
                    onClick={() => generateForLead(selectedLead.id)}
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
