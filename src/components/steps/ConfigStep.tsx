import { useState } from "react";
import { CampaignConfig } from "@/hooks/useWizard";

interface Props {
  config: CampaignConfig;
  setConfig: (c: CampaignConfig) => void;
  onComplete: () => void;
}

const COUNTRIES = ["Argentina", "Colombia", "Chile", "México", "Brasil", "USA"];
const PROFILES = ["Data Analyst", "Data Leader / CDO / Head of BI", "Ambos"] as const;

export function ConfigStep({ config, setConfig, onComplete }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const total = Object.values(config.geoMix).reduce((a, b) => a + b, 0);
  const isValid = config.profile !== "" && total === 100 && config.quantity > 0;

  const updateGeo = (country: string, val: number) => {
    setConfig({ ...config, geoMix: { ...config.geoMix, [country]: val } });
  };

  if (confirmed) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Resumen de campaña</h2>
        <div className="glass-card p-5 border-primary/30 bg-primary/[0.06]">
          <p className="text-sm text-foreground leading-relaxed">
            Voy a buscar <span className="font-semibold text-primary">{config.quantity}</span>{" "}
            <span className="font-semibold text-primary">{config.profile}</span> en{" "}
            {Object.entries(config.geoMix)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k} (${v}%)`)
              .join(", ")}
            , <span className="font-semibold text-primary">
              {config.frequency === "once" ? "una sola vez" : config.frequency === "weekly" ? "semanal" : "mensual"}
            </span>.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setConfirmed(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Editar
          </button>
          <button onClick={onComplete} className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Confirmar y continuar →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Configuración de campaña</h2>
        <p className="text-sm text-muted-foreground mt-1">Define el perfil, geografía y volumen de tu prospección.</p>
      </div>

      {/* ICP Profile */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Perfil ICP</h3>
        <div className="space-y-2">
          {PROFILES.map((p) => (
            <label key={p} className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
              config.profile === p ? "bg-primary/10 border border-primary/30" : "hover:bg-white/[0.03] border border-transparent"
            }`}>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                config.profile === p ? "border-primary" : "border-muted-foreground/30"
              }`}>
                {config.profile === p && <span className="w-2 h-2 rounded-full bg-primary" />}
              </span>
              <span className="text-sm text-foreground">{p}</span>
              <input type="radio" className="sr-only" checked={config.profile === p} onChange={() => setConfig({ ...config, profile: p })} />
            </label>
          ))}
        </div>
      </div>

      {/* Geo Mix */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Mix geográfico</h3>
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
              <div className="relative flex-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.geoMix[c] || 0}
                  onChange={(e) => updateGeo(c, parseInt(e.target.value) || 0)}
                  className="glass-input w-full pr-6 text-right font-mono text-xs"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Volumen y frecuencia</h3>
        <div className="flex gap-3">
          {([["once", "Una sola vez"], ["weekly", "Semanal"], ["monthly", "Mensual"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setConfig({ ...config, frequency: val })}
              className={`px-4 py-2 rounded-lg text-xs transition-colors ${
                config.frequency === val
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "border border-white/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">Cantidad de leads</label>
          <input
            type="number"
            min={1}
            value={config.quantity}
            onChange={(e) => setConfig({ ...config, quantity: parseInt(e.target.value) || 0 })}
            className="glass-input w-24 text-center font-mono text-sm"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => setConfirmed(true)}
        disabled={!isValid}
        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isValid
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        Revisar configuración →
      </button>
    </div>
  );
}
