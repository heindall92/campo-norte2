import {
  ACCENT_PALETTE,
  applyUserPrefsToDocument,
  loadUserPrefs,
  saveUserPrefs,
  type AccentId,
  type UiTheme,
  type UserPrefs,
} from "@/lib/user-prefs";
import { Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function AppearanceCard({
  lang,
  userId,
  onPrefsChange,
}: {
  lang: Lang;
  userId: string;
  onPrefsChange?: (prefs: UserPrefs) => void;
}) {
  const [prefs, setPrefs] = useState<UserPrefs>(() => loadUserPrefs(userId));

  useEffect(() => {
    setPrefs(loadUserPrefs(userId));
  }, [userId]);

  function persist(next: UserPrefs) {
    setPrefs(next);
    saveUserPrefs(userId, next);
    applyUserPrefsToDocument(next);
    onPrefsChange?.(next);
  }

  return (
    <Card
      title={lang === "es" ? "Apariencia" : "Appearance"}
      subtitle={
        lang === "es"
          ? "Tema y color de acento de tu sesión (no afecta a otros usuarios)."
          : "Theme and accent for your session only (does not affect other users)."
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Tema" : "Theme"}
          </p>
          <div className="flex max-w-sm gap-1 rounded-full border border-[var(--field-border)] bg-[var(--field-bg)] p-1">
            {(["light", "dark"] as UiTheme[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => persist({ ...prefs, theme: t })}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition",
                  prefs.theme === t
                    ? "bg-[var(--accent)] text-white shadow-[0_0_16px_color-mix(in_oklab,var(--accent)_40%,transparent)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
                )}
              >
                {t === "light"
                  ? lang === "es"
                    ? "Claro"
                    : "Light"
                  : lang === "es"
                    ? "Oscuro"
                    : "Dark"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Color de acento" : "Accent color"}
          </p>
          <div className="grid max-w-lg grid-cols-4 gap-3 sm:grid-cols-8">
            {(Object.keys(ACCENT_PALETTE) as AccentId[]).map((id) => {
              const pal = ACCENT_PALETTE[id];
              const swatch = prefs.theme === "light" ? pal.light : pal.dark;
              const active = prefs.accent === id;
              return (
                <button
                  key={id}
                  type="button"
                  title={pal.label}
                  onClick={() => persist({ ...prefs, accent: id })}
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
                        ? `0 0 18px ${swatch}`
                        : `0 0 10px color-mix(in srgb, ${swatch} 55%, transparent)`,
                    }}
                  />
                  <span className="text-[10px] font-semibold text-[var(--ink-muted)]">
                    {pal.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[var(--ink-muted)]">
            {lang === "es"
              ? "Por defecto: modo claro · Azul eléctrico"
              : "Default: light mode · Electric blue"}
          </p>
        </div>
      </div>
    </Card>
  );
}
