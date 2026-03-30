import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";

const QUARTILES = [
  { value: "Q1", label: "Top Fit" },
  { value: "Q2", label: "Buen Fit" },
  { value: "Q3", label: "Fit Moderado" },
  { value: "Q4", label: "Fit Bajo" },
];

const ALL_OPTION = { value: "ALL", label: "A todos" };

/* ─── Types ─── */
interface AprobadoRule {
  id: string;
  quartile: string;
  value: string; // SI | NO
}

interface ResponsableRule {
  id: string;
  quartile: string;
  value: string; // free text
  percentage: string;
}

interface CanalRule {
  id: string;
  quartile: string;
  value: string; // LinkedIn | Mail
  percentage: string;
  responsable: string; // filter by responsable
}

/* ─── Exported result type ─── */
export interface SmartAssignResult {
  value: string;
  quartile: string;
  percentage: number;
  responsable?: string; // only for canal
}

interface SmartAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: "calificacion" | "responsable" | "canal";
  fieldLabel: string;
  leadCountByQuartile: Record<string, number>;
  usedResponsables: string[];
  onApply: (rules: SmartAssignResult[]) => void;
}

export function SmartAssignDialog({
  open,
  onOpenChange,
  field,
  fieldLabel,
  leadCountByQuartile,
  usedResponsables,
  onApply,
}: SmartAssignDialogProps) {
  const totalLeads = Object.values(leadCountByQuartile).reduce((s, n) => s + n, 0);

  /* ─── Aprobado state ─── */
  const [aprobadoRules, setAprobadoRules] = useState<AprobadoRule[]>([
    { id: crypto.randomUUID(), quartile: "Q1", value: "SI" },
  ]);

  /* ─── Responsable state ─── */
  const [responsableRules, setResponsableRules] = useState<ResponsableRule[]>([
    { id: crypto.randomUUID(), quartile: "Q1", value: "", percentage: "100" },
  ]);

  /* ─── Canal state ─── */
  const [canalRules, setCanalRules] = useState<CanalRule[]>([
    { id: crypto.randomUUID(), quartile: "Q1", value: "LinkedIn", percentage: "100", responsable: "" },
  ]);

  const quartileOptions = [...QUARTILES, ALL_OPTION];

  const getCount = (quartile: string) =>
    quartile === "ALL" ? totalLeads : (leadCountByQuartile[quartile] || 0);

  /* ─── Handlers ─── */
  const handleApply = () => {
    const results: SmartAssignResult[] = [];

    if (field === "calificacion") {
      for (const r of aprobadoRules) {
        if (!r.value || !r.quartile) continue;
        results.push({ value: r.value, quartile: r.quartile, percentage: 100 });
      }
    } else if (field === "responsable") {
      for (const r of responsableRules) {
        if (!r.value || !r.quartile) continue;
        const pct = parseInt(r.percentage) || 0;
        if (pct <= 0) continue;
        results.push({ value: r.value, quartile: r.quartile, percentage: pct });
      }
    } else if (field === "canal") {
      for (const r of canalRules) {
        if (!r.value || !r.quartile) continue;
        const pct = parseInt(r.percentage) || 0;
        if (pct <= 0) continue;
        results.push({ value: r.value, quartile: r.quartile, percentage: pct, responsable: r.responsable || undefined });
      }
    }

    onApply(results);
    onOpenChange(false);
    resetState();
  };

  const handleClear = () => {
    onApply([{ value: "__clear__", quartile: "ALL", percentage: 100 }]);
    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setAprobadoRules([{ id: crypto.randomUUID(), quartile: "Q1", value: "SI" }]);
    setResponsableRules([{ id: crypto.randomUUID(), quartile: "Q1", value: "", percentage: "100" }]);
    setCanalRules([{ id: crypto.randomUUID(), quartile: "Q1", value: "LinkedIn", percentage: "100", responsable: "" }]);
  };

  const isValid = () => {
    if (field === "calificacion") return aprobadoRules.some((r) => r.value && r.quartile);
    if (field === "responsable") return responsableRules.some((r) => r.value && r.quartile && parseInt(r.percentage) > 0);
    if (field === "canal") return canalRules.some((r) => r.value && r.quartile && parseInt(r.percentage) > 0);
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-[hsl(var(--card))] border-white/[0.1]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Zap className="w-4 h-4 text-primary" />
            Asignación inteligente — {fieldLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          {field === "calificacion" && (
            <AprobadoEditor
              rules={aprobadoRules}
              setRules={setAprobadoRules}
              quartileOptions={quartileOptions}
              getCount={getCount}
            />
          )}
          {field === "responsable" && (
            <ResponsableEditor
              rules={responsableRules}
              setRules={setResponsableRules}
              quartileOptions={quartileOptions}
              getCount={getCount}
            />
          )}
          {field === "canal" && (
            <CanalEditor
              rules={canalRules}
              setRules={setCanalRules}
              quartileOptions={quartileOptions}
              getCount={getCount}
              usedResponsables={usedResponsables}
            />
          )}
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs text-muted-foreground">
            Limpiar todos
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleApply} disabled={!isValid()} className="text-xs">
            <Zap className="w-3.5 h-3.5 mr-1" /> Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Aprobado: SI/NO per quartile, no percentage
   ═══════════════════════════════════════════════════════════════ */
function AprobadoEditor({
  rules,
  setRules,
  quartileOptions,
  getCount,
}: {
  rules: AprobadoRule[];
  setRules: React.Dispatch<React.SetStateAction<AprobadoRule[]>>;
  quartileOptions: { value: string; label: string }[];
  getCount: (q: string) => number;
}) {
  return (
    <>
      {rules.map((rule) => (
        <div key={rule.id} className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <span className="text-xs text-muted-foreground shrink-0">Asignar</span>
          <select
            value={rule.value}
            onChange={(e) => setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, value: e.target.value } : r)))}
            className="h-8 px-2 rounded-md text-xs font-medium border border-white/[0.1] bg-white/[0.06] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [&>option]:bg-[hsl(240,10%,10%)] [&>option]:text-white"
          >
            <option value="SI">SI</option>
            <option value="NO">NO</option>
          </select>

          <span className="text-xs text-muted-foreground shrink-0">a</span>

          <select
            value={rule.quartile}
            onChange={(e) => setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, quartile: e.target.value } : r)))}
            className="h-8 px-2 rounded-md text-xs font-medium border border-white/[0.1] bg-white/[0.06] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [&>option]:bg-[hsl(240,10%,10%)] [&>option]:text-white"
          >
            {quartileOptions.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label} ({getCount(q.value)})
              </option>
            ))}
          </select>

          {rules.length > 1 && (
            <button
              onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
              className="p-1.5 rounded hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <span className="text-[10px] text-muted-foreground ml-auto">
            → {getCount(rule.quartile)} leads
          </span>
        </div>
      ))}
      <button
        onClick={() => setRules((prev) => [...prev, { id: crypto.randomUUID(), quartile: "Q1", value: "SI" }])}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-1 py-1"
      >
        <Plus className="w-3.5 h-3.5" /> Agregar regla
      </button>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Responsable: free text + % + quartile
   ═══════════════════════════════════════════════════════════════ */
function ResponsableEditor({
  rules,
  setRules,
  quartileOptions,
  getCount,
}: {
  rules: ResponsableRule[];
  setRules: React.Dispatch<React.SetStateAction<ResponsableRule[]>>;
  quartileOptions: { value: string; label: string }[];
  getCount: (q: string) => number;
}) {
  const update = (id: string, patch: Partial<ResponsableRule>) =>
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <>
      {rules.map((rule) => {
        const count = getCount(rule.quartile);
        const pct = parseInt(rule.percentage) || 0;
        const affected = Math.round((pct / 100) * count);
        return (
          <div key={rule.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0">Asignar</span>
              <Input
                type="text"
                placeholder="Nombre o email..."
                value={rule.value}
                onChange={(e) => update(rule.id, { value: e.target.value })}
                className="w-[160px] h-8 text-xs bg-white/[0.06] border-white/[0.1]"
              />
              <span className="text-xs text-muted-foreground shrink-0">al</span>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={rule.percentage}
                  onChange={(e) => update(rule.id, { percentage: e.target.value })}
                  className="w-[70px] h-8 text-xs pr-6 bg-white/[0.06] border-white/[0.1]"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">de</span>
              <select
                value={rule.quartile}
                onChange={(e) => update(rule.id, { quartile: e.target.value })}
                className="h-8 px-2 rounded-md text-xs font-medium border border-white/[0.1] bg-white/[0.06] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [&>option]:bg-[hsl(240,10%,10%)] [&>option]:text-white"
              >
                {quartileOptions.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label} ({getCount(q.value)})
                  </option>
                ))}
              </select>

              {rules.length > 1 && (
                <button
                  onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                  className="p-1.5 rounded hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {rule.value && (
              <p className="text-[10px] text-muted-foreground pl-1">→ {affected} leads afectados</p>
            )}
          </div>
        );
      })}
      <button
        onClick={() => setRules((prev) => [...prev, { id: crypto.randomUUID(), quartile: "Q1", value: "", percentage: "100" }])}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-1 py-1"
      >
        <Plus className="w-3.5 h-3.5" /> Agregar regla
      </button>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Canal: Mail/LinkedIn + % + quartile + filter by responsable
   ═══════════════════════════════════════════════════════════════ */
function CanalEditor({
  rules,
  setRules,
  quartileOptions,
  getCount,
  usedResponsables,
}: {
  rules: CanalRule[];
  setRules: React.Dispatch<React.SetStateAction<CanalRule[]>>;
  quartileOptions: { value: string; label: string }[];
  getCount: (q: string) => number;
  usedResponsables: string[];
}) {
  const update = (id: string, patch: Partial<CanalRule>) =>
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <>
      {rules.map((rule) => {
        const count = getCount(rule.quartile);
        const pct = parseInt(rule.percentage) || 0;
        const affected = Math.round((pct / 100) * count);
        return (
          <div key={rule.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0">Asignar</span>
              <select
                value={rule.value}
                onChange={(e) => update(rule.id, { value: e.target.value })}
                className="h-8 px-2 rounded-md text-xs font-medium border border-white/[0.1] bg-white/[0.06] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [&>option]:bg-[hsl(240,10%,10%)] [&>option]:text-white"
              >
                <option value="LinkedIn">LinkedIn</option>
                <option value="Mail">Mail</option>
              </select>

              <span className="text-xs text-muted-foreground shrink-0">al</span>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={rule.percentage}
                  onChange={(e) => update(rule.id, { percentage: e.target.value })}
                  className="w-[70px] h-8 text-xs pr-6 bg-white/[0.06] border-white/[0.1]"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">de</span>
              <select
                value={rule.quartile}
                onChange={(e) => update(rule.id, { quartile: e.target.value })}
                className="h-8 px-2 rounded-md text-xs font-medium border border-white/[0.1] bg-white/[0.06] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [&>option]:bg-[hsl(240,10%,10%)] [&>option]:text-white"
              >
                {quartileOptions.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label} ({getCount(q.value)})
                  </option>
                ))}
              </select>

              {rules.length > 1 && (
                <button
                  onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                  className="p-1.5 rounded hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Responsable filter */}
            {usedResponsables.length > 0 && (
              <div className="flex items-center gap-2 pl-1">
                <span className="text-[10px] text-muted-foreground">donde Responsable sea</span>
                <select
                  value={rule.responsable}
                  onChange={(e) => update(rule.id, { responsable: e.target.value })}
                  className="h-7 px-2 rounded text-[11px] font-medium border border-white/[0.1] bg-white/[0.06] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [&>option]:bg-[hsl(240,10%,10%)] [&>option]:text-white"
                >
                  <option value="">Cualquiera</option>
                  {usedResponsables.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}

            {rule.value && (
              <p className="text-[10px] text-muted-foreground pl-1">
                → {affected} leads afectados{rule.responsable ? ` (responsable: ${rule.responsable})` : ""}
              </p>
            )}
          </div>
        );
      })}
      <button
        onClick={() => setRules((prev) => [...prev, { id: crypto.randomUUID(), quartile: "Q1", value: "LinkedIn", percentage: "100", responsable: "" }])}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-1 py-1"
      >
        <Plus className="w-3.5 h-3.5" /> Agregar regla
      </button>
    </>
  );
}
