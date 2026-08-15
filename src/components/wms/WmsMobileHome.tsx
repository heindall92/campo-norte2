import { Badge } from "@/components/CrmChrome";
import { useAuth } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import type { AppSection } from "@/lib/notifications";
import {
  navigateWmsSection,
  operatorForAppUser,
  operatorJornada,
  rankDayPriorities,
} from "@/lib/wms";
import { ArrowLeftRight, ChevronRight, ClipboardCheck, Clock, Package, ScanBarcode, Truck } from "lucide-react";
import { WmsAisleTraceCard } from "./WmsFloorBoard";
import { WmsJornadaCard, WmsShiftCloseCard } from "./WmsJornadaCard";
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

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          {lang === "es" ? "Planta hoy" : "Floor today"}
        </p>
        <h2 className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)]">
          {matched?.name ?? (lang === "es" ? "Torre de control" : "Control tower")}
        </h2>
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
