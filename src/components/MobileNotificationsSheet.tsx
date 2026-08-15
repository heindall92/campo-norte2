"use client";

import { useNotifications, type AppSection } from "@/lib/notifications";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CheckCircle2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function toneDot(tone: string) {
  if (tone === "ok") return "bg-[var(--ok)]";
  if (tone === "warn") return "bg-[var(--warn-ink)]";
  if (tone === "danger") return "bg-[var(--danger)]";
  return "bg-[var(--accent-2)]";
}

function toneLabel(tone: string) {
  if (tone === "ok") return "text-[var(--ok)]";
  if (tone === "warn") return "text-[var(--warn-ink)]";
  if (tone === "danger") return "text-[var(--danger)]";
  return "text-[var(--accent-2)]";
}

export function MobileNotificationsSheet({
  open,
  onClose,
  lang,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  onNavigate: (section: AppSection) => void;
}) {
  const { items, unreadCount, markAllRead, markRead, clear } = useNotifications();
  const es = lang === "es";
  const [justMarked, setJustMarked] = useState(false);
  const hasUnread = useMemo(
    () => unreadCount > 0 || items.some((n) => !n.read),
    [unreadCount, items],
  );

  useEffect(() => {
    if (open) setJustMarked(false);
  }, [open]);

  if (!open) return null;

  function handleMarkAllRead() {
    markAllRead();
    setJustMarked(true);
    window.setTimeout(() => setJustMarked(false), 1600);
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-[color-mix(in_oklab,#0f172a_45%,transparent)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-notif-title"
      onClick={onClose}
    >
      <div
        className="max-h-[80dvh] w-full max-w-lg overflow-hidden rounded-t-[1.75rem] border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[color-mix(in_oklab,var(--ink)_18%,transparent)]" />
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="mobile-notif-title" className="text-base font-bold text-[var(--ink)]">
              {es ? "Notificaciones" : "Notifications"}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-semibold text-[var(--accent)]"
                onClick={() => clear()}
              >
                {es ? "Limpiar" : "Clear"}
              </button>
              <button
                type="button"
                aria-label={es ? "Cerrar" : "Close"}
                onClick={onClose}
                className="rounded-full border border-[var(--glass-border)] p-2 text-[var(--ink-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <ul className="max-h-[min(55dvh,24rem)] overflow-y-auto">
          {items.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-[var(--ink-muted)]">
              {es
                ? "Sin eventos todavía. Crea o edita leads, clientes o reservas."
                : "No events yet. Create or edit leads, clients or bookings."}
            </li>
          )}
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  markRead(n.id);
                  if (n.section) onNavigate(n.section);
                  onClose();
                }}
                className={cn(
                  "flex w-full gap-3 border-b border-[var(--glass-border)] px-4 py-3 text-left active:bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]",
                  !n.read && "bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]",
                )}
              >
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", toneDot(n.tone))} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--ink)]">
                    <span className="font-semibold">{n.actor}</span>{" "}
                    <span className={cn("font-bold uppercase", toneLabel(n.tone))}>
                      {n.statusLabel}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{n.body}</p>
                  {n.detail && (
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">{n.detail}</p>
                  )}
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--ink-muted)]">
                    <CheckCircle2 className="h-3 w-3" />
                    {new Date(n.createdAt).toLocaleString(es ? "es-ES" : "en-GB")}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {items.length > 0 && (
          <div className="relative z-10 border-t border-[var(--glass-border)] px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={!hasUnread && !justMarked}
              onClick={(e) => {
                e.stopPropagation();
                handleMarkAllRead();
              }}
              className={cn(
                "w-full rounded-2xl py-3.5 text-sm font-bold text-white transition",
                justMarked || !hasUnread
                  ? "bg-[var(--ok)]"
                  : "bg-[var(--accent)] active:opacity-90",
                !hasUnread && !justMarked && "opacity-70",
              )}
            >
              {justMarked || !hasUnread
                ? es
                  ? "Todas leídas"
                  : "All read"
                : es
                  ? "Marcar todas como leídas"
                  : "Mark all as read"}
            </button>
          </div>
        )}
        {items.length === 0 && (
          <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]" />
        )}
      </div>
    </div>
  );
}
