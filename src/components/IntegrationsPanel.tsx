import { useMemo, useState } from "react";

import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import type { Lang } from "@/lib/i18n";
import {
  INTEGRATION_CATEGORY_LABEL,
  listIntegrationsByCategory,
  setIntegrationConnected,
  type IntegrationStatus,
} from "@/lib/integrations";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<IntegrationStatus, StatusTone> = {
  conectado: "positive",
  parcial: "warning",
  no_conectado: "neutral",
};

const STATUS_LABEL: Record<IntegrationStatus, { es: string; en: string }> = {
  conectado: { es: "Conectado", en: "Connected" },
  parcial: { es: "Parcial", en: "Partial" },
  no_conectado: { es: "No conectado", en: "Not connected" },
};

interface IntegrationsPanelProps {
  lang?: Lang;
  className?: string;
}

/**
 * Catálogo de integraciones — patrón de la demo de referencia,
 * cableado a Stripe/Brevo/Supabase/WhatsApp/n8n del ecosistema Campo Norte.
 */
export function IntegrationsPanel({ lang = "es", className }: IntegrationsPanelProps) {
  const [tick, setTick] = useState(0);
  const groups = useMemo(() => {
    void tick;
    return listIntegrationsByCategory();
  }, [tick]);

  return (
    <div className={cn("space-y-5", className)}>
      <header>
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {lang === "es" ? "Integraciones" : "Integrations"}
        </h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {lang === "es"
            ? "Conecta las piezas del ecosistema. La IA y los flujos nunca escriben solos al viajero."
            : "Connect ecosystem pieces. AI and flows never write to the traveller alone."}
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.category} className="space-y-3">
          <div className="flex items-center gap-2">
            <h4
              className="text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {lang === "es"
                ? INTEGRATION_CATEGORY_LABEL[g.category].es
                : INTEGRATION_CATEGORY_LABEL[g.category].en}
            </h4>
            <StatusBadge tone="info">{g.items.length}</StatusBadge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.items.map((item) => (
              <article key={item.id} className="glass-panel flex flex-col gap-3 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {item.name}
                    </p>
                    <StatusBadge tone={STATUS_TONE[item.status]} className="mt-1">
                      {lang === "es" ? STATUS_LABEL[item.status].es : STATUS_LABEL[item.status].en}
                    </StatusBadge>
                  </div>
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {lang === "es" ? item.descriptionEs : item.descriptionEn}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {item.href !== "#" ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mps-choice rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      {lang === "es" ? "Abrir" : "Open"}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => {
                      setIntegrationConnected(item.id, item.status !== "conectado");
                      setTick((n) => n + 1);
                    }}
                  >
                    {item.status === "conectado"
                      ? lang === "es"
                        ? "Desconectar"
                        : "Disconnect"
                      : lang === "es"
                        ? "Marcar conectado"
                        : "Mark connected"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
