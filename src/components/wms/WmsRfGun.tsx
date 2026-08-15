import { Badge, Card } from "@/components/CrmChrome";
import { useAuth } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import {
  applyRfScan,
  buildRfQueue,
  confirmRfTask,
  loadWmsSnapshot,
  operatorForAppUser,
  saveWmsSnapshot,
  startRfSession,
  type RfScanError,
  type RfSession,
  type RfStep,
  type WmsSnapshot,
} from "@/lib/wms";
import { cn } from "@/lib/utils";
import { Check, MapPin, Package, ScanLine, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  const [snap, setSnap] = useState(() => loadWmsSnapshot());
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const matched = operatorForAppUser(snap, user);
  const [operatorId, setOperatorId] = useState(matched?.id ?? "");
  const queue = useMemo(() => buildRfQueue(snap, siteId), [snap, siteId]);
  const [taskId, setTaskId] = useState(queue[0]?.id ?? "");
  const task = queue.find((t) => t.id === taskId) ?? queue[0] ?? null;
  const [session, setSession] = useState<RfSession | null>(task ? startRfSession(task) : null);
  const [scan, setScan] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (session) return;
    const first = queue[0];
    if (!first) return;
    setTaskId(first.id);
    setSession(startRfSession(first));
  }, [queue, session]);

  function persist(next: WmsSnapshot) {
    saveWmsSnapshot(next);
    setSnap(next);
  }

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
    const result = confirmRfTask(snap, session, operatorId || null);
    if (!result.ok) {
      setOkMsg(null);
      setFeedback(lang === "es" ? "No se pudo confirmar: revisa los escaneos" : "Could not confirm: check scans");
      return;
    }
    persist(result.snap);
    const nextQueue = buildRfQueue(result.snap, siteId);
    const next = nextQueue[0] ?? null;
    setTaskId(next?.id ?? "");
    setSession(next ? startRfSession(next) : null);
    setOkMsg(lang === "es" ? "Movimiento registrado" : "Move recorded");
    setFeedback(null);
  }

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
            ? "Un escáner: hueco → SSCC → destino o cantidad. Solo confirma si coincide con el palet y el hueco reales de la cola."
            : "One scanner: slot → SSCC → dest or qty. Confirms only if it matches the real pallet and slot in the queue."}
        </p>
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
        <select
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
        >
          <option value="">{lang === "es" ? "Sin operario asignado" : "No operator"}</option>
          {snap.operators
            .filter((o) => o.active && o.siteId === siteId)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.code}
              </option>
            ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="mx-auto w-full max-w-[22rem] rounded-[2rem] border border-white/10 bg-[#0f172a] p-4 text-white shadow-inner">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200/80">
            <ScanLine className="h-4 w-4" />
            {lang === "es" ? "Terminal de planta" : "Floor terminal"}
          </p>
          {task && session ? (
            <>
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
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-300">
                  <X className="h-3.5 w-3.5" />
                  {feedback}
                </p>
              )}
              {okMsg && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
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
    </div>
  );
}
