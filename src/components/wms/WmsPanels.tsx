import { Badge, Card } from "@/components/CrmChrome";
import { StatCard } from "@/components/ui/StatCard";
import type { Lang } from "@/lib/i18n";
import {
  CAMPO_NORTE_ORG,
  ZONE_LABEL,
  WMS_DEMO_NOW,
  alertCounts,
  assignOutboundCarrier,
  setOutboundTracking,
  CARRIER_KIND_LABEL,
  computeShiftCoverage,
  computeSitePnl,
  computeTowerKpis,
  computeUnitEconomics,
  computeWmsAlerts,
  fleetUtilization,
  createOutboundOrder,
  navigateWmsSection,
  openWaveFromOrder,
  operatorForAppUser,
  outboundItinerary,
  rankDayPriorities,
  monthCosts,
  occupancyByZone,
  type FleetStatus,
  type PalletStatus,
  type SlotStatus,
} from "@/lib/wms";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Battery,
  Boxes,
  Building2,
  CircleAlert,
  ClipboardCheck,
  Coins,
  Forklift,
  Grid3X3,
  Package,
  ScanBarcode,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { WmsJornadaCard } from "./WmsJornadaCard";
import { useWmsLive } from "./useWmsLive";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function euro(n: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : "es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function statusTone(
  s: SlotStatus | PalletStatus | FleetStatus | string,
): "good" | "warn" | "bad" | "brand" | "neutral" {
  if (["libre", "operativa", "cerrado", "expedido", "en_ubicacion"].includes(s)) return "good";
  if (["reservado", "picking", "cargando", "en_muelle", "ubicando", "embalaje", "muelle"].includes(s))
    return "warn";
  if (["bloqueado", "fuera_servicio", "mantenimiento", "cuarentena"].includes(s)) return "bad";
  return "brand";
}

export function WmsDashboardPanel({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const { snap, commit } = useWmsLive();
  const matched = operatorForAppUser(snap, user);
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const kpis = computeTowerKpis(snap, "2026-08", siteId);
  const occ = occupancyByZone(snap.slots.filter((s) => s.siteId === siteId));
  const site = snap.sites.find((s) => s.id === siteId) ?? snap.sites[0];
  const alerts = computeWmsAlerts(snap, new Date(WMS_DEMO_NOW), siteId);
  const counts = alertCounts(alerts);
  const unit = computeUnitEconomics(snap, siteId);
  const coverage = computeShiftCoverage(snap, siteId);
  const openGaps = coverage.gaps.filter((g) => g.gap < 0).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            <Building2 className="h-3.5 w-3.5" />
            {snap.org.plan} · {snap.sites.length} {lang === "es" ? "centros" : "sites"}
          </p>
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)] md:text-3xl">
            {site?.name ?? "Campo Norte"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "Stock, flota, gente y euros — con alertas de batería, caducidad y cut-off en el mismo ritmo."
              : "Stock, fleet, people and euros — battery, expiry and cut-off alerts in the same rhythm."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {snap.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.city} · {s.code}
              </option>
            ))}
          </select>
          <Badge tone="brand">{site?.code}</Badge>
          <Badge tone={counts.critical ? "bad" : counts.warn ? "warn" : "good"}>
            {counts.total} {lang === "es" ? "alertas" : "alerts"}
          </Badge>
        </div>
      </header>

      {matched && <WmsJornadaCard lang={lang} snap={snap} operatorId={matched.id} onChange={commit} />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={lang === "es" ? "Ocupación" : "Occupancy"}
          lang={lang}
          metrics={[
            { label: lang === "es" ? "Huecos ocupados" : "Occupied slots", value: `${kpis.occupancyPct}%`, deltaPct: 2.1 },
            { label: lang === "es" ? "Libres" : "Free", value: String(kpis.freeSlots) },
          ]}
          footnote={`${kpis.occupiedSlots} / ${kpis.occupiedSlots + kpis.freeSlots} ${lang === "es" ? "slots vivos" : "live slots"}`}
        />
        <StatCard
          title={lang === "es" ? "Mercancía" : "Goods"}
          lang={lang}
          metrics={[
            { label: lang === "es" ? "Palets vivos" : "Live pallets", value: String(kpis.palletsLive) },
            { label: lang === "es" ? "Bajo mínimo" : "Below min", value: String(kpis.lowStockSkus), lowerIsBetter: true },
          ]}
          footnote={
            kpis.expiringSoon
              ? lang === "es"
                ? `${kpis.expiringSoon} caducan en 7 días`
                : `${kpis.expiringSoon} expire in 7 days`
              : undefined
          }
        />
        <StatCard
          title={lang === "es" ? "Flota & gente" : "Fleet & people"}
          lang={lang}
          metrics={[
            { label: lang === "es" ? "Carretillas ON" : "Trucks ON", value: String(kpis.fleetOnline) },
            { label: lang === "es" ? "Operarios" : "Operators", value: String(kpis.operatorsActive) },
          ]}
          footnote={
            kpis.batteryAlerts
              ? lang === "es"
                ? `${kpis.batteryAlerts} batería < 25%`
                : `${kpis.batteryAlerts} battery < 25%`
              : lang === "es"
                ? `${kpis.fleetCharging} en carga`
                : `${kpis.fleetCharging} charging`
          }
        />
        <StatCard
          title={lang === "es" ? "Economía hoy" : "Economics today"}
          lang={lang}
          metrics={[
            { label: lang === "es" ? "Coste mes" : "Month cost", value: euro(kpis.costMonthEur, lang), deltaPct: ((kpis.costMonthEur / kpis.costBudgetEur) - 1) * 100, lowerIsBetter: true },
            { label: lang === "es" ? "Mano de obra hoy" : "Labor today", value: euro(kpis.laborCostTodayEur, lang) },
          ]}
          footnote={`${lang === "es" ? "€/palet movido" : "€/pallet move"} ${unit.costPerPalletMoveEur.toFixed(2)} · ${lang === "es" ? "huecos de turno" : "shift gaps"} ${openGaps}`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card title={lang === "es" ? "€ / palet movido" : "€ / pallet move"}>
          <p className="flex items-center gap-2 text-2xl font-semibold text-[var(--ink)]">
            <Coins className="h-5 w-5 text-[var(--accent)]" />
            {unit.costPerPalletMoveEur.toFixed(2)} €
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {unit.palletMoves} {lang === "es" ? "movimientos RF hoy" : "RF moves today"}
          </p>
        </Card>
        <Card title={lang === "es" ? "€ / línea pick" : "€ / pick line"}>
          <p className="flex items-center gap-2 text-2xl font-semibold text-[var(--ink)]">
            <ScanBarcode className="h-5 w-5 text-[var(--accent)]" />
            {unit.costPerPickLineEur.toFixed(2)} €
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {unit.pickLinesDone}/{unit.pickLinesDone + unit.pickLinesOpen} {lang === "es" ? "líneas picadas" : "lines picked"}
          </p>
        </Card>
        <Card title={lang === "es" ? "Cobertura de turnos" : "Shift coverage"}>
          <p className="flex items-center gap-2 text-2xl font-semibold text-[var(--ink)]">
            {openGaps ? (
              <CircleAlert className="h-5 w-5 text-[var(--danger)]" />
            ) : (
              <Users className="h-5 w-5 text-[var(--accent)]" />
            )}
            {openGaps}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {lang === "es" ? "huecos vs dotación mínima" : "gaps vs minimum staffing"}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card
          title={lang === "es" ? "Ocupación por zona" : "Occupancy by zone"}
          subtitle={
            lang === "es"
              ? `Mapa vivo · ${site?.city ?? "Campo Norte"}`
              : `Live map · ${site?.city ?? "Campo Norte"}`
          }
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occ.map((o) => ({ ...o, name: ZONE_LABEL[o.zone as keyof typeof ZONE_LABEL]?.[lang] ?? o.zone }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in oklab, var(--ink) 12%, transparent)" />
                <XAxis dataKey="name" tick={{ fill: "var(--ink-muted)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--glass-strong)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="occupied" name={lang === "es" ? "Ocupados" : "Occupied"} radius={[8, 8, 0, 0]}>
                  {occ.map((o) => (
                    <Cell key={o.zone} fill={o.pct > 85 ? "var(--danger)" : o.pct > 70 ? "var(--warn-ink)" : "var(--accent)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title={lang === "es" ? "Flujo del día" : "Day flow"}
          subtitle={lang === "es" ? "Pulsa una fila para ir a su sección" : "Tap a row to open its section"}
        >
          <ul className="space-y-3 text-sm">
            {(
              [
                {
                  id: "recepcion",
                  icon: Truck,
                  label: lang === "es" ? "ASN abiertos" : "Open ASN",
                  value: kpis.inboundOpen,
                  tone: "brand" as const,
                },
                {
                  id: "expedicion",
                  icon: Package,
                  label: lang === "es" ? "Salidas abiertas" : "Open outbound",
                  value: kpis.outboundOpen,
                  tone: "warn" as const,
                },
                {
                  id: "palets",
                  icon: AlertTriangle,
                  label: lang === "es" ? "Caducidad próxima" : "Near expiry",
                  value: kpis.expiringSoon,
                  tone: kpis.expiringSoon ? ("bad" as const) : ("good" as const),
                },
                {
                  id: "flota",
                  icon: Battery,
                  label: lang === "es" ? "Utilización flota" : "Fleet utilization",
                  value: `${fleetUtilization(snap.fleet.filter((f) => f.siteId === siteId))}%`,
                  tone: "good" as const,
                },
              ] as const
            ).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => navigateWmsSection(row.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2.5 text-left transition hover:border-[color-mix(in_oklab,var(--accent)_40%,transparent)]"
                >
                  <span className="inline-flex items-center gap-2 text-[var(--ink)]">
                    <row.icon className="h-4 w-4 text-[var(--accent)]" />
                    {row.label}
                  </span>
                  <Badge tone={row.tone}>{row.value}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title={lang === "es" ? "Prioridades del día" : "Today's priorities"}
        subtitle={
          lang === "es"
            ? "Pedidos y olas ordenados por heurística: express · urgente · cut-off · palets"
            : "Orders and waves ranked by heuristic: express · urgent · cut-off · pallets"
        }
      >
        <ul className="space-y-2">
          {rankDayPriorities(snap, siteId).map((row) => (
            <li key={row.order.id}>
              <button
                type="button"
                onClick={() => {
                  const waveId = snap.pickWaves.find(
                    (w) => w.status !== "cerrada" && w.lines.some((l) => l.orderCode === row.order.code),
                  )?.id;
                  navigateWmsSection(waveId ? "picking" : "expedicion", {
                    waveId,
                    orderId: row.order.id,
                  });
                }}
                className="flex w-full items-start justify-between gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2.5 text-left text-sm"
              >
                <span>
                  <span className="font-mono text-xs font-semibold">{row.order.code}</span>
                  <span className="mt-0.5 block text-[var(--ink)]">{row.order.customer}</span>
                  <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                    {lang === "es" ? row.reasonEs : row.reasonEn}
                    {row.waveCodes.length ? ` · ${row.waveCodes.join(", ")}` : ""}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge tone={row.done ? "good" : row.order.priority === "express" ? "bad" : row.order.priority === "urgente" ? "warn" : "neutral"}>
                    {row.done ? (lang === "es" ? "hecho" : "done") : row.order.priority}
                  </Badge>
                  {row.pickTotal > 0 && (
                    <span className="text-[11px] text-[var(--ink-muted)]">
                      {row.pickDone}/{row.pickTotal}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title={lang === "es" ? "Alertas operativas" : "Operational alerts"}
        subtitle={
          lang === "es"
            ? "Batería · caducidad · cut-off tienda · pick face vacío"
            : "Battery · expiry · store cut-off · empty pick face"
        }
      >
        <ul className="space-y-2">
          {alerts.slice(0, 10).map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2.5 text-sm"
            >
              <span>
                <span className="font-medium text-[var(--ink)]">{lang === "es" ? a.titleEs : a.titleEn}</span>
                <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                  {lang === "es" ? a.detailEs : a.detailEn}
                </span>
              </span>
              <Badge tone={a.severity === "critical" ? "bad" : a.severity === "warn" ? "warn" : "neutral"}>
                {a.kind}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export { WmsStockPanel } from "./WmsCatalog";
export { WmsPalletsPanel } from "./WmsPalletsAdmin";
export { WmsFleetPanel } from "./WmsFleetAdmin";
export { WmsOperatorsPanel } from "./WmsOperatorsAdmin";
export { WmsInboundPanel } from "./WmsInboundAdmin";


export function WmsOutboundPanel({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const carriers = snap.carriers.filter((c) => c.active && c.orgId === snap.org.id);
  const ranked = rankDayPriorities(snap);
  const itinerary = outboundItinerary(snap);
  const [customer, setCustomer] = useState("");
  const [dock, setDock] = useState("M-05");
  const [cutOff, setCutOff] = useState("2026-08-15T18:00");
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const [pallets, setPallets] = useState(3);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Expedición · olas" : "Outbound · waves"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Pedido del día → itinerario de muelle → abrir ola con palets reales del pasillo. El tracking lo escribes tú."
            : "Daily order → dock itinerary → open a wave from real pick-face pallets. You type the tracking."}
        </p>
      </header>
      <Card title={lang === "es" ? "Pedido diario" : "Daily order"}>
        <form
          className="grid gap-2 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const result = createOutboundOrder(snap, {
              customer,
              cutOff: new Date(cutOff).toISOString(),
              dock,
              siteId,
              lines: pallets,
              pallets,
              priority: "urgente",
            });
            if (!result.ok) {
              setMsg(lang === "es" ? "Faltan datos del pedido" : "Order data missing");
              return;
            }
            commit(result.snap);
            setCustomer("");
            setMsg(null);
          }}
        >
          <input
            required
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder={lang === "es" ? "Cliente / tienda" : "Customer / store"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={cutOff}
            onChange={(e) => setCutOff(e.target.value)}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <input
            value={dock}
            onChange={(e) => setDock(e.target.value)}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
          />
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
            type="number"
            min={1}
            value={pallets}
            onChange={(e) => setPallets(Number(e.target.value))}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">
            {lang === "es" ? "Crear pedido" : "Create order"}
          </button>
        </form>
        {msg && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
      </Card>
      <Card
        title={lang === "es" ? "Itinerario de muelle" : "Dock itinerary"}
        subtitle={lang === "es" ? "Orden de salida según ventana y prioridad" : "Outbound sequence by window and priority"}
      >
        <ol className="space-y-2">
          {itinerary.map((stop) => (
            <li
              key={stop.order.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm"
            >
              <span>
                <span className="mr-2 font-semibold text-[var(--accent)]">{stop.seq}</span>
                <span className="font-mono text-xs">{stop.order.code}</span>
                <span className="ml-2 text-[var(--ink-muted)]">
                  {stop.order.dock} · {stop.order.customer}
                </span>
              </span>
              <Badge tone="neutral">
                {new Date(stop.windowStart ?? stop.order.cutOff).toLocaleTimeString(lang === "es" ? "es-ES" : "en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Badge>
            </li>
          ))}
        </ol>
      </Card>
      <div className="flex flex-wrap gap-2">
        {carriers.map((c) => (
          <Badge key={c.id} tone="neutral">
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-3 w-3" />
              {c.name} · {CARRIER_KIND_LABEL[c.kind][lang]}
            </span>
          </Badge>
        ))}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <tr>
                <th className="pb-2 pr-3">{lang === "es" ? "Pedido" : "Order"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Cliente" : "Customer"}</th>
                <th className="pb-2 pr-3">Cut-off</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Carrier" : "Carrier"}</th>
                <th className="pb-2 pr-3">Tracking</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Prioridad" : "Priority"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Estado" : "Status"}</th>
                <th className="pb-2 pr-3">Palets</th>
                <th className="pb-2">{lang === "es" ? "Ola" : "Wave"}</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row) => {
                const o = row.order;
                return (
                <tr key={o.id} className="border-t border-[var(--glass-border)]">
                  <td className="py-2.5 pr-3 font-mono text-xs">{o.code}</td>
                  <td className="py-2.5 pr-3">
                    {o.customer}
                    <span className="mt-0.5 block text-[11px] text-[var(--ink-muted)]">
                      {lang === "es" ? row.reasonEs : row.reasonEn}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--ink-muted)]">
                    {new Date(o.cutOff).toLocaleTimeString(lang === "es" ? "es-ES" : "en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      className="rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                      value={o.carrierId ?? ""}
                      onChange={(e) => {
                        const result = assignOutboundCarrier(snap, o.id, e.target.value);
                        if (result.ok) commit(result.snap);
                      }}
                    >
                      {carriers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 pr-3">
                    <input
                      defaultValue={o.tracking ?? ""}
                      placeholder={lang === "es" ? "Tracking real" : "Real tracking"}
                      className="w-36 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 font-mono text-[11px]"
                      onBlur={(e) => {
                        const result = setOutboundTracking(snap, o.id, e.target.value);
                        if (result.ok) commit(result.snap);
                      }}
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={row.done ? "good" : o.priority === "normal" ? "neutral" : o.priority === "urgente" ? "warn" : "bad"}>
                      {row.done ? (lang === "es" ? "hecho" : "done") : o.priority}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 font-semibold">{o.pallets}</td>
                  <td className="py-2.5 text-xs text-[var(--ink-muted)]">
                    {row.waveCodes.length ? (
                      <button
                        type="button"
                        className="font-semibold text-[var(--accent)]"
                        onClick={() =>
                          navigateWmsSection("picking", {
                            waveId: snap.pickWaves.find((w) => row.waveCodes.includes(w.code))?.id,
                            orderId: o.id,
                          })
                        }
                      >
                        {row.waveCodes.join(", ")} · {row.pickDone}/{row.pickTotal}
                      </button>
                    ) : row.done ? (
                      "—"
                    ) : (
                      <button
                        type="button"
                        className="rounded-full border border-[var(--glass-border)] px-2 py-1 text-[11px] font-semibold"
                        onClick={() => {
                          const result = openWaveFromOrder(snap, o.id);
                          if (!result.ok) {
                            setMsg(
                              result.error === "no_free_pallets"
                                ? lang === "es"
                                  ? "No hay palets libres en cara de picking"
                                  : "No free pick-face pallets"
                                : result.error,
                            );
                            return;
                          }
                          commit(result.snap);
                          navigateWmsSection("picking", { waveId: result.waveId, orderId: o.id });
                        }}
                      >
                        {lang === "es" ? "Abrir ola" : "Open wave"}
                      </button>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function WmsSitePnlCard({ lang, siteId }: { lang: Lang; siteId?: string }) {
  const { snap } = useWmsLive();
  const sid = siteId ?? snap.sites[0]?.id;
  const pnl = computeSitePnl(snap, "2026-08", sid);
  const site = snap.sites.find((s) => s.id === sid);

  return (
    <Card
      title={lang === "es" ? "P&L del centro (3PL)" : "Site P&L (3PL)"}
      subtitle={`${site?.name ?? CAMPO_NORTE_ORG.legalName} · ${pnl.month} · ${
        lang === "es" ? "tarifas WMS locales, no es tesorería del Hub" : "local WMS tariffs, not Hub treasury"
      }`}
    >
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Ingresos almacén" : "Warehouse revenue"}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xl font-semibold text-[var(--ink)]">
            <Banknote className="h-4 w-4 text-[var(--accent)]" />
            {euro(pnl.revenueEur, lang)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">OPEX</p>
          <p className="mt-1 text-xl font-semibold text-[var(--ink)]">{euro(pnl.opexEur, lang)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Contribución" : "Contribution"}
          </p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold",
              pnl.contributionEur < 0 ? "text-[var(--danger)]" : "text-[var(--ok)]",
            )}
          >
            {euro(pnl.contributionEur, lang)}
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm text-[var(--ink-muted)]">
        <li className="flex justify-between">
          <span>{lang === "es" ? "Almacenaje (hueco/día)" : "Storage (slot/day)"}</span>
          <span className="font-medium text-[var(--ink)]">{euro(pnl.storageEur, lang)}</span>
        </li>
        <li className="flex justify-between">
          <span>{lang === "es" ? "Handling in/out" : "Handling in/out"}</span>
          <span className="font-medium text-[var(--ink)]">{euro(pnl.handlingEur, lang)}</span>
        </li>
        <li className="flex justify-between">
          <span>{lang === "es" ? "Líneas de picking" : "Pick lines"}</span>
          <span className="font-medium text-[var(--ink)]">{euro(pnl.pickEur, lang)}</span>
        </li>
        <li className="flex justify-between border-t border-[var(--glass-border)] pt-1.5">
          <span>{lang === "es" ? "Margen contribución" : "Contribution margin"}</span>
          <span className="font-semibold text-[var(--ink)]">{pnl.marginPct.toFixed(1)}%</span>
        </li>
      </ul>
      <p className="mt-3 text-xs text-[var(--ink-muted)]">
        {lang === "es"
          ? "OPEX del WMS (mano de obra, energía, flota, espacio, merma, IT). Tesorería sigue derivando cobros de facturas; esto es el P&L operativo del hub."
          : "WMS opex (labor, energy, fleet, space, shrink, IT). Treasury still derives cash from invoices; this is the hub operating P&L."}
      </p>
    </Card>
  );
}

export function WmsCostsPanel({ lang }: { lang: Lang }) {
  const { snap } = useWmsLive();
  const month = "2026-08";
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const lines = monthCosts(snap.costs, month, siteId);
  const total = lines.reduce((s, c) => s + c.amountEur, 0);
  const budget = lines.reduce((s, c) => s + c.budgetEur, 0);
  const chart = lines.map((c) => ({
    name: c.center,
    real: c.amountEur,
    budget: c.budgetEur,
  }));
  const unit = computeUnitEconomics(snap, siteId);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
            {lang === "es" ? "Costes & economía del centro" : "Site costs & economics"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "€/palet movido, €/línea pick, OPEX vs presupuesto y P&L 3PL del hub."
              : "€/pallet move, €/pick line, opex vs budget and hub 3PL P&L."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {snap.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.city} · {s.code}
              </option>
            ))}
          </select>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">{month}</p>
            <p className="text-xl font-semibold text-[var(--ink)]">{euro(total, lang)}</p>
            <p className={cn("text-xs font-semibold", total > budget ? "text-[var(--danger)]" : "text-[var(--ok)]")}>
              {lang === "es" ? "Presupuesto" : "Budget"} {euro(budget, lang)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title={lang === "es" ? "Coste unitario hoy" : "Unit cost today"}>
          <div className="flex flex-wrap gap-4">
            <p className="inline-flex items-center gap-2 text-sm">
              <ArrowLeftRight className="h-4 w-4 text-[var(--accent)]" />
              <span>
                <span className="block text-xs text-[var(--ink-muted)]">{lang === "es" ? "Palet movido" : "Pallet move"}</span>
                <span className="font-semibold">{unit.costPerPalletMoveEur.toFixed(2)} €</span>
              </span>
            </p>
            <p className="inline-flex items-center gap-2 text-sm">
              <ClipboardCheck className="h-4 w-4 text-[var(--accent)]" />
              <span>
                <span className="block text-xs text-[var(--ink-muted)]">{lang === "es" ? "Línea pick" : "Pick line"}</span>
                <span className="font-semibold">{unit.costPerPickLineEur.toFixed(2)} €</span>
              </span>
            </p>
          </div>
        </Card>
        <WmsSitePnlCard lang={lang} siteId={siteId} />
      </div>

      <Card title={lang === "es" ? "Real vs presupuesto" : "Actual vs budget"}>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in oklab, var(--ink) 12%, transparent)" />
              <XAxis dataKey="name" tick={{ fill: "var(--ink-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 11 }} />
              <Tooltip
                formatter={(v) => euro(Number(v), lang)}
                contentStyle={{
                  background: "var(--glass-strong)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="budget" fill="color-mix(in oklab, var(--ink) 25%, transparent)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="real" fill="var(--accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lines.map((c) => (
          <Card key={c.id} title={c.label} subtitle={c.center}>
            <p className="text-2xl font-semibold text-[var(--ink)]">{euro(c.amountEur, lang)}</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Presupuesto" : "Budget"} {euro(c.budgetEur, lang)}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Iconos exportados para el nav (evita duplicar imports en shell). */
export const WmsNavIcons = {
  Warehouse,
  Boxes,
  Grid3X3,
  Package,
  Forklift,
  Users,
  Truck,
} as const;
