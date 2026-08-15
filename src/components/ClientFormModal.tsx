import {
  EXPERIENCE_LABEL,
  ORIGIN_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  ROUTE_LABEL,
  SEGMENT_LABEL,
  STATUS_LABEL,
  type Client,
  type ClientSegment,
  type ClientStatus,
  type ExperienceLevel,
  type LeadOrigin,
  type PaymentChannel,
  type PaymentStatus,
  type RouteCode,
  type VehicleMode,
} from "@/lib/demo-data";
import type { Lang } from "@/lib/i18n";
import { X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

const SEGMENTS = Object.keys(SEGMENT_LABEL) as ClientSegment[];
const STATUSES = Object.keys(STATUS_LABEL) as ClientStatus[];
const PAY_STATUSES = Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[];
const PAY_METHODS = Object.keys(PAYMENT_METHOD_LABEL) as PaymentChannel[];
const EXPERIENCES = Object.keys(EXPERIENCE_LABEL) as ExperienceLevel[];
const ORIGINS = Object.keys(ORIGIN_LABEL) as LeadOrigin[];
const ROUTES = Object.keys(ROUTE_LABEL) as RouteCode[];

export function blankClient(): Client {
  const n = String(Math.floor(200 + Math.random() * 700));
  return {
    id: `C-${n}`,
    name: "",
    email: "",
    phone: "+34 ",
    city: "",
    country: "España",
    dni: "",
    address: "",
    contactPerson: "",
    emergencyPhone: "",
    segment: "activo",
    status: "al_dia",
    paymentStatus: "al_dia",
    pendingBalance: 0,
    paymentMethod: "transferencia",
    trips: 0,
    lastTripAt: null,
    nextInterest: null,
    ltv: 0,
    avgTicket: 0,
    preferredRoute: null,
    vehiclePref: "moto",
    experience: "intermedio",
    docsComplete: false,
    originPrimary: "web_form",
    brevoOpens: 0,
    referrals: 0,
    nps: null,
    owner: "Laura",
    since: new Date().toLocaleDateString("es-ES", { month: "2-digit", year: "numeric" }),
    notes: "",
    history: [],
    reactivationPriority: 40,
    reactivationWhy: "Alta manual desde CRM",
    lastOutboundAt: null,
    returnProbability: 40,
    contactThisMonth: false,
    intelligenceSource: "seed",
    intelligenceAt: null,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] focus:ring-2";

export function ClientFormModal({
  lang,
  initial,
  mode,
  onClose,
  onSave,
}: {
  lang: Lang;
  initial: Client;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (c: Client) => void;
}) {
  const [form, setForm] = useState<Client>(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof Client>(key: K, value: Client[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.dni.trim()) return;
    onSave({
      ...form,
      contactPerson: form.contactPerson.trim() || form.name,
      reactivationWhy:
        form.reactivationWhy ||
        (mode === "create"
          ? lang === "es"
            ? "Alta manual desde CRM"
            : "Manual CRM create"
          : form.reactivationWhy),
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg0)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-strong)] px-4 py-3 backdrop-blur-md md:px-5">
          <div>
            <h2
              id="client-modal-title"
              className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)]"
            >
              {mode === "create"
                ? lang === "es"
                  ? "Añadir cliente"
                  : "Add client"
                : lang === "es"
                  ? "Editar cliente"
                  : "Edit client"}
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">
              {form.id} · {lang === "es" ? "Ficha fiscal y operativa" : "Fiscal & ops record"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--glass-border)] p-2 text-[var(--ink)] hover:bg-[var(--glass)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-4 md:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={lang === "es" ? "Nombre completo" : "Full name"}>
              <input
                required
                className={inputClass}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="DNI / NIF / Pasaporte">
              <input
                required
                className={inputClass}
                value={form.dni}
                onChange={(e) => set("dni", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="WhatsApp / Teléfono">
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label={lang === "es" ? "Persona de contacto" : "Contact person"}>
              <input
                className={inputClass}
                value={form.contactPerson}
                onChange={(e) => set("contactPerson", e.target.value)}
              />
            </Field>
            <Field label={lang === "es" ? "Tel. emergencia" : "Emergency phone"}>
              <input
                className={inputClass}
                value={form.emergencyPhone}
                onChange={(e) => set("emergencyPhone", e.target.value)}
              />
            </Field>
            <Field label={lang === "es" ? "Dirección fiscal" : "Tax address"}>
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <Field label={lang === "es" ? "Ciudad" : "City"}>
              <input
                className={inputClass}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
            <Field label={lang === "es" ? "País" : "Country"}>
              <input
                className={inputClass}
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
              />
            </Field>
            <Field label="Owner">
              <input
                className={inputClass}
                value={form.owner}
                onChange={(e) => set("owner", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={lang === "es" ? "Segmento" : "Segment"}>
              <select
                className={inputClass}
                value={form.segment}
                onChange={(e) => set("segment", e.target.value as ClientSegment)}
              >
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {SEGMENT_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={lang === "es" ? "Estado" : "Status"}>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => set("status", e.target.value as ClientStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={lang === "es" ? "Estado de pago" : "Payment status"}>
              <select
                className={inputClass}
                value={form.paymentStatus}
                onChange={(e) => set("paymentStatus", e.target.value as PaymentStatus)}
              >
                {PAY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={lang === "es" ? "Medio de pago" : "Payment method"}>
              <select
                className={inputClass}
                value={form.paymentMethod}
                onChange={(e) => set("paymentMethod", e.target.value as PaymentChannel)}
              >
                {PAY_METHODS.map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_METHOD_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={lang === "es" ? "Saldo pendiente (€)" : "Pending balance (€)"}>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                value={form.pendingBalance}
                onChange={(e) => set("pendingBalance", Number(e.target.value))}
              />
            </Field>
            <Field label={lang === "es" ? "Experiencia" : "Experience"}>
              <select
                className={inputClass}
                value={form.experience}
                onChange={(e) => set("experience", e.target.value as ExperienceLevel)}
              >
                {EXPERIENCES.map((s) => (
                  <option key={s} value={s}>
                    {EXPERIENCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={lang === "es" ? "Vehículo preferido" : "Preferred vehicle"}>
              <select
                className={inputClass}
                value={form.vehiclePref ?? ""}
                onChange={(e) =>
                  set("vehiclePref", (e.target.value || null) as VehicleMode | null)
                }
              >
                <option value="">—</option>
                <option value="moto">Moto</option>
                <option value="4x4">4x4</option>
              </select>
            </Field>
            <Field label={lang === "es" ? "Ruta preferida" : "Preferred route"}>
              <select
                className={inputClass}
                value={form.preferredRoute ?? ""}
                onChange={(e) =>
                  set("preferredRoute", (e.target.value || null) as RouteCode | null)
                }
              >
                <option value="">—</option>
                {ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {ROUTE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={lang === "es" ? "Próximo interés" : "Next interest"}>
              <select
                className={inputClass}
                value={form.nextInterest ?? ""}
                onChange={(e) =>
                  set("nextInterest", (e.target.value || null) as RouteCode | null)
                }
              >
                <option value="">—</option>
                {ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {ROUTE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={lang === "es" ? "Origen primario" : "Primary origin"}>
              <select
                className={inputClass}
                value={form.originPrimary}
                onChange={(e) => set("originPrimary", e.target.value as LeadOrigin)}
              >
                {ORIGINS.map((o) => (
                  <option key={o} value={o}>
                    {ORIGIN_LABEL[o]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="LTV (€)">
              <input
                type="number"
                className={inputClass}
                value={form.ltv}
                onChange={(e) => set("ltv", Number(e.target.value))}
              />
            </Field>
            <Field label={lang === "es" ? "Viajes" : "Trips"}>
              <input
                type="number"
                className={inputClass}
                value={form.trips}
                onChange={(e) => set("trips", Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label={lang === "es" ? "Notas internas" : "Internal notes"}>
            <textarea
              rows={3}
              className={inputClass}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              checked={form.docsComplete}
              onChange={(e) => set("docsComplete", e.target.checked)}
            />
            {lang === "es" ? "Documentación completa" : "Documents complete"}
          </label>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--glass-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm font-semibold text-[var(--ink)]"
            >
              {lang === "es" ? "Cancelar" : "Cancel"}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              {mode === "create"
                ? lang === "es"
                  ? "Crear cliente"
                  : "Create client"
                : lang === "es"
                  ? "Guardar cambios"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
