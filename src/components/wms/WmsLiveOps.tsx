import { Badge, Card } from "@/components/CrmChrome";
import { useAuth } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import {
  FLEET_KIND_LABEL,
  applyReplenishment,
  assertCanPick,
  closeCountSession,
  confirmCountSessionLine,
  confirmCycleCount,
  confirmPutaway,
  confirmTransfer,
  linesForSession,
  openCountSession,
  openCountSessionForSite,
  operatorForAppUser,
  planCycleCounts,
  proposeReplenishments,
  putawayReceivedPallet,
  skipCountSessionLine,
  suggestPutawaySlot,
  transferPalletBetweenSites,
  type CountSessionError,
  type LiveMoveError,
} from "@/lib/wms";
import { cn } from "@/lib/utils";
import { ArrowDownToLine, ArrowLeftRight, Check, Forklift, ScanBarcode } from "lucide-react";
import { useMemo, useState } from "react";
import { WmsMermaCard } from "./WmsFloorBoard";
import { WmsJornadaCard } from "./WmsJornadaCard";
import { useWmsLive } from "./useWmsLive";

const MOVE_ERR: Record<LiveMoveError, { es: string; en: string }> = {
  pallet_missing: { es: "SSCC no encontrado", en: "SSCC not found" },
  wrong_sscc: { es: "SSCC incorrecto", en: "Wrong SSCC" },
  wrong_from: { es: "El palet no está en ese hueco de origen", en: "Pallet is not in that from-slot" },
  to_missing: { es: "Hueco destino no existe", en: "To-slot does not exist" },
  slot_occupied: { es: "Destino ocupado", en: "Destination occupied" },
  slot_blocked: { es: "Destino bloqueado", en: "Destination blocked" },
  same_slot: { es: "Origen y destino son el mismo hueco", en: "Same slot" },
  not_on_dock: { es: "El palet no está en muelle", en: "Pallet is not on dock" },
  same_site: { es: "Elige otro centro de destino", en: "Pick a different destination site" },
  pallet_shipped: { es: "Ese palet ya salió", en: "That pallet already shipped" },
  pallet_in_wave: { es: "El palet está en una ola o en muelle de salida", en: "Pallet is on a wave or outbound dock" },
  stock_negative: { es: "El ledger no admite stock negativo", en: "Ledger rejected negative stock" },
};

const COUNT_ERR: Record<CountSessionError, { es: string; en: string }> = {
  task_missing: { es: "Tarea no vigente", en: "Task gone" },
  wrong_slot: { es: "Hueco incorrecto", en: "Wrong slot" },
  wrong_sscc: { es: "SSCC incorrecto", en: "Wrong SSCC" },
  invalid_qty: { es: "Cantidad no válida", en: "Invalid qty" },
  session_missing: { es: "No hay sesión abierta", en: "No open session" },
  line_missing: { es: "Línea no vigente", en: "Line gone" },
  line_done: { es: "Línea ya cerrada", en: "Line already closed" },
  filter_required: { es: "Escribe SKU, lote o hueco", en: "Type SKU, lot or slot" },
  no_lines: { es: "No hay huecos ocupados para ese recorte", en: "No occupied slots for that filter" },
  session_closed: { es: "La sesión ya está cerrada", en: "Session already closed" },
  site_missing: { es: "Centro no encontrado", en: "Site not found" },
};

export function WmsMovementsPanel({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const { snap, commit } = useWmsLive();
  const matched = operatorForAppUser(snap, user);
  const isFloor = user?.role === "guide";
  const [mode, setMode] = useState<"putaway" | "traslado" | "intersitio">("putaway");
  const [hubPalletId, setHubPalletId] = useState("");
  const [hubSiteId, setHubSiteId] = useState("");
  const [hubSlot, setHubSlot] = useState("");
  const [sscc, setSscc] = useState("");
  const [fromCode, setFromCode] = useState("");
  const [toCode, setToCode] = useState("");
  const [pickPin, setPickPin] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const dockPals = snap.pallets.filter((p) => p.status === "muelle");
  const proposals = useMemo(() => proposeReplenishments(snap), [snap]);
  const doubleReach = snap.fleet.find((f) => f.kind === "retractil_doble" && f.status === "operativa");
  const operatorId = matched?.id ?? null;

  function gateFloor(): boolean {
    if (!isFloor || !matched) return true;
    const gate = assertCanPick(snap, matched.id, pickPin || null, true);
    if (gate.ok) return true;
    setOkMsg(null);
    setFeedback(
      gate.error === "not_clocked"
        ? lang === "es"
          ? "Ficha la entrada antes de mover"
          : "Clock in before moving"
        : lang === "es"
          ? "PIN incorrecto o pendiente"
          : "PIN missing or wrong",
    );
    return false;
  }

  function runMove() {
    if (!gateFloor()) return;
    const input = {
      sscc,
      fromSlotCode: fromCode,
      toSlotCode: toCode,
      operatorId,
      fleetId: doubleReach?.id ?? null,
    };
    const pallet = snap.pallets.find((p) => p.sscc === sscc.trim());
    const result =
      mode === "putaway" && pallet
        ? putawayReceivedPallet(snap, pallet.id, toCode, operatorId, doubleReach?.id ?? null)
        : mode === "putaway"
          ? confirmPutaway(snap, input)
          : confirmTransfer(snap, input);
    if (!result.ok) {
      setOkMsg(null);
      setFeedback(MOVE_ERR[result.error][lang]);
      return;
    }
    commit(result.snap);
    setFeedback(null);
    setOkMsg(lang === "es" ? `Movimiento OK · ${fromCode} → ${toCode}` : `Move OK · ${fromCode} → ${toCode}`);
    setSscc("");
    setFromCode("");
    setToCode("");
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Movimientos en vivo" : "Live movements"}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Putaway de muelle y traslados hueco a hueco. El destino se sugiere por zona del SKU; planta necesita haber fichado."
            : "Dock putaway and slot-to-slot transfers. Destination follows the SKU zone; floor staff must clock in."}
        </p>
      </header>

      {matched && <WmsJornadaCard lang={lang} snap={snap} operatorId={matched.id} onChange={commit} />}
      <WmsMermaCard lang={lang} operatorId={operatorId} />
      {isFloor && matched?.fingerprintEnrolled && (
        <input
          value={pickPin}
          onChange={(e) => setPickPin(e.target.value)}
          placeholder={lang === "es" ? "PIN de planta" : "Floor PIN"}
          className="max-w-xs rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("putaway")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold",
            mode === "putaway" ? "bg-[var(--accent)] text-white" : "border border-[var(--glass-border)]",
          )}
        >
          Putaway
        </button>
        <button
          type="button"
          onClick={() => setMode("traslado")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold",
            mode === "traslado" ? "bg-[var(--accent)] text-white" : "border border-[var(--glass-border)]",
          )}
        >
          {lang === "es" ? "Traslado" : "Transfer"}
        </button>
        <button
          type="button"
          onClick={() => setMode("intersitio")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold",
            mode === "intersitio" ? "bg-[var(--accent)] text-white" : "border border-[var(--glass-border)]",
          )}
        >
          {lang === "es" ? "Inter-centro" : "Inter-site"}
        </button>
      </div>

      {mode === "intersitio" && (
        <Card
          title={lang === "es" ? "Traslado entre centros" : "Inter-site transfer"}
          subtitle={
            lang === "es"
              ? "Mueve un palet real a un hueco libre de otro hub. No se fabrica stock."
              : "Move a real pallet to a free slot in another hub. No stock is invented."
          }
        >
          <form
            className="grid gap-2 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!gateFloor()) return;
              const result = transferPalletBetweenSites(snap, {
                palletId: hubPalletId,
                destSiteId: hubSiteId,
                toSlotCode: hubSlot,
                operatorId,
                fleetId: doubleReach?.id ?? null,
              });
              if (!result.ok) {
                setOkMsg(null);
                setFeedback(MOVE_ERR[result.error][lang]);
                return;
              }
              commit(result.snap);
              setFeedback(null);
              setOkMsg(
                lang === "es"
                  ? `Traslado OK · ${hubSlot}`
                  : `Transfer OK · ${hubSlot}`,
              );
              setHubPalletId("");
              setHubSlot("");
            }}
          >
            <select
              required
              value={hubPalletId}
              onChange={(e) => setHubPalletId(e.target.value)}
              className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
            >
              <option value="">{lang === "es" ? "Palet origen" : "Source pallet"}</option>
              {snap.pallets
                .filter((p) => p.status === "en_ubicacion" && p.qty > 0)
                .slice(0, 80)
                .map((p) => {
                  const sku = snap.skus.find((s) => s.id === p.skuId);
                  const site = snap.sites.find((s) => s.id === p.siteId);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.sscc.slice(-10)} · {sku?.sku} · {site?.code}
                    </option>
                  );
                })}
            </select>
            <select
              required
              value={hubSiteId}
              onChange={(e) => {
                setHubSiteId(e.target.value);
                setHubSlot("");
              }}
              className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
            >
              <option value="">{lang === "es" ? "Centro destino" : "Destination site"}</option>
              {snap.sites
                .filter((s) => s.id !== snap.pallets.find((p) => p.id === hubPalletId)?.siteId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.city} · {s.code}
                  </option>
                ))}
            </select>
            <select
              required
              value={hubSlot}
              onChange={(e) => setHubSlot(e.target.value)}
              className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
            >
              <option value="">{lang === "es" ? "Hueco libre destino" : "Free destination slot"}</option>
              {snap.slots
                .filter((s) => s.siteId === hubSiteId && s.status === "libre" && !s.palletId)
                .slice(0, 80)
                .map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.code} · {s.zone}
                  </option>
                ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white md:col-span-3"
            >
              <ArrowLeftRight className="h-4 w-4" />
              {lang === "es" ? "Trasladar palet" : "Transfer pallet"}
            </button>
          </form>
          {feedback && (
            <p className="mt-2 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-xs font-semibold text-[var(--warn-ink)]">
              {feedback}
            </p>
          )}
          {okMsg && (
            <p className="mt-2 rounded-xl bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--ok)]">
              {okMsg}
            </p>
          )}
        </Card>
      )}

      {mode === "putaway" && dockPals.length > 0 && (
        <Card title={lang === "es" ? "Palets en muelle" : "Dock pallets"} subtitle={`${dockPals.length}`}>
          <ul className="space-y-2">
            {dockPals.slice(0, 8).map((pal) => {
              const from = pal.slotId ? snap.slots.find((s) => s.id === pal.slotId) : null;
              const dest = suggestPutawaySlot(snap, pal);
              const sku = snap.skus.find((s) => s.id === pal.skuId);
              return (
                <li
                  key={pal.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-xs font-semibold">{pal.sscc.slice(-10)}</span>
                    <span className="mt-0.5 block truncate text-[var(--ink-muted)]">
                      {sku?.name} · {from?.code} → {dest?.code ?? "—"}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={!dest}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    onClick={() => {
                      if (!dest || !gateFloor()) return;
                      const result = putawayReceivedPallet(
                        snap,
                        pal.id,
                        dest.code,
                        operatorId,
                        doubleReach?.id ?? null,
                      );
                      if (!result.ok) {
                        setFeedback(MOVE_ERR[result.error][lang]);
                        return;
                      }
                      commit(result.snap);
                      setOkMsg(
                        lang === "es"
                          ? `Ubicado ${from?.code} → ${dest.code}`
                          : `Put away ${from?.code} → ${dest.code}`,
                      );
                    }}
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    {lang === "es" ? "Ubicar" : "Putaway"}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {mode !== "intersitio" && <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Card title={lang === "es" ? "Confirmar con escáner" : "Confirm with scanner"}>
          <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            SSCC
            <input
              value={sscc}
              onChange={(e) => setSscc(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Hueco origen" : "From slot"}
            <input
              value={fromCode}
              onChange={(e) => setFromCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Hueco destino" : "To slot"}
            <input
              value={toCode}
              onChange={(e) => setToCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
            />
          </label>
          {feedback && (
            <p className="mb-3 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-xs font-semibold text-[var(--warn-ink)]">
              {feedback}
            </p>
          )}
          {okMsg && (
            <p className="mb-3 rounded-xl bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--ok)]">
              {okMsg}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runMove}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Check className="h-4 w-4" />
              {lang === "es" ? "Confirmar movimiento" : "Confirm move"}
            </button>
            {mode === "putaway" && dockPals[0] && (
              <button
                type="button"
                onClick={() => {
                  const pal = dockPals[0]!;
                  const from = pal.slotId ? snap.slots.find((s) => s.id === pal.slotId) : null;
                  const dest = suggestPutawaySlot(snap, pal);
                  setSscc(pal.sscc);
                  setFromCode(from?.code ?? "");
                  setToCode(dest?.code ?? "");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] px-4 py-2.5 text-sm font-semibold"
              >
                <ScanBarcode className="h-4 w-4" />
                {lang === "es" ? "Usar sugerencia de zona" : "Use zone suggestion"}
              </button>
            )}
          </div>
        </Card>

        <Card
          title={lang === "es" ? "Reposición pick face" : "Pick-face replenishment"}
          subtitle={doubleReach ? `${doubleReach.code} · ${FLEET_KIND_LABEL[doubleReach.kind][lang]}` : undefined}
        >
          {proposals.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">
              {lang === "es" ? "Cara de picking cubierta." : "Pick faces covered."}
            </p>
          ) : (
            <ul className="space-y-2">
              {proposals.slice(0, 6).map((p) => {
                const from = snap.slots.find((s) => s.id === p.fromSlotId);
                const to = snap.slots.find((s) => s.id === p.toSlotId);
                const sku = snap.skus.find((s) => s.id === p.skuId);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{sku?.name}</span>
                      <span className="mt-0.5 block font-mono text-xs text-[var(--ink-muted)]">
                        {from?.code} → {to?.code}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!gateFloor()) return;
                        const result = applyReplenishment(
                          snap,
                          p,
                          doubleReach?.id ?? null,
                          operatorId,
                        );
                        if (!result.ok) {
                          setFeedback(MOVE_ERR[result.error][lang]);
                          return;
                        }
                        commit(result.snap);
                        setOkMsg(
                          lang === "es"
                            ? `Reposición OK con retráctil doble`
                            : `Replenishment OK with double reach`,
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <Forklift className="h-3.5 w-3.5" />
                      {lang === "es" ? "Bajar" : "Drop"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>}

      <Card title={lang === "es" ? "Últimos movimientos" : "Latest movements"}>
        <ul className="space-y-2 text-sm">
          {snap.movements.slice(0, 8).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 border-b border-[var(--glass-border)] py-2 last:border-0">
              <span className="inline-flex items-center gap-2">
                {m.type === "entrada" ? (
                  <ArrowDownToLine className="h-4 w-4 text-[var(--accent)]" />
                ) : (
                  <ArrowLeftRight className="h-4 w-4 text-[var(--accent)]" />
                )}
                <span>
                  <span className="font-semibold">{m.type}</span>
                  <span className="text-[var(--ink-muted)]"> · {m.note}</span>
                </span>
              </span>
              <span className="font-mono text-xs text-[var(--ink-muted)]">{m.at.slice(11, 16)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function WmsCycleCountPanel({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const { snap, commit } = useWmsLive();
  const matched = operatorForAppUser(snap, user);
  const isFloor = user?.role === "guide";
  const [pickPin, setPickPin] = useState("");
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const session = openCountSessionForSite(snap, siteId);
  const sessionLines = session ? linesForSession(snap, session.id) : [];
  const tasks = useMemo(
    () => planCycleCounts(snap, { siteId, limit: 10 }),
    [snap, siteId],
  );
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [lineId, setLineId] = useState(sessionLines.find((l) => l.status === "pending")?.id ?? "");
  const line = sessionLines.find((l) => l.id === lineId) ?? sessionLines.find((l) => l.status === "pending") ?? sessionLines[0];
  const task = session
    ? line
      ? {
          id: line.id,
          slotId: line.slotId,
          palletId: line.palletId,
          skuId: line.skuId,
          reason: line.taskReason,
          expectedQty: line.expectedQty,
        }
      : null
    : (tasks.find((t) => t.id === taskId) ?? tasks[0]);
  const slot = task ? snap.slots.find((s) => s.id === task.slotId) : null;
  const pallet = task ? snap.pallets.find((p) => p.id === task.palletId) : null;
  const sku = task ? snap.skus.find((s) => s.id === task.skuId) : null;
  const [scanSlot, setScanSlot] = useState("");
  const [scanSscc, setScanSscc] = useState("");
  const [qty, setQty] = useState(task?.expectedQty ?? 0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const reasonLabel: Record<(typeof tasks)[number]["reason"], string> = {
    caducidad: lang === "es" ? "Caducidad" : "Expiry",
    abc_a: "ABC A",
    antiguo: lang === "es" ? "Sin conteo reciente" : "Stale count",
    frio: lang === "es" ? "Cámara" : "Cold",
  };

  function openSession(kind: "cyclic" | "abc") {
    const result = openCountSession(snap, {
      warehouseId: siteId,
      kind,
      operatorId: matched?.id ?? null,
    });
    if (!result.ok) {
      setOkMsg(null);
      setFeedback(COUNT_ERR[result.error][lang]);
      return;
    }
    commit(result.snap);
    const first = linesForSession(result.snap, result.sessionId).find((l) => l.status === "pending");
    if (first) {
      setLineId(first.id);
      setQty(first.expectedQty);
    }
    setFeedback(null);
    setOkMsg(lang === "es" ? "Sesión abierta · palets reales del recorte" : "Session opened · real pallets only");
  }

  function confirm() {
    if (!task) return;
    if (isFloor && matched) {
      const gate = assertCanPick(snap, matched.id, pickPin || null, true);
      if (!gate.ok) {
        setOkMsg(null);
        setFeedback(
          gate.error === "not_clocked"
            ? lang === "es"
              ? "Ficha la entrada antes de contar"
              : "Clock in before counting"
            : lang === "es"
              ? "PIN incorrecto o pendiente"
              : "PIN missing or wrong",
        );
        return;
      }
    }
    const payload = {
      slotCode: scanSlot,
      sscc: scanSscc,
      qty,
      operatorId: matched?.id ?? null,
    };
    const result = session && line
      ? confirmCountSessionLine(snap, session.id, line.id, payload)
      : confirmCycleCount(snap, tasks.find((t) => t.id === task.id) ?? tasks[0]!, payload);
    if (!result.ok) {
      setOkMsg(null);
      setFeedback(COUNT_ERR[result.error][lang]);
      return;
    }
    commit(result.snap);
    setFeedback(null);
    const variance = result.variance ?? 0;
    setOkMsg(
      variance === 0
        ? lang === "es"
          ? "Conteo OK · sin desvío"
          : "Count OK · no variance"
        : lang === "es"
          ? `Ajuste ${variance > 0 ? "+" : ""}${variance} ud.`
          : `Adjust ${variance > 0 ? "+" : ""}${variance} u.`,
    );
    setScanSlot("");
    setScanSscc("");
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
            {lang === "es" ? "Inventario cíclico" : "Cycle count"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "Sesión + líneas sobre el planner (caducidad, ABC A, hueco). Full count solo si se pide. El desvío queda en movimientos con el operario."
              : "Session + lines on the planner (expiry, ABC A, slot). Full count only if asked. Variance is signed on movements."}
          </p>
        </div>
        <select
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          {snap.sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.city}
            </option>
          ))}
        </select>
      </header>

      {matched && <WmsJornadaCard lang={lang} snap={snap} operatorId={matched.id} onChange={commit} />}
      {!session && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openSession("cyclic")}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            {lang === "es" ? "Abrir sesión cíclica" : "Open cyclic session"}
          </button>
          <button
            type="button"
            onClick={() => openSession("abc")}
            className="rounded-full border border-[var(--glass-border)] px-4 py-2 text-sm font-semibold"
          >
            {lang === "es" ? "Sesión ABC A" : "ABC A session"}
          </button>
        </div>
      )}
      {session && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="brand">{session.kind === "abc" ? "ABC" : session.kind}</Badge>
          <span className="text-[var(--ink-muted)]">
            {sessionLines.filter((l) => l.status === "counted").length}/{sessionLines.length}{" "}
            {lang === "es" ? "contadas" : "counted"}
          </span>
          <button
            type="button"
            onClick={() => {
              const closed = closeCountSession(snap, session.id);
              if (closed.ok) commit(closed.snap);
            }}
            className="rounded-full border border-[var(--glass-border)] px-3 py-1.5 text-xs font-semibold"
          >
            {lang === "es" ? "Cerrar sesión" : "Close session"}
          </button>
        </div>
      )}
      {isFloor && matched?.fingerprintEnrolled && (
        <input
          value={pickPin}
          onChange={(e) => setPickPin(e.target.value)}
          placeholder={lang === "es" ? "PIN de planta" : "Floor PIN"}
          className="max-w-xs rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
      )}

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <Card title={lang === "es" ? "Cola de conteo" : "Count queue"}>
          <ul className="space-y-2">
            {(session ? sessionLines : tasks).map((t) => {
              const s = snap.slots.find((x) => x.id === ("slotId" in t ? t.slotId : ""));
              const sk = snap.skus.find((x) => x.id === t.skuId);
              const selected = session ? t.id === line?.id : t.id === task?.id;
              const reason = "taskReason" in t ? t.taskReason : t.reason;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (session) setLineId(t.id);
                      else setTaskId(t.id);
                      setQty("expectedQty" in t ? t.expectedQty : 0);
                      setFeedback(null);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm",
                      selected
                        ? "border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]"
                        : "border-[var(--glass-border)]",
                    )}
                  >
                    <span>
                      <span className="font-mono text-xs font-semibold">{s?.code}</span>
                      <span className="mt-0.5 block text-[var(--ink-muted)]">{sk?.name}</span>
                    </span>
                    <Badge tone={"status" in t && t.status === "counted" ? "good" : reason === "caducidad" ? "bad" : "warn"}>
                      {"status" in t && t.status !== "pending" ? t.status : reasonLabel[reason]}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {task && slot && pallet && sku ? (
          <Card title={slot.code} subtitle={sku.name}>
            <p className="mb-3 text-xs text-[var(--ink-muted)]">
              SSCC {pallet.sscc} · {lang === "es" ? "esperado" : "expected"} {task.expectedQty}
            </p>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              {lang === "es" ? "1. Escanea hueco" : "1. Scan slot"}
              <input
                value={scanSlot}
                onChange={(e) => setScanSlot(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              {lang === "es" ? "2. Escanea SSCC" : "2. Scan SSCC"}
              <input
                value={scanSscc}
                onChange={(e) => setScanSscc(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              {lang === "es" ? "3. Cantidad contada" : "3. Counted qty"}
              <input
                type="number"
                min={0}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
              />
            </label>
            {feedback && (
              <p className="mb-3 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-xs font-semibold text-[var(--warn-ink)]">
                {feedback}
              </p>
            )}
            {okMsg && (
              <p className="mb-3 rounded-xl bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--ok)]">
                {okMsg}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirm}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Check className="h-4 w-4" />
                {lang === "es" ? "Confirmar conteo" : "Confirm count"}
              </button>
              {session && line?.status === "pending" && (
                <button
                  type="button"
                  onClick={() => {
                    const skipped = skipCountSessionLine(snap, session.id, line.id);
                    if (skipped.ok) commit(skipped.snap);
                  }}
                  className="rounded-full border border-[var(--glass-border)] px-4 py-2.5 text-sm font-semibold"
                >
                  {lang === "es" ? "Omitir línea" : "Skip line"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setScanSlot(slot.code);
                  setScanSscc(pallet.sscc);
                  setQty(task.expectedQty);
                }}
                className="rounded-full border border-[var(--glass-border)] px-4 py-2.5 text-sm font-semibold"
              >
                {lang === "es" ? "Rellenar hueco y SSCC reales" : "Fill real slot and SSCC"}
              </button>
            </div>
          </Card>
        ) : (
          <Card title={lang === "es" ? "Sin tareas" : "No tasks"}>
            <p className="text-sm text-[var(--ink-muted)]">
              {lang === "es" ? "Cola de inventario cíclico vacía." : "Cycle count queue is empty."}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
