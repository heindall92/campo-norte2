import {
  businessWhatsappConfigured,
  clientWaMeUrl,
  formatBusinessWhatsappLabel,
  loadBusinessSettings,
} from "@/lib/business-settings";
import { useNotifications } from "@/lib/notifications";
import { showMobileTicket } from "@/lib/mobile-confirm";
import { resolveIsMobile } from "@/lib/view-mode";
import { cn } from "@/lib/utils";
import { MessageCircle, Settings, ShieldAlert, X } from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";

type Props = {
  clientPhone: string;
  className?: string;
  title?: string;
  children?: ReactNode;
  /** Si true, renderiza como <button> (barra de acciones). Si false, estilo enlace. */
  asButton?: boolean;
};

/**
 * Abre WhatsApp al cliente solo tras confirmar que el PC usa el WhatsApp de negocio del CRM.
 * Si no hay número en Ajustes, muestra aviso (popup) + notificación.
 */
export function WhatsAppSecureLink({
  clientPhone,
  className,
  title = "WhatsApp",
  children,
  asButton = true,
}: Props) {
  const { push } = useNotifications();
  const [open, setOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [bizLabel, setBizLabel] = useState("");

  function goToSettings() {
    setBlockedOpen(false);
    window.dispatchEvent(new CustomEvent("mps-navigate", { detail: "ajustes" }));
  }

  function requestOpen(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const business = loadBusinessSettings();
    if (!businessWhatsappConfigured(business)) {
      push({
        kind: "system",
        tone: "warn",
        actor: "WhatsApp",
        statusLabel: "BLOQUEADO",
        body: "Configura el WhatsApp de negocio en Ajustes antes de escribir a clientes",
        detail: "Ajustes → Datos del negocio",
        section: "ajustes",
      });

      if (resolveIsMobile()) {
        showMobileTicket({
          title: "WhatsApp no configurado",
          subtitle: "Canal de negocio pendiente",
          headline: "Falta el número en Ajustes",
          meta: "Sin WhatsApp de negocio no se abre el chat",
          fields: [
            {
              label: "Qué hacer",
              value: "Ajustes → Datos del negocio → WhatsApp (mín. 9 dígitos)",
            },
            {
              label: "Cliente",
              value: clientPhone || "—",
            },
          ],
          chips: ["Bloqueado", "Humano en el loop"],
          primaryLabel: "Ir a Ajustes",
          navigateTo: "ajustes",
        });
      } else {
        setBlockedOpen(true);
      }
      return;
    }

    setBizLabel(formatBusinessWhatsappLabel(business));
    setConfirmed(false);
    setOpen(true);
  }

  function proceed() {
    if (!confirmed) return;
    const url = clientWaMeUrl(clientPhone);
    window.open(url, "_blank", "noopener,noreferrer");
    push({
      kind: "system",
      tone: "ok",
      actor: clientPhone,
      statusLabel: "WHATSAPP",
      body: "Has abierto WhatsApp para seguimiento humano",
      detail: `Desde negocio ${bizLabel} → ${clientPhone}`,
    });
    setOpen(false);
    setConfirmed(false);
  }

  return (
    <>
      {asButton ? (
        <button
          type="button"
          title={title}
          onClick={requestOpen}
          className={cn(
            "rounded-lg border border-[color-mix(in_oklab,#16a34a_35%,transparent)] bg-[color-mix(in_oklab,#16a34a_12%,transparent)] p-2 text-[#15803d] hover:opacity-90",
            className,
          )}
        >
          {children ?? <MessageCircle className="h-4 w-4" />}
        </button>
      ) : (
        <button
          type="button"
          title={title}
          onClick={requestOpen}
          className={cn(
            "mt-1 inline-flex items-center gap-1 font-semibold text-[var(--accent)]",
            className,
          )}
        >
          {children}
        </button>
      )}

      {blockedOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[color-mix(in_oklab,#0f172a_45%,transparent)] p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wa-blocked-title"
          onClick={(e) => {
            e.stopPropagation();
            setBlockedOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warn-ink)]" />
                <div>
                  <h3
                    id="wa-blocked-title"
                    className="font-[family-name:var(--mps-display)] text-lg text-[var(--ink)]"
                  >
                    WhatsApp no configurado
                  </h3>
                  <p className="mt-1 text-sm text-[var(--ink-muted)] text-pretty">
                    Configura el WhatsApp de negocio en Ajustes antes de escribir a clientes. Sin
                    ese número el CRM no abre el chat.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setBlockedOpen(false)}
                className="rounded-lg p-1 text-[var(--ink-muted)] hover:bg-[var(--glass)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3 text-sm text-[var(--ink)]">
              <p>
                <span className="text-[var(--ink-muted)]">Ruta:</span>{" "}
                <strong>Ajustes → Datos del negocio → WhatsApp</strong>
              </p>
              <p className="mt-1">
                <span className="text-[var(--ink-muted)]">Cliente:</span>{" "}
                <strong>{clientPhone || "—"}</strong>
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setBlockedOpen(false)}
                className="rounded-xl border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={goToSettings}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
              >
                <Settings className="h-4 w-4" />
                Ir a Ajustes
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[color-mix(in_oklab,#0f172a_45%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wa-secure-title"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warn-ink,var(--accent))]" />
                <div>
                  <h3
                    id="wa-secure-title"
                    className="font-[family-name:var(--mps-display)] text-lg text-[var(--ink)]"
                  >
                    Confirmar WhatsApp de negocio
                  </h3>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    El CRM no puede leer qué cuenta hay en WhatsApp Desktop. Confirma que este
                    ordenador usa el número registrado antes de escribir al cliente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-[var(--ink-muted)] hover:bg-[var(--glass)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 space-y-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3 text-sm">
              <p>
                <span className="text-[var(--ink-muted)]">Negocio registrado:</span>{" "}
                <strong className="text-[var(--ink)]">{bizLabel}</strong>
              </p>
              <p>
                <span className="text-[var(--ink-muted)]">Cliente:</span>{" "}
                <strong className="text-[var(--ink)]">{clientPhone}</strong>
              </p>
            </div>

            <label className="mb-4 flex items-start gap-2 text-sm text-[var(--ink)]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                Confirmo que WhatsApp de este ordenador está logueado con el número / @alias de
                negocio del CRM. No enviaré desde otra cuenta personal.
              </span>
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!confirmed}
                onClick={proceed}
                className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                <MessageCircle className="h-4 w-4" />
                Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
