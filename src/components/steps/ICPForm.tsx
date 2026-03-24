import { useState, useRef, useCallback } from "react";
import { CampaignConfig } from "@/hooks/useWizard";
import { Plus, X } from "lucide-react";

interface Props {
  config: CampaignConfig;
  onConfirm: (config: CampaignConfig) => void;
  onCancel: () => void;
}

const DEFAULT_COUNTRIES = ["Argentina", "USA", "Brasil"];
const EXTRA_COUNTRIES = ["Colombia", "Chile", "México"];
const PROFILES = ["Data Analyst", "BI Analyst", "Data Leader / CDO / Head of BI"] as const;

function GeoSlider({ country, value, onChange, onRemove }: { country: string; value: number; onChange: (v: number) => void; onRemove?: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const calcValue = useCallback((clientX: number) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.round(((clientX - rect.left) / rect.width) * 100 / 5) * 5;
    return Math.max(0, Math.min(100, pct));
  }, [value]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onChange(calcValue(e.clientX));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    onChange(calcValue(e.clientX));
  };

  const onPointerUp = () => { dragging.current = false; };

  return (
    <div className="flex items-center gap-3 group/geo">
      <div className="flex items-center gap-2 w-24 shrink-0">
        <span className="text-sm text-foreground font-medium">{country}</span>
        {onRemove && (
          <button onClick={onRemove} className="p-0.5 rounded hover:bg-white/10 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/geo:opacity-100 transition-all">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div
        ref={trackRef}
        className="flex-1 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] relative cursor-pointer select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-lg bg-primary/20 transition-[width] duration-75"
          style={{ width: `${value}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary shadow-lg shadow-primary/30 border-2 border-primary-foreground/20 transition-[left] duration-75"
          style={{ left: `calc(${value}% - 8px)` }}
        />
      </div>
      <span className="text-sm font-mono text-foreground w-12 text-right tabular-nums">{value}%</span>
    </div>
  );
}

export function ICPForm({ config: initialConfig, onConfirm, onCancel }: Props) {
  const [config, setConfig] = useState<CampaignConfig>({
    ...initialConfig,
    profile: "",
    geoMix: { Argentina: 0, USA: 0, Brasil: 0 },
    quantity: 50,
    frequency: "once",
  });
  const [isCustom, setIsCustom] = useState(false);
  const [customProfile, setCustomProfile] = useState("");
  const [visibleCountries, setVisibleCountries] = useState<string[]>(DEFAULT_COUNTRIES);
  const [showAddCountry, setShowAddCountry] = useState(false);

  const total = Object.values(config.geoMix).reduce((a, b) => a + b, 0);
  const isValid = config.profile !== "" && total === 100 && config.quantity > 0;
  const availableExtras = EXTRA_COUNTRIES.filter((c) => !visibleCountries.includes(c));

  const updateGeo = (country: string, val: number) => {
    setConfig({ ...config, geoMix: { ...config.geoMix, [country]: val } });
  };

  const addCountry = (country: string) => {
    setVisibleCountries([...visibleCountries, country]);
    setConfig({ ...config, geoMix: { ...config.geoMix, [country]: 0 } });
    setShowAddCountry(false);
  };

  const removeCountry = (country: string) => {
    setVisibleCountries(visibleCountries.filter((c) => c !== country));
    const newMix = { ...config.geoMix };
    delete newMix[country];
    setConfig({ ...config, geoMix: newMix });
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Mix geográfico</h4>
          <span className={`text-xs font-mono px-2 py-1 rounded ${
            total === 100 ? "bg-success/10 text-success" : total > 100 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
          }`}>
            {total}%
          </span>
        </div>
        <div className="space-y-3">
          {visibleCountries.map((c) => (
            <GeoSlider
              key={c}
              country={c}
              value={config.geoMix[c] || 0}
              onChange={(v) => updateGeo(c, v)}
              onRemove={!DEFAULT_COUNTRIES.includes(c) ? () => removeCountry(c) : undefined}
            />
          ))}
        </div>
        {availableExtras.length > 0 && (
        {!showAddCountry ? (
          <button
            onClick={() => setShowAddCountry(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar región
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ej: Colombia, Chile, España..."
              value={customCountry}
              onChange={(e) => setCustomCountry(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && customCountry.trim()) { addCountry(customCountry.trim()); setCustomCountry(""); } if (e.key === "Escape") { setShowAddCountry(false); setCustomCountry(""); } }}
              className="glass-input text-sm py-1.5 px-3 w-48"
              autoFocus
            />
            <button
              onClick={() => { if (customCountry.trim()) { addCountry(customCountry.trim()); setCustomCountry(""); } }}
              disabled={!customCountry.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Agregar
            </button>
            <button onClick={() => { setShowAddCountry(false); setCustomCountry(""); }} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
