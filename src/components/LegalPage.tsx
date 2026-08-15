import { COMPANY } from "@/lib/assumptions";
import { LEGAL_UPDATED, legalSections, type LegalSectionId } from "@/lib/legal-copy";
import { cn } from "@/lib/utils";
import { ArrowLeft, Scale } from "lucide-react";
import { useEffect, useState } from "react";

const TABS: LegalSectionId[] = ["aviso", "privacidad", "cookies"];

export function LegalPage({ lang = "es" }: { lang?: "es" | "en" }) {
  const [tab, setTab] = useState<LegalSectionId>(() => {
    const hash = window.location.hash.replace("#", "") as LegalSectionId;
    return TABS.includes(hash) ? hash : "aviso";
  });

  useEffect(() => {
    window.location.hash = tab;
  }, [tab]);

  const section = legalSections[tab];
  const paragraphs = lang === "en" ? section.paragraphsEn : section.paragraphsEs;
  const title = lang === "en" ? section.titleEn : section.titleEs;

  return (
    <div className="mps-crm mps-bg min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl">
        <a
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "es" ? "Volver al Growth OS" : "Back to Growth OS"}
        </a>

        <header className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
            <Scale className="h-5 w-5" />
          </div>
          <h1 className="font-[family-name:var(--mps-display)] text-3xl text-[var(--ink)]">
            {lang === "es" ? "Legal · Privacidad · Cookies" : "Legal · Privacy · Cookies"}
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            {COMPANY.legal} · {lang === "es" ? "Actualizado" : "Updated"} {LEGAL_UPDATED}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {lang === "es"
              ? "Documento orientativo para el CRM interno. Validar con asesoría legal antes de producción real."
              : "Guidance for the internal CRM. Validate with counsel before real production."}
          </p>
        </header>

        <div className="mb-5 flex flex-wrap gap-2">
          {TABS.map((id) => {
            const s = legalSections[id];
            const label = lang === "en" ? s.titleEn : s.titleEs;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                  tab === id
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--glass-border)] bg-[var(--glass)] text-[var(--ink)] hover:border-[var(--accent)]",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <article className="glass-panel rounded-3xl border border-[var(--glass-border)] p-6 md:p-8">
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
            {title}
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--ink-muted)]">
            {paragraphs.map((p) => (
              <p key={p.slice(0, 48)}>{p}</p>
            ))}
          </div>
        </article>

        <p className="mt-8 text-center text-xs text-[var(--ink-muted)]">
          {COMPANY.tagline}
        </p>
      </div>
    </div>
  );
}
