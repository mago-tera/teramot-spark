import { useState } from "react";
import { CampaignConfig } from "@/hooks/useWizard";

interface Props {
  config: CampaignConfig;
  onConfirm: (config: CampaignConfig) => void;
  onCancel: () => void;
}

const COUNTRIES = ["Argentina", "Colombia", "Chile", "México", "Brasil", "USA"];
const PROFILES = ["Data Analyst", "BI Analyst", "Data Leader / CDO / Head of BI"] as const;

export function ICPForm({ config: initialConfig, onConfirm, onCancel }: Props) {
  const [config, setConfig] = useState<CampaignConfig>({ ...initialConfig, profile: "", geoMix: { Argentina: 0, Colombia: 0, Chile: 0, México: 0, Brasil: 0, USA: 0 }, quantity: 50, frequency: "once" });
  const [isCustom, setIsCustom] = useState(false);
  const [customProfile, setCustomProfile] = useState("");
  const total = Object.values(config.geoMix).reduce((a, b) => a + b, 0);
  const isValid = config.profile !== "" && total === 100 && config.quantity > 0;

  const updateGeo = (country: string, val: number) => {
    setConfig({ ...config, geoMix: { ...config.geoMix, [country]: val } });
  };

  return (
    <div className="space-y-6 glass-card p-6 border-primary/20">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Nueva lista — Choose ICP</h3>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">✕ Cancelar</button>
      </div>

      {/* ICP Profile */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Perfil ICP</h4>
        <div className="space-y-2">
          {PROFILES.map((p) => (
            <label key={p} className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
              config.profile === p && !isCustom ? "bg-primary/10 border border-primary/30" : "hover:bg-white/[0.03] border border-transparent"
            }`}>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                config.profile === p && !isCustom ? "border-primary" : "border-muted-foreground/30"
              }`}>
                {config.profile === p && !isCustom && <span className="w-2 h-2 rounded-full bg-primary" />}
              </span>
              <span className="text-sm text-foreground">{p}</span>
              <input type="radio" className="sr-only" checked={config.profile === p && !isCustom} onChange={() => { setIsCustom(false); setConfig({ ...config, profile: p }); }} />
            </label>
          ))}
          <label className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
            isCustom ? "bg-primary/10 border border-primary/30" : "hover:bg-white/[0.03] border border-transparent"
          }`}
            onClick={() => { setIsCustom(true); setConfig({ ...config, profile: customProfile }); }}
          >
            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              isCustom ? "border-primary" : "border-muted-foreground/30"
            }`}>
              {isCustom && <span className="w-2 h-2 rounded-full bg-primary" />}
            </span>
            <span className="text-sm text-foreground">Otros</span>
          </label>
          {isCustom && (
            <input
              type="text"
              placeholder="Ej: Marketing Manager, CTO..."
              value={customProfile}
              onChange={(e) => { setCustomProfile(e.target.value); setConfig({ ...config, profile: e.target.value }); }}
              className="glass-input w-full text-sm ml-7"
              autoFocus
            />
          )}
        </div>
      </div>

      {/* Geo Mix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Mix geográfico</h4>
          <span className={`text-xs font-mono px-2 py-1 rounded ${
            total === 100 ? "bg-success/10 text-success" : total > 100 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
          }`}>
            Total: {total}%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {COUNTRIES.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-20 shrink-0">{c}</label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => updateGeo(c, Math.max(0, (config.geoMix[c] || 0) - 5))}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">−</button>
                <input type="number" min={0} max={100} value={config.geoMix[c] || 0}
                  onChange={(e) => updateGeo(c, Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                  className="w-12 text-center text-xs font-mono text-foreground bg-transparent border border-white/10 rounded-md py-1 focus:outline-none focus:border-primary/50" />
                <span className="text-xs text-muted-foreground">%</span>
                <button type="button" onClick={() => updateGeo(c, Math.min(100, (config.geoMix[c] || 0) + 5))}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Volumen</h4>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">Cantidad de leads</label>
          <input type="number" min={1} value={config.quantity}
            onChange={(e) => setConfig({ ...config, quantity: parseInt(e.target.value) || 0 })}
            className="glass-input w-24 text-center font-mono text-sm" />
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
        <button onClick={() => isValid && onConfirm(config)} disabled={!isValid}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            isValid ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}>
          🔍 Buscar prospectos →
        </button>
      </div>
    </div>
  );
}
