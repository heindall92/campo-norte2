import { Badge, Card } from "@/components/CrmChrome";
import { useAuth } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import {
  appendAuditLog,
  applyOfflineRfEvent,
  applyRfScan,
  assertCanPick,
  buildRfQueue,
  confirmRfTask,
  enqueueOfflineEvent,
  localDeviceId,
  pendingOfflineEvents,
  readOfflineQueue,
  syncOfflineQueue,
  nextFloorTicket,
  operatorByCode,
  operatorForAppUser,
  confirmVoicePick,
  declareUnitsMade,
  remainingOnPallet,
  reportSlotMismatch,
  voiceCueAfterMark,
  startRfSession,
  type CloseCueInput,
  type RfScanError,
  type RfSession,
  type RfStep,
} from "@/lib/wms";
import { cn } from "@/lib/utils";
import { Check, MapPin, Package, ScanLine, UserRound, WifiOff, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { WmsMermaCard, WmsSlotFixCard, WmsSuperFinishCard } from "./WmsFloorBoard";
import { WmsJornadaCard } from "./WmsJornadaCard";
import { WmsVoiceHeadset } from "./WmsVoiceHeadset";
import { useWmsLive } from "./useWmsLive";

const SCAN_ERR: Record<RfScanError, { es: string; en: string }> = {
  unknown_scan: { es: "Código no reconocido", en: "Unrecognized code" },
  wrong_slot: { es: "Hueco incorrecto", en: "Wrong slot" },
  wrong_sscc: { es: "SSCC incorrecto", en: "Wrong SSCC" },
  wrong_dest: { es: "Destino incorrecto", en: "Wrong destination" },
  invalid_qty: { es: "Cantidad no válida", en: "Invalid qty" },
};

const STEP_LABEL: Record<RfStep, { es: string; en: string }> = {
  from: { es: "Escanea el hueco", en: "Scan the slot" },
  sscc: { es: "Escanea el SSCC", en: "Scan the SSCC" },
  to: { es: "Escanea el destino", en: "Scan destination" },
  qty: { es: "Introduce la cantidad", en: "Enter quantity" },
  ready: { es: "Confirmar", en: "Confirm" },
};

export function WmsRfGunPanel({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const { snap, commit: persist, getSnap } = useWmsLive();
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const matched = operatorForAppUser(snap, user);
  const isFloor = user?.role === "guide";
  const [operatorId, setOperatorId] = useState(matched?.id ?? "");
  const [opCode, setOpCode] = useState("");
  const [pickPin, setPickPin] = useState("");
  const queue = useMemo(
    () => buildRfQueue(snap, siteId, isFloor ? matched?.id ?? operatorId : operatorId || null),
    [snap, siteId, isFloor, matched?.id, operatorId],
  );
  const [taskId, setTaskId] = useState(queue[0]?.id ?? "");
  const task = queue.find((t) => t.id === taskId) ?? queue[0] ?? null;
  const [session, setSession] = useState<RfSession | null>(task ? startRfSession(task) : null);
  const [scan, setScan] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [closeCue, setCloseCue] = useState<CloseCueInput | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [queued, setQueued] = useState(() => pendingOfflineEvents().length);

  useEffect(() => {
    const ping = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const flush = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const actor = operatorId || matched?.id || null;
      syncOfflineQueue(
        readOfflineQueue(),
        (ev) => {
          const applied = applyOfflineRfEvent(getSnap(), ev, actor);
          if (!applied.ok) return { ok: false, reason: applied.reason };
          persist(applied.snap);
          return { ok: true };
        },
        true,
      );
      setQueued(pendingOfflineEvents().length);
    };
    const onOnline = () => {
      ping();
      flush();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", ping);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", ping);
    };
  }, [getSnap, matched?.id, operatorId, persist]);

  useEffect(() => {
    if (session) return;
    const first = queue[0];
    if (!first) return;
    setTaskId(first.id);
    setSession(startRfSession(first));
  }, [queue, session]);

  function selectTask(id: string) {
    const next = queue.find((t) => t.id === id);
    setTaskId(id);
    setSession(next ? startRfSession(next) : null);
    setScan("");
    setFeedback(null);
    setOkMsg(null);
  }

  function onScan() {
    if (!session) return;
    const result = applyRfScan(session, scan);
    if (!result.ok) {
      setOkMsg(null);
      setFeedback(SCAN_ERR[result.error][lang]);
      return;
    }
    setSession(result.session);
    setScan("");
    setFeedback(null);
    setOkMsg(null);
  }

  function onConfirm() {
    if (!session) return;
    if (isFloor && matched) {
      const gate = assertCanPick(snap, matched.id, pickPin || null, true);
      if (!gate.ok) {
        setOkMsg(null);
        setFeedback(
          gate.error === "not_clocked"
            ? lang === "es"
              ? "Ficha la entrada antes de confirmar"
              : "Clock in before confirming"
            : lang === "es"
              ? "PIN incorrecto o pendiente"
              : "PIN missing or wrong",
        );
        return;
      }
    }
    const actor = operatorId || matched?.id || null;
    const deviceId = localDeviceId();
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      enqueueOfflineEvent({
        id: `off-${session.task.id}-${session.task.lineId ?? "x"}-${Date.now()}`,
        at: new Date().toISOString(),
        kind: session.task.kind === "putaway" ? "putaway" : session.task.kind === "count" ? "count" : "confirm_pick",
        entity: session.task.kind,
        entityId: session.task.lineId ?? session.task.id,
        payload: {
          qty: session.qty,
          sscc: session.sscc,
          from: session.fromCode,
          to: session.toCode,
          siteId: session.task.siteId,
          taskId: session.task.id,
          deviceId,
        },
        correlationId: `rf-${session.task.id}`,
      });
      setQueued(pendingOfflineEvents().length);
      setOkMsg(lang === "es" ? "Sin red: evento en cola. No se ha tocado el stock." : "Offline: event queued. Stock was not changed.");
      setFeedback(null);
      return;
    }
    const result = confirmRfTask(snap, session, actor);
    if (!result.ok) {
      setOkMsg(null);
      setFeedback(lang === "es" ? "No se pudo confirmar: revisa los escaneos" : "Could not confirm: check scans");
      return;
    }
    persist(
      appendAuditLog(result.snap, {
        actorId: actor,
        warehouseId: session.task.siteId,
        action: "rf_confirm",
        entity: session.task.kind,
        entityId: session.task.lineId ?? session.task.id,
        beforeData: { step: session.step },
        afterData: { qty: session.qty, sscc: session.sscc },
        reason: session.task.labelEs,
        deviceId,
        correlationId: `rf-${session.task.id}`,
      }),
    );
    const nextQueue = buildRfQueue(
      result.snap,
      siteId,
      isFloor ? matched?.id ?? operatorId : operatorId || null,
    );
    const next = nextQueue[0] ?? null;
    setTaskId(next?.id ?? "");
    setSession(next ? startRfSession(next) : null);
    setOkMsg(lang === "es" ? "Movimiento registrado" : "Move recorded");
    setFeedback(null);
    const opId = operatorId || matched?.id || "";
    if (floorTicket && opId) {
      const last: CloseCueInput & { palletId?: string | null; pickPack?: typeof floorTicket.pickPack } = {
        storeName: floorTicket.storeName,
        orderCode: floorTicket.orderCode,
        dockAisle: floorTicket.dockAisle,
        palletId: floorTicket.line.palletId,
        pickPack: floorTicket.pickPack,
      };
      const cue = voiceCueAfterMark(result.snap, opId, last, lang);
      setCloseCue(cue.kind === "close" ? last : null);
    }
  }

  const floorTicket = operatorId ? nextFloorTicket(snap, operatorId) : null;

  return (
    <div className="space-y-4">
      <header>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          <ScanLine className="h-3.5 w-3.5" />
          {snap.seededFromDemo
            ? lang === "es"
              ? "Cola derivada del snapshot local · no inventa palets"
              : "Queue derived from local snapshot · no invented pallets"
            : lang === "es"
              ? "Cola RF en vivo"
              : "Live RF queue"}
        </p>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Pistola RF" : "RF gun"}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "SCAN LOCATION → SCAN SKU/SSCC → CONFIRM QTY → COMPLETE. Sin red el evento se guarda; al volver se aplica o queda en conflicto. El aparato no te asigna él solo."
            : "SCAN LOCATION → SCAN SKU/SSCC → CONFIRM QTY → COMPLETE. Offline events are queued; on reconnect they apply or conflict. The device does not assign you by itself."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <RfFlowSteps step={session?.step ?? "from"} lang={lang} />
          <Badge tone={online ? "good" : "warn"}>{online ? "online" : "offline"}</Badge>
          {queued > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--warn-ink)]">
              <WifiOff className="h-3.5 w-3.5" />
              {queued} {lang === "es" ? "en cola" : "queued"}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value);
            setSession(null);
            setTaskId("");
          }}
        >
          {snap.sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.city} · {s.code}
            </option>
          ))}
        </select>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const op = operatorByCode(snap, opCode);
            setOperatorId(op?.id ?? "");
            setSession(null);
            setTaskId("");
            setFeedback(op ? null : lang === "es" ? "Código de operario no encontrado" : "Operator code not found");
          }}
        >
          <input
            value={opCode}
            onChange={(e) => setOpCode(e.target.value)}
            placeholder={lang === "es" ? "Código operario OP-1903" : "Operator code OP-1903"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
          />
          <button type="submit" className="rounded-full border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold">
            {lang === "es" ? "Entrar con código" : "Sign in with code"}
          </button>
        </form>
      </div>

      {matched && <WmsJornadaCard lang={lang} snap={snap} operatorId={matched.id} onChange={persist} />}
      {isFloor && matched?.fingerprintEnrolled && (
        <input
          value={pickPin}
          onChange={(e) => setPickPin(e.target.value)}
          placeholder={lang === "es" ? "PIN de picking" : "Picking PIN"}
          className="max-w-xs rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="mx-auto w-full max-w-[22rem] rounded-[2rem] border border-white/10 bg-[#0f172a] p-4 text-white shadow-inner">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200/80">
            <ScanLine className="h-4 w-4" />
            {lang === "es" ? "Terminal de planta" : "Floor terminal"}
          </p>
          {task && session ? (
            <>
              {task.kind === "pick" && operatorId
                ? (() => {
                    const ticket = nextFloorTicket(snap, operatorId);
                    return ticket ? (
                      <p className="mb-2 text-sm font-semibold text-amber-100">
                        {ticket.storeName}
                        <span className="mt-0.5 block font-mono text-xs font-normal text-white/60">
                          {lang === "es" ? "Tomar" : "Take"} {ticket.qty} · {lang === "es" ? "muelle" : "dock"}{" "}
                          {ticket.dockAisle}
                        </span>
                      </p>
                    ) : null;
                  })()
                : null}
              <p className="font-mono text-lg font-semibold">{task.fromCode}</p>
              <p className="mt-1 text-sm text-white/70">{lang === "es" ? task.labelEs : task.labelEn}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/60">
                <Package className="h-3.5 w-3.5" />
                SSCC {task.sscc}
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-200">
                {STEP_LABEL[session.step][lang]}
              </p>
              <form
                className="mt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (session.step === "ready") onConfirm();
                  else onScan();
                }}
              >
                <input
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  autoComplete="off"
                  placeholder={
                    session.step === "from"
                      ? task.fromCode
                      : session.step === "sscc"
                        ? task.sscc
                        : session.step === "to"
                          ? (task.toCode ?? "")
                          : session.step === "qty"
                            ? String(task.qty)
                            : ""
                  }
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-3 font-mono text-sm text-white placeholder:text-white/30"
                />
                <button
                  type="submit"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-3 text-sm font-semibold text-slate-950"
                >
                  {session.step === "ready" ? <Check className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
                  {session.step === "ready"
                    ? lang === "es"
                      ? "Confirmar movimiento"
                      : "Confirm move"
                    : lang === "es"
                      ? "Leer código"
                      : "Read code"}
                </button>
              </form>
              {feedback && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-300" role="alert">
                  <X className="h-3.5 w-3.5" />
                  {feedback}
                </p>
              )}
              {okMsg && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300" role="status">
                  <Check className="h-3.5 w-3.5" />
                  {okMsg}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-white/70">
              {lang === "es" ? "No hay tareas abiertas en este centro." : "No open tasks at this site."}
            </p>
          )}
        </div>

        <Card title={lang === "es" ? "Cola real" : "Live queue"} subtitle={`${queue.length} ${lang === "es" ? "tareas" : "tasks"}`}>
          <ul className="space-y-2">
            {queue.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => selectTask(t.id)}
                  className={cn(
                    "flex w-full items-start justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm",
                    t.id === task?.id
                      ? "border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]"
                      : "border-[var(--glass-border)]",
                  )}
                >
                  <span>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold">
                      <MapPin className="h-3 w-3" />
                      {t.fromCode}
                    </span>
                    <span className="mt-0.5 block text-[var(--ink-muted)]">
                      {lang === "es" ? t.labelEs : t.labelEn}
                    </span>
                  </span>
                  <Badge tone={t.kind === "pick" ? "brand" : t.kind === "count" ? "warn" : "neutral"}>{t.kind}</Badge>
                </button>
              </li>
            ))}
          </ul>
          {matched && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
              <UserRound className="h-3.5 w-3.5" />
              {matched.name} · {matched.code}
            </p>
          )}
        </Card>
      </div>
      {task?.kind === "pick" && floorTicket && (
        <WmsVoiceHeadset
          lang={lang}
          ticket={floorTicket}
          remaining={remainingOnPallet(snap, floorTicket.line.palletId)}
          onConfirmOk={(spokenQty) => {
            const opId = operatorId || matched?.id || "";
            if (!opId) return;
            const last = {
              storeName: floorTicket.storeName,
              orderCode: floorTicket.orderCode,
              dockAisle: floorTicket.dockAisle,
              palletId: floorTicket.line.palletId,
              pickPack: floorTicket.pickPack,
            };
            const result = confirmVoicePick(snap, opId, spokenQty);
            if (!result.ok) {
              setOkMsg(null);
              setFeedback(
                result.error === "qty_mismatch"
                  ? lang === "es"
                    ? `Di ${floorTicket.qty} ok`
                    : `Say ${floorTicket.qty} ok`
                  : result.error === "slot_short"
                    ? lang === "es"
                      ? "En el hueco no hay tantas. Avisa al jefe."
                      : "The slot does not have that many. Tell the lead."
                    : lang === "es"
                      ? "No se pudo picar"
                      : "Could not pick",
              );
              return;
            }
            persist(result.snap);
            const cue = voiceCueAfterMark(result.snap, opId, last, lang);
            setCloseCue(cue.kind === "close" ? last : null);
            setOkMsg(lang === "es" ? "Picado. Siguiente hueco." : "Picked. Next slot.");
            setFeedback(null);
            const nextQueue = buildRfQueue(result.snap, siteId, isFloor ? matched?.id ?? operatorId : operatorId || null);
            const next = nextQueue[0] ?? null;
            setTaskId(next?.id ?? "");
            setSession(next ? startRfSession(next) : null);
          }}
          onReportMismatch={() => {
            const result = reportSlotMismatch(snap, {
              slotCode: floorTicket.slotCode,
              takeQty: floorTicket.qty,
              operatorId: operatorId || matched?.id || null,
            });
            if (!result.ok) {
              setFeedback(lang === "es" ? "No se pudo avisar" : "Could not report");
              return;
            }
            persist(result.snap);
            setFeedback(null);
            setOkMsg(lang === "es" ? "Aviso al jefe. Sigue al siguiente hueco." : "Lead notified. Next slot.");
          }}
        />
      )}
      {!floorTicket && closeCue && (() => {
        const order = snap.outbound.find((o) => o.code === closeCue.orderCode);
        const assignment =
          operatorId && order
            ? snap.superAssignments.find((a) => a.operatorId === operatorId && a.orderId === order.id)
            : null;
        const cue = { ...closeCue, loadKind: closeCue.loadKind ?? assignment?.loadKind ?? null };
        if (assignment?.unitsMade != null) {
          return (
            <WmsVoiceHeadset
              lang={lang}
              labelCue={{ ...cue, units: assignment.unitsMade, labels: assignment.labelsPrinted }}
            />
          );
        }
        return (
          <WmsVoiceHeadset
            lang={lang}
            askUnits={cue}
            onUnitsSaid={(n) => {
              if (!operatorId || !order) return;
              const result = declareUnitsMade(snap, operatorId, order.id, n);
              if (result.ok) persist(result.snap);
            }}
          />
        );
      })()}
      {!floorTicket && (
        <WmsSuperFinishCard
          lang={lang}
          operatorId={operatorId || matched?.id || null}
          orderId={closeCue ? snap.outbound.find((o) => o.code === closeCue.orderCode)?.id : undefined}
        />
      )}
      {task?.kind === "pick" && (
        <WmsMermaCard
          lang={lang}
          siteId={siteId}
          operatorId={operatorId || matched?.id || null}
          preset={{ sscc: task.sscc, fromSlotCode: task.fromCode }}
        />
      )}
      <WmsSlotFixCard lang={lang} siteId={siteId} />
    </div>
  );
}

const FLOW_STEPS: { id: RfStep | "complete"; es: string; en: string }[] = [
  { id: "from", es: "1 · Location", en: "1 · Location" },
  { id: "sscc", es: "2 · SKU / SSCC", en: "2 · SKU / SSCC" },
  { id: "qty", es: "3 · Qty", en: "3 · Qty" },
  { id: "complete", es: "4 · Complete", en: "4 · Complete" },
];

function RfFlowSteps({ step, lang }: { step: RfStep; lang: Lang }) {
  const current = step === "to" ? "sscc" : step === "ready" ? "complete" : step;
  return (
    <ol className="flex flex-wrap gap-1.5">
      {FLOW_STEPS.map((s) => (
        <li
          key={s.id}
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
            s.id === current
              ? "bg-amber-500 text-slate-950"
              : "bg-[var(--field-bg)] text-[var(--ink-muted)]",
          )}
        >
          {lang === "es" ? s.es : s.en}
        </li>
      ))}
    </ol>
  );
}
