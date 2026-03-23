import { useState, useEffect } from "react";
import { Lead, ScoredLead } from "@/hooks/useWizard";

interface Props {
  leads: Lead[];
  scoredLeads: ScoredLead[];
  setScoredLeads: (l: ScoredLead[]) => void;
  onComplete: () => void;
}

const QUARTILE_STYLES = {
  Q1: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", label: "Top 25%" },
  Q2: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20", label: "Buen fit" },
  Q3: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Fit moderado" },
  Q4: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", label: "Bajo fit" },
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
    const painScore = Math.floor(Math.random() * 4); // simulated
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

export function ScoringStep({ leads, scoredLeads, setScoredLeads, onComplete }: Props) {
  useEffect(() => {
    if (scoredLeads.length === 0 && leads.length > 0) {
      setScoredLeads(scoreAndAssign(leads));
    }
  }, [leads, scoredLeads.length, setScoredLeads]);

  const quartileCounts = scoredLeads.reduce((acc, l) => {
    acc[l.quartile] = (acc[l.quartile] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Scoring por cuartiles</h2>
        <p className="text-sm text-muted-foreground mt-1">{scoredLeads.length} leads evaluados y clasificados.</p>
      </div>

      {/* Quartile cards */}
      <div className="grid grid-cols-4 gap-3">
        {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => {
          const s = QUARTILE_STYLES[q];
          return (
            <div key={q} className={`glass-card p-4 ${s.border} border`}>
              <div className={`text-2xl font-bold font-mono ${s.text}`}>{quartileCounts[q] || 0}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{q} — {s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Nombre", "Empresa", "Industria", "Score", "Cuartil", "Desglose"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scoredLeads.slice(0, 25).map((lead, i) => {
                const qs = QUARTILE_STYLES[lead.quartile];
                return (
                  <tr key={lead.id} className={`border-b border-white/[0.03] ${i % 2 === 0 ? "bg-white/[0.01]" : ""} hover:bg-white/[0.03]`}>
                    <td className="px-4 py-2.5 text-foreground font-medium">{lead.firstName} {lead.lastName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.company}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">{lead.industry}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-foreground font-semibold">{lead.total}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${qs.bg} ${qs.text} ${qs.border}`}>{lead.quartile}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {[
                          { val: lead.scores.industryScore, max: 3, label: "Ind" },
                          { val: lead.scores.growthScore, max: 2, label: "Grow" },
                          { val: lead.scores.seniorityScore, max: 2, label: "Sen" },
                          { val: lead.scores.painScore, max: 3, label: "Pain" },
                        ].map((s) => (
                          <div key={s.label} className="flex flex-col items-center gap-0.5" title={`${s.label}: ${s.val}/${s.max}`}>
                            <div className="w-8 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${(s.val / s.max) * 100}%` }} />
                            </div>
                            <span className="text-[8px] text-muted-foreground">{s.label}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={onComplete}
        className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
      >
        Confirmar distribución →
      </button>
    </div>
  );
}
