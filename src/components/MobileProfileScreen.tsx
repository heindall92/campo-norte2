import { useAuth, canManageCrmUsers } from "@/lib/auth";
import { loadUserProfile } from "@/lib/user-profile";
import {
  ACCENT_PALETTE,
  PROFILE_LAYOUT_B_ENABLED,
  saveUserPrefs,
  type AccentId,
  type ProfileLayoutId,
  type UserPrefs,
} from "@/lib/user-prefs";
import type { Lang } from "@/lib/i18n";
import type { AppSection } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { AppleSwitch } from "@/components/AppleSwitch";
import { ViewModePicker } from "@/components/ViewModePicker";
import { SupportModal } from "@/components/SupportModal";
import { MobileAccessLogSheet } from "@/components/MobileAccessLogSheet";
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Globe,
  LayoutTemplate,
  LogOut,
  Palette,
  Settings,
  Shield,
  User,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type RowProps = {
  icon: typeof User;
  label: string;
  value?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function Row({ icon: Icon, label, value, onClick, disabled, danger }: RowProps) {
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition",
        disabled && "opacity-50",
        danger ? "text-[var(--danger)]" : "text-[var(--ink)]",
        onClick && !disabled && "active:bg-[var(--field-bg)]",
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", !danger && "text-[var(--ink)]")} strokeWidth={1.75} />
      <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
      {value && (
        <span className="shrink-0 text-sm text-[var(--ink-muted)]">{value}</span>
      )}
      {onClick && !disabled && !danger && (
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
      )}
    </button>
  );
}

function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-sm dark:bg-[var(--glass-strong)]">
      {title && (
        <p className="px-4 pt-3 text-sm font-bold text-[var(--ink)]">{title}</p>
      )}
      <div className="divide-y divide-[color-mix(in_oklab,var(--ink)_8%,transparent)]">
        {children}
      </div>
    </div>
  );
}

export function MobileProfileScreen({
  lang,
  prefs,
  onPrefsChange,
  onOpenProfile,
  onOpenNotifications,
  onNavigate,
  onLangChange,
}: {
  lang: Lang;
  prefs: UserPrefs;
  onPrefsChange: (p: UserPrefs) => void;
  onOpenProfile: () => void;
  onOpenNotifications?: () => void;
  onNavigate: (s: AppSection) => void;
  onLangChange: (l: Lang) => void;
}) {
  const { user, signOut } = useAuth();
  const [layout, setLayout] = useState<ProfileLayoutId>(prefs.profileLayout);
  const [themeOpen, setThemeOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [accessLogOpen, setAccessLogOpen] = useState(false);

  useEffect(() => {
    setLayout(prefs.profileLayout);
  }, [prefs.profileLayout]);

  if (!user) return null;

  const profile = loadUserProfile(user.id, {
    name: user.name,
    email: user.email,
    roleLabel: user.roleLabel,
  });
  const displayName = profile.fullName.trim() || user.name;
  const es = lang === "es";
  const showUsers = canManageCrmUsers(user.role);

  function persistPrefs(patch: Partial<UserPrefs>) {
    if (!user) return;
    const updated = { ...prefs, ...patch };
    saveUserPrefs(user.id, updated);
    onPrefsChange(updated);
  }

  function setProfileLayout(next: ProfileLayoutId) {
    if (!user) return;
    setLayout(next);
    persistPrefs({ profileLayout: next });
  }

  function toggleLang() {
    onLangChange(lang === "es" ? "en" : "es");
  }

  // Selector A/B oculto mientras PROFILE_LAYOUT_B_ENABLED === false (B queda en código).
  const layoutPicker = PROFILE_LAYOUT_B_ENABLED ? (
    <Card title={es ? "Estilo de mi perfil" : "My profile style"}>
      <div className="grid grid-cols-2 gap-2 p-3">
        {(
          [
            ["settings", es ? "Lista" : "List", "A"],
            ["hub", es ? "Hub" : "Hub", "B"],
          ] as const
        ).map(([id, label, letter]) => (
          <button
            key={id}
            type="button"
            onClick={() => setProfileLayout(id)}
            className={cn(
              "rounded-2xl border px-3 py-3 text-left transition",
              layout === id
                ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,white)]"
                : "border-[var(--field-border)] bg-[var(--field-bg)]",
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-white">
              {letter}
            </span>
            <span className="mt-2 block text-xs font-bold text-[var(--ink)]">{label}</span>
            <LayoutTemplate className="mt-1 h-3.5 w-3.5 text-[var(--ink-muted)]" />
          </button>
        ))}
      </div>
    </Card>
  ) : null;

  /** A (settings) fija en UI; B (hub) solo si se reactiva el flag. */
  const activeLayout: ProfileLayoutId = PROFILE_LAYOUT_B_ENABLED
    ? layout
    : "settings";

  const preferencesCard = (
    <Card>
      <Row
        icon={Globe}
        label={es ? "Idioma" : "Language"}
        value={lang === "es" ? "Español" : "English"}
        onClick={toggleLang}
      />
      <div>
        <button
          type="button"
          onClick={() => setThemeOpen((o) => !o)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[var(--ink)] active:bg-[var(--field-bg)]"
          aria-expanded={themeOpen}
        >
          <Palette className="h-5 w-5 shrink-0 text-[var(--ink)]" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 text-sm font-semibold">
            {es ? "Tema" : "Theme"}
          </span>
          <span className="shrink-0 text-sm text-[var(--ink-muted)]">
            {prefs.theme === "light" ? (es ? "Claro" : "Light") : es ? "Oscuro" : "Dark"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform duration-200",
              themeOpen && "rotate-180",
            )}
          />
        </button>
        {themeOpen && (
          <div className="space-y-4 border-t border-[color-mix(in_oklab,var(--ink)_8%,transparent)] bg-[color-mix(in_oklab,var(--ink)_2%,transparent)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {es ? "Modo oscuro" : "Dark mode"}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {prefs.theme === "dark"
                    ? es
                      ? "Oscuro activo"
                      : "Dark on"
                    : es
                      ? "Claro activo"
                      : "Light on"}
                </p>
              </div>
              <AppleSwitch
                checked={prefs.theme === "dark"}
                label={es ? "Modo oscuro" : "Dark mode"}
                onChange={(on) => persistPrefs({ theme: on ? "dark" : "light" })}
              />
            </div>
            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                {es ? "Color de acento" : "Accent color"}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {(Object.keys(ACCENT_PALETTE) as AccentId[]).map((id) => {
                  const pal = ACCENT_PALETTE[id];
                  const swatch = prefs.theme === "light" ? pal.light : pal.dark;
                  const active = prefs.accent === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      title={pal.label}
                      onClick={() => persistPrefs({ accent: id })}
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        className={cn(
                          "h-9 w-9 rounded-full transition",
                          active &&
                            "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--glass-strong)]",
                        )}
                        style={{
                          background: swatch,
                          boxShadow: active
                            ? `0 0 14px ${swatch}`
                            : `0 0 8px color-mix(in srgb, ${swatch} 50%, transparent)`,
                        }}
                      />
                      <span className="text-[10px] font-semibold leading-tight text-[var(--ink-muted)]">
                        {pal.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      <Row
        icon={Bell}
        label={es ? "Notificaciones" : "Notifications"}
        value={es ? "Activas" : "On"}
        onClick={() => onOpenNotifications?.()}
      />
      <Row
        icon={CircleHelp}
        label={es ? "Soporte" : "Support"}
        onClick={() => setSupportOpen(true)}
      />
      <Row
        icon={Settings}
        label={es ? "Ajustes del negocio" : "Business settings"}
        onClick={() => onNavigate("ajustes")}
      />
      {showUsers && (
        <Row
          icon={UsersRound}
          label={es ? "Usuarios y roles" : "Users & roles"}
          onClick={() => onNavigate("usuarios")}
        />
      )}
    </Card>
  );

  /** Tarjeta aparte (con hueco) para no pegarla a Preferencias. */
  const sessionCard = (
    <Card>
      <Row
        icon={Activity}
        label={es ? "Quién se ha conectado" : "Who logged in"}
        value={es ? "Analítica" : "Analytics"}
        onClick={() => setAccessLogOpen(true)}
      />
      <Row
        icon={LogOut}
        label={es ? "Cerrar sesión" : "Sign out"}
        danger
        onClick={() => void signOut()}
      />
    </Card>
  );

  // Layout B — hub centrado (conservado; oculto salvo PROFILE_LAYOUT_B_ENABLED)
  if (activeLayout === "hub") {
    return (
      <>
        <div className="space-y-4 pb-2">
          <div className="relative flex flex-col items-center pt-2 text-center">
            <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-xl font-bold text-white shadow-md">
              {profile.avatarDataUrl ? (
                <img src={profile.avatarDataUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                user.avatarInitial
              )}
            </span>
            <p className="mt-3 text-lg font-bold text-[var(--ink)]">{displayName}</p>
            <p className="text-sm text-[var(--ink-muted)]">{user.email}</p>
            <button
              type="button"
              onClick={onOpenProfile}
              className="mt-3 rounded-full border-2 border-[var(--accent)] px-5 py-2 text-sm font-bold text-[var(--accent)]"
            >
              {es ? "Editar perfil" : "Edit profile"}
            </button>
          </div>
          {layoutPicker}
          <ViewModePicker lang={lang === "es" ? "es" : "en"} variant="inline" />
          <div className="space-y-4">
            {preferencesCard}
            {sessionCard}
          </div>
        </div>
        <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} lang={lang} />
        <MobileAccessLogSheet
          open={accessLogOpen}
          onClose={() => setAccessLogOpen(false)}
          lang={lang === "es" ? "es" : "en"}
        />
      </>
    );
  }

  // Layout A — lista tipo Settings (activa en móvil).
  // Título «Cuenta» y campana viven en el shell: no repetir «Perfil» ni otra campana.
  return (
    <>
      <div className="space-y-4 pb-2">
        <div className="flex items-center gap-3 rounded-[1.25rem] bg-white p-4 shadow-sm dark:bg-[var(--glass-strong)]">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-base font-bold text-white">
            {profile.avatarDataUrl ? (
              <img src={profile.avatarDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              user.avatarInitial
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-[var(--ink)]">{displayName}</p>
            <p className="truncate text-sm text-[var(--ink-muted)]">{user.email}</p>
          </div>
        </div>
        {layoutPicker}
        <ViewModePicker lang={lang === "es" ? "es" : "en"} variant="inline" />
        <div>
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {es ? "Cuenta" : "Account"}
          </p>
          <Card>
            <Row icon={User} label={es ? "Gestionar perfil" : "Manage profile"} onClick={onOpenProfile} />
            <Row
              icon={Shield}
              label={es ? "Contraseña y seguridad" : "Password & security"}
              value={es ? "Próximamente" : "Soon"}
              disabled
            />
          </Card>
        </div>
        <div>
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {es ? "Preferencias" : "Preferences"}
          </p>
          {preferencesCard}
        </div>
        <div>
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {es ? "Sesión" : "Session"}
          </p>
          {sessionCard}
        </div>
      </div>
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} lang={lang} />
      <MobileAccessLogSheet
        open={accessLogOpen}
        onClose={() => setAccessLogOpen(false)}
        lang={lang === "es" ? "es" : "en"}
      />
    </>
  );
}
