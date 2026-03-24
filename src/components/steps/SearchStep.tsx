import { useState } from "react";
import { CampaignConfig, Lead, ScoredLead } from "@/hooks/useWizard";
import { searchApollo } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  config: CampaignConfig;
  leads: Lead[];
  setLeads: (l: Lead[]) => void;
  setScoredLeads: (l: ScoredLead[]) => void;
  onComplete: () => void;
}

const COUNTRY_COLORS: Record<string, string> = {
  Argentina: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  Colombia: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
  Chile: "bg-red-500/15 text-red-300 border-red-500/20",
  México: "bg-green-500/15 text-green-300 border-green-500/20",
  Brasil: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  USA: "bg-purple-500/15 text-purple-300 border-purple-500/20",
};

const QUARTILE_STYLES = {
  Q1: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", label: "Top Fit" },
  Q2: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20", label: "Buen Fit" },
  Q3: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Fit Moderado" },
  Q4: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", label: "Fit Bajo" },
};

function scoreAndAssign(leads: Lead[]): ScoredLead[] {
  const industryMap: Record<string, number> = {
    saas: 3, tech: 3, ecommerce: 3, fintech: 3,
    it: 2, pharma: 2, logistics: 2, insurance: 2,
    retail: 1, government: 1, health: 1, automotive: 1,
  };

  const scored = leads.map((lead) => {
    const industryScore = industryMap[lead.industry.toLowerCase()] ?? 1;
    const growthScore = lead.headcount > 500 ? 2 : lead.headcount > 100 ? 1 : 0;
    const seniorityScore = lead.seniority === "senior" ? 2 : lead.seniority === "mid" ? 1 : 0;
    const painScore = Math.floor(Math.random() * 4);
    const total = industryScore + growthScore + seniorityScore + painScore;
    return { ...lead, scores: { industryScore, growthScore, seniorityScore, painScore }, total, quartile: "Q1" as const };
  });

  const sorted = [...scored].sort((a, b) => b.total - a.total);
  const n = sorted.length;
  return sorted.map((lead, i) => ({
    ...lead,
    quartile: (i < n * 0.25 ? "Q1" : i < n * 0.5 ? "Q2" : i < n * 0.75 ? "Q3" : "Q4") as "Q1" | "Q2" | "Q3" | "Q4",
  }));
}

export function SearchStep({ config, leads, setLeads, setScoredLeads, onComplete }: Props) {
  const [searching, setSearching] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [displayLeads, setDisplayLeads] = useState<ScoredLead[]>([]);

  const startSearch = async () => {
    setSearching(true);
    setLogs([]);
    setProgress(0);

    const countries = Object.entries(config.geoMix).filter(([, v]) => v > 0);
    setLogs(countries.map(([c, p]) => {
      const qty = Math.round(((p as number) / 100) * config.quantity);
      return `Buscando en ${c}... (${qty} leads)`;
    }));
    setProgress(20);

    try {
      setLogs((prev) => [...prev, "🔄 Enriqueciendo contactos con Apollo (email + LinkedIn)..."]);
      setProgress(40);
      const apolloLeads = await searchApollo(config);
      setProgress(80);
      setLeads(apolloLeads);

      // Auto-score
      const scored = scoreAndAssign(apolloLeads);
      setScoredLeads(scored);
      setDisplayLeads(scored);
      setProgress(100);

      const withEmail = scored.filter(l => l.email).length;
      const withLinkedin = scored.filter(l => l.linkedinUrl).length;
      setLogs((prev) => [
        ...prev,
        `✓ ${apolloLeads.length} leads encontrados y enriquecidos`,
        `   📧 ${withEmail} con email · 🔗 ${withLinkedin} con LinkedIn`,
      ]);
      toast.success(`${apolloLeads.length} leads encontrados y clasificados`);
    } catch (e: any) {
      console.error("Apollo search error:", e);
      toast.error(e.message || "Error buscando en Apollo");
      setLogs((prev) => [...prev, `✗ Error: ${e.message}`]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Búsqueda en Apollo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Buscando <span className="text-foreground font-medium">{config.profile}</span> según tu mix geográfico.
        </p>
      </div>

      {displayLeads.length === 0 && !searching && (
        <button
          onClick={startSearch}
          className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          🔍 Iniciar búsqueda
        </button>
      )}

      {/* Progress */}
      {(searching || logs.length > 0) && (
        <div className="glass-card p-5 space-y-3">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="space-y-1 font-mono text-xs">
            {logs.map((log, i) => (
              <p key={i} className={i === logs.length - 1 && !searching ? "text-success" : "text-muted-foreground"}>
                {log}
              </p>
            ))}
            {searching && (
              <p className="text-muted-foreground flex items-center gap-2">
                <span className="flex gap-1">
                  <span className="w-1 h-1 rounded-full bg-primary pulse-dot" />
                  <span className="w-1 h-1 rounded-full bg-primary pulse-dot" />
                  <span className="w-1 h-1 rounded-full bg-primary pulse-dot" />
                </span>
                Procesando...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quartile summary */}
      {displayLeads.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => {
            const s = QUARTILE_STYLES[q];
            const count = displayLeads.filter(l => l.quartile === q).length;
            return (
              <div key={q} className={`glass-card p-4 ${s.border} border`}>
                <div className={`text-2xl font-bold font-mono ${s.text}`}>{count}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{q} — {s.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Results table */}
      {displayLeads.length > 0 && (
        <>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Nombre", "Cargo", "Empresa", "País", "Nivel", "Email", "LinkedIn"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayLeads.slice(0, 30).map((lead, i) => {
                    const qs = QUARTILE_STYLES[lead.quartile];
                    return (
                      <tr key={lead.id} className={`border-b border-white/[0.03] ${i % 2 === 0 ? "bg-white/[0.01]" : ""} hover:bg-white/[0.03] transition-colors`}>
                        <td className="px-4 py-2.5 text-foreground font-medium">{lead.firstName} {lead.lastName}</td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[180px] truncate">{lead.title}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{lead.company}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${COUNTRY_COLORS[lead.country] || "text-muted-foreground"}`}>
                            {lead.country}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${qs.bg} ${qs.text} ${qs.border}`}>
                            {qs.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-[10px]">
                          {lead.email || <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {lead.linkedinUrl ? (
                            <div className="flex items-center gap-1.5 max-w-[200px]">
                              <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-[10px] truncate">
                                {lead.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '')}
                              </a>
                              <button
                                onClick={() => { navigator.clipboard.writeText(lead.linkedinUrl); toast.success("LinkedIn copiado"); }}
                                className="shrink-0 p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                                title="Copiar URL"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {displayLeads.length > 30 && (
              <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-white/[0.06]">
                Mostrando 30 de {displayLeads.length} leads
              </div>
            )}
          </div>

          <button
            onClick={onComplete}
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Continuar a mensajes →
          </button>
        </>
      )}
    </div>
  );
}
