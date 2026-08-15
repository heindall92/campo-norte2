import { ROLE_DESCRIPTION, useAuth } from "@/lib/auth";
import { loadUserProfile } from "@/lib/user-profile";
import type { Lang } from "@/lib/i18n";
import { Card } from "@/components/CrmChrome";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

/** Sesión actual + cambio de contraseña (deshabilitado). La BD de usuarios vive en Usuarios. */
export function AccountUsersCard({
  lang,
  fieldCls,
  labelCls,
}: {
  lang: Lang;
  fieldCls: string;
  labelCls: string;
}) {
  const { user, signOut } = useAuth();
  const profile = user
    ? loadUserProfile(user.id, {
        name: user.name,
        email: user.email,
        roleLabel: user.roleLabel,
      })
    : null;

  return (
    <Card
      className="w-full"
      headerAlign="center"
      title={lang === "es" ? "Cuenta y sesión" : "Account & session"}
      subtitle={
        lang === "es"
          ? "Tu sesión en el ecosistema Growth OS. Debajo: directorio de usuarios y roles del equipo."
          : "Your Growth OS session. Below: team users and roles directory."
      }
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-4">
          <p className={cn(labelCls, "text-center")}>
            {lang === "es" ? "Sesión actual" : "Current session"}
          </p>
          {user && profile && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-lg font-bold text-white">
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
                  <p className="truncate font-[family-name:var(--mps-display)] text-lg text-[var(--ink)]">
                    {profile.fullName || user.name}
                  </p>
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{user.email}</p>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                    {user.roleLabel} ·{" "}
                    {ROLE_DESCRIPTION[user.role][lang === "es" ? "es" : "en"]}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="shrink-0 rounded-xl border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
              >
                {lang === "es" ? "Cerrar sesión" : "Sign out"}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-[var(--field-border)] p-4 opacity-80">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
            <Lock className="h-4 w-4 text-[var(--ink-muted)]" />
            <p className="text-sm font-semibold text-[var(--ink)]">
              {lang === "es"
                ? "Nueva contraseña (tu cuenta)"
                : "New password (your account)"}
            </p>
            <span className="rounded-md border border-[var(--field-border)] bg-[var(--field-bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
              {lang === "es" ? "Próximamente" : "Soon"}
            </span>
          </div>
          <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row sm:items-end">
            <input
              type="password"
              disabled
              value="••••••••"
              readOnly
              className={cn(fieldCls, "cursor-not-allowed opacity-70")}
            />
            <button
              type="button"
              disabled
              className="mps-choice cursor-not-allowed rounded-lg px-4 py-2 text-sm font-semibold opacity-60"
            >
              {lang === "es" ? "Cambiar" : "Change"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
