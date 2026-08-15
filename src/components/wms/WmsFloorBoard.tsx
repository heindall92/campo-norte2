import { Badge, Card } from "@/components/CrmChrome";
import { useAuth } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import {
  LOAD_KIND_LABEL,
  aisleTraces,
  assignSuperToOperator,
  labelLoadUnit,
  openLoadUnit,
  placeLoadUnitOnDock,
  strapLoadUnit,
  type FloorError,
  type LoadUnitKind,
} from "@/lib/wms";
import { Footprints, MapPin, Tag, UserRound } from "lucide-react";
import { useState } from "react";
import { useWmsLive } from "./useWmsLive";

const FLOOR_ERR: Record<FloorError, { es: string; en: string }> = {
  order_missing: { es: "Pedido no encontrado", en: "Order missing" },
  order_done: { es: "Ese súper ya salió", en: "That store order already shipped" },
  operator_missing: { es: "No hay operario con ese código", en: "No operator with that code" },
  code_required: { es: "Escribe el código de operario", en: "Type the operator code" },
  no_free_pallets: { es: "No hay palets libres en cara de picking", en: "No free pick-face pallets" },
  nothing_picked: { es: "Aún no hay mercancía picada de ese súper", en: "Nothing picked for that store yet" },
  unit_missing: { es: "Unidad no encontrada", en: "Unit missing" },
  label_required: { es: "Escribe el código de la etiqueta que pegas", en: "Type the label you stick" },
  dock_slot: { es: "Ese hueco no es un muelle real de este centro", en: "That slot is not a real dock here" },
  lines_used: { es: "Esas líneas ya están en una unidad", en: "Those lines are already in a unit" },
};

const KINDS: LoadUnitKind[] = ["palet", "caja", "carro"];

export function WmsAssignSuperCard({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const { snap, commit } = useWmsLive();
  const canAssign = user?.role === "admin" || user?.role === "ops";
  const [orderId, setOrderId] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const openOrders = snap.outbound.filter((o) => o.status !== "expedido");

  if (!canAssign) {
    return (
      <Card
        title={lang === "es" ? "Asignación de súper" : "Store assignment"}
        subtitle={
          lang === "es"
            ? "Solo el patrón o un técnico asignan. El operario entra con su código."
            : "Only the lead or a technician assigns. The operator signs in with their code."
        }
      >
        <p className="text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "En planta no se asigna desde el aparato: te dan el súper y vas al pasillo que marca el ticket."
            : "On the floor the gun does not assign: you get the store and walk the aisle on the ticket."}
        </p>
      </Card>
    );
  }

  return (
    <Card
      title={lang === "es" ? "Asignar súper al operario" : "Assign store to operator"}
      subtitle={
        lang === "es"
          ? "Patrón o técnico. El código de operario (OP-1903), no el número del aparato."
          : "Lead or technician. Operator code (OP-1903), not the device number."
      }
    >
      <form
        className="grid gap-2 md:grid-cols-[1fr_10rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const result = assignSuperToOperator(snap, orderId, code, user?.name ?? null);
          if (!result.ok) {
            setMsg(FLOOR_ERR[result.error][lang]);
            return;
          }
          commit(result.snap);
          setCode("");
          setMsg(null);
        }}
      >
        <select
          required
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        >
          <option value="">{lang === "es" ? "Súper / pedido" : "Store / order"}</option>
          {openOrders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.customer} · {o.code} · {o.dock}
            </option>
          ))}
        </select>
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="OP-1903"
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
        <button type="submit" className="rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">
          {lang === "es" ? "Asignar" : "Assign"}
        </button>
      </form>
      {msg && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
      {snap.superAssignments[0] && (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">
          {snap.superAssignments[0].assignedBy ?? (lang === "es" ? "Técnico" : "Tech")} →{" "}
          {snap.operators.find((o) => o.id === snap.superAssignments[0]!.operatorId)?.code} ·{" "}
          {snap.outbound.find((o) => o.id === snap.superAssignments[0]!.orderId)?.customer}
        </p>
      )}
    </Card>
  );
}

export function WmsAisleTraceCard({ lang, siteId }: { lang: Lang; siteId?: string }) {
  const { snap } = useWmsLive();
  const rows = aisleTraces(snap, siteId);

  return (
    <Card
      title={lang === "es" ? "Por qué pasillo va el operario" : "Which aisle the operator is on"}
      subtitle={
        lang === "es"
          ? "El rastro sale de cada artículo que marca. No hay GPS ni posición inventada."
          : "The trail comes from each article they mark. No GPS or invented position."
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Nadie tiene súper asignado ni ha marcado todavía."
            : "Nobody has a store assigned or has marked yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.operator.id}
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm"
            >
              <p className="flex flex-wrap items-center gap-2">
                <UserRound className="h-4 w-4 text-[var(--accent)]" />
                <span className="font-medium">{row.operator.name}</span>
                <span className="font-mono text-xs">{row.operator.code}</span>
                {row.assignedStore && <Badge tone="brand">{row.assignedStore}</Badge>}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
                <MapPin className="h-3.5 w-3.5" />
                {row.currentAisle
                  ? lang === "es"
                    ? `Pasillo ${row.currentAisle}`
                    : `Aisle ${row.currentAisle}`
                  : lang === "es"
                    ? "Aún no ha marcado"
                    : "Not marked yet"}
                {row.nextSlot
                  ? ` · ${lang === "es" ? "siguiente" : "next"} ${row.nextSlot}`
                  : ""}
                {row.stops[0] ? ` · ${row.stops[0].skuName} × ${row.stops[0].qty}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function WmsLoadUnitCard({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const [orderId, setOrderId] = useState("");
  const [kind, setKind] = useState<LoadUnitKind>("palet");
  const [label, setLabel] = useState<Record<string, string>>({});
  const [dockCode, setDockCode] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const pickedOrders = snap.outbound.filter((o) =>
    snap.pickWaves.some((w) => w.lines.some((l) => l.orderCode === o.code && l.status === "picada")),
  );

  function apply(result: { ok: true; snap: typeof snap } | { ok: false; error: FloorError }) {
    if (!result.ok) {
      setMsg(FLOOR_ERR[result.error][lang]);
      return;
    }
    commit(result.snap);
    setMsg(null);
  }

  return (
    <Card
      title={lang === "es" ? "Unidad de carga · fleje y muelle" : "Load unit · strap and dock"}
      subtitle={
        lang === "es"
          ? "Palet, caja o carro. Completas, flejas, pegas la etiqueta y la dejas en el pasillo de muelle que dice la pantalla."
          : "Pallet, case or roll cage. Complete, strap, stick the label and leave it in the dock aisle on the screen."
      }
    >
      <form
        className="mb-3 grid gap-2 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          apply(openLoadUnit(snap, orderId, kind, null));
        }}
      >
        <select
          required
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        >
          <option value="">{lang === "es" ? "Súper picado" : "Picked store"}</option>
          {pickedOrders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.customer} · {o.dock}
            </option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as LoadUnitKind)}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {LOAD_KIND_LABEL[k][lang]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">
          {lang === "es" ? "Unidad completa" : "Unit complete"}
        </button>
      </form>
      {msg && <p className="mb-2 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
      <ul className="space-y-2">
        {snap.loadUnits.slice(0, 8).map((u) => {
          const order = snap.outbound.find((o) => o.id === u.orderId);
          const slot = u.dockSlotId ? snap.slots.find((s) => s.id === u.dockSlotId) : null;
          return (
            <li key={u.id} className="rounded-xl border border-[var(--glass-border)] px-3 py-2 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{LOAD_KIND_LABEL[u.kind][lang]}</Badge>
                <span className="font-medium">{order?.customer ?? u.orderCode}</span>
                <Badge tone="brand">
                  <MapPin className="mr-1 inline h-3 w-3" />
                  {lang === "es" ? "Dejar en" : "Leave at"} {u.dockAisle}
                </Badge>
                <Badge tone={u.status === "en_muelle" ? "good" : "warn"}>{u.status}</Badge>
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                {u.qty} ud. · {u.labelCode ?? (lang === "es" ? "sin etiqueta escrita" : "no typed label")}
                {slot ? ` · ${slot.code}` : ""}
              </p>
              {u.status !== "en_muelle" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {!u.strapped && (
                    <button
                      type="button"
                      className="rounded-full border border-[var(--glass-border)] px-2 py-1 text-[11px] font-semibold"
                      onClick={() => apply(strapLoadUnit(snap, u.id))}
                    >
                      {lang === "es" ? "Flejado" : "Strapped"}
                    </button>
                  )}
                  <input
                    value={label[u.id] ?? u.labelCode ?? ""}
                    onChange={(e) => setLabel((prev) => ({ ...prev, [u.id]: e.target.value }))}
                    placeholder={lang === "es" ? "Etiqueta que pegas" : "Label you stick"}
                    className="w-40 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--glass-border)] px-2 py-1 text-[11px] font-semibold"
                    onClick={() => apply(labelLoadUnit(snap, u.id, label[u.id] || u.labelCode || ""))}
                  >
                    <Tag className="h-3 w-3" />
                    {lang === "es" ? "Pegar" : "Stick"}
                  </button>
                  <input
                    value={dockCode[u.id] ?? ""}
                    onChange={(e) => setDockCode((prev) => ({ ...prev, [u.id]: e.target.value }))}
                    placeholder={lang === "es" ? "Hueco muelle" : "Dock slot"}
                    className="w-28 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    className="rounded-full bg-[var(--accent)] px-2 py-1 text-[11px] font-semibold text-white"
                    onClick={() => apply(placeLoadUnitOnDock(snap, u.id, dockCode[u.id] ?? ""))}
                  >
                    {lang === "es" ? "Dejar en muelle" : "Leave on dock"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function WmsFloorHint({ lang }: { lang: Lang }) {
  return (
    <p className="inline-flex items-start gap-2 text-xs text-[var(--ink-muted)]">
      <Footprints className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {lang === "es"
        ? "No modelamos carta de porte ni la oficina de recepción: eso no está descrito. Aquí está el pasillo, el súper y el muelle que ve el operario."
        : "We do not model the consignment note or inbound office: that was not described. This is the aisle, store and dock the operator sees."}
    </p>
  );
}
