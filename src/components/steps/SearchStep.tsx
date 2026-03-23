import { useState, useEffect } from "react";
import { CampaignConfig, Lead } from "@/hooks/useWizard";

interface Props {
  config: CampaignConfig;
  leads: Lead[];
  setLeads: (l: Lead[]) => void;
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

// Mock data generator
function generateMockLeads(config: CampaignConfig): Lead[] {
  const titles = config.profile === "Data Analyst"
    ? ["Data Analyst", "BI Analyst", "Analytics Analyst", "Business Intelligence Analyst"]
    : config.profile === "Data Leader / CDO / Head of BI"
    ? ["Head of Data", "CDO", "Director de Datos", "Head of Analytics", "Data Manager"]
    : ["Data Analyst", "Head of Data", "BI Analyst", "CDO", "Analytics Lead"];

  const companies = ["TechCorp", "DataFlow", "NovaPay", "CloudSync", "FinServ", "LogiTrack", "MedData", "RetailPro", "InsureTech", "AgriSmart"];
  const industries = ["saas", "fintech", "ecommerce", "tech", "logistics", "pharma", "retail", "insurance"];
  const seniorities = ["senior", "mid", "junior"];
  const firstNames = ["María", "Carlos", "Ana", "Juan", "Lucía", "Pedro", "Sofia", "Diego", "Valentina", "Mateo"];
  const lastNames = ["García", "Rodríguez", "López", "Martínez", "Hernández", "González", "Pérez", "Sánchez"];

  const leads: Lead[] = [];
  Object.entries(config.geoMix).forEach(([country, pct]) => {
    if (pct <= 0) return;
    const qty = Math.round((pct / 100) * config.quantity);
    for (let i = 0; i < qty; i++) {
      leads.push({
        id: crypto.randomUUID(),
        firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
        lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
        title: titles[Math.floor(Math.random() * titles.length)],
        company: companies[Math.floor(Math.random() * companies.length)],
        industry: industries[Math.floor(Math.random() * industries.length)],
        country,
        seniority: seniorities[Math.floor(Math.random() * seniorities.length)],
        email: `lead${leads.length + 1}@example.com`,
        linkedinUrl: `https://linkedin.com/in/lead${leads.length + 1}`,
        headcount: Math.floor(Math.random() * 2000) + 50,
      });
    }
  });
  return leads;
}

export function SearchStep({ config, leads, setLeads, onComplete }: Props) {
  const [searching, setSearching] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const startSearch = () => {
    setSearching(true);
    setLogs([]);
    setProgress(0);

    const countries = Object.entries(config.geoMix).filter(([, v]) => v > 0);
    let step = 0;

    const interval = setInterval(() => {
      if (step < countries.length) {
        const [country, pct] = countries[step];
        const qty = Math.round((pct / 100) * config.quantity);
        setLogs((prev) => [...prev, `Buscando en ${country}... ✓ ${qty} leads`]);
        setProgress(((step + 1) / countries.length) * 100);
        step++;
      } else {
        clearInterval(interval);
        const mockLeads = generateMockLeads(config);
        setLeads(mockLeads);
        setLogs((prev) => [...prev, `✓ Búsqueda completada — ${mockLeads.length} leads encontrados`]);
        setSearching(false);
      }
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Búsqueda en Apollo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Buscando <span className="text-foreground font-medium">{config.profile}</span> según tu mix geográfico.
        </p>
      </div>

      {leads.length === 0 && !searching && (
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

      {/* Results table */}
      {leads.length > 0 && (
        <>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Nombre", "Cargo", "Empresa", "Industria", "País", "Seniority", "Email"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 20).map((lead, i) => (
                    <tr key={lead.id} className={`border-b border-white/[0.03] ${i % 2 === 0 ? "bg-white/[0.01]" : ""} hover:bg-white/[0.03] transition-colors`}>
                      <td className="px-4 py-2.5 text-foreground font-medium">{lead.firstName} {lead.lastName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{lead.title}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{lead.company}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">{lead.industry}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] border ${COUNTRY_COLORS[lead.country] || "text-muted-foreground"}`}>
                          {lead.country}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground capitalize">{lead.seniority}</td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono">{lead.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {leads.length > 20 && (
              <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-white/[0.06]">
                Mostrando 20 de {leads.length} leads
              </div>
            )}
          </div>

          <button
            onClick={onComplete}
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Continuar al scoring →
          </button>
        </>
      )}
    </div>
  );
}
