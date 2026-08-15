import {
  ROUTE_LABEL,
  type PaymentChannel,
  type RouteCode,
  type VehicleMode,
} from "@/lib/demo-data";
import {
  PAYMENT_LABEL,
  RESERVATION_STATUS_LABEL,
  type Reservation,
  type ReservationStatus,
} from "@/lib/ops-data";
import type { Lang } from "@/lib/i18n";
import { X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

const STATUSES = Object.keys(RESERVATION_STATUS_LABEL) as ReservationStatus[];
const PAYMENTS = Object.keys(PAYMENT_LABEL) as PaymentChannel[];
const ROUTES = Object.keys(ROUTE_LABEL) as RouteCode[];

const inputClass =
  "w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] focus:ring-2";

export function blankReservation(): Reservation {
  const id = `R-${4800 + Math.floor(Math.random() * 100)}`;
  return {
    id,
    clientId: "C-NEW",
    clientName: "",
    clientPhone: "+34 ",
    expeditionId: "E-NEW",
    route: "MONGOLIA",
    tripName: "",
    vehicle: "moto",
    status: "reservado",
    bookedAt: new Date().toISOString().slice(0, 10),
    departureAt: "",
    pax: 1,
    totalAmount: 0,
    depositPaid: 0,
    paymentChannel: "transferencia",
    paymentRefs: [],
    tourLeader: "Luis Ortega",
    logisticsContacts: [
      { role: "Operador local", name: "", phone: "", email: "", notes: "" },
    ],
    itinerary: [
      { day: "D1", place: "", lodging: "", meals: "" },
    ],
    prep: [
      { label: "Pasaporte / docs", done: false, owner: "Marta Vega" },
      { label: "Confirmación alojamiento", done: false, owner: "Luis Ortega" },
    ],
    internalNotes: "",
  };
}

export function ReservationFormModal({
  lang,
  mode,
  initial,
  onClose,
  onSave,
}: {
  lang: Lang;
  mode: "create" | "edit";
  initial: Reservation;
  onClose: () => void;
  onSave: (r: Reservation) => void;
}) {
  const [form, setForm] = useState<Reservation>(initial);

  useEffect(() => setForm(initial), [initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof Reservation>(key: K, value: Reservation[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.clientName.trim() || !form.tripName.trim()) return;
    onSave({
      ...form,
      paymentRefs: form.paymentRefs.length
        ? form.paymentRefs
        : form.depositPaid > 0
          ? [`REF-${form.id}`]
          : [],
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg0)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-strong)] px-4 py-3 backdrop-blur-md">
          <div>
            <h2 className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)]">
              {mode === "create"
                ? lang === "es"
                  ? "Nueva reserva"
                  : "New booking"
                : lang === "es"
                  ? "Editar reserva"
                  : "Edit booking"}
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">{form.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--glass-border)] p-2 text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-4 md:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Cliente" : "Client"}
              <input
                required
                className={inputClass + " mt-1"}
                value={form.clientName}
                onChange={(e) => set("clientName", e.target.value)}
              />
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              WhatsApp / Tel
              <input
                className={inputClass + " mt-1"}
                value={form.clientPhone}
                onChange={(e) => set("clientPhone", e.target.value)}
              />
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Nombre del viaje" : "Trip name"}
              <input
                required
                className={inputClass + " mt-1"}
                value={form.tripName}
                onChange={(e) => set("tripName", e.target.value)}
              />
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Ruta" : "Route"}
              <select
                className={inputClass + " mt-1"}
                value={form.route}
                onChange={(e) => set("route", e.target.value as RouteCode)}
              >
                {ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {ROUTE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Vehículo" : "Vehicle"}
              <select
                className={inputClass + " mt-1"}
                value={form.vehicle}
                onChange={(e) => set("vehicle", e.target.value as VehicleMode)}
              >
                <option value="moto">Moto</option>
                <option value="4x4">4x4</option>
              </select>
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              Status
              <select
                className={inputClass + " mt-1"}
                value={form.status}
                onChange={(e) => set("status", e.target.value as ReservationStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {RESERVATION_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Salida" : "Departure"}
              <input
                type="date"
                className={inputClass + " mt-1"}
                value={form.departureAt}
                onChange={(e) => set("departureAt", e.target.value)}
              />
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              Tour Leader
              <input
                className={inputClass + " mt-1"}
                value={form.tourLeader}
                onChange={(e) => set("tourLeader", e.target.value)}
              />
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              Pax
              <input
                type="number"
                className={inputClass + " mt-1"}
                value={form.pax}
                onChange={(e) => set("pax", Number(e.target.value))}
              />
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Total (€)" : "Total (€)"}
              <input
                type="number"
                className={inputClass + " mt-1"}
                value={form.totalAmount}
                onChange={(e) => set("totalAmount", Number(e.target.value))}
              />
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Depósito cobrado (€)" : "Deposit paid (€)"}
              <input
                type="number"
                className={inputClass + " mt-1"}
                value={form.depositPaid}
                onChange={(e) => set("depositPaid", Number(e.target.value))}
              />
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Medio de pago" : "Payment"}
              <select
                className={inputClass + " mt-1"}
                value={form.paymentChannel}
                onChange={(e) => set("paymentChannel", e.target.value as PaymentChannel)}
              >
                {PAYMENTS.map((p) => (
                  <option key={p} value={p}>
                    {PAYMENT_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-[var(--ink-muted)]">
              {lang === "es" ? "Contactos logística" : "Logistics contacts"}
            </p>
            {form.logisticsContacts.map((c, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-[var(--glass-border)] p-2 sm:grid-cols-2">
                <input
                  className={inputClass}
                  placeholder={lang === "es" ? "Rol" : "Role"}
                  value={c.role}
                  onChange={(e) => {
                    const logisticsContacts = form.logisticsContacts.map((x, idx) =>
                      idx === i ? { ...x, role: e.target.value } : x,
                    );
                    set("logisticsContacts", logisticsContacts);
                  }}
                />
                <input
                  className={inputClass}
                  placeholder={lang === "es" ? "Nombre" : "Name"}
                  value={c.name}
                  onChange={(e) => {
                    const logisticsContacts = form.logisticsContacts.map((x, idx) =>
                      idx === i ? { ...x, name: e.target.value } : x,
                    );
                    set("logisticsContacts", logisticsContacts);
                  }}
                />
                <input
                  className={inputClass}
                  placeholder="Tel"
                  value={c.phone}
                  onChange={(e) => {
                    const logisticsContacts = form.logisticsContacts.map((x, idx) =>
                      idx === i ? { ...x, phone: e.target.value } : x,
                    );
                    set("logisticsContacts", logisticsContacts);
                  }}
                />
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Email"
                    value={c.email ?? ""}
                    onChange={(e) => {
                      const logisticsContacts = form.logisticsContacts.map((x, idx) =>
                        idx === i ? { ...x, email: e.target.value } : x,
                      );
                      set("logisticsContacts", logisticsContacts);
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-rose-500/30 px-2 text-xs font-semibold text-rose-700"
                    onClick={() =>
                      set(
                        "logisticsContacts",
                        form.logisticsContacts.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    {lang === "es" ? "Quitar" : "Remove"}
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-[var(--accent)]"
              onClick={() =>
                set("logisticsContacts", [
                  ...form.logisticsContacts,
                  { role: "", name: "", phone: "" },
                ])
              }
            >
              + {lang === "es" ? "contacto" : "contact"}
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-[var(--ink-muted)]">
              {lang === "es" ? "Itinerario (alojamiento / comidas)" : "Itinerary (lodging / meals)"}
            </p>
            {form.itinerary.map((s, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-[var(--glass-border)] p-2 sm:grid-cols-2">
                <input
                  className={inputClass}
                  placeholder="Día"
                  value={s.day}
                  onChange={(e) => {
                    const itinerary = form.itinerary.map((x, idx) =>
                      idx === i ? { ...x, day: e.target.value } : x,
                    );
                    set("itinerary", itinerary);
                  }}
                />
                <input
                  className={inputClass}
                  placeholder={lang === "es" ? "Lugar" : "Place"}
                  value={s.place}
                  onChange={(e) => {
                    const itinerary = form.itinerary.map((x, idx) =>
                      idx === i ? { ...x, place: e.target.value } : x,
                    );
                    set("itinerary", itinerary);
                  }}
                />
                <input
                  className={inputClass}
                  placeholder={lang === "es" ? "Alojamiento" : "Lodging"}
                  value={s.lodging}
                  onChange={(e) => {
                    const itinerary = form.itinerary.map((x, idx) =>
                      idx === i ? { ...x, lodging: e.target.value } : x,
                    );
                    set("itinerary", itinerary);
                  }}
                />
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder={lang === "es" ? "Comidas" : "Meals"}
                    value={s.meals}
                    onChange={(e) => {
                      const itinerary = form.itinerary.map((x, idx) =>
                        idx === i ? { ...x, meals: e.target.value } : x,
                      );
                      set("itinerary", itinerary);
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-rose-500/30 px-2 text-xs font-semibold text-rose-700"
                    onClick={() =>
                      set(
                        "itinerary",
                        form.itinerary.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    {lang === "es" ? "Quitar" : "Remove"}
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-[var(--accent)]"
              onClick={() =>
                set("itinerary", [
                  ...form.itinerary,
                  { day: `D${form.itinerary.length + 1}`, place: "", lodging: "", meals: "" },
                ])
              }
            >
              + {lang === "es" ? "parada" : "stop"}
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-[var(--ink-muted)]">
              Checklist prep
            </p>
            {form.prep.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={p.done}
                  onChange={(e) => {
                    const prep = form.prep.map((x, idx) =>
                      idx === i ? { ...x, done: e.target.checked } : x,
                    );
                    set("prep", prep);
                  }}
                />
                <input
                  className={inputClass}
                  value={p.label}
                  onChange={(e) => {
                    const prep = form.prep.map((x, idx) =>
                      idx === i ? { ...x, label: e.target.value } : x,
                    );
                    set("prep", prep);
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-rose-500/30 px-2 text-xs font-semibold text-rose-700"
                  onClick={() => set("prep", form.prep.filter((_, idx) => idx !== i))}
                >
                  {lang === "es" ? "Quitar" : "Remove"}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-[var(--accent)]"
              onClick={() =>
                set("prep", [...form.prep, { label: "Nuevo ítem", done: false, owner: "Laura" }])
              }
            >
              + {lang === "es" ? "ítem" : "item"}
            </button>
          </div>

          <label className="block text-xs text-[var(--ink-muted)]">
            {lang === "es" ? "Notas internas" : "Internal notes"}
            <textarea
              rows={3}
              className={inputClass + " mt-1"}
              value={form.internalNotes}
              onChange={(e) => set("internalNotes", e.target.value)}
            />
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
                  ? "Crear reserva"
                  : "Create booking"
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
