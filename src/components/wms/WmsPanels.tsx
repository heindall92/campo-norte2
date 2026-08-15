import { Badge, Card } from "@/components/CrmChrome";
import { StatCard } from "@/components/ui/StatCard";
import type { Lang } from "@/lib/i18n";
import {
  CATEGORY_LABEL,
  FLEET_KIND_LABEL,
  ZONE_LABEL,
  WMS_DEMO_NOW,
  alertCounts,
  computeTowerKpis,
  computeWmsAlerts,
  fleetUtilization,
  loadWmsSnapshot,
  monthCosts,
  occupancyByZone,
  stockByCategory,
  type FleetStatus,
  type PalletStatus,
  type SlotStatus,
  type WmsSnapshot,
} from "@/lib/wms";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Battery,
  Boxes,
  Forklift,
  Grid3X3,
  Package,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { useMemo, useState } from "react";
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

function useWms(): WmsSnapshot {
  return useMemo(() => loadWmsSnapshot(), []);
}

export function WmsDashboardPanel({ lang }: { lang: Lang }) {
  const snap = useWms();
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const kpis = computeTowerKpis(snap, "2026-08", siteId);
  const occ = occupancyByZone(snap.slots.filter((s) => s.siteId === siteId));
  const site = snap.sites.find((s) => s.id === siteId) ?? snap.sites[0];
  const alerts = computeWmsAlerts(snap, new Date(WMS_DEMO_NOW), siteId);
  const counts = alertCounts(alerts);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            {lang === "es" ? "Torre de control" : "Control tower"}
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
          footnote={`${lang === "es" ? "Presupuesto" : "Budget"} ${euro(kpis.costBudgetEur, lang)}`}
        />
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
          subtitle={lang === "es" ? "Recepción · expedición · alertas" : "Inbound · outbound · alerts"}
        >
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-[var(--ink)]">
                <Truck className="h-4 w-4 text-[var(--accent)]" />
                {lang === "es" ? "ASN abiertos" : "Open ASN"}
              </span>
              <Badge tone="brand">{kpis.inboundOpen}</Badge>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-[var(--ink)]">
                <Package className="h-4 w-4 text-[var(--accent)]" />
                {lang === "es" ? "Salidas abiertas" : "Open outbound"}
              </span>
              <Badge tone="warn">{kpis.outboundOpen}</Badge>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-[var(--ink)]">
                <AlertTriangle className="h-4 w-4 text-[var(--warn-ink)]" />
                {lang === "es" ? "Caducidad próxima" : "Near expiry"}
              </span>
              <Badge tone={kpis.expiringSoon ? "bad" : "good"}>{kpis.expiringSoon}</Badge>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-[var(--ink)]">
                <Battery className="h-4 w-4 text-[var(--accent)]" />
                {lang === "es" ? "Utilización flota" : "Fleet utilization"}
              </span>
              <Badge tone="good">{fleetUtilization(snap.fleet)}%</Badge>
            </li>
          </ul>
        </Card>
      </div>

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

export function WmsStockPanel({ lang }: { lang: Lang }) {
  const snap = useWms();
  const byCat = stockByCategory(snap.pallets, snap.skus, lang);
  const skuMap = useMemo(() => new Map(snap.skus.map((s) => [s.id, s])), [snap.skus]);
  const unitsBySku = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of snap.pallets) {
      if (p.status === "expedido") continue;
      m.set(p.skuId, (m.get(p.skuId) ?? 0) + p.qty);
    }
    return m;
  }, [snap.pallets]);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Stock por categoría" : "Stock by category"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Control ABC · mínimos · unidades vivas en el hub."
            : "ABC control · mins · live units in the hub."}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {byCat.map((c) => (
          <Card key={c.category} title={c.label}>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-3xl font-semibold text-[var(--ink)]">{c.pallets}</p>
                <p className="text-xs text-[var(--ink-muted)]">{lang === "es" ? "palets" : "pallets"}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-[var(--ink)]">{c.units.toLocaleString(lang === "es" ? "es-ES" : "en-GB")}</p>
                <p className="text-xs text-[var(--ink-muted)]">{lang === "es" ? "unidades" : "units"}</p>
              </div>
            </div>
            {c.belowMin > 0 && (
              <p className="mt-3 text-xs font-semibold text-[var(--danger)]">
                {c.belowMin} SKU {lang === "es" ? "bajo mínimo" : "below min"}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card title={lang === "es" ? "Catálogo SKU" : "SKU catalog"}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <tr>
                <th className="pb-2 pr-3">SKU</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Producto" : "Product"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Categoría" : "Category"}</th>
                <th className="pb-2 pr-3">ABC</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Stock" : "Stock"}</th>
                <th className="pb-2">Min / Max</th>
              </tr>
            </thead>
            <tbody>
              {snap.skus.map((sku) => {
                const units = unitsBySku.get(sku.id) ?? 0;
                const low = units < sku.minStock;
                return (
                  <tr key={sku.id} className="border-t border-[var(--glass-border)]">
                    <td className="py-2.5 pr-3 font-mono text-xs">{sku.sku}</td>
                    <td className="py-2.5 pr-3">{sku.name}</td>
                    <td className="py-2.5 pr-3">{CATEGORY_LABEL[sku.category][lang]}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={sku.abc === "A" ? "brand" : sku.abc === "B" ? "warn" : "neutral"}>{sku.abc}</Badge>
                    </td>
                    <td className={cn("py-2.5 pr-3 font-semibold", low && "text-[var(--danger)]")}>{units}</td>
                    <td className="py-2.5 text-[var(--ink-muted)]">
                      {sku.minStock} / {sku.maxStock}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 hidden text-xs text-[var(--ink-muted)]">{skuMap.size}</p>
      </Card>
    </div>
  );
}

export function WmsPalletsPanel({ lang }: { lang: Lang }) {
  const snap = useWms();
  const skuMap = useMemo(() => new Map(snap.skus.map((s) => [s.id, s])), [snap.skus]);
  const slotMap = useMemo(() => new Map(snap.slots.map((s) => [s.id, s])), [snap.slots]);
  const [q, setQ] = useState("");
  const rows = snap.pallets
    .filter((p) => {
      if (!q.trim()) return true;
      const sku = skuMap.get(p.skuId);
      const hay = `${p.sscc} ${p.lot} ${sku?.name ?? ""} ${sku?.sku ?? ""}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    })
    .slice(0, 80);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
            {lang === "es" ? "Palets · SSCC" : "Pallets · SSCC"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "Trazabilidad por palet, lote, caducidad y hueco."
              : "Traceability by pallet, lot, expiry and slot."}
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lang === "es" ? "Buscar SSCC, lote, SKU…" : "Search SSCC, lot, SKU…"}
          className="w-full max-w-xs rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        />
      </header>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <tr>
                <th className="pb-2 pr-3">SSCC</th>
                <th className="pb-2 pr-3">SKU</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Cant." : "Qty"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Hueco" : "Slot"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Estado" : "Status"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Caducidad" : "Expiry"}</th>
                <th className="pb-2">{lang === "es" ? "Proveedor" : "Supplier"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const sku = skuMap.get(p.skuId);
                const slot = p.slotId ? slotMap.get(p.slotId) : null;
                return (
                  <tr key={p.id} className="border-t border-[var(--glass-border)]">
                    <td className="py-2.5 pr-3 font-mono text-xs">{p.sscc}</td>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{sku?.name ?? p.skuId}</p>
                      <p className="text-xs text-[var(--ink-muted)]">{sku?.sku}</p>
                    </td>
                    <td className="py-2.5 pr-3">{p.qty}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{slot?.code ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--ink-muted)]">{p.expiry ?? "—"}</td>
                    <td className="py-2.5">{p.supplier}</td>
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

export function WmsFleetPanel({ lang }: { lang: Lang }) {
  const snap = useWms();
  const opMap = useMemo(() => new Map(snap.operators.map((o) => [o.id, o])), [snap.operators]);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Flota eléctrica" : "Electric fleet"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Carretillas, retráctiles (incl. stand-up doble) y recogepedidos: batería, horas, coste/hora y ola asignada."
            : "Forklifts, reach trucks (incl. stand-up double) and pickers: battery, hours, cost/hour and assigned wave."}
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snap.fleet.map((f) => {
          const op = f.operatorId ? opMap.get(f.operatorId) : null;
          const waves = snap.pickWaves.filter((w) => w.fleetId === f.id);
          const site = snap.sites.find((s) => s.id === f.siteId);
          return (
            <Card key={f.id} title={`${f.code} · ${f.brand}`} subtitle={f.model}>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone={statusTone(f.status)}>{f.status}</Badge>
                <Badge tone={f.kind === "retractil_doble" ? "warn" : "neutral"}>
                  {FLEET_KIND_LABEL[f.kind][lang]}
                </Badge>
                {site && <Badge tone="neutral">{site.city}</Badge>}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
                    <Battery className="h-3.5 w-3.5" />
                    {lang === "es" ? "Batería" : "Battery"}
                  </span>
                  <span className={cn("font-semibold", f.batteryPct < 25 && "text-[var(--danger)]")}>
                    {f.batteryPct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${f.batteryPct}%`,
                      background: f.batteryPct < 25 ? "var(--danger)" : "var(--accent)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-[var(--ink-muted)]">
                  <span>{lang === "es" ? "Horas hoy" : "Hours today"}</span>
                  <span className="font-medium text-[var(--ink)]">{f.hoursToday.toFixed(1)} h</span>
                </div>
                <div className="flex justify-between text-[var(--ink-muted)]">
                  <span>{lang === "es" ? "Coste/h" : "Cost/h"}</span>
                  <span className="font-medium text-[var(--ink)]">{f.costPerHour.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-[var(--ink-muted)]">
                  <span>{lang === "es" ? "Operario" : "Operator"}</span>
                  <span className="font-medium text-[var(--ink)]">{op?.name ?? "—"}</span>
                </div>
                {waves.length > 0 && (
                  <div className="flex justify-between text-[var(--ink-muted)]">
                    <span>{lang === "es" ? "Ola asignada" : "Assigned wave"}</span>
                    <span className="font-medium text-[var(--ink)]">
                      {waves.map((w) => w.code).join(", ")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--ink-muted)]">
                  <span>{lang === "es" ? "Próx. servicio" : "Next service"}</span>
                  <span className="font-medium text-[var(--ink)]">{f.nextServiceAt}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function WmsOperatorsPanel({ lang }: { lang: Lang }) {
  const snap = useWms();
  const labor = snap.operators.reduce((s, o) => s + o.hoursToday * o.costPerHour, 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
            {lang === "es" ? "Operarios & RRHH operativo" : "Operators & floor HR"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "Turnos, certificaciones, productividad y coste real del día."
              : "Shifts, certifications, productivity and real day cost."}
          </p>
        </div>
        <Badge tone="brand">
          {lang === "es" ? "Coste hoy" : "Cost today"} · {euro(labor, lang)}
        </Badge>
      </header>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <tr>
                <th className="pb-2 pr-3">{lang === "es" ? "Operario" : "Operator"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Rol" : "Role"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Turno" : "Shift"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Movimientos" : "Moves"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Horas" : "Hours"}</th>
                <th className="pb-2 pr-3">€/h</th>
                <th className="pb-2">{lang === "es" ? "Extras sem." : "OT week"}</th>
              </tr>
            </thead>
            <tbody>
              {snap.operators.map((o) => (
                <tr key={o.id} className="border-t border-[var(--glass-border)]">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium">{o.name}</p>
                    <p className="font-mono text-xs text-[var(--ink-muted)]">{o.code}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone="neutral">{o.role}</Badge>
                  </td>
                  <td className="py-2.5 pr-3">{o.shift}</td>
                  <td className="py-2.5 pr-3 font-semibold">{o.movesToday}</td>
                  <td className="py-2.5 pr-3">{o.hoursToday.toFixed(1)}</td>
                  <td className="py-2.5 pr-3">{o.costPerHour.toFixed(2)}</td>
                  <td className="py-2.5">
                    <Badge tone={o.overtimeHoursWeek > 4 ? "warn" : "good"}>{o.overtimeHoursWeek} h</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function WmsInboundPanel({ lang }: { lang: Lang }) {
  const snap = useWms();
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Recepción · ASN" : "Receiving · ASN"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Muelle, descarga, putaway y cierre de entrada."
            : "Dock, unload, putaway and inbound close."}
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {snap.inbound.map((asn) => {
          const pct = asn.palletsExpected
            ? Math.round((asn.palletsDone / asn.palletsExpected) * 100)
            : 0;
          return (
            <Card key={asn.id} title={asn.code} subtitle={asn.supplier}>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone={statusTone(asn.status)}>{asn.status}</Badge>
                <Badge tone="neutral">{asn.dock}</Badge>
              </div>
              <div className="mb-2 flex justify-between text-sm text-[var(--ink-muted)]">
                <span>
                  {asn.palletsDone}/{asn.palletsExpected} {lang === "es" ? "palets" : "pallets"}
                </span>
                <span>{asn.lines} lines</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-[var(--ink-muted)]">ETA {new Date(asn.eta).toLocaleString(lang === "es" ? "es-ES" : "en-GB")}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function WmsOutboundPanel({ lang }: { lang: Lang }) {
  const snap = useWms();
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Expedición · olas" : "Outbound · waves"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Picking, embalaje, muelle y corte de tienda."
            : "Picking, pack, dock and store cut-off."}
        </p>
      </header>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <tr>
                <th className="pb-2 pr-3">{lang === "es" ? "Pedido" : "Order"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Cliente" : "Customer"}</th>
                <th className="pb-2 pr-3">Cut-off</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Prioridad" : "Priority"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Estado" : "Status"}</th>
                <th className="pb-2">Palets</th>
              </tr>
            </thead>
            <tbody>
              {snap.outbound.map((o) => (
                <tr key={o.id} className="border-t border-[var(--glass-border)]">
                  <td className="py-2.5 pr-3 font-mono text-xs">{o.code}</td>
                  <td className="py-2.5 pr-3">{o.customer}</td>
                  <td className="py-2.5 pr-3 text-[var(--ink-muted)]">
                    {new Date(o.cutOff).toLocaleTimeString(lang === "es" ? "es-ES" : "en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={o.priority === "normal" ? "neutral" : o.priority === "urgente" ? "warn" : "bad"}>
                      {o.priority}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                  </td>
                  <td className="py-2.5 font-semibold">{o.pallets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function WmsCostsPanel({ lang }: { lang: Lang }) {
  const snap = useWms();
  const month = "2026-08";
  const lines = monthCosts(snap.costs, month, snap.sites[0]?.id);
  const total = lines.reduce((s, c) => s + c.amountEur, 0);
  const budget = lines.reduce((s, c) => s + c.budgetEur, 0);
  const chart = lines.map((c) => ({
    name: c.center,
    real: c.amountEur,
    budget: c.budgetEur,
  }));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
            {lang === "es" ? "Costes del centro" : "Site costs"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "Mano de obra, energía, flota, espacio, merma e IT — vs presupuesto."
              : "Labor, energy, fleet, space, shrinkage and IT — vs budget."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">{month}</p>
          <p className="text-xl font-semibold text-[var(--ink)]">{euro(total, lang)}</p>
          <p className={cn("text-xs font-semibold", total > budget ? "text-[var(--danger)]" : "text-[var(--ok)]")}>
            {lang === "es" ? "Presupuesto" : "Budget"} {euro(budget, lang)} ·{" "}
            {(((total / budget) - 1) * 100).toFixed(1)}%
          </p>
        </div>
      </header>

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
