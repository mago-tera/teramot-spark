import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "proyecto" | "campaña" | "lista";
  entityId: string;
  /** Table to insert the membership into */
  memberTable: "project_members" | "campaign_members" | "list_members";
  /** FK column name pointing to the entity */
  fkColumn: "project_id" | "campaign_id" | "list_id";
}

export function ShareEntityDialog({ open, onOpenChange, entityType, entityId, memberTable, fkColumn }: Props) {
  const [email, setEmail] = useState("");
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    if (!email.trim()) return;
    setSharing(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .single();

      if (!profile) {
        toast.error("No se encontró un usuario con ese email.");
        return;
      }

      const { error } = await supabase.from(memberTable).insert({
        [fkColumn]: entityId,
        user_id: profile.id,
        role: "viewer",
      } as any);

      if (error) {
        toast.error(error.code === "23505" ? "Este usuario ya tiene acceso." : error.message);
      } else {
        toast.success(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} compartida exitosamente.`);
        setEmail("");
        onOpenChange(false);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Compartir {entityType}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ingresá el email del usuario @teramot.com con quien querés compartir esta {entityType}.
            {entityType === "campaña" && " Podrá ver la campaña y todas sus listas."}
            {entityType === "lista" && " Solo podrá ver esta lista dentro de la campaña."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@teramot.com"
          className="glass-input w-full text-sm py-2 px-3"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") share(); }}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={share} disabled={sharing || !email.trim()}>
            {sharing ? "Compartiendo..." : "Compartir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
