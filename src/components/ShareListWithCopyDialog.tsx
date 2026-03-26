import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  listName: string;
}

const RESPONSABLES = ["Bruno", "Juan", "Lucio", "Gabo", "Valen"];
const CALIFICACIONES = ["SI", "NO"];
const CANALES = ["LinkedIn", "Mail"];

export function ShareListWithCopyDialog({ open, onOpenChange, listId, listName }: Props) {
  const [email, setEmail] = useState("");
  const [copySugerido, setCopySugerido] = useState("");
  const [filterAprobado, setFilterAprobado] = useState("");
  const [filterResponsable, setFilterResponsable] = useState("");
  const [filterCanal, setFilterCanal] = useState("");
  const [sharing, setSharing] = useState(false);

  const selectClasses = "w-full rounded-lg px-3 py-2 text-sm font-medium border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring [&>option]:bg-background [&>option]:text-foreground";

  const share = async () => {
    if (!email.trim()) return;
    setSharing(true);
    try {
      // Find user by email
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .single();

      if (!profile) {
        toast.error("No se encontró un usuario con ese email.");
        return;
      }

      // Save filters + copy on the list
      const filtros: Record<string, string> = {};
      if (filterAprobado) filtros.aprobado = filterAprobado;
      if (filterResponsable) filtros.responsable = filterResponsable;
      if (filterCanal) filtros.canal = filterCanal;

      await supabase.from("lists").update({
        copy_sugerido: copySugerido,
        filtros_compartidos: filtros,
      }).eq("id", listId);

      // Add as list member
      const { error } = await supabase.from("list_members").insert({
        list_id: listId,
        user_id: profile.id,
        role: "viewer",
      });

      if (error) {
        toast.error(error.code === "23505" ? "Este usuario ya tiene acceso." : error.message);
      } else {
        toast.success(`Lista compartida con ${email.trim()}`);
        setEmail("");
        setCopySugerido("");
        setFilterAprobado("");
        setFilterResponsable("");
        setFilterCanal("");
        onOpenChange(false);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Compartir "{listName}"
          </DialogTitle>
          <DialogDescription>
            Compartí la lista con filtros y un copy sugerido. El destinatario podrá marcar enviados, respondidos y conversiones por lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Email */}
          <div>
            <Label className="text-xs text-muted-foreground">Email del destinatario</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@teramot.com"
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Filtros (opcional — el destinatario verá solo leads que coincidan)</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Aprobado</label>
                <select value={filterAprobado} onChange={(e) => setFilterAprobado(e.target.value)} className={selectClasses}>
                  <option value="">Todos</option>
                  {CALIFICACIONES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Responsable</label>
                <select value={filterResponsable} onChange={(e) => setFilterResponsable(e.target.value)} className={selectClasses}>
                  <option value="">Todos</option>
                  {RESPONSABLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Canal</label>
                <select value={filterCanal} onChange={(e) => setFilterCanal(e.target.value)} className={selectClasses}>
                  <option value="">Todos</option>
                  {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Copy sugerido */}
          <div>
            <Label className="text-xs text-muted-foreground">Copy sugerido (lo que el destinatario debería enviar)</Label>
            <textarea
              value={copySugerido}
              onChange={(e) => setCopySugerido(e.target.value)}
              placeholder="Escribí acá el mensaje que sugerís que envíen a estos leads..."
              rows={5}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={share}
            disabled={sharing || !email.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {sharing ? "Compartiendo..." : "Compartir"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
