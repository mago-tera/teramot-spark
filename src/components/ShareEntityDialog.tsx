import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Copy, Check, Link } from "lucide-react";
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
  const [sharedLink, setSharedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        toast.error("No se encontró un usuario con ese email. Asegurate de que se haya logueado al menos una vez.");
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
        const link = `${window.location.origin}/shared/list/${entityId}`;
        setSharedLink(link);
        toast.success("Acceso compartido exitosamente.");
      }
    } finally {
      setSharing(false);
    }
  };

  const copyLink = async () => {
    if (!sharedLink) return;
    await navigator.clipboard.writeText(sharedLink);
    setCopied(true);
    toast.success("Link copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setEmail("");
      setSharedLink(null);
      setCopied(false);
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Compartir {entityType}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {!sharedLink
              ? <>Ingresá el email del usuario con quien querés compartir esta {entityType}. Debe haberse logueado al menos una vez.</>
              : "¡Listo! Copiá el link y enviáselo al usuario."
            }
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!sharedLink ? (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
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
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.1] bg-white/[0.04]">
              <Link className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground font-mono truncate flex-1">{sharedLink}</span>
              <button
                onClick={copyLink}
                className="shrink-0 p-1.5 rounded-md hover:bg-white/[0.08] transition-colors"
              >
                {copied
                  ? <Check className="w-4 h-4 text-green-400" />
                  : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => handleClose(false)}>
                Listo
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
