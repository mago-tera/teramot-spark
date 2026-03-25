import { useState, useCallback } from "react";
import { ScoredLead } from "@/hooks/useWizard";
import { Copy, RefreshCw, MessageSquare, Save, Pencil, Sparkles, ArrowLeft } from "lucide-react";
import { generateGroupMessages, updateBulkLeadMessages } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  scoredLeads: ScoredLead[];
  setScoredLeads: (l: ScoredLead[]) => void;
  onComplete: () => void;
}

interface SimpleMessages {
  linkedin: string;
  email_asunto: string;
  email_cuerpo: string;
}

const MESSAGE_FIELDS: { key: keyof SimpleMessages; label: string; maxChars?: number }[] = [
  { key: "linkedin", label: "LinkedIn (máx 300 chars)", maxChars: 300 },
  { key: "email_asunto", label: "Asunto email" },
  { key: "email_cuerpo", label: "Cuerpo email" },
];

function MessageEditor({
  messages,
  onSave,
  onAIEdit,
  aiEditing,
}: {
  messages: SimpleMessages;
  onSave: (updated: SimpleMessages) => void;
  onAIEdit: (key: keyof SimpleMessages, instruction: string) => void;
  aiEditing: string | null;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [showAiInput, setShowAiInput] = useState<string | null>(null);

  const startEdit = (key: string, value: string) => {
    setEditing(key);
    setDraft(value);
    setShowAiInput(null);
  };

  const saveEdit = async (key: string) => {
    setSaving(true);
    const updated = { ...messages, [key]: draft };
    await onSave(updated);
    setEditing(null);
    setSaving(false);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-4">
      {MESSAGE_FIELDS.map((field) => {
        const value = messages[field.key];
        const isEditing = editing === field.key;
        const isAiEditing = aiEditing === field.key;

        return (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{field.label}</span>
              <div className="flex items-center gap-1">
                {field.maxChars && (
                  <span className={`text-[10px] font-mono ${(isEditing ? draft : value).length > field.maxChars ? "text-destructive" : "text-muted-foreground"}`}>
                    {(isEditing ? draft : value).length}/{field.maxChars}
                  </span>
                )}
                {!isEditing && (
                  <>
                    <button
                      onClick={() => {
                        setShowAiInput(showAiInput === field.key ? null : field.key);
                        setAiInstruction("");
                      }}
                      className="p-1 rounded hover:bg-white/[0.06] text-muted-foreground hover:text-primary transition-colors"
                      title="Editar con IA"
                    >
                      <Sparkles className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => startEdit(field.key, value)}
                      className="p-1 rounded hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                      title="Editar manual"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => copyText(value, field.key)}
                      className="p-1 rounded hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* AI edit input */}
            {showAiInput === field.key && !isEditing && (
              <div className="flex gap-2">
                <input
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="Ej: Hacelo más corto, cambiá el tono a informal..."
                  className="glass-input flex-1 text-xs py-1.5"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && aiInstruction.trim()) {
                      onAIEdit(field.key, aiInstruction);
                      setShowAiInput(null);
                      setAiInstruction("");
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (aiInstruction.trim()) {
                      onAIEdit(field.key, aiInstruction);
                      setShowAiInput(null);
                      setAiInstruction("");
                    }
                  }}
                  disabled={!aiInstruction.trim() || !!isAiEditing}
                  className="px-3 py-1.5 rounded-lg text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isAiEditing ? "..." : "Aplicar"}
                </button>
              </div>
            )}

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="glass-input w-full min-h-[80px] text-xs resize-y"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(field.key)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="px-3 py-1 rounded-lg text-[11px] border border-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className={`p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-foreground whitespace-pre-wrap leading-relaxed ${isAiEditing ? "opacity-50 animate-pulse" : ""}`}>
                {value}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MessagesStep({ scoredLeads, setScoredLeads, onComplete }: Props) {
  const leadsWithMessages = scoredLeads.filter((l) => l.messages);
  const hasExistingMessages = leadsWithMessages.length > 0;

  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiEditing, setAiEditing] = useState<string | null>(null);
  const [messages, setMessages] = useState<SimpleMessages | null>(
    hasExistingMessages && leadsWithMessages[0].messages
      ? {
          linkedin: (leadsWithMessages[0].messages as any).linkedin || "",
          email_asunto: (leadsWithMessages[0].messages as any).email_asunto || "",
          email_cuerpo: (leadsWithMessages[0].messages as any).email_cuerpo || "",
        }
      : null
  );

  const persistBulkMessages = useCallback(async (leadIds: string[], msgs: SimpleMessages) => {
    try {
      await updateBulkLeadMessages(leadIds, msgs as unknown as Record<string, string>);
    } catch (e) {
      console.error("Error persisting bulk messages:", e);
    }
  }, []);

  const generateMessages = async () => {
    if (!prompt.trim()) {
      toast.error("Escribí un prompt para generar la comunicación");
      return;
    }
    setGenerating(true);
    try {
      const representative = scoredLeads[0];
      const result = await generateGroupMessages(representative, "Q2", "email", prompt, prompt);
      const simpleMessages: SimpleMessages = {
        linkedin: result.linkedin || "",
        email_asunto: result.email_asunto || "",
        email_cuerpo: result.email_cuerpo || "",
      };
      setMessages(simpleMessages);
      const allIds = scoredLeads.map((l) => l.id);
      setScoredLeads(scoredLeads.map((l) => ({ ...l, messages: { ...simpleMessages, followup_d4: "", cierre_d9: "" } })));
      await persistBulkMessages(allIds, simpleMessages);
      toast.success("Comunicación generada y guardada");
    } catch (e: any) {
      console.error("Error generating messages:", e);
      toast.error(e.message || "Error generando mensajes");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveMessages = async (updated: SimpleMessages) => {
    setMessages(updated);
    const allIds = scoredLeads.map((l) => l.id);
    setScoredLeads(scoredLeads.map((l) => ({ ...l, messages: { ...updated, followup_d4: "", cierre_d9: "" } })));
    await persistBulkMessages(allIds, updated);
    toast.success("Mensaje actualizado");
  };

  const handleAIEdit = async (key: keyof SimpleMessages, instruction: string) => {
    if (!messages) return;
    setAiEditing(key);
    try {
      const { data, error } = await supabase.functions.invoke("edit-message", {
        body: { currentText: messages[key], instruction, field: key },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const updated = { ...messages, [key]: data.text };
      await handleSaveMessages(updated);
      toast.success("Texto actualizado con IA");
    } catch (e: any) {
      console.error("AI edit error:", e);
      toast.error(e.message || "Error editando con IA");
    } finally {
      setAiEditing(null);
    }
  };

  // ─── No messages yet: show prompt ───
  if (!messages) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto pt-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Generar Comunicación</h2>
          <p className="text-sm text-muted-foreground">
            Escribí qué querés comunicar y generamos un mensaje de LinkedIn y un email para toda la lista.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              ¿Qué querés comunicar?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: Quiero agendar demos de 15 min mostrando cómo Teramot reduce el tiempo de construcción de infraestructura de datos de semanas a horas..."
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
                Generando comunicación...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                Generar comunicación
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-muted-foreground/60">
            {scoredLeads.length} leads en la lista · Se genera un mensaje único para todos
          </p>
        </div>
      </div>
    );
  }

  // ─── Messages exist: show editor ───
  return (
    <div className="space-y-6 max-w-2xl mx-auto pt-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMessages(null)}
          className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Comunicación</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mensaje para toda la lista · {scoredLeads.length} leads
          </p>
        </div>
        <button
          onClick={() => {
            setMessages(null);
          }}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Nuevo mensaje
        </button>
      </div>

      <div className="glass-card p-5">
        <MessageEditor
          messages={messages}
          onSave={handleSaveMessages}
          onAIEdit={handleAIEdit}
          aiEditing={aiEditing}
        />
      </div>
    </div>
  );
}
