import { COMPANY } from "@/lib/assumptions";
import { Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import { BookOpen, CircleHelp, ExternalLink } from "lucide-react";

export function SupportCard({ lang }: { lang: Lang }) {
  return (
    <Card
      title={lang === "es" ? "Soporte" : "Support"}
      subtitle={
        lang === "es"
          ? "Ayuda interna del Growth OS · equipo Campo Norte"
          : "Internal Growth OS help · Campo Norte team"
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--accent)]">
            <CircleHelp className="h-5 w-5" />
          </span>
          <p className="text-sm text-[var(--ink-muted)] text-pretty">
            {lang === "es"
              ? `${COMPANY.name} Growth OS es el CRM interno del equipo. La tecnología clasifica; nunca escribe al viajero. Si necesitas ayuda de configuración, contacta al Admin / CEO.`
              : `${COMPANY.name} Growth OS is the internal team CRM. Tech ranks; never messages travellers. For setup help, contact Admin / CEO.`}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <a
            href={COMPANY.website}
            target="_blank"
            rel="noreferrer"
            className="mps-choice flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-[var(--accent)]"
          >
            <span>{lang === "es" ? `Web · ${COMPANY.name}` : `Website · ${COMPANY.name}`}</span>
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href="/legal#aviso"
            className="mps-choice flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-[var(--accent)]"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {lang === "es" ? "Documentación legal" : "Legal docs"}
            </span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <ul className="space-y-2 text-sm text-[var(--ink)]">
          {(lang === "es"
            ? [
                ["Hub / Dashboard", "KPIs y datos vivos del equipo."],
                ["Leads · Clientes", "Clasificación humana + IA interna."],
                ["WhatsApp", "Solo desde el número de negocio confirmado."],
                ["Roles", "Cada sesión ve solo las secciones de su rol."],
              ]
            : [
                ["Hub / Dashboard", "Live team KPIs and data."],
                ["Leads · Clients", "Human ranking + internal AI."],
                ["WhatsApp", "Only from the confirmed business number."],
                ["Roles", "Each session only sees its allowed sections."],
              ]
          ).map(([t, d]) => (
            <li key={t} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>
                <strong>{t}:</strong>{" "}
                <span className="text-[var(--ink-muted)]">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
