import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  DOCK_EVENT_KINDS,
  DOCK_EVENT_LABEL,
  WMS_DEMO_NOW,
  addDock,
  cancelDockAppointment,
  dockCalendarDay,
  eventsForAppointment,
  openDockAppointment,
  recordDockEvent,
  type DockError,
  type DockEventKind,
} from "@/lib/wms";
import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { useWmsLive } from "./useWmsLive";

const DOCK_ERR: Record<DockError, { es: string; en: string }> = {
  site_missing: { es: "Centro no encontrado", en: "Site missing" },
  code_required: { es: "Escribe el código del muelle", en: "Type the dock code" },
  name_required: { es: "Escribe el nombre del muelle", en: "Type the dock name" },
  dock_dup: { es: "Ese código de muelle ya existe en el centro", en: "That dock code already exists here" },
  dock_missing: { es: "Muelle no encontrado", en: "Dock missing" },
  invalid_capacity: { es: "Capacidad no válida", en: "Invalid capacity" },
  invalid_window: { es: "Ventana no válida", en: "Invalid window" },
  order_missing: { es: "Pedido no encontrado", en: "Order missing" },
  order_done: { es: "Ese pedido ya salió", en: "That order already shipped" },
  asn_missing: { es: "ASN no encontrado", en: "ASN missing" },
  ref_required: { es: "Elige un pedido", en: "Pick an order" },
  dock_busy: { es: "Ese muelle ya tiene el cupo de esa ventana", en: "That dock is at capacity for that window" },
  appointment_missing: { es: "No hay cita", en: "No appointment" },
  appointment_cancelled: { es: "La cita está cancelada", en: "Appointment cancelled" },
  event_invalid: { es: "Evento no válido", en: "Invalid event" },
};

function clock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(11, 16);
}

export function WmsDockCalendar({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const day = WMS_DEMO_NOW.slice(0, 10);
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [dockId, setDockId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const calendar = useMemo(() => dockCalendarDay(snap, day, siteId || undefined), [snap, day, siteId]);
  const openOrders = snap.outbound.filter((o) => o.status !== "expedido" && (!siteId || o.siteId === siteId));

  return (
    <Card
      title={lang === "es" ? "Calendario de muelle" : "Dock calendar"}
      subtitle={
        lang === "es"
          ? `Día ${day}. Los muelles se dan de alta. El cupo 1 solo cuenta si lo escribes; si no, no se inventa.`
          : `Day ${day}. Docks are added in writing. Capacity 1 only applies if you type it; otherwise it is not invented.`
      }
    >
      <form
        className="mb-3 grid gap-2 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          const cap = capacity.trim() ? Number(capacity) : null;
          const result = addDock(snap, {
            warehouseId: siteId,
            code,
            name,
            capacity: cap,
          });
          if (!result.ok) {
            setMsg(DOCK_ERR[result.error][lang]);
            return;
          }
          commit(result.snap);
          setMsg(null);
          setCode("");
          setName("");
          setCapacity("");
        }}
      >
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        >
          {snap.sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.city}
            </option>
          ))}
        </select>
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="M-05"
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={lang === "es" ? "Nombre" : "Name"}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        />
        <input
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder={lang === "es" ? "Cupo (opcional)" : "Capacity (optional)"}
          inputMode="numeric"
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
        <button type="submit" className="rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">
          {lang === "es" ? "Alta muelle" : "Add dock"}
        </button>
      </form>

      <form
        className="mb-3 grid gap-2 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const result = openDockAppointment(snap, { dockId, orderId });
          if (!result.ok) {
            setMsg(DOCK_ERR[result.error][lang]);
            return;
          }
          commit(result.snap);
          setMsg(null);
        }}
      >
        <select
          required
          value={dockId}
          onChange={(e) => setDockId(e.target.value)}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        >
          <option value="">{lang === "es" ? "Muelle escrito" : "Written dock"}</option>
          {(snap.docks ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} · {d.name}
              {d.capacity != null ? ` · ${d.capacity}` : ""}
            </option>
          ))}
        </select>
        <select
          required
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        >
          <option value="">{lang === "es" ? "Pedido" : "Order"}</option>
          {openOrders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} · {o.dock} · {clock(o.dockWindowStart)}–{clock(o.dockWindowEnd)}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-full border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold">
          {lang === "es" ? "Asignar cita" : "Book appointment"}
        </button>
      </form>

      {msg && <p className="mb-2 text-xs font-semibold text-[var(--danger)]">{msg}</p>}

      {calendar.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          <CalendarDays className="size-4" />
          {lang === "es" ? "Ningún muelle escrito. El itinerario de texto M-05 sigue abajo." : "No docks written. The M-05 text itinerary remains below."}
        </p>
      ) : (
        <ul className="space-y-3">
          {calendar.map(({ dock, appointments }) => (
            <li key={dock.id}>
              <p className="mb-1 text-sm font-semibold">
                {dock.code} · {dock.name}
                <span className="ml-2 text-[11px] font-normal text-[var(--ink-muted)]">
                  {dock.capacity == null
                    ? lang === "es"
                      ? "sin cupo escrito"
                      : "no written capacity"
                    : lang === "es"
                      ? `cupo ${dock.capacity}`
                      : `capacity ${dock.capacity}`}
                </span>
              </p>
              {appointments.length === 0 ? (
                <p className="text-xs text-[var(--ink-muted)]">{lang === "es" ? "Sin citas este día" : "No appointments this day"}</p>
              ) : (
                <ul className="space-y-2">
                  {appointments.map((a) => {
                    const order = a.orderId ? snap.outbound.find((o) => o.id === a.orderId) : null;
                    const events = eventsForAppointment(snap, a.id);
                    return (
                      <li
                        key={a.id}
                        className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2"
                      >
                        <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span>
                            <span className="font-mono text-xs font-semibold">{order?.code ?? a.asnId ?? a.id}</span>
                            <span className="ml-2 text-[var(--ink-muted)]">
                              {clock(a.windowStart)}–{clock(a.windowEnd)} UTC
                            </span>
                          </span>
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-[var(--danger)]"
                            onClick={() => {
                              const result = cancelDockAppointment(snap, a.id);
                              if (!result.ok) {
                                setMsg(DOCK_ERR[result.error][lang]);
                                return;
                              }
                              commit(result.snap);
                              setMsg(null);
                            }}
                          >
                            {lang === "es" ? "Cancelar" : "Cancel"}
                          </button>
                        </p>
                        <p className="mt-1 flex flex-wrap gap-1">
                          {events.map((ev) => (
                            <Badge key={ev.id}>{DOCK_EVENT_LABEL[ev.kind][lang]}</Badge>
                          ))}
                        </p>
                        <p className="mt-2 flex flex-wrap gap-1">
                          {DOCK_EVENT_KINDS.filter((k) => k !== "assignment").map((kind: DockEventKind) => (
                            <button
                              key={kind}
                              type="button"
                              className="rounded-full border border-[var(--glass-border)] px-2 py-0.5 text-[11px] font-semibold"
                              onClick={() => {
                                const result = recordDockEvent(snap, a.id, kind);
                                if (!result.ok) {
                                  setMsg(DOCK_ERR[result.error][lang]);
                                  return;
                                }
                                commit(result.snap);
                                setMsg(null);
                              }}
                            >
                              {DOCK_EVENT_LABEL[kind][lang]}
                            </button>
                          ))}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
