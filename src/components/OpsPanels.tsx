import { ViewTotals } from "@/components/ui/ViewTotals";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { askAboutInvoice, requestAsk } from "@/lib/ai/ask-bus";
import { N8nFlowBuilder } from "@/components/N8nFlowBuilder";
import { blankReservation, ReservationFormModal } from "@/components/ReservationFormModal";
import { EntityActionBar } from "@/components/EntityActionBar";
import { WhatsAppSecureLink } from "@/components/WhatsAppSecureLink";
import { showMobileTicket } from "@/lib/mobile-confirm";
import {
  aiReady,
  providerLabel,
  runLeadCapturePipeline,
  type LeadPipelineResult,
  type WebFormLeadPayload,
} from "@/lib/ai";
import {
  EXPERIENCE_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  ROUTE_LABEL,
  SEGMENT_LABEL,
  STATUS_LABEL,
  type Client,
  type RouteCode,
  type VehicleMode,
} from "@/lib/demo-data";
import { useDataHub } from "@/lib/data";
import { useNotifications } from "@/lib/notifications";
import { GESTORIA_EXPORT_FIELDS, LEGAL_CITATIONS, VERIFACTU_CHECKLIST } from "@/lib/legal-verifactu";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { buildInvoiceAlerts } from "@/lib/invoice-alerts";
import { formatEur } from "@/lib/format";
import {
  INVOICE_STATUS_LABEL,
  PAYMENT_LABEL,
  RESERVATION_STATUS_LABEL,
  downloadGestoriaPack,
  type Reservation,
  type ReservationStatus,
} from "@/lib/ops-data";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  Copy,
  Download,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Scale,
  Search,
  Sparkles,
  Utensils,
  Zap,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

function statusSelectClass(status: ReservationStatus) {
  if (status === "reservado" || status === "prep_viaje" || status === "en_curso") {
    return "border-[color-mix(in_oklab,var(--ok)_45%,transparent)] bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] text-[var(--ok)]";
  }
  if (status === "docs_pendientes") {
    return "border-[color-mix(in_oklab,var(--warn-ink)_45%,transparent)] bg-[var(--warn-bg)] text-[var(--warn-ink)]";
  }
  return "border-[var(--glass-border)] bg-[var(--glass-strong)] text-[var(--ink)]";
}

function euro(n: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : "es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "good" | "warn" | "bad" | "brand" | "neutral";
}) {
  const tones = {
    good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    warn: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
    bad: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    brand: "bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--accent)] border-[color-mix(in_oklab,var(--accent)_35%,transparent)]",
    neutral: "bg-[var(--glass)] text-[var(--ink-muted)] border-[var(--glass-border)]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-4 shadow-[var(--shadow)] backdrop-blur-md md:p-5">
      {(title || action) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && (
              <h3 className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)] md:text-2xl">
                {title}
              </h3>
            )}
            {subtitle && <p className="mt-1 text-sm text-[var(--ink-muted)]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}



/** Ecosistema CRM: orquestación real A-01 + editor visual estilo n8n */
export function AutomationsEcosystemPanel({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  const { push } = useNotifications();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LeadPipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<WebFormLeadPayload>({
    name: "Pedro Ruiz",
    email: "pedro.ruiz.demo@example.com",
    phone: "+34 600 99 88 77",
    utmSource: "instagram",
    utmCampaign: "namibia-2026",
    utmMedium: "paid_social",
    interestRoute: "NAMIBIA",
    vehicle: "4x4",
    message: "Interés Namibia · presupuesto alto",
  });

  async function runPipeline() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const pipeline = await runLeadCapturePipeline(form, hub.leads, {
        clients: hub.clients,
      });
      await hub.saveLead(pipeline.lead);
      push({
        kind: "lead",
        tone: pipeline.lead.score >= 80 ? "ok" : "info",
        actor: pipeline.notification.actor,
        statusLabel: pipeline.notification.statusLabel,
        body: pipeline.notification.body,
        detail: pipeline.notification.detail,
        section: "leads",
        entityId: pipeline.lead.id,
      });
      setResult(pipeline);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const routes = Object.keys(ROUTE_LABEL) as RouteCode[];

  return (
    <div className="space-y-5">
      <Card
        title={
          lang === "es"
            ? "Orquestación A-01 · formulario → Ollama → seguimiento"
            : "A-01 orchestration · form → Ollama → follow-up"
        }
        subtitle={
          lang === "es"
            ? "Ejecución real en el Hub (backstage). Sin intervención humana en la tubería. El equipo solo recibe el aviso. Nunca escribe al viajero."
            : "Live Hub execution (backstage). No human in the pipeline. Team only gets the alert. Never messages the traveller."
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-[var(--glass-border)] px-2.5 py-1 font-semibold text-[var(--ink)]">
            Formulario → Lead → Dedupe → IA → Origen → Dashboard → Aviso → Seguimiento
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 font-semibold",
              aiReady()
                ? "bg-[color-mix(in_oklab,var(--ok)_18%,transparent)] text-[var(--ok)]"
                : "bg-[var(--glass)] text-[var(--ink-muted)]",
            )}
          >
            {aiReady()
              ? `${providerLabel()} API`
              : lang === "es"
                ? "Heurística (activa IA en Ajustes)"
                : "Heuristic (enable AI in Settings)"}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
              {lang === "es" ? "Nombre" : "Name"}
              <input
                className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
              Email
              <input
                className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
                utm_source
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                  value={form.utmSource ?? ""}
                  onChange={(e) => setForm({ ...form, utmSource: e.target.value })}
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
                utm_campaign
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                  value={form.utmCampaign ?? ""}
                  onChange={(e) => setForm({ ...form, utmCampaign: e.target.value })}
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
                Destino
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                  value={form.interestRoute ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      interestRoute: (e.target.value || null) as RouteCode | null,
                    })
                  }
                >
                  <option value="">—</option>
                  {routes.map((r) => (
                    <option key={r} value={r}>
                      {ROUTE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
              {lang === "es" ? "Vehículo" : "Vehicle"}
              <select
                className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                value={form.vehicle ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vehicle: (e.target.value || null) as VehicleMode | null,
                  })
                }
              >
                <option value="">—</option>
                <option value="moto">moto</option>
                <option value="4x4">4x4</option>
              </select>
            </label>
            <button
              type="button"
              disabled={running}
              onClick={() => void runPipeline()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {lang === "es"
                ? "Ejecutar flujo (sin intervención humana)"
                : "Run flow (no human intervention)"}
            </button>
            <p className="text-xs text-[var(--ink-muted)]">
              {lang === "es"
                ? "Equivalente a webhook Make/n8n → este pipeline. Exporta el canvas JSON para el mismo flujo en n8n real."
                : "Same as a Make/n8n webhook → this pipeline. Export canvas JSON for the real n8n flow."}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-4">
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            {!result && !error && (
              <p className="text-sm text-[var(--ink-muted)]">
                {lang === "es"
                  ? "Pulsa ejecutar. Verás cada paso del log y el lead quedará en Lead Intelligence + notificación al owner."
                  : "Hit run. You’ll see each log step; the lead lands in Lead Intelligence + owner notification."}
              </p>
            )}
            {result && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{result.lead.id}</Badge>
                  <Badge tone={result.lead.score >= 80 ? "good" : "warn"}>
                    score {result.lead.score}
                  </Badge>
                  <Badge>{result.engine}</Badge>
                  {result.wasDuplicate && (
                    <Badge tone="warn">{lang === "es" ? "merge" : "merge"}</Badge>
                  )}
                  <span className="text-xs text-[var(--ink-muted)]">
                    → {result.owner} · follow-up {result.followUpAt.slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                <ol className="space-y-2">
                  {result.steps.map((s) => (
                    <li
                      key={`${s.id}-${s.at}`}
                      className="rounded-lg border border-[var(--glass-border)] bg-[color-mix(in_oklab,var(--bg0)_40%,transparent)] px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                        {s.status === "ok" ? (
                          <CheckCircle2 className="h-4 w-4 text-[var(--ok)]" />
                        ) : s.status === "warn" ? (
                          <Sparkles className="h-4 w-4 text-[var(--warn-ink)]" />
                        ) : (
                          <Circle className="h-4 w-4 text-[var(--ink-muted)]" />
                        )}
                        {s.label}
                      </div>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">{s.detail}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        title={lang === "es" ? "Ecosistema CRM · editor de flujos" : "CRM ecosystem · flow editor"}
        subtitle={
          lang === "es"
            ? "Canvas arrastrar y soltar estilo n8n/Make: crear, editar y exportar JSON. A-01 ya incluye el nodo «Clasificar con IA (Ollama)»."
            : "n8n/Make-style canvas: create, edit and export JSON. A-01 already includes the «Classify with AI (Ollama)» node."
        }
      >
        <p className="mb-4 text-sm leading-relaxed text-[var(--ink-muted)]">
          Web/UTM → <strong className="text-[var(--ink)]">Data Hub</strong> → Score Ollama → Lead /
          Customer Intelligence → Reserva + logística → Cobros → Factura REAV / Veri*FACTU → Export
          gestoría → Dashboard · Content · Knowledge.{" "}
          <span className="text-[var(--accent)]">
            {lang === "es" ? "Nunca escribe al cliente." : "Never messages the customer."}
          </span>
        </p>
        <N8nFlowBuilder lang={lang} />
        <aside className="mt-5 rounded-2xl border border-[var(--glass-border)] bg-[color-mix(in_oklab,var(--accent)_6%,var(--glass))] p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
            {lang === "es" ? "Qué decir si te preguntan" : "What to say if they ask"}
          </p>
          <blockquote className="mt-2 border-l-4 border-[var(--accent)] pl-4 text-sm leading-relaxed text-[var(--ink)]">
            {lang === "es" ? (
              <>
                «La automatización de captura de leads (A-01) ya tiene toda la lógica de negocio
                construida y probada dentro del CRM — dedupe, scoring, asignación, aviso. Lo que falta
                para que corra sola es conectar el formulario real de la web a ese pipeline, que es
                trabajo de fontanería (un webhook), no de diseño. El resto de automatizaciones del
                roadmap están especificadas y dibujadas como flujo, listas para implementarse fase a
                fase — así evitamos construir 12 integraciones antes de validar que la primera
                funciona.»
              </>
            ) : (
              <>
                “Lead capture automation (A-01) already has the full business logic built and tested
                inside the CRM — dedupe, scoring, assignment, alert. What’s left for it to run on its
                own is wiring the real website form into that pipeline — plumbing (a webhook), not
                design. The rest of the roadmap automations are specified and drawn as flows, ready to
                implement phase by phase — so we don’t build 12 integrations before proving the first
                one works.”
              </>
            )}
          </blockquote>
        </aside>
      </Card>
    </div>
  );
}

export function ReservationsPanel({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  const reservations = hub.reservations;
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReservationStatus>("all");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; reservation: Reservation } | null>(
    null,
  );

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!query) return true;
      return (
        r.clientName.toLowerCase().includes(query) ||
        r.id.toLowerCase().includes(query) ||
        r.tripName.toLowerCase().includes(query) ||
        ROUTE_LABEL[r.route].toLowerCase().includes(query) ||
        r.tourLeader.toLowerCase().includes(query)
      );
    });
  }, [q, reservations, statusFilter]);

  const viewAgg = useMemo(() => {
    let total = 0;
    let pending = 0;
    let pax = 0;
    for (const r of list) {
      total += r.totalAmount;
      pending += Math.max(0, r.totalAmount - r.depositPaid);
      pax += r.pax;
    }
    return { total, pending, pax, count: list.length };
  }, [list]);

  async function saveReservation(r: Reservation) {
    await hub.saveReservation(r);
    setOpenId(r.id);
    setModal(null);
    showMobileTicket({
      title: lang === "es" ? "Reserva confirmada" : "Booking confirmed",
      subtitle: lang === "es" ? "Operación registrada" : "Operation recorded",
      headline: r.tripName || r.clientName,
      meta: r.clientName,
      fields: [
        {
          label: lang === "es" ? "Salida" : "Departure",
          value: r.departureAt || r.bookedAt || "—",
        },
        { label: lang === "es" ? "Ruta" : "Route", value: ROUTE_LABEL[r.route] || r.route },
        { label: lang === "es" ? "Estado" : "Status", value: String(r.status || "—") },
        {
          label: lang === "es" ? "Pago" : "Payment",
          value: String(r.paymentChannel || "—"),
        },
      ],
      chips: [String(r.status), String(r.paymentChannel), `${r.pax} pax`].filter(Boolean),
      primaryLabel: lang === "es" ? "Hecho" : "Done",
    });
  }

  async function deleteReservation(id: string) {
    const ok = window.confirm(
      lang === "es"
        ? "¿Eliminar esta reserva y toda su logística? Knowledge y Content Factory dejan de tener esta fuente."
        : "Delete this booking and all its logistics? Knowledge and Content Factory lose this source.",
    );
    if (!ok) return;
    await hub.deleteReservation(id);
    if (openId === id) setOpenId(null);
  }

  function duplicateReservation(r: Reservation) {
    const copy: Reservation = {
      ...structuredClone(r),
      id: `R-${4800 + Math.floor(Math.random() * 900)}`,
      status: "reservado",
      bookedAt: new Date().toISOString().slice(0, 10),
      internalNotes:
        (lang === "es" ? `Duplicada de ${r.id}. ` : `Duplicated from ${r.id}. `) + r.internalNotes,
    };
    setModal({ mode: "create", reservation: copy });
  }

  async function patchReservation(id: string, patch: Partial<Reservation>) {
    const current = reservations.find((r) => r.id === id);
    if (!current) return;
    await hub.saveReservation({ ...current, ...patch });
  }

  async function togglePrep(id: string, index: number) {
    const current = reservations.find((r) => r.id === id);
    if (!current) return;
    const prep = current.prep.map((p, i) => (i === index ? { ...p, done: !p.done } : p));
    await hub.saveReservation({ ...current, prep });
  }

  const statuses = Object.keys(RESERVATION_STATUS_LABEL) as ReservationStatus[];

  return (
    <div className="space-y-5">
      <Card
        title={lang === "es" ? "Reservas · logística · prep viaje" : "Bookings · logistics · trip prep"}
        subtitle={
          lang === "es"
            ? "Fuente de verdad operativa: aquí se crean, editan y eliminan reservas. Lodges, comidas, contactos y prep alimentan Knowledge y el resto del CRM."
            : "Operational source of truth: create, edit and delete bookings here. Lodges, meals, contacts and prep feed Knowledge and the rest of the CRM."
        }
        action={
          <button
            type="button"
            onClick={() => setModal({ mode: "create", reservation: blankReservation() })}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {lang === "es" ? "Nueva reserva" : "New booking"}
          </button>
        }
      >
        <div className="mb-4 rounded-xl border border-[color-mix(in_oklab,var(--accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-3 py-2.5 text-sm text-[var(--ink)]">
          {lang === "es"
            ? "Gestiona cada ficha con Editar / Duplicar / Eliminar (siempre visibles). El checklist se marca en vivo; el detalle completo se abre en el modal."
            : "Manage each record with Edit / Duplicate / Delete (always visible). Checklist toggles live; full detail opens in the modal."}
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                lang === "es"
                  ? "Buscar por cliente, reserva, destino o TL…"
                  : "Search by client, booking, destination or TL…"
              }
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] py-2.5 pl-10 pr-3 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--ink-muted)] focus:ring-2"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | ReservationStatus)}
              className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-[var(--ink)]"
            >
              <option value="all">{lang === "es" ? "Todos los estados" : "All statuses"}</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {RESERVATION_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <Badge tone="brand">
              {list.length}/{reservations.length} {lang === "es" ? "reservas" : "bookings"}
            </Badge>
          </div>
        </div>

        <ViewTotals
          className="mb-4"
          headline={{
            label: lang === "es" ? "Importe (vista)" : "Amount (view)",
            value: euro(viewAgg.total, lang),
          }}
          totals={[
            {
              label: lang === "es" ? "Pendiente cobro" : "Outstanding",
              value: euro(viewAgg.pending, lang),
              tone: "negative",
            },
            { label: "Pax", value: String(viewAgg.pax) },
            {
              label: lang === "es" ? "Reservas" : "Bookings",
              value: String(viewAgg.count),
            },
          ]}
        />

        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--glass-border)] px-4 py-10 text-center">
            <p className="text-sm text-[var(--ink-muted)]">
              {lang === "es"
                ? "No hay reservas con este filtro. Crea una para empezar a alimentar logística y Knowledge."
                : "No bookings match this filter. Create one to start feeding logistics and Knowledge."}
            </p>
            <button
              type="button"
              onClick={() => setModal({ mode: "create", reservation: blankReservation() })}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              {lang === "es" ? "Crear primera reserva" : "Create first booking"}
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((r) => {
              const open = openId === r.id;
              const prepDone = r.prep.filter((p) => p.done).length;
              return (
                <li
                  key={r.id}
                  className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-sm"
                >
                  {/* Misma composición que Inteligencia de clientes: info izq · badges/acciones der */}
                  <div className="flex w-full flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="w-full text-left"
                      >
                        <p className="truncate font-semibold text-[var(--ink)]">
                          {r.clientName}{" "}
                          <span className="font-mono text-xs font-normal text-[var(--ink-muted)]">
                            {r.id}
                          </span>
                        </p>
                        <p className="mt-1 truncate text-sm text-[var(--ink-muted)]">
                          {r.tripName} · {r.vehicle} · {r.pax} pax
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--accent)]"
                      >
                        {open
                          ? lang === "es"
                            ? "Ocultar logística"
                            : "Hide logistics"
                          : lang === "es"
                            ? "Ver logística"
                            : "View logistics"}
                        <ChevronDown
                          className={cn("h-3.5 w-3.5 transition", open && "rotate-180")}
                        />
                      </button>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <select
                          id={`status-${r.id}`}
                          value={r.status}
                          aria-label={lang === "es" ? "Estado" : "Status"}
                          onChange={(e) =>
                            void patchReservation(r.id, {
                              status: e.target.value as ReservationStatus,
                            })
                          }
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold outline-none",
                            statusSelectClass(r.status),
                          )}
                        >
                          {statuses.map((s) => (
                            <option key={s} value={s}>
                              {RESERVATION_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <Badge tone="neutral">{PAYMENT_LABEL[r.paymentChannel]}</Badge>
                        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[var(--ink)]">
                          {euro(r.depositPaid, lang)} / {euro(r.totalAmount, lang)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 self-stretch sm:justify-end sm:self-end">
                        <button
                          type="button"
                          onClick={() => duplicateReservation(r)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2.5 py-2 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {lang === "es" ? "Duplicar" : "Duplicate"}
                        </button>
                        <EntityActionBar
                          className="justify-end"
                          phone={r.clientPhone}
                          onEdit={() =>
                            setModal({ mode: "edit", reservation: structuredClone(r) })
                          }
                          onDelete={() => void deleteReservation(r.id)}
                        />
                      </div>
                    </div>
                  </div>

                  {open && (
                    <div className="space-y-4 border-t border-[var(--glass-border)] px-4 pb-4 pt-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-[var(--glass-border)] p-3 text-sm">
                          <p className="text-[10px] uppercase text-[var(--ink-muted)]">
                            {lang === "es" ? "Salida" : "Departure"}
                          </p>
                          <p className="mt-1 font-semibold text-[var(--ink)]">{r.departureAt || "—"}</p>
                          <p className="text-[var(--ink-muted)]">TL: {r.tourLeader}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--glass-border)] p-3 text-sm">
                          <p className="text-[10px] uppercase text-[var(--ink-muted)]">Prep</p>
                          <p className="mt-1 font-semibold text-[var(--ink)]">
                            {prepDone}/{r.prep.length}
                          </p>
                        </div>
                        <div className="rounded-xl border border-[var(--glass-border)] p-3 text-sm">
                          <p className="text-[10px] uppercase text-[var(--ink-muted)]">WhatsApp</p>
                          <WhatsAppSecureLink
                            clientPhone={r.clientPhone}
                            asButton={false}
                            className="mt-1"
                          >
                            <Phone className="h-3.5 w-3.5" /> {r.clientPhone}
                          </WhatsAppSecureLink>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                            <Building2 className="h-3.5 w-3.5" />
                            {lang === "es" ? "Contactos logística" : "Logistics contacts"}
                          </p>
                          <button
                            type="button"
                            onClick={() => setModal({ mode: "edit", reservation: structuredClone(r) })}
                            className="text-xs font-semibold text-[var(--accent)]"
                          >
                            {lang === "es" ? "Gestionar contactos" : "Manage contacts"}
                          </button>
                        </div>
                        <ul className="grid gap-2 md:grid-cols-2">
                          {r.logisticsContacts.map((c) => (
                            <li
                              key={c.name + c.role}
                              className="rounded-lg border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--ink)]"
                            >
                              <p className="font-medium">{c.role}</p>
                              <p>{c.name}</p>
                              <p className="text-[var(--ink-muted)]">
                                {c.phone}
                                {c.email ? ` · ${c.email}` : ""}
                              </p>
                              {c.notes && (
                                <p className="mt-1 text-xs text-[var(--ink-muted)]">{c.notes}</p>
                              )}
                            </li>
                          ))}
                          {r.logisticsContacts.length === 0 && (
                            <li className="text-sm text-[var(--ink-muted)]">
                              {lang === "es" ? "Sin contactos — añádelos al modificar." : "No contacts — add them when editing."}
                            </li>
                          )}
                        </ul>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                            <MapPin className="h-3.5 w-3.5" />
                            {lang === "es" ? "Alojamiento y comidas" : "Lodging & meals"}
                          </p>
                          <button
                            type="button"
                            onClick={() => setModal({ mode: "edit", reservation: structuredClone(r) })}
                            className="text-xs font-semibold text-[var(--accent)]"
                          >
                            {lang === "es" ? "Gestionar itinerario" : "Manage itinerary"}
                          </button>
                        </div>
                        <ul className="space-y-2">
                          {r.itinerary.map((s) => (
                            <li
                              key={s.day + s.place}
                              className="rounded-lg border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--ink)]"
                            >
                              <p className="font-medium">
                                {s.day} · {s.place}
                              </p>
                              <p className="text-[var(--ink-muted)]">
                                {lang === "es" ? "Alojamiento:" : "Stay:"} {s.lodging}
                              </p>
                              <p className="flex items-center gap-1 text-[var(--ink-muted)]">
                                <Utensils className="h-3.5 w-3.5" /> {s.meals}
                              </p>
                            </li>
                          ))}
                          {r.itinerary.length === 0 && (
                            <li className="text-sm text-[var(--ink-muted)]">
                              {lang === "es" ? "Sin paradas — añádelas al modificar." : "No stops — add them when editing."}
                            </li>
                          )}
                        </ul>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                          {lang === "es"
                            ? "Checklist preparación (clic para marcar)"
                            : "Prep checklist (click to toggle)"}
                        </p>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {r.prep.map((p, i) => (
                            <li key={`${p.label}-${i}`}>
                              <button
                                type="button"
                                onClick={() => togglePrep(r.id, i)}
                                className="flex w-full items-start gap-2 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]"
                              >
                                {p.done ? (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Circle className="mt-0.5 h-4 w-4 text-[var(--ink-muted)]" />
                                )}
                                <span>
                                  {p.label}
                                  <span className="block text-xs text-[var(--ink-muted)]">{p.owner}</span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <p className="rounded-lg border border-dashed border-[var(--glass-border)] p-3 text-sm text-[var(--ink)]">
                        <strong>{lang === "es" ? "Nota interna:" : "Internal note:"}</strong>{" "}
                        {r.internalNotes || "—"}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {modal && (
        <ReservationFormModal
          lang={lang}
          mode={modal.mode}
          initial={modal.reservation}
          onClose={() => setModal(null)}
          onSave={saveReservation}
        />
      )}
    </div>
  );
}

export function InvoicesVerifactuPanel({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  const invoices = hub.invoices;
  const [openId, setOpenId] = useState<string | null>(null);
  const [legalOpen, setLegalOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [filter, setFilter] = useState<"todas" | "vencidas" | "pendientes" | "cobradas">("todas");

  const now = Date.now();
  const enriched = useMemo(() => {
    return invoices.map((inv) => {
      const outstanding = Math.max(0, inv.total - inv.amountCollected);
      const ageDays = Math.floor((now - new Date(inv.issueDate).getTime()) / 86_400_000);
      const vencida =
        outstanding > 0 &&
        inv.status !== "anulada" &&
        inv.status !== "borrador" &&
        ageDays > 30;
      return { inv, outstanding, ageDays, vencida };
    });
  }, [invoices, now]);

  const visible = useMemo(() => {
    return enriched.filter(({ inv, outstanding, vencida }) => {
      if (filter === "cobradas") return inv.amountCollected > 0 && outstanding === 0;
      if (filter === "pendientes") return outstanding > 0 && !vencida;
      if (filter === "vencidas") return vencida;
      return inv.status !== "anulada";
    });
  }, [enriched, filter]);

  const viewTotals = useMemo(() => {
    let cobrado = 0;
    let pendiente = 0;
    for (const row of visible) {
      cobrado += row.inv.amountCollected;
      pendiente += row.outstanding;
    }
    return { cobrado, pendiente, count: visible.length };
  }, [visible]);

  const counts = useMemo(() => {
    const all = enriched.filter((e) => e.inv.status !== "anulada").length;
    const vencidas = enriched.filter((e) => e.vencida).length;
    const pendientes = enriched.filter((e) => e.outstanding > 0 && !e.vencida).length;
    const cobradas = enriched.filter((e) => e.inv.amountCollected > 0 && e.outstanding === 0).length;
    return { todas: all, vencidas, pendientes, cobradas };
  }, [enriched]);

  const alerts = useMemo(() => buildInvoiceAlerts(invoices), [invoices]);

  return (
    <div className="space-y-5">
      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-4 py-3"
              style={{
                borderColor:
                  a.tone === "negative"
                    ? "color-mix(in oklab, var(--negative) 40%, transparent)"
                    : a.tone === "warning"
                      ? "color-mix(in oklab, var(--warning) 40%, transparent)"
                      : "var(--glass-border)",
                background:
                  a.tone === "negative"
                    ? "color-mix(in oklab, var(--negative) 8%, transparent)"
                    : a.tone === "warning"
                      ? "color-mix(in oklab, var(--warning) 8%, transparent)"
                      : "var(--glass)",
              }}
            >
              <div className="flex min-w-0 items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{
                    color:
                      a.tone === "negative"
                        ? "var(--negative)"
                        : a.tone === "warning"
                          ? "var(--warning)"
                          : "var(--accent)",
                  }}
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{a.title}</p>
                  <p className="text-xs text-[var(--ink-muted)]">{a.body}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {a.amount != null ? (
                  <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">
                    {formatEur(a.amount, lang)}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="mps-choice rounded-lg px-2.5 py-1 text-xs font-semibold"
                  onClick={() => setOpenId(a.invoiceId)}
                >
                  {lang === "es" ? "Ver" : "View"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Card
        title={lang === "es" ? "Facturas · Veri*FACTU · REAV" : "Invoices · Veri*FACTU · REAV"}
        subtitle={
          lang === "es"
            ? "Tabla con filtros, totales EN ESTA VISTA y enlaces a cliente / asistente."
            : "Table with filters, IN THIS VIEW totals and links to client / assistant."
        }
        action={
          <button
            type="button"
            onClick={() => downloadGestoriaPack(invoices)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Download className="h-4 w-4" />
            {lang === "es" ? "Exportar a gestoría" : "Export for tax advisor"}
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {["Stripe", "SEPA", "PayPal", "Depósito", "Efectivo"].map((p) => (
            <Badge key={p} tone="brand">
              {p}
            </Badge>
          ))}
          <Badge tone="good">ClaveRégimen 05</Badge>
          <Badge tone="warn">Deadline IS 01/01/2027</Badge>
        </div>

        <ViewTotals
          className="mb-4"
          headline={{
            label: lang === "es" ? "Emitido (vista)" : "Issued (view)",
            value: euro(viewTotals.cobrado + viewTotals.pendiente, lang),
          }}
          totals={[
            {
              label: lang === "es" ? "Cobrado" : "Collected",
              value: euro(viewTotals.cobrado, lang),
              tone: "positive",
            },
            {
              label: lang === "es" ? "Pendiente" : "Outstanding",
              value: euro(viewTotals.pendiente, lang),
              tone: "negative",
            },
            { label: lang === "es" ? "Facturas" : "Invoices", value: String(viewTotals.count) },
          ]}
        />

        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ["todas", lang === "es" ? "Todas" : "All"],
              ["vencidas", lang === "es" ? "Vencidas" : "Overdue"],
              ["pendientes", lang === "es" ? "Pendientes" : "Open"],
              ["cobradas", lang === "es" ? "Cobradas" : "Paid"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn("mps-choice rounded-lg px-3 py-1 text-sm transition", filter === id && "is-active")}
            >
              {label}
              <span className="ml-1.5 tabular-nums opacity-70">{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--glass-border)]">
          <table className="mps-table">
            <thead>
              <tr>
                <th scope="col">{lang === "es" ? "Número" : "Number"}</th>
                <th scope="col">{lang === "es" ? "Cliente" : "Client"}</th>
                <th scope="col">{lang === "es" ? "Emisión" : "Issued"}</th>
                <th scope="col">{lang === "es" ? "Estado" : "Status"}</th>
                <th scope="col" className="mps-num">
                  Total
                </th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ inv, outstanding, ageDays, vencida }) => (
                <tr key={inv.id} className={openId === inv.id ? "mps-row-final" : undefined}>
                  <td>
                    <button
                      type="button"
                      className="text-left font-semibold text-[var(--accent)]"
                      onClick={() => setOpenId(openId === inv.id ? null : inv.id)}
                    >
                      {inv.number}
                    </button>
                    <span className="block text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {inv.expedition}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-left"
                      onClick={() =>
                        window.dispatchEvent(new CustomEvent("mps-navigate", { detail: "clientes" }))
                      }
                    >
                      {inv.clientName}
                    </button>
                    <span className="block text-xs" style={{ color: "var(--text-tertiary)" }}>
                      NIF {inv.clientNif}
                    </span>
                  </td>
                  <td className="whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {inv.issueDate.slice(0, 10)}
                    {vencida ? (
                      <span className="block text-xs font-semibold" style={{ color: "var(--negative)" }}>
                        {ageDays}d {lang === "es" ? "VENCIDA" : "OVERDUE"}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <StatusBadge
                      tone={vencida ? "negative" : inv.status === "cobrada" ? "positive" : "info"}
                    >
                      {INVOICE_STATUS_LABEL[inv.status]}
                    </StatusBadge>
                    {outstanding > 0 ? (
                      <span className="mt-1 block text-[11px]" style={{ color: "var(--warning)" }}>
                        pend. {euro(outstanding, lang)}
                      </span>
                    ) : null}
                  </td>
                  <td className="mps-num font-semibold">{euro(inv.total, lang)}</td>
                  <td className="mps-num">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        className="mps-choice rounded-lg px-2 py-1 text-xs font-semibold"
                        onClick={() =>
                          requestAsk(
                            askAboutInvoice(
                              inv.number,
                              vencida ? `Vencida ${ageDays}d` : INVOICE_STATUS_LABEL[inv.status],
                            ),
                          )
                        }
                      >
                        {lang === "es" ? "Preguntar" : "Ask"}
                      </button>
                      <button
                        type="button"
                        className="mps-choice rounded-lg px-2 py-1 text-xs font-semibold"
                        onClick={() => downloadInvoicePdf(inv)}
                      >
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center" style={{ color: "var(--text-tertiary)" }}>
                    {lang === "es" ? "Sin facturas en esta vista." : "No invoices in this view."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {openId
          ? (() => {
              const inv = invoices.find((i) => i.id === openId);
              if (!inv) return null;
              return (
                <div className="mt-3 space-y-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] px-4 py-4">
                  <div className="grid gap-3 text-sm text-[var(--ink)] md:grid-cols-2">
                    <p>
                      <span className="text-[var(--ink-muted)]">Base (margen REAV):</span>{" "}
                      {inv.taxBase.toFixed(2)} € · IVA {inv.vatRate}% = {inv.vatAmount.toFixed(2)} €
                    </p>
                    <p>
                      <span className="text-[var(--ink-muted)]">Operación:</span> {inv.operationClass} ·
                      Mención REAV: {inv.reavMention ? "Sí" : "No"}
                    </p>
                    <p>
                      <span className="text-[var(--ink-muted)]">Pago:</span>{" "}
                      {PAYMENT_LABEL[inv.paymentChannel]} · {inv.paymentRef}
                    </p>
                    <p>
                      <span className="text-[var(--ink-muted)]">Veri*FACTU:</span> {inv.verifactuHash} ·
                      AEAT: {inv.aeatStatus}
                    </p>
                    <p className="md:col-span-2 text-[var(--ink-muted)]">{inv.clientAddress}</p>
                  </div>
                </div>
              );
            })()
          : null}
      </Card>

      <section className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-[var(--shadow)] backdrop-blur-md">
        <button
          type="button"
          onClick={() => setLegalOpen((v) => !v)}
          className="flex w-full items-start justify-between gap-3 p-4 text-left md:p-5"
          aria-expanded={legalOpen}
        >
          <div className="min-w-0">
            <h3 className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)] md:text-2xl">
              {lang === "es" ? "Respaldo legal (citado)" : "Legal basis (cited)"}
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {lang === "es"
                ? `${LEGAL_CITATIONS.length} normas · disponible al expandir · validar con gestoría`
                : `${LEGAL_CITATIONS.length} statutes · expand to view · validate with advisor`}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--glass-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)]">
            {legalOpen
              ? lang === "es"
                ? "Contraer"
                : "Collapse"
              : lang === "es"
                ? "Expandir"
                : "Expand"}
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", legalOpen && "rotate-180")}
            />
          </span>
        </button>
        {legalOpen && (
          <div className="space-y-3 border-t border-[var(--glass-border)] px-4 pb-4 pt-3 md:px-5">
            <p className="text-sm text-[var(--ink-muted)]">
              {lang === "es"
                ? "Todo lo que el módulo cumple o prepara — con norma."
                : "What this module meets or prepares for — with statute."}
            </p>
            <ul className="space-y-3">
              {LEGAL_CITATIONS.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Scale className="h-4 w-4 text-[var(--accent)]" />
                    <Badge tone="brand">{c.short}</Badge>
                    {c.boe && <span className="text-xs text-[var(--ink-muted)]">{c.boe}</span>}
                  </div>
                  <p className="mt-2 font-semibold text-[var(--ink)]">{c.title}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink-muted)]">
                    {c.articles.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-[var(--ink)]">{c.why}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-[var(--shadow)] backdrop-blur-md">
        <button
          type="button"
          onClick={() => setChecklistOpen((v) => !v)}
          className="flex w-full items-start justify-between gap-3 p-4 text-left md:p-5"
          aria-expanded={checklistOpen}
        >
          <div className="min-w-0">
            <h3 className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)] md:text-2xl">
              {lang === "es" ? "Checklist cumplimiento" : "Compliance checklist"}
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {lang === "es"
                ? `${VERIFACTU_CHECKLIST.length} puntos · contraído por defecto`
                : `${VERIFACTU_CHECKLIST.length} items · collapsed by default`}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--glass-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)]">
            {checklistOpen
              ? lang === "es"
                ? "Contraer"
                : "Collapse"
              : lang === "es"
                ? "Expandir"
                : "Expand"}
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", checklistOpen && "rotate-180")}
            />
          </span>
        </button>
        {checklistOpen && (
          <div className="border-t border-[var(--glass-border)] px-4 pb-4 pt-3 md:px-5">
            <ul className="space-y-2">
              {VERIFACTU_CHECKLIST.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-sm"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                  <div>
                    <p className="text-[var(--ink)]">{item.item}</p>
                    <p className="text-xs text-[var(--ink-muted)]">{item.legalRef}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Campos export gestoría:" : "Tax-advisor export fields:"}{" "}
              {GESTORIA_EXPORT_FIELDS.join(" · ")}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function clientPaymentTone(
  s: Client["paymentStatus"],
): "good" | "warn" | "bad" | "neutral" {
  if (s === "al_dia") return "good";
  if (s === "vence_pronto" || s === "saldo_pendiente") return "warn";
  if (s === "deposito_pendiente") return "bad";
  return "neutral";
}

export {
  Badge as OpsBadge,
  Card as OpsCard,
  euro as opsEuro,
  EXPERIENCE_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  SEGMENT_LABEL,
  STATUS_LABEL,
};
