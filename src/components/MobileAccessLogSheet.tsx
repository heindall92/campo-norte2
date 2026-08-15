import {
  eventLabel,
  fetchAccessLog,
  formatAccessWhen,
  type AccessLogEntry,
} from "@/lib/access-log";
import { cn } from "@/lib/utils";
import { Activity, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function MobileAccessLogSheet({
  open,
  onClose,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  lang: "es" | "en";
}) {
  const es = lang === "es";
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<AccessLogEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchAccessLog(100);
    setConfigured(result.configured);
    setEntries(result.entries);
    setError(result.error ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const logins = entries.filter((e) => e.event === "login" || e.event === "session").length;
  const proposals = entries.filter((e) => e.event === "view_proposal").length;
  const product = entries.filter((e) => e.event === "view_product").length;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end" role="presentation">
      <button
        type="button"
        aria-label={es ? "Cerrar" : "Close"}
        onClick={onClose}
        className="absolute inset-0 bg-[color-mix(in_oklab,#0f172a_45%,transparent)] backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={es ? "Quién se ha conectado" : "Who logged in"}
        className="relative flex max-h-[88dvh] flex-col rounded-t-[1.75rem] bg-[var(--bg0)] shadow-[0_-18px_50px_rgba(3,8,18,.35)] animate-[mps-sheet-in_.36s_cubic-bezier(.22,1.2,.36,1)]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-bold text-[var(--ink)]">
              <Activity className="h-5 w-5 text-[var(--accent)]" strokeWidth={1.75} />
              {es ? "Quién se ha conectado" : "Who logged in"}
            </p>
            <p className="mt-1 text-xs leading-snug text-[var(--ink-muted)]">
              {es
                ? "Analítica propia (gratis): login, hora, IP real y si abrieron la propuesta o el CRM."
                : "Free built-in analytics: login, time, real IP, and proposal/CRM views."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full p-2 text-[var(--ink-muted)] active:bg-[var(--field-bg)]"
              aria-label={es ? "Actualizar" : "Refresh"}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-[var(--ink-muted)] active:bg-[var(--field-bg)]"
              aria-label={es ? "Cerrar" : "Close"}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 pb-3">
          <Stat label={es ? "Logins" : "Logins"} value={logins} />
          <Stat label={es ? "Propuesta" : "Proposal"} value={proposals} />
          <Stat label={es ? "Producto" : "Product"} value={product} />
        </div>

        {!configured && (
          <p className="mx-5 mb-2 rounded-xl border border-[color-mix(in_oklab,var(--warn-ink)_35%,transparent)] bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn-ink)]">
            {es
              ? "Bitácora compartida pendiente: añade SUPABASE_SERVICE_ROLE_KEY en Vercel y ejecuta el SQL de mps_access_log. Mientras, se guarda en este dispositivo."
              : "Shared log pending: add SUPABASE_SERVICE_ROLE_KEY on Vercel and run mps_access_log SQL. Until then, this device only."}
            {error ? ` · ${error}` : ""}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--ink-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              {es ? "Cargando…" : "Loading…"}
            </div>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--ink-muted)]">
              {es
                ? "Aún no hay accesos registrados. En cuanto alguien entre, aparece aquí."
                : "No access events yet. They appear here as soon as someone signs in."}
            </p>
          ) : (
            <ul className="space-y-2 pb-4">
              {entries.map((e, i) => (
                <li
                  key={e.id ?? `${e.email}-${e.created_at}-${i}`}
                  className="rounded-2xl border border-[color-mix(in_oklab,var(--ink)_8%,transparent)] bg-white px-3.5 py-3 dark:bg-[var(--glass-strong)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--ink)]">{e.name}</p>
                      <p className="truncate text-xs text-[var(--ink-muted)]">{e.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                      {e.org_tag}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-[var(--ink)]">
                    {eventLabel(e.event, lang)}
                    {e.section ? (
                      <span className="font-normal text-[var(--ink-muted)]"> · {e.section}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                    {formatAccessWhen(e.created_at, lang)}
                    {" · IP "}
                    <code className="text-[var(--ink)]">{e.ip}</code>
                    {e.localOnly ? (es ? " · solo este móvil" : " · this device only") : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2.5 text-center shadow-sm dark:bg-[var(--glass-strong)]">
      <p className="text-lg font-bold tabular-nums text-[var(--ink)]">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
    </div>
  );
}
