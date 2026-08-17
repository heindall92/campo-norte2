import { CircleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { clearWmsSyncError, subscribeWmsSyncError, type WmsSyncNotice } from "@/lib/wms/sync-status";

export function WmsSyncBanner({ lang, className }: { lang: Lang; className?: string }) {
  const [notice, setNotice] = useState<WmsSyncNotice | null>(null);
  useEffect(() => subscribeWmsSyncError(setNotice), []);
  if (!notice) return null;
  const title =
    notice.kind === "save"
      ? lang === "es"
        ? "No se guardó en el almacén"
        : "Warehouse save failed"
      : lang === "es"
        ? "No se cargó el almacén"
        : "Warehouse load failed";
  return (
    <div
      role="alert"
      className={cn(
        "mb-3 flex items-start gap-2 rounded-2xl border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_10%,var(--field-bg))] px-3 py-2.5 text-sm text-[var(--ink)]",
        className,
      )}
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 break-words text-xs text-[var(--ink-muted)]">{notice.message}</p>
      </div>
      <button
        type="button"
        onClick={() => clearWmsSyncError()}
        className="rounded-lg p-1 text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
        aria-label={lang === "es" ? "Cerrar aviso" : "Dismiss"}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
