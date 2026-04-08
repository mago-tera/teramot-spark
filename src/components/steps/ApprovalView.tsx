import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface ApprovalLead {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  industry: string;
  country: string;
  email: string;
  linkedinUrl: string;
  phone: string | null;
  score: number;
  quartile: string;
  calificacion: string | null;
  responsable: string | null;
  canal: string | null;
}

const RESPONSABLES = [
  { label: "Bruno", email: "burno@teramot.com" },
  { label: "Juan", email: "juan@teramot.com" },
  { label: "Lucio", email: "lucio@teramot.com" },
  { label: "Gabo", email: "gabriel@teramot.com" },
  { label: "Valen", email: "valentina@teramot.com" },
];

const CALIFICACIONES = ["Top Fit", "Fit", "Not"];
const CANALES = ["LinkedIn", "Mail"];

const QUARTILE_LABELS: Record<string, { label: string; cls: string }> = {
  Q1: { label: "Top Fit", cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  Q2: { label: "Buen Fit", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  Q3: { label: "Fit Moderado", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  Q4: { label: "Fit Bajo", cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
};

interface Props {
  listId: string;
  listName: string;
  onBack: () => void;
}

export function ApprovalView({ listId, listName, onBack }: Props) {
  const [leads, setLeads] = useState<ApprovalLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase
      .from("leads")
      .select("*")
      .eq("list_id", listId)
      .order("score", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setLeads(
            data.map((d: any) => ({
              id: d.id,
              firstName: d.first_name || "",
              lastName: d.last_name || "",
              title: d.title || "",
              company: d.company || "",
              industry: d.industry || "",
              country: d.country || "",
              email: d.email || "",
              linkedinUrl: d.linkedin_url || "",
              phone: d.phone || null,
              score: d.score || 0,
              quartile: d.quartile || "Q4",
              calificacion: d.calificacion,
              responsable: d.responsable,
              canal: d.canal,
            }))
          );
        }
        setLoading(false);
      });
  }, [listId]);

  const updateField = async (leadId: string, field: string, value: string | null) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, [field]: value } : l))
    );
    setSaving((prev) => ({ ...prev, [leadId]: true }));
    const { error } = await supabase
      .from("leads")
      .update({ [field]: value })
      .eq("id", leadId);
    setSaving((prev) => ({ ...prev, [leadId]: false }));
    if (error) {
      toast.error("Error al guardar");
    }
  };

  if (loading) {
    return <div className="glass-card p-5 animate-pulse h-24" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Aprobaciones</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {listName} · {leads.length} leads
          </p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Nombre", "Apellido", "Cargo", "Empresa", "País", "Email", "Teléfono", "Calificación", "Responsable", "Canal"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => {
                const q = QUARTILE_LABELS[lead.quartile] || QUARTILE_LABELS.Q4;
                return (
                  <tr
                    key={lead.id}
                    className={`border-b border-white/[0.03] ${
                      i % 2 === 0 ? "bg-white/[0.01]" : ""
                    } hover:bg-white/[0.03] transition-colors`}
                  >
                    <td className="px-3 py-2.5 text-foreground font-medium whitespace-nowrap">
                      {lead.firstName}
                    </td>
                    <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                      {lead.lastName}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate">
                      {lead.title}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{lead.company}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-muted-foreground">{lead.country}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">
                      {lead.email || "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {lead.phone ? (
                        <a
                          href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-400 hover:text-green-300 font-mono text-[10px] underline"
                        >
                          {lead.phone}
                        </a>
                      ) : <span className="text-muted-foreground text-[10px]">—</span>}
                    </td>
                    {/* Calificación */}
                    <td className="px-3 py-2.5">
                      <select
                        value={lead.calificacion || ""}
                        onChange={(e) =>
                          updateField(lead.id, "calificacion", e.target.value || null)
                        }
                        className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">—</option>
                        {CALIFICACIONES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    {/* Responsable */}
                    <td className="px-3 py-2.5">
                      <select
                        value={lead.responsable || ""}
                        onChange={(e) =>
                          updateField(lead.id, "responsable", e.target.value || null)
                        }
                        className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">—</option>
                        {RESPONSABLES.map((r) => (
                          <option key={r.email} value={r.label}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    {/* Canal */}
                    <td className="px-3 py-2.5">
                      <select
                        value={lead.canal || ""}
                        onChange={(e) =>
                          updateField(lead.id, "canal", e.target.value || null)
                        }
                        className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">—</option>
                        {CANALES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
