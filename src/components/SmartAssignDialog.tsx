import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const QUARTILES = [
  { value: "Q1", label: "Top Fit" },
  { value: "Q2", label: "Buen Fit" },
  { value: "Q3", label: "Fit Moderado" },
  { value: "Q4", label: "Fit Bajo" },
];

interface AssignRule {
  id: string;
  value: string;
  percentage: string; // "rest" or number
  quartile: string;
}

interface SmartAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: "calificacion" | "responsable" | "canal";
  fieldLabel: string;
  options: { label: string; value: string }[];
  leadCountByQuartile: Record<string, number>;
  onApply: (rules: { value: string; quartile: string; percentage: number }[]) => void;
}

export function SmartAssignDialog({
  open,
  onOpenChange,
  field,
  fieldLabel,
  options,
  leadCountByQuartile,
  onApply,
}: SmartAssignDialogProps) {
  const [rules, setRules] = useState<AssignRule[]>([
    { id: crypto.randomUUID(), value: "", percentage: "100", quartile: "Q1" },
  ]);

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      { id: crypto.randomUUID(), value: "", percentage: "", quartile: "Q1" },
    ]);
  };

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRule = (id: string, field: keyof AssignRule, value: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // Calculate used percentage per quartile
  const usedPerQuartile = (quartile: string, excludeId?: string) => {
    return rules
      .filter((r) => r.quartile === quartile && r.id !== excludeId && r.percentage !== "rest")
      .reduce((sum, r) => sum + (parseInt(r.percentage) || 0), 0);
  };

  const handleApply = () => {
    const expandedRules: { value: string; quartile: string; percentage: number }[] = [];
    
    for (const rule of rules) {
      if (!rule.value || !rule.quartile) continue;
      const pct = rule.percentage === "rest" 
        ? Math.max(0, 100 - usedPerQuartile(rule.quartile, rule.id))
        : parseInt(rule.percentage) || 0;
      if (pct <= 0) continue;
      expandedRules.push({ value: rule.value, quartile: rule.quartile, percentage: pct });
    }

    onApply(expandedRules);
    onOpenChange(false);
    // Reset
    setRules([{ id: crypto.randomUUID(), value: "", percentage: "100", quartile: "Q1" }]);
  };

  const handleClear = () => {
    onApply([{ value: "__clear__", quartile: "ALL", percentage: 100 }]);
    onOpenChange(false);
    setRules([{ id: crypto.randomUUID(), value: "", percentage: "100", quartile: "Q1" }]);
  };

  const isValid = rules.some((r) => r.value && r.quartile && (r.percentage === "rest" || parseInt(r.percentage) > 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-[hsl(var(--card))] border-white/[0.1]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Zap className="w-4 h-4 text-primary" />
            Asignación inteligente — {fieldLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {rules.map((rule, idx) => {
            const remaining = 100 - usedPerQuartile(rule.quartile, rule.id);
            const quartileCount = leadCountByQuartile[rule.quartile] || 0;
            const effectivePct = rule.percentage === "rest" ? remaining : (parseInt(rule.percentage) || 0);
            const affectedCount = Math.round((effectivePct / 100) * quartileCount);

            return (
              <div key={rule.id} className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground shrink-0">Asignar</span>
                    <Select value={rule.value} onValueChange={(v) => updateRule(rule.id, "value", v)}>
                      <SelectTrigger className="w-[120px] h-8 text-xs bg-white/[0.06] border-white/[0.1]">
                        <SelectValue placeholder="Elegir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <span className="text-xs text-muted-foreground shrink-0">al</span>
                    
                    <div className="flex items-center gap-1">
                      {rule.percentage === "rest" ? (
                        <button
                          onClick={() => updateRule(rule.id, "percentage", String(remaining))}
                          className="h-8 px-2 rounded-md text-xs font-medium bg-primary/20 text-primary border border-primary/30"
                        >
                          Restante ({remaining}%)
                        </button>
                      ) : (
                        <div className="relative">
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={rule.percentage}
                            onChange={(e) => updateRule(rule.id, "percentage", e.target.value)}
                            className="w-[80px] h-8 text-xs pr-6 bg-white/[0.06] border-white/[0.1]"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                        </div>
                      )}
                      {rule.percentage !== "rest" && (
                        <button
                          onClick={() => updateRule(rule.id, "percentage", "rest")}
                          className="h-8 px-1.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
                          title="Usar restante"
                        >
                          ∞
                        </button>
                      )}
                    </div>

                    <span className="text-xs text-muted-foreground shrink-0">de los</span>

                    <Select value={rule.quartile} onValueChange={(v) => updateRule(rule.id, "quartile", v)}>
                      <SelectTrigger className="w-[130px] h-8 text-xs bg-white/[0.06] border-white/[0.1]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUARTILES.map((q) => (
                          <SelectItem key={q.value} value={q.value}>
                            {q.label} ({leadCountByQuartile[q.value] || 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {rule.value && rule.quartile && (
                    <p className="text-[10px] text-muted-foreground pl-1">
                      → {affectedCount} lead{affectedCount !== 1 ? "s" : ""} afectados
                    </p>
                  )}
                </div>

                {rules.length > 1 && (
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="p-1.5 rounded hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors mt-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={addRule}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-1 py-1"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar condición
          </button>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs text-muted-foreground">
            Limpiar todos
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleApply} disabled={!isValid} className="text-xs">
            <Zap className="w-3.5 h-3.5 mr-1" /> Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
