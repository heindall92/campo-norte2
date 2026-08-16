import { Badge } from "@/components/CrmChrome";
import { useAuth } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import type { AppSection } from "@/lib/notifications";
import {
  computeTowerPulse,
  navigateWmsSection,
  operatorForAppUser,
  operatorJornada,
  pendingOfflineEvents,
  rankDayPriorities,
  recommendTowerActions,
  WMS_DEMO_NOW,
} from "@/lib/wms";
import { ArrowLeftRight, ChevronRight, ClipboardCheck, Clock, Package, ScanBarcode, Truck, WifiOff } from "lucide-react";
import { WmsAisleTraceCard } from "./WmsFloorBoard";
import { WmsJornadaCard, WmsShiftCloseCard } from "./WmsJornadaCard";
import { WmsModeBadge } from "./WmsModeBadge";
import { useWmsLive } from "./useWmsLive";

export function WmsMobileHome({
  lang,
  onNavigate,
}: {
  lang: Lang;
  onNavigate: (section: AppSection) => void;
}) {
  const { user } = useAuth();
  const { snap, commit } = useWmsLive();
  const matched = operatorForAppUser(snap, user);
  const jornada = matched ? operatorJornada(snap, matched.id) : null;
  const siteId = matched?.siteId ?? snap.sites[0]?.id;
  const priorities = rankDayPriorities(snap, siteId).slice(0, 5);
  const pulse = computeTowerPulse(snap, siteId, new Date(WMS_DEMO_NOW));
  const actions = recommendTowerActions(snap, siteId, new Date(WMS_DEMO_NOW)).slice(0, 2);
  const queued = pendingOfflineEvents().length;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          {lang === "es" ? "Planta hoy" : "Floor today"}
        </p>
        <h2 className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)]">
          {matched?.name ?? (lang === "es" ? "Torre de control" : "Control tower")}
        </h2>
        <div className="mt-1">
          <WmsModeBadge lang={lang} />
        </div>
        {jornada && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <Clock className="h-3.5 w-3.5" />
            {jornada.windowLabel} · {jornada.hoursWorked.toFixed(1)} h
            {jornada.clockedIn
              ? lang === "es"
                ? " · dentro"
                : " · in"
              : lang === "es"
                ? " · fuera"
                : " · out"}
          </p>
        )}
      </div>

      {matched && <WmsJornadaCard lang={lang} snap={snap} operatorId={matched.id} onChange={commit} />}

      <div className="rounded-[1.15rem] bg-[var(--field-bg)] px-3 py-2.5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
          {lang === "es" ? "¿Qué está pasando?" : "What's happening?"}
        </p>
        <p className="mt-1 text-xs text-[var(--ink)]">
          {lang === "es" ? "Stock" : "Stock"} {pulse.stockAvailabilityPct}% ·{" "}
          {lang === "es" ? "olas" : "waves"} {pulse.wavesOpen} · picking {pulse.pickingProgressPct}% ·{" "}
          {lang === "es" ? "muelle" : "dock"} {pulse.dockOccupancyPct}%
        </p>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
          {lang === "es" ? "Pedidos pend." : "Orders pend."} {pulse.ordersPending} ·{" "}
          {lang === "es" ? "retraso ASN" : "ASN delay"} {pulse.asnDelayed} ·{" "}
          {lang === "es" ? "cut-off" : "cut-off"} {pulse.cutOffRisk} ·{" "}
          {lang === "es" ? "flota" : "fleet"} {pulse.fleetOperative}/{pulse.fleetTotal}
        </p>
        {queued > 0 && (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--warn-ink)]">
            <WifiOff className="h-3 w-3" />
            {queued} {lang === "es" ? "eventos RF a sincronizar" : "RF events to sync"}
          </p>
        )}
      </div>

      {actions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
            {lang === "es" ? "¿Qué debo hacer?" : "What should I do?"}
          </p>
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              className="flex w-full min-h-11 flex-col items-start rounded-[1.15rem] bg-[var(--field-bg)] px-3 py-2.5 text-left shadow-sm"
              onClick={() => {
                navigateWmsSection(a.section, { waveId: a.waveId, orderId: a.orderId });
                onNavigate(a.section);
              }}
            >
              <span className="text-sm text-[var(--ink)]">{lang === "es" ? a.titleEs : a.titleEn}</span>
              <span className="mt-1 text-[11px] font-semibold text-[var(--accent)]">
                {lang === "es" ? a.actionEs : a.actionEn}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onNavigate("rf")}
        className="flex min-h-14 w-full flex-col items-start justify-center rounded-[1.15rem] bg-[#0f172a] px-3 py-3 text-left text-white shadow-sm"
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <ScanBarcode className="h-4 w-4 text-amber-300" />
          {lang === "es" ? "Pistola RF / PDA" : "RF / PDA gun"}
        </span>
        <span className="mt-1 text-[11px] text-white/70">
          SCAN LOCATION → SCAN SKU → CONFIRM QTY → COMPLETE
        </span>
      </button>

      <WmsAisleTraceCard lang={lang} siteId={siteId} />
      <WmsShiftCloseCard lang={lang} snap={snap} siteId={siteId} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-[var(--ink)]">
            {lang === "es" ? "Prioridades del día" : "Today's priorities"}
          </p>
          <button
            type="button"
            className="text-xs font-semibold text-[var(--accent)]"
            onClick={() => onNavigate("expedicion")}
          >
            {lang === "es" ? "Ver todas" : "See all"}
          </button>
        </div>
        <ul className="space-y-2">
          {priorities.map((row) => (
            <li key={row.order.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-[1.15rem] bg-[var(--field-bg)] px-3 py-2.5 text-left shadow-sm"
                onClick={() => {
                  const waveId = snap.pickWaves.find(
                    (w) => w.status !== "cerrada" && w.lines.some((l) => l.orderCode === row.order.code),
                  )?.id;
                  navigateWmsSection(waveId ? "picking" : "expedicion", {
                    waveId,
                    orderId: row.order.id,
                  });
                  onNavigate(waveId ? "picking" : "expedicion");
                }}
              >
                <span className="min-w-0">
                  <span className="font-mono text-[11px] font-semibold">{row.order.code}</span>
                  <span className="mt-0.5 block truncate text-sm text-[var(--ink)]">{row.order.customer}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Badge tone={row.done ? "good" : row.order.priority === "express" ? "bad" : "warn"}>
                    {row.done ? (lang === "es" ? "hecho" : "done") : row.order.priority}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onNavigate("picking")}
          className="flex min-h-[4.5rem] items-center gap-2 rounded-[1.15rem] bg-[var(--field-bg)] px-3 py-2 text-left shadow-sm"
        >
          <ScanBarcode className="h-5 w-5 text-[var(--accent)]" />
          <span className="text-sm font-semibold">{lang === "es" ? "Picar" : "Pick"}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("rf")}
          className="flex min-h-[4.5rem] items-center gap-2 rounded-[1.15rem] bg-[var(--field-bg)] px-3 py-2 text-left shadow-sm"
        >
          <Package className="h-5 w-5 text-[var(--accent)]" />
          <span className="text-sm font-semibold">RF</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("movimientos")}
          className="flex min-h-[4.5rem] items-center gap-2 rounded-[1.15rem] bg-[var(--field-bg)] px-3 py-2 text-left shadow-sm"
        >
          <ArrowLeftRight className="h-5 w-5 text-[var(--accent)]" />
          <span className="text-sm font-semibold">{lang === "es" ? "Ubicar" : "Putaway"}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("inventario")}
          className="flex min-h-[4.5rem] items-center gap-2 rounded-[1.15rem] bg-[var(--field-bg)] px-3 py-2 text-left shadow-sm"
        >
          <ClipboardCheck className="h-5 w-5 text-[var(--accent)]" />
          <span className="text-sm font-semibold">{lang === "es" ? "Conteo" : "Count"}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("expedicion")}
          className="flex min-h-[4.5rem] items-center gap-2 rounded-[1.15rem] bg-[var(--field-bg)] px-3 py-2 text-left shadow-sm"
        >
          <Truck className="h-5 w-5 text-[var(--accent)]" />
          <span className="text-sm font-semibold">{lang === "es" ? "Expedir" : "Ship"}</span>
        </button>
      </div>
    </div>
  );
}
