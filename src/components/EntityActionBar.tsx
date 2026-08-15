import { WhatsAppSecureLink } from "@/components/WhatsAppSecureLink";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Pencil, Phone, Trash2 } from "lucide-react";

export function EntityActionBar({
  phone,
  onEdit,
  onDelete,
  className,
}: {
  phone?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  const { push } = useNotifications();

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {onEdit && (
        <button
          type="button"
          title="Editar"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] p-2 text-[var(--ink)] hover:border-[var(--accent)]"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {phone && (
        <>
          <WhatsAppSecureLink clientPhone={phone} />
          <a
            href={`tel:${phone}`}
            title="Llamar"
            onClick={(e) => {
              e.stopPropagation();
              push({
                kind: "system",
                tone: "info",
                actor: phone,
                statusLabel: "LLAMADA",
                body: "Has iniciado una llamada (seguimiento humano)",
                detail: phone,
              });
            }}
            className="rounded-lg border border-[color-mix(in_oklab,var(--accent-2)_35%,transparent)] bg-[color-mix(in_oklab,var(--accent-2)_12%,transparent)] p-2 text-[var(--accent-2)] hover:opacity-90"
          >
            <Phone className="h-4 w-4" />
          </a>
        </>
      )}
      {onDelete && (
        <button
          type="button"
          title="Eliminar"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-lg border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] p-2 text-[var(--danger)] hover:opacity-90"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
