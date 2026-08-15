import { useAuth } from "@/lib/auth";
import { useNotifications, type AppSection } from "@/lib/notifications";
import { loadUserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/utils";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  LogOut,
  RefreshCw,
  Settings,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UnreadDot } from "@/components/UnreadDot";

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

export function AppHeader({
  title,
  subtitle,
  hubBadge,
  onRefresh,
  onNavigate,
  onOpenProfile,
}: {
  title: string;
  subtitle: string;
  hubBadge: string;
  onRefresh?: () => void | Promise<void>;
  onNavigate: (section: AppSection) => void;
  onOpenProfile?: () => void;
}) {
  const { user, signOut } = useAuth();
  const { items, unreadCount, markAllRead, markRead, clear } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFlash, setRefreshFlash] = useState<"ok" | "err" | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const [, bump] = useState(0);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(t)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    function onProfileSaved() {
      bump((n) => n + 1);
    }
    window.addEventListener("mps-profile-saved", onProfileSaved);
    return () => window.removeEventListener("mps-profile-saved", onProfileSaved);
  }, []);

  async function handleRefresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    setRefreshFlash(null);
    try {
      await onRefresh();
      setRefreshFlash("ok");
      window.setTimeout(() => setRefreshFlash(null), 2000);
    } catch {
      setRefreshFlash("err");
      window.setTimeout(() => setRefreshFlash(null), 2800);
    } finally {
      setRefreshing(false);
    }
  }

  if (!user) return null;

  const profile = loadUserProfile(user.id, {
    name: user.name,
    email: user.email,
    roleLabel: user.roleLabel,
  });
  const displayName = profile.fullName.trim() || user.name;

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border)] bg-[var(--header)] px-4 py-3 backdrop-blur-xl md:px-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
        <p className="text-xs text-[var(--ink-muted)]">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="glass-chip hidden rounded-md px-2 py-1 text-xs font-semibold sm:inline">
          {hubBadge}
        </span>

        {refreshFlash === "ok" && (
          <span className="hidden text-xs font-semibold text-[var(--ok)] sm:inline">
            Hub actualizado
          </span>
        )}
        {refreshFlash === "err" && (
          <span className="hidden text-xs font-semibold text-[var(--danger)] sm:inline">
            Error al actualizar
          </span>
        )}

        {onRefresh && (
          <button
            type="button"
            title="Recargar Hub · leads, clientes, reservas, facturas"
            aria-label="Recargar Hub"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-strong)] text-[var(--ink)] hover:border-[var(--accent)] disabled:opacity-60"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                refreshing && "animate-spin text-[var(--accent)]",
                refreshFlash === "ok" && "text-[var(--ok)]",
                refreshFlash === "err" && "text-[var(--danger)]",
              )}
            />
          </button>
        )}

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            aria-label="Notificaciones"
            onClick={() => {
              setNotifOpen((v) => !v);
              setUserOpen(false);
              if (!notifOpen) markAllRead();
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-strong)] text-[var(--ink)] hover:border-[var(--accent)]"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && <UnreadDot className="right-1.5 top-1.5 ring-[var(--header)]" />}
          </button>

          {notifOpen && (
            <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
                <p className="font-semibold text-[var(--ink)]">Notificaciones</p>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <button type="button" className="text-[var(--accent)] hover:underline" onClick={clear}>
                    Limpiar
                  </button>
                  <button
                    type="button"
                    className="text-[var(--ink-muted)] hover:underline"
                    onClick={() => setNotifOpen(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
              <ul className="max-h-[min(70vh,24rem)] overflow-y-auto">
                {items.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-[var(--ink-muted)]">
                    Sin eventos todavía. Crea o edita leads, clientes o reservas.
                  </li>
                )}
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        markRead(n.id);
                        if (n.section) onNavigate(n.section);
                        setNotifOpen(false);
                      }}
                      className={cn(
                        "flex w-full gap-3 border-b border-[var(--glass-border)] px-4 py-3 text-left hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]",
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
                          {new Date(n.createdAt).toLocaleString("es-ES")}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => {
              setUserOpen((v) => !v);
              setNotifOpen(false);
            }}
            className="flex h-10 items-center gap-2.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-strong)] py-1 pl-1 pr-2.5 hover:border-[var(--accent)] sm:pr-3.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-sm font-bold text-white">
              {profile.avatarDataUrl ? (
                <img src={profile.avatarDataUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                user.avatarInitial
              )}
            </span>
            <span className="hidden min-w-0 items-center gap-2 sm:inline-flex">
              <span className="truncate text-sm font-semibold leading-none text-[var(--ink)]">
                {displayName}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] px-2 py-0.5 text-[10px] font-bold leading-none text-[var(--accent)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                {user.roleLabel}
              </span>
            </span>
            <ChevronDown className="hidden h-4 w-4 shrink-0 text-[var(--ink-muted)] sm:block" />
          </button>

          {userOpen && (
            <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                    {profile.avatarDataUrl ? (
                      <img
                        src={profile.avatarDataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      user.avatarInitial
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--ink)]">{displayName}</p>
                    <p className="truncate text-xs text-[var(--ink-muted)]">{user.roleLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 text-[var(--ink-muted)] hover:bg-[var(--field-bg)]"
                  onClick={() => setUserOpen(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  onOpenProfile?.();
                  setUserOpen(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]"
              >
                <UserRound className="h-4 w-4 text-[var(--accent)]" />
                Mi perfil
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate("ajustes");
                  setUserOpen(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]"
              >
                <Settings className="h-4 w-4 text-[var(--accent)]" />
                Ajustes
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-2 border-t border-[var(--glass-border)] px-4 py-3 text-sm font-semibold text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_8%,transparent)]"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
