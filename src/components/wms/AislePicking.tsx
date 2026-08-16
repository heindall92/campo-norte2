import { Badge, Card } from "@/components/CrmChrome";
import { useAuth } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import {
  FLEET_KIND_LABEL,
  assertCanPick,
  assignWaveOperator,
  confirmPick,
  markShortage,
  navigateWmsSection,
  nextFloorTicket,
  nextOpenLine,
  operatorForAppUser,
  confirmVoicePick,
  declareUnitsMade,
  remainingOnPallet,
  reportSlotMismatch,
  voiceCueAfterMark,
  orderFulfillment,
  packPickedLines,
  peekWmsFocus,
  shipOutboundOrder,
  skipPickLine,
  splitWaveByOrder,
  stageOrderToDock,
  waveOrderCodes,
  type CloseCueInput,
  type ConfirmPickError,
  type PickGateError,
  type PickPack,
  type PickWave,
  type Slot,
} from "@/lib/wms";
import { cn } from "@/lib/utils";
import {
  Check,
  ScanBarcode,
  ChevronRight,
  Forklift,
  MapPin,
  Package,
  Search,
  SkipForward,
  Split,
  TriangleAlert,
  Truck,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { WmsLoadUnitCard, WmsMermaCard, WmsSlotFixCard, WmsSuperFinishCard } from "./WmsFloorBoard";
import { WmsJornadaCard } from "./WmsJornadaCard";
import { WmsAisleGuideCard, WmsVoiceHeadset } from "./WmsVoiceHeadset";
import { useWmsLive } from "./useWmsLive";

const GATE_ERR: Record<PickGateError, { es: string; en: string }> = {
  operator_missing: { es: "No hay operario de planta en esta sesión", en: "No floor operator on this session" },
  operator_vacant: { es: "Plaza vacante", en: "Vacant seat" },
  not_clocked: { es: "Ficha la entrada antes de picar", en: "Clock in before picking" },
  pin_required: { es: "Introduce el PIN de picking", en: "Enter the picking PIN" },
  pin_mismatch: { es: "PIN incorrecto", en: "Wrong PIN" },
};

const PICK_ERROR: Record<ConfirmPickError, { es: string; en: string }> = {
  wave_missing: { es: "Ola no encontrada", en: "Wave not found" },
  line_missing: { es: "Línea no encontrada", en: "Line not found" },
  line_not_open: { es: "Esta línea ya no está abierta", en: "This line is no longer open" },
  wrong_slot: { es: "Hueco incorrecto — vuelve a escanear la ubicación", en: "Wrong slot — rescan location" },
  wrong_sscc: { es: "SSCC incorrecto — escanea la etiqueta del palet", en: "Wrong SSCC — scan pallet label" },
  invalid_qty: { es: "Cantidad no válida", en: "Invalid quantity" },
  pallet_missing: { es: "Palet no localizado en el hueco", en: "Pallet missing in slot" },
  slot_blocked: { es: "Hueco bloqueado: el jefe tiene que cuadrarlo", en: "Slot blocked: the lead must fix it" },
  pallet_quarantined: { es: "Palet en cuarentena: no se pica", en: "Pallet in quarantine: do not pick" },
};

/** Vista pasillo: rack selectivo (montantes azules, 2 palets/bahía, film + SSCC). */
export function WmsAisleView({
  lang,
  aisle,
  siteId,
  highlightSlotId,
  onSelectSlot,
  showReachTruck,
}: {
  lang: Lang;
  aisle: string;
  siteId?: string;
  highlightSlotId?: string | null;
  onSelectSlot?: (slot: Slot) => void;
  showReachTruck?: boolean;
}) {
  const { snap } = useWmsLive();
  const sid = siteId ?? snap.sites[0]?.id;
  const slots = snap.slots.filter((s) => s.aisle === aisle && s.siteId === sid);
  const racks = [...new Set(slots.map((s) => s.rack))].sort((a, b) => a - b);
  const levels = [...new Set(slots.map((s) => s.level))].sort((a, b) => b - a);
  const palletMap = useMemo(() => new Map(snap.pallets.map((p) => [p.id, p])), [snap.pallets]);
  const skuMap = useMemo(() => new Map(snap.skus.map((s) => [s.id, s])), [snap.skus]);

  return (
    <div className="wms-aisle overflow-x-auto rounded-2xl border border-[var(--glass-border)] bg-[linear-gradient(180deg,#0f172a_0%,#1e293b_38%,#334155_78%,#475569_100%)] p-3 shadow-inner">
      <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs text-white/80">
        <span className="font-semibold tracking-wide">
          {lang === "es" ? "Pasillo" : "Aisle"} {aisle}
          <span className="ml-2 font-normal text-white/50">
            {lang === "es" ? "rack selectivo · doble profundidad" : "selective rack · double deep"}
          </span>
        </span>
        <span>
          {racks.length} {lang === "es" ? "bahías" : "bays"} · {levels.length}{" "}
          {lang === "es" ? "niveles" : "levels"}
        </span>
      </div>

      <div className="flex min-w-max gap-0">
        <div className="mr-2 flex flex-col justify-between py-1 pr-1">
          {levels.map((level) => (
            <div key={level} className="flex h-[3.85rem] items-center">
              <span
                className={cn(
                  "w-10 rounded-sm px-1 py-0.5 text-center font-mono text-[9px] font-bold uppercase tracking-wide",
                  level === 1 ? "bg-amber-400/90 text-slate-900" : "bg-white/10 text-white/70",
                )}
              >
                N{level}
                <span className="mt-0.5 block text-[7px] font-semibold">
                  {level === 1 ? (lang === "es" ? "pick" : "pick") : lang === "es" ? "res." : "rsv"}
                </span>
              </span>
            </div>
          ))}
          <div className="h-8" />
        </div>

        {racks.map((rack, rackIdx) => (
          <div
            key={rack}
            className="wms-bay relative flex w-[7.6rem] flex-col gap-1 px-1"
            style={{ animationDelay: `${rackIdx * 40}ms` }}
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-sm bg-[#1d4ed8] shadow-[0_0_10px_rgba(37,99,235,0.65)]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[3px] rounded-sm bg-[#1d4ed8] shadow-[0_0_10px_rgba(37,99,235,0.65)]" />

            {levels.map((level) => {
              const left = slots.find((s) => s.rack === rack && s.level === level && s.position === 1);
              const right = slots.find((s) => s.rack === rack && s.level === level && s.position === 2);
              return (
                <div key={`${rack}-${level}`} className="relative">
                  <div className="absolute inset-x-0 top-0 z-10 h-[3px] rounded-sm bg-[#f97316] shadow-[0_0_8px_rgba(249,115,22,0.45)]" />
                  <div className="flex gap-0.5 bg-[#0b1220]/70 px-0.5 pb-0.5 pt-1.5">
                    {[left, right].map((slot, i) => {
                      if (!slot) {
                        return <div key={i} className="h-14 flex-1 rounded-sm bg-black/20" />;
                      }
                      const pallet = slot.palletId ? palletMap.get(slot.palletId) : null;
                      const sku = pallet ? skuMap.get(pallet.skuId) : null;
                      const active = highlightSlotId === slot.id;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => onSelectSlot?.(slot)}
                          className={cn(
                            "group relative h-14 flex-1 overflow-hidden rounded-[2px] border text-left transition",
                            slot.status === "libre" && "border-emerald-500/40 bg-emerald-950/40",
                            slot.status === "ocupado" && "wms-pallet-film border-white/25 bg-[#e2e8f0]",
                            slot.status === "reservado" && "wms-pallet-film border-amber-400/60 bg-amber-100",
                            slot.status === "bloqueado" && "border-red-500/50 bg-red-900/40",
                            active && "ring-2 ring-[#fbbf24] ring-offset-1 ring-offset-[#0f172a]",
                            slot.pickFace && "shadow-[inset_0_-5px_0_0_rgba(251,191,36,0.55)]",
                          )}
                          title={`${slot.code} · ${sku?.name ?? slot.status}`}
                        >
                          {pallet ? (
                            <div className="flex h-full flex-col justify-between p-1">
                              <span className="line-clamp-2 text-[8px] font-semibold leading-tight text-slate-800">
                                {sku?.name ?? "—"}
                              </span>
                              <span className="wms-sscc-bars block h-2 w-full opacity-70" />
                              <span className="font-mono text-[7px] text-slate-600">{slot.code}</span>
                            </div>
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <span className="font-mono text-[8px] text-white/50">{slot.code}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-center font-mono text-[10px] font-bold text-white/70">
              {aisle}-{String(rack).padStart(2, "0")}
            </p>
          </div>
        ))}
      </div>

      <div className="relative mt-2 h-7 overflow-hidden rounded-full bg-[linear-gradient(90deg,#64748b,#cbd5e1_18%,#e2e8f0_50%,#cbd5e1_82%,#64748b)]">
        <div className="absolute inset-x-8 top-1/2 h-[2px] -translate-y-1/2 bg-amber-300/80" />
        {showReachTruck && (
          <div className="absolute bottom-0 left-[28%] flex items-end gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-900">
            <Forklift className="h-4 w-4" />
            <span>{lang === "es" ? "Retráctil doble stand-up" : "Stand-up double reach"}</span>
          </div>
        )}
      </div>
      <p className="mt-1 text-center text-[10px] text-white/60">
        {lang === "es"
          ? "Suelo de pasillo · línea de seguridad · operario con escáner en cara de picking"
          : "Aisle floor · safety line · scanner operator on pick face"}
      </p>
    </div>
  );
}

export function WmsSlotsPanel({ lang }: { lang: Lang }) {
  const { snap } = useWmsLive();
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const siteSlots = snap.slots.filter((s) => s.siteId === siteId);
  const aisles = [...new Set(siteSlots.map((s) => s.aisle))].filter((a) => a !== "M");
  const [aisle, setAisle] = useState(aisles[0] ?? "A");
  const [selected, setSelected] = useState<Slot | null>(null);
  const [query, setQuery] = useState("");
  const pallet = selected?.palletId ? snap.pallets.find((p) => p.id === selected.palletId) : null;
  const sku = pallet ? snap.skus.find((s) => s.id === pallet.skuId) : null;
  const skuMap = useMemo(() => new Map(snap.skus.map((s) => [s.id, s])), [snap.skus]);
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return snap.slots
      .filter((s) => s.siteId === siteId && s.aisle !== "M")
      .filter((s) => {
        const pal = s.palletId ? snap.pallets.find((p) => p.id === s.palletId) : null;
        const sk = pal ? skuMap.get(pal.skuId) : null;
        const hay = `${s.code} ${pal?.sscc ?? ""} ${pal?.lot ?? ""} ${sk?.sku ?? ""} ${sk?.name ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [query, siteId, snap.pallets, snap.slots, skuMap]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
            {lang === "es" ? "Pasillos y huecos" : "Aisles & slots"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "Digital twin de rack selectivo: montantes azules · 2 palets por bahía · nivel 1 = cara de picking · arriba = reserva."
              : "Selective-rack digital twin: blue uprights · 2 pallets per bay · level 1 = pick face · above = reserve."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
            value={siteId}
            onChange={(e) => {
              const next = e.target.value;
              setSiteId(next);
              const nextAisle =
                [...new Set(snap.slots.filter((s) => s.siteId === next && s.aisle !== "M").map((s) => s.aisle))][0] ??
                "A";
              setAisle(nextAisle);
              setSelected(null);
            }}
          >
            {snap.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.city} · {s.code}
              </option>
            ))}
          </select>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === "es" ? "Buscar producto, SKU, SSCC…" : "Search product, SKU, SSCC…"}
              className="w-56 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
            value={aisle}
            onChange={(e) => {
              setAisle(e.target.value);
              setSelected(null);
            }}
          >
            {aisles.map((a) => (
              <option key={a} value={a}>
                {lang === "es" ? "Pasillo" : "Aisle"} {a}
              </option>
            ))}
          </select>
        </div>
      </header>
      <WmsAisleGuideCard lang={lang} />

      {hits.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {hits.map((s) => {
            const pal = s.palletId ? snap.pallets.find((p) => p.id === s.palletId) : null;
            const sk = pal ? skuMap.get(pal.skuId) : null;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className="rounded-full border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-1.5 text-xs"
                  onClick={() => {
                    setAisle(s.aisle);
                    setSelected(s);
                  }}
                >
                  <span className="font-mono font-semibold">{s.code}</span>
                  {sk ? ` · ${sk.name}` : ""}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <WmsAisleView
        lang={lang}
        aisle={aisle}
        siteId={siteId}
        highlightSlotId={selected?.id}
        onSelectSlot={setSelected}
        showReachTruck={aisle === "A" || aisle === "B"}
      />

      {selected && (
        <Card
          title={selected.code}
          subtitle={
            selected.pickFace
              ? lang === "es"
                ? "Cara de picking"
                : "Pick face"
              : lang === "es"
                ? "Reserva alta"
                : "High reserve"
          }
        >
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{selected.status}</Badge>
            <Badge tone="neutral">
              {lang === "es" ? "Pos" : "Pos"} {selected.position}
            </Badge>
            <Badge tone="neutral">
              {lang === "es" ? "Nivel" : "Level"} {selected.level}
            </Badge>
          </div>
          {sku ? (
            <p className="mt-3 text-sm text-[var(--ink)]">
              <span className="font-semibold">{sku.name}</span>
              <span className="text-[var(--ink-muted)]">
                {" "}
                · {pallet?.sscc} · {lang === "es" ? "lote" : "lot"} {pallet?.lot} · qty {pallet?.qty}
              </span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--ink-muted)]">
              {lang === "es" ? "Hueco libre" : "Empty slot"}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

/** Flujo operario: ticket → hueco → escáner → confirmar. */
export function WmsPickingPanel({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const { snap, commit: setSnap } = useWmsLive();
  const matched = operatorForAppUser(snap, user);
  const isFloor = user?.role === "guide";
  const visibleWaves = useMemo(() => {
    if (!isFloor || !matched) return snap.pickWaves;
    return snap.pickWaves.filter((w) => w.operatorId === matched.id || w.operatorId === null);
  }, [isFloor, matched, snap.pickWaves]);
  const [waveId, setWaveId] = useState(() => peekWmsFocus().waveId ?? visibleWaves[0]?.id ?? "");
  const wave = visibleWaves.find((w) => w.id === waveId) ?? visibleWaves[0];
  const line = wave ? nextOpenLine(wave) : null;
  const slot = line ? snap.slots.find((s) => s.id === line.slotId) : null;
  const sku = line ? snap.skus.find((s) => s.id === line.skuId) : null;
  const pallet = line?.palletId ? snap.pallets.find((p) => p.id === line.palletId) : null;
  const operator = wave?.operatorId ? snap.operators.find((o) => o.id === wave.operatorId) : null;
  const fleet = wave?.fleetId ? snap.fleet.find((f) => f.id === wave.fleetId) : null;

  const [scanSlot, setScanSlot] = useState("");
  const [scanSscc, setScanSscc] = useState("");
  const [qty, setQty] = useState(line?.qty ?? 0);
  const [pickPin, setPickPin] = useState("");
  const [shortageQty, setShortageQty] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [closeCue, setCloseCue] = useState<CloseCueInput | null>(null);
  const [lastRemaining, setLastRemaining] = useState<number | null>(null);

  const done = wave?.lines.filter((l) => l.status === "picada").length ?? 0;
  const total = wave?.lines.length ?? 0;

  function gateFloor(): boolean {
    if (!isFloor || !matched) return true;
    const gate = assertCanPick(snap, matched.id, pickPin || null, true);
    if (!gate.ok) {
      setFeedback(GATE_ERR[gate.error][lang]);
      return false;
    }
    return true;
  }

  function speakAfterMark(nextSnap: typeof snap, last: CloseCueInput & { palletId?: string | null; pickPack?: PickPack }) {
    const operatorId = wave?.operatorId ?? matched?.id ?? "";
    if (!operatorId) return;
    const cue = voiceCueAfterMark(nextSnap, operatorId, last, lang);
    setLastRemaining(cue.remaining);
    setCloseCue(cue.kind === "close" ? { storeName: last.storeName, orderCode: last.orderCode, dockAisle: last.dockAisle } : null);
  }

  function lineCloseCue(): (CloseCueInput & { palletId?: string | null; pickPack?: PickPack }) | null {
    if (!line) return null;
    const order = snap.outbound.find((o) => o.code === line.orderCode);
    const assignment =
      wave?.operatorId && order
        ? snap.superAssignments.find((a) => a.operatorId === wave.operatorId && a.orderId === order.id)
        : null;
    return {
      storeName: order?.customer ?? line.orderCode,
      orderCode: line.orderCode,
      dockAisle: order?.dock ?? "",
      palletId: line.palletId,
      pickPack: line.pickPack ?? "caja",
      loadKind: assignment?.loadKind ?? null,
    };
  }

  function applyConfirm() {
    if (!wave || !line) return;
    if (!gateFloor()) return;
    const last = lineCloseCue();
    const result = confirmPick(snap, wave.id, line.id, {
      slotCode: scanSlot,
      sscc: scanSscc,
      qty,
    });
    if (!result.ok) {
      setFeedback(PICK_ERROR[result.error][lang]);
      return;
    }
    setSnap(result.snap);
    setScanSlot("");
    setScanSscc("");
    setFeedback(null);
    const nextWave = result.snap.pickWaves.find((w) => w.id === wave.id);
    const nxt = nextWave ? nextOpenLine(nextWave) : null;
    setQty(nxt?.qty ?? 0);
    if (last) speakAfterMark(result.snap, last);
  }

  function applyVoiceOk(spokenQty: number) {
    const operatorId = wave?.operatorId ?? matched?.id ?? "";
    if (!operatorId || !wave || !line) return;
    if (!gateFloor()) return;
    const last = lineCloseCue();
    const result = confirmVoicePick(snap, operatorId, spokenQty);
    if (!result.ok) {
      setFeedback(
        result.error === "qty_mismatch"
          ? lang === "es"
            ? `Di ${line.qty} ok, la cantidad del ticket`
            : `Say ${line.qty} ok, the ticket qty`
          : result.error === "slot_short"
            ? lang === "es"
              ? "En el hueco no hay tantas. Avisa al jefe."
              : "The slot does not have that many. Tell the lead."
            : result.error === "no_ticket"
              ? lang === "es"
                ? "No hay ticket abierto"
                : "No open ticket"
              : PICK_ERROR[result.error][lang],
      );
      return;
    }
    setSnap(result.snap);
    setScanSlot("");
    setScanSscc("");
    setFeedback(null);
    const nextWave = result.snap.pickWaves.find((w) => w.id === wave.id);
    const nxt = nextWave ? nextOpenLine(nextWave) : null;
    setQty(nxt?.qty ?? 0);
    if (last) speakAfterMark(result.snap, last);
  }

  function applyMismatch() {
    if (!line || !slot) return;
    const result = reportSlotMismatch(snap, {
      slotCode: slot.code,
      takeQty: line.qty,
      operatorId: matched?.id ?? wave?.operatorId ?? null,
    });
    if (!result.ok) {
      setFeedback(lang === "es" ? "No se pudo avisar el hueco" : "Could not report the slot");
      return;
    }
    setSnap(result.snap);
    setFeedback(
      lang === "es"
        ? "Aviso al jefe. Sigue al siguiente hueco que te diga el aparato."
        : "Lead notified. Go to the next slot the device speaks.",
    );
  }

  if (!wave) {
    return (
      <Card title={lang === "es" ? "Sin olas de picking" : "No pick waves"}>
        <p className="text-sm text-[var(--ink-muted)]">
          {lang === "es" ? "No hay tickets impresos." : "No printed tickets."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
            {lang === "es" ? "Picar mercancía" : "Pick orders"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "Ticket impreso → ir al hueco → escanear ubicación → escanear SSCC → confirmar cantidad → siguiente línea."
              : "Printed ticket → walk to slot → scan location → scan SSCC → confirm qty → next line."}
          </p>
        </div>
        <select
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          value={wave.id}
          onChange={(e) => {
            setWaveId(e.target.value);
            setFeedback(null);
            const w = snap.pickWaves.find((x) => x.id === e.target.value);
            const open = w ? nextOpenLine(w) : null;
            setQty(open?.qty ?? 0);
            setScanSlot("");
            setScanSscc("");
          }}
        >
          {visibleWaves.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} · {w.aisle} · {w.kind} · {w.status}
            </option>
          ))}
        </select>
        {wave && waveOrderCodes(wave).length > 1 && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold"
            onClick={() => {
              const result = splitWaveByOrder(snap, wave.id);
              if (result.ok) {
                setSnap(result.snap);
                setWaveId(result.waveId);
                setFeedback(null);
              }
            }}
          >
            <Split className="h-4 w-4" />
            {lang === "es" ? "Separar por pedido" : "Split by order"}
          </button>
        )}
        {!isFloor && wave && (
          <select
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
            value={wave.operatorId ?? ""}
            onChange={(e) => {
              const result = assignWaveOperator(snap, wave.id, e.target.value || null);
              if (result.ok) setSnap(result.snap);
            }}
          >
            <option value="">{lang === "es" ? "Sin picker" : "No picker"}</option>
            {snap.operators
              .filter((o) => !o.vacant && o.active)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
        )}
      </header>

      {matched && (
        <WmsJornadaCard lang={lang} snap={snap} operatorId={matched.id} onChange={setSnap} />
      )}
      {isFloor && !matched && (
        <p className="rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-xs font-semibold text-[var(--warn-ink)]">
          {lang === "es"
            ? "Esta sesión de planta no está vinculada a un operario del snapshot (el nombre debe coincidir)."
            : "This floor session is not linked to a snapshot operator (the name must match)."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge tone={wave.kind === "reposicion" ? "warn" : "brand"}>
          {wave.kind === "reposicion"
            ? lang === "es"
              ? "Reposición desde reserva"
              : "Replenish from reserve"
            : lang === "es"
              ? "Picking cara baja"
              : "Pick face"}
        </Badge>
        {operator && (
          <Badge tone="neutral">
            <UserRound className="mr-1 inline h-3 w-3" />
            {operator.name}
          </Badge>
        )}
        {fleet && (
          <Badge tone="warn">
            <Forklift className="mr-1 inline h-3 w-3" />
            {fleet.code} · {FLEET_KIND_LABEL[fleet.kind][lang]}
          </Badge>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <Card title={wave.code} subtitle={`${lang === "es" ? "Progreso" : "Progress"} ${done}/${total}`}>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
          <ul className="space-y-2">
            {wave.lines.map((l) => {
              const s = snap.slots.find((x) => x.id === l.slotId);
              const sk = snap.skus.find((x) => x.id === l.skuId);
              const active = line?.id === l.id;
              return (
                <li
                  key={l.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition",
                    active
                      ? "border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]"
                      : "border-[var(--glass-border)] bg-[var(--surface-sunken)]",
                  )}
                >
                  <span className="min-w-0">
                    <span className="font-mono text-xs font-semibold">{s?.code}</span>
                    <span className="mt-0.5 block truncate text-[var(--ink-muted)]">{sk?.name}</span>
                  </span>
                  <Badge
                    tone={
                      l.status === "picada"
                        ? "good"
                        : l.status === "en_curso"
                          ? "warn"
                          : l.status === "faltante"
                            ? "bad"
                            : "neutral"
                    }
                  >
                    {l.qtyPicked}/{l.qty}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-3">
          {slot && line && sku && pallet ? (
            <>
              <Card title={lang === "es" ? "Ticket del súper" : "Store ticket"}>
                {(() => {
                  const ticket = wave.operatorId ? nextFloorTicket(snap, wave.operatorId) : null;
                  const order = snap.outbound.find((o) => o.code === line.orderCode);
                  return (
                    <>
                      <p className="mb-2 text-sm font-semibold text-[var(--ink)]">
                        {order?.customer ?? line.orderCode}
                      </p>
                      <div className="mb-3 flex flex-wrap gap-2">
                        <Badge tone="brand">
                          <MapPin className="mr-1 inline h-3 w-3" />
                          {lang === "es" ? "Pasillo" : "Aisle"} {slot.aisle} · {slot.code}
                        </Badge>
                        <Badge tone="neutral">{sku.name}</Badge>
                        <Badge tone="warn">
                          {lang === "es" ? "Tomar" : "Take"} {line.qty}
                        </Badge>
                        {order?.dock && (
                          <Badge tone="neutral">
                            {lang === "es" ? "Muelle" : "Dock"} {order.dock}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--ink-muted)]">
                        {ticket?.orderCode ?? line.orderCode} · SSCC {pallet.sscc} ·{" "}
                        {lang === "es" ? "lote" : "lot"} {pallet.lot}
                      </p>
                      <div className="mt-3">
                        <WmsVoiceHeadset
                          lang={lang}
                          ticket={{
                            storeName: order?.customer ?? line.orderCode,
                            aisle: slot.aisle,
                            slotCode: slot.code,
                            skuName: sku.name,
                            skuId: sku.id,
                            qty: line.qty,
                            pickPack: line.pickPack ?? "caja",
                            stockInSlot: remainingOnPallet(snap, line.palletId),
                            loadKind: ticket?.loadKind ?? null,
                          }}
                          remaining={remainingOnPallet(snap, line.palletId)}
                          onConfirmOk={applyVoiceOk}
                          onReportMismatch={applyMismatch}
                        />
                      </div>
                    </>
                  );
                })()}
              </Card>

              <WmsAisleView
                lang={lang}
                aisle={wave.aisle}
                siteId={wave.siteId}
                highlightSlotId={slot.id}
                showReachTruck={wave.kind === "reposicion"}
              />

              <Card title={lang === "es" ? "Escáner de planta" : "Floor scanner"}>
                <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  {lang === "es" ? "1. Escanea hueco" : "1. Scan slot"}
                  <div className="mt-1 flex items-center gap-2">
                    <ScanBarcode className="h-4 w-4 text-[var(--accent)]" />
                    <input
                      value={scanSlot}
                      onChange={(e) => setScanSlot(e.target.value)}
                      placeholder={slot.code}
                      className="w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </label>
                <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  {lang === "es" ? "2. Escanea SSCC del palet" : "2. Scan pallet SSCC"}
                  <div className="mt-1 flex items-center gap-2">
                    <Package className="h-4 w-4 text-[var(--accent)]" />
                    <input
                      value={scanSscc}
                      onChange={(e) => setScanSscc(e.target.value)}
                      placeholder={pallet.sscc}
                      className="w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </label>
                <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  {lang === "es" ? "3. Cantidad" : "3. Quantity"}
                  <input
                    type="number"
                    min={1}
                    max={line.qty}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
                  />
                </label>
                {isFloor && matched?.fingerprintEnrolled && (
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                    {lang === "es" ? "PIN de picking" : "Picking PIN"}
                    <input
                      value={pickPin}
                      onChange={(e) => setPickPin(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
                    />
                  </label>
                )}
                {feedback && (
                  <p className="mb-3 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-xs font-semibold text-[var(--warn-ink)]">
                    {feedback}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyConfirm}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    <Check className="h-4 w-4" />
                    {lang === "es" ? "Confirmar picado" : "Confirm pick"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScanSlot(slot.code);
                      setScanSscc(pallet.sscc);
                      setQty(line.qty);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)]"
                  >
                    <ChevronRight className="h-4 w-4" />
                    {lang === "es" ? "Autocompletar demo" : "Autofill demo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!gateFloor()) return;
                      const result = skipPickLine(snap, wave.id, line.id);
                      if (!result.ok) {
                        setFeedback(PICK_ERROR[result.error][lang]);
                        return;
                      }
                      setSnap(result.snap);
                      setScanSlot("");
                      setScanSscc("");
                      setFeedback(null);
                      const nextWave = result.snap.pickWaves.find((w) => w.id === wave.id);
                      const nxt = nextWave ? nextOpenLine(nextWave) : null;
                      setQty(nxt?.qty ?? 0);
                      const last = lineCloseCue();
                      if (last) speakAfterMark(result.snap, last);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)]"
                  >
                    <SkipForward className="h-4 w-4" />
                    {lang === "es" ? "Omitir línea" : "Skip line"}
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, line.qty - 1)}
                    value={shortageQty}
                    onChange={(e) => setShortageQty(Number(e.target.value))}
                    className="w-16 rounded-full border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
                    title={lang === "es" ? "Cantidad encontrada" : "Qty found"}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!gateFloor()) return;
                      const result = markShortage(snap, wave.id, line.id, shortageQty);
                      if (!result.ok) {
                        setFeedback(PICK_ERROR[result.error][lang]);
                        return;
                      }
                      setSnap(result.snap);
                      setScanSlot("");
                      setScanSscc("");
                      setFeedback(null);
                      const nextWave = result.snap.pickWaves.find((w) => w.id === wave.id);
                      const nxt = nextWave ? nextOpenLine(nextWave) : null;
                      setQty(nxt?.qty ?? 0);
                      const last = lineCloseCue();
                      if (last) speakAfterMark(result.snap, last);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] px-4 py-2.5 text-sm font-semibold text-[var(--warn-ink)]"
                  >
                    <TriangleAlert className="h-4 w-4" />
                    {lang === "es" ? "Faltante" : "Shortage"}
                  </button>
                </div>
              </Card>
              <WmsMermaCard
                lang={lang}
                siteId={wave.siteId}
                operatorId={matched?.id ?? wave.operatorId}
                preset={{ sscc: pallet.sscc, fromSlotCode: slot.code }}
              />
              <WmsSlotFixCard lang={lang} siteId={wave.siteId} />
            </>
          ) : (
            <Card title={lang === "es" ? "Ola completada" : "Wave complete"}>
              {(() => {
                const code = wave.lines[0]?.orderCode;
                const order = code ? snap.outbound.find((o) => o.code === code) : undefined;
                const assignment =
                  wave.operatorId && order
                    ? snap.superAssignments.find((a) => a.operatorId === wave.operatorId && a.orderId === order.id)
                    : null;
                const fallback = closeCue
                  ? { ...closeCue, loadKind: closeCue.loadKind ?? assignment?.loadKind ?? null }
                  : order
                    ? {
                        storeName: order.customer,
                        orderCode: order.code,
                        dockAisle: order.dock,
                        loadKind: assignment?.loadKind ?? null,
                      }
                    : null;
                if (!fallback) return null;
                if (assignment?.unitsMade != null) {
                  return (
                    <div className="mb-3">
                      <WmsVoiceHeadset
                        lang={lang}
                        labelCue={{
                          ...fallback,
                          units: assignment.unitsMade,
                          labels: assignment.labelsPrinted,
                        }}
                        remaining={lastRemaining}
                      />
                    </div>
                  );
                }
                return (
                  <div className="mb-3">
                    <WmsVoiceHeadset
                      lang={lang}
                      askUnits={fallback}
                      remaining={lastRemaining}
                      autoSpeak={Boolean(closeCue)}
                      onUnitsSaid={(n) => {
                        if (!wave.operatorId || !order) return;
                        const result = declareUnitsMade(snap, wave.operatorId, order.id, n);
                        if (result.ok) setSnap(result.snap);
                      }}
                    />
                  </div>
                );
              })()}
              <p className="mb-3 text-sm text-[var(--ink-muted)]">
                {lang === "es"
                  ? "Súper finalizado. Di cuántos palets has hecho. Se imprimen dos etiquetas por palet (una por lado). En pantalla, déjalo en el muelle. Luego te asignan el siguiente súper."
                  : "Store finished. Say how many pallets you made. Two labels print per pallet (one per side). On screen, leave it on the dock. Then you get the next store."}
              </p>
              <div className="flex flex-wrap gap-2">
                {[...new Set(wave.lines.map((l) => l.orderCode))].map((code) => {
                  const order = snap.outbound.find((o) => o.code === code);
                  const fill = order ? orderFulfillment(snap, order.id) : null;
                  if (!order || !fill) return null;
                  return (
                    <span key={code} className="flex flex-wrap items-center gap-2">
                      {fill.canPack && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => {
                            if (!gateFloor()) return;
                            const result = packPickedLines(snap, order.id, matched?.id ?? wave.operatorId);
                            if (!result.ok) {
                              setFeedback(result.error);
                              return;
                            }
                            setSnap(result.snap);
                            setFeedback(null);
                          }}
                        >
                          <Package className="h-4 w-4" />
                          {lang === "es" ? `Embalar ${code}` : `Pack ${code}`}
                        </button>
                      )}
                      {fill.canStage && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => {
                            if (!gateFloor()) return;
                            const result = stageOrderToDock(snap, order.id, matched?.id ?? wave.operatorId);
                            if (!result.ok) {
                              setFeedback(
                                result.error === "dock_full"
                                  ? lang === "es"
                                    ? "No hay hueco libre en muelle"
                                    : "No free dock slot"
                                  : result.error,
                              );
                              return;
                            }
                            setSnap(result.snap);
                            setFeedback(null);
                          }}
                        >
                          <Truck className="h-4 w-4" />
                          {lang === "es" ? `Cargar ${code}` : `Load ${code}`}
                        </button>
                      )}
                      {fill.canShip && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => {
                            const result = shipOutboundOrder(snap, order.id, matched?.id ?? wave.operatorId);
                            if (!result.ok) {
                              setFeedback(result.error);
                              return;
                            }
                            setSnap(result.snap);
                            setFeedback(null);
                          }}
                        >
                          <Truck className="h-4 w-4" />
                          {lang === "es" ? `Expedir ${code}` : `Ship ${code}`}
                        </button>
                      )}
                    </span>
                  );
                })}
                <button
                  type="button"
                  className="rounded-full border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold"
                  onClick={() => navigateWmsSection("expedicion")}
                >
                  {lang === "es" ? "Ir a expedición" : "Go to outbound"}
                </button>
              </div>
            </Card>
          )}
          {!line && (
            <>
              <WmsSuperFinishCard
                lang={lang}
                operatorId={wave.operatorId ?? matched?.id ?? null}
                orderId={snap.outbound.find((o) => o.code === wave.lines[0]?.orderCode)?.id}
              />
              <WmsLoadUnitCard lang={lang} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export type { PickWave };
