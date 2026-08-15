import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  canManageCrmUsers,
  createCrmUser,
  listCrmUsersSafe,
  updateCrmUserRole,
  useAuth,
  type AppUser,
  type UserRole,
} from "@/lib/auth";
import { loadUserProfile } from "@/lib/user-profile";
import type { Lang } from "@/lib/i18n";
import { ProfileModal } from "@/components/ProfileModal";
import { AccountUsersCard } from "@/components/AccountUsersCard";
import { showMobileTicket } from "@/lib/mobile-confirm";
import { useIsMobile } from "@/lib/use-is-mobile";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Plus, RefreshCw, Shield } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

const fieldCls =
  "mps-field mt-1 w-full rounded-lg px-2.5 py-2 text-sm font-normal text-[var(--ink)]";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]";

/**
 * BD de usuarios del CRM — solo Admin/CEO/founder.
 * Tarjetas estilo carpeta; clic abre perfil (vista admin).
 */
export function UsersDirectoryPanel({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const canManage = canManageCrmUsers(user?.role);
  const localMode = user?.provider === "local";

  const [users, setUsers] = useState<AppUser[]>(() => listCrmUsersSafe());
  const [inspect, setInspect] = useState<AppUser | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("booking");
  const [createError, setCreateError] = useState<string | null>(null);

  const refresh = useCallback(() => setUsers(listCrmUsersSafe()), []);

  useEffect(() => {
    function onHubRefresh() {
      refresh();
    }
    window.addEventListener("mps-hub-refreshed", onHubRefresh);
    return () => window.removeEventListener("mps-hub-refreshed", onHubRefresh);
  }, [refresh]);

  if (!user || !canManage) {
    return (
      <div className="rounded-2xl border border-[var(--field-border)] bg-[var(--field-bg)] p-8 text-center">
        <Shield className="mx-auto h-8 w-8 text-[var(--accent)]" />
        <p className="mt-3 font-semibold text-[var(--ink)]">
          {lang === "es" ? "Acceso restringido" : "Restricted"}
        </p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Solo Admin / CEO / founder pueden ver la base de usuarios del CRM."
            : "Only Admin / CEO / founder can view the CRM user directory."}
        </p>
      </div>
    );
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!localMode) {
      setCreateError(
        lang === "es"
          ? "Con Supabase Auth crea usuarios en el dashboard de Supabase."
          : "With Supabase Auth, create users in the Supabase dashboard.",
      );
      return;
    }
    try {
      createCrmUser({ email: newEmail, password: newPassword, role: newRole });
      setNewEmail("");
      setNewPassword("");
      setNewRole("booking");
      refresh();
      setFlash(lang === "es" ? "Usuario creado" : "User created");
      showMobileTicket({
        title: lang === "es" ? "Usuario guardado" : "User saved",
        subtitle: lang === "es" ? "Cuenta añadida al CRM" : "Account added to the CRM",
        headline: newEmail.trim(),
        meta: ROLE_LABEL[newRole],
        fields: [
          { label: "Email", value: newEmail.trim() },
          { label: lang === "es" ? "Rol" : "Role", value: ROLE_LABEL[newRole] },
          { label: lang === "es" ? "Estado" : "Status", value: lang === "es" ? "Activo" : "Active" },
          { label: lang === "es" ? "Origen" : "Source", value: "CRM local" },
        ],
        chips: [ROLE_LABEL[newRole]],
        primaryLabel: lang === "es" ? "Hecho" : "Done",
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-5">
      <AccountUsersCard lang={lang} fieldCls={fieldCls} labelCls={labelCls} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {/* En móvil el shell ya muestra el título de sección. */}
          {!isMobile && (
            <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
              {lang === "es" ? "Usuarios y roles" : "Users & roles"}
            </h2>
          )}
          <p
            className={cn(
              "max-w-xl text-sm text-[var(--ink-muted)] text-pretty",
              !isMobile && "mt-1",
            )}
          >
            {lang === "es"
              ? "Base de sesiones del equipo. Cada rol limita el menú. El perfil personal de cada uno solo lo ve el propio usuario o Admin."
              : "Team session directory. Each role limits the menu. Personal profiles are only visible to the owner or Admin."}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="mps-choice inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
        >
          <RefreshCw className="h-4 w-4" />
          {lang === "es" ? "Actualizar" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {users.map((u) => {
          const profile = loadUserProfile(u.id, {
            name: u.name,
            email: u.email,
            roleLabel: ROLE_LABEL[u.role],
          });
          const displayName = profile.fullName.trim() || u.name;
          const title = profile.jobTitle.trim() || ROLE_LABEL[u.role];
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setInspect(u)}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--field-border)] bg-[var(--glass-strong)] text-left shadow-md transition",
                "hover:border-[var(--accent)] hover:shadow-[0_8px_28px_color-mix(in_oklab,var(--accent)_22%,transparent)]",
              )}
            >
              {/* pestaña carpeta */}
              <div className="flex items-center justify-between gap-2 border-b border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                    {profile.avatarDataUrl ? (
                      <img
                        src={profile.avatarDataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      u.avatarInitial
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--ink)]">{displayName}</p>
                    <p className="truncate text-xs text-[var(--ink-muted)]">
                      {title}
                      {u.id === user.id ? (lang === "es" ? " · tú" : " · you") : ""}
                    </p>
                  </div>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--field-border)] bg-[var(--glass-strong)] text-[var(--accent)] transition group-hover:border-[var(--accent)]">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="truncate text-xs text-[var(--ink-muted)]">{u.email}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                    {ROLE_LABEL[u.role]}
                  </span>
                  {localMode && (
                    <select
                      className="mps-field rounded-md px-2 py-1 text-[11px] font-semibold"
                      value={u.role}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateCrmUserRole(u.id, e.target.value as UserRole);
                        refresh();
                      }}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="line-clamp-2 text-[11px] text-[var(--ink-muted)]">
                  {ROLE_DESCRIPTION[u.role][lang === "es" ? "es" : "en"]}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <form
        onSubmit={onCreate}
        className="rounded-2xl border border-dashed border-[var(--field-border)] bg-[var(--field-bg)] p-4"
      >
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <Plus className="h-4 w-4" />
          {lang === "es" ? "Crear usuario" : "Create user"}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelCls}>
            Email
            <input
              type="email"
              required
              disabled={!localMode}
              className={fieldCls}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </label>
          <label className={labelCls}>
            {lang === "es" ? "Contraseña (mín. 6)" : "Password (min. 6)"}
            <input
              type="password"
              required
              minLength={6}
              disabled={!localMode}
              className={fieldCls}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className={labelCls}>
            {lang === "es" ? "Rol" : "Role"}
            <select
              className={fieldCls}
              disabled={!localMode}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {createError && <p className="mt-2 text-sm text-[var(--danger)]">{createError}</p>}
        {flash && <p className="mt-2 text-sm text-[var(--accent)]">{flash}</p>}
        <button
          type="submit"
          disabled={!localMode}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          {lang === "es" ? "Crear usuario" : "Create user"}
        </button>
      </form>

      {inspect && (
        <ProfileModal
          open
          onClose={() => setInspect(null)}
          subject={inspect}
          role={inspect.role}
          readOnly={inspect.id !== user.id}
          lang={lang === "es" ? "es" : "en"}
        />
      )}
    </div>
  );
}
