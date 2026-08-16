import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  buildShiftClose,
  clockInOrOut,
  enrollOperatorPin,
  ingestAdapterPunch,
  operatorJornada,
  type WmsSnapshot,
} from "@/lib/wms";
import { ClipboardCheck, Clock, Fingerprint, LogIn, LogOut } from "lucide-react";
import { useState } from "react";

const CLOCK_ERR: Record<string, { es: string; en: string }> = {
  operator_missing: { es: "Operario no encontrado", en: "Operator missing" },
  operator_vacant: { es: "Plaza vacante", en: "Vacant seat" },
  pin_invalid: { es: "PIN de 4–6 dígitos", en: "4–6 digit PIN" },
  pin_mismatch: { es: "PIN incorrecto", en: "Wrong PIN" },
  already_in: { es: "Ya estás dentro", en: "Already clocked in" },
  not_in: { es: "No hay entrada previa", en: "No open clock-in" },
  adapter_empty: { es: "Falta deviceId o fecha", en: "Missing device or time" },
};

export function WmsJornadaCard({
  lang,
  snap,
  operatorId,
  onChange,
}: {
  lang: Lang;
  snap: WmsSnapshot;
  operatorId: string;
  onChange: (next: WmsSnapshot) => void;
}) {
  const jornada = operatorJornada(snap, operatorId);
  const [pin, setPin] = useState("");
  const [enroll, setEnroll] = useState("");
  const [adapter, setAdapter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (!jornada) return null;
  const { operator } = jornada;

  function apply(result: { ok: true; snap: WmsSnapshot } | { ok: false; error: string }) {
    if (!result.ok) {
      setMsg((CLOCK_ERR[result.error] ?? { es: result.error, en: result.error })[lang]);
      return;
    }
    onChange(result.snap);
    setPin("");
    setMsg(null);
  }

  return (
    <Card
      title={lang === "es" ? "Jornada de planta" : "Floor shift"}
      subtitle={`${operator.name} · ${jornada.windowLabel} · ${lang === "es" ? "plan" : "plan"} ${jornada.plannedHours} h`}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone={jornada.clockedIn ? "good" : "warn"}>
          {jornada.clockedIn
            ? lang === "es"
              ? "Dentro"
              : "In"
            : lang === "es"
              ? "Fuera"
              : "Out"}
        </Badge>
        <Badge tone={jornada.withinWindow ? "neutral" : "warn"}>
          {jornada.withinWindow
            ? lang === "es"
              ? "En horario"
              : "On shift"
            : lang === "es"
              ? "Fuera de horario"
              : "Off window"}
        </Badge>
        <Badge tone="brand">
          <Clock className="mr-1 inline h-3 w-3" />
          {jornada.hoursWorked.toFixed(1)} h
        </Badge>
        {jornada.overtimeHours > 0 && (
          <Badge tone="warn">
            +{jornada.overtimeHours} h {lang === "es" ? "extra" : "OT"}
          </Badge>
        )}
      </div>
      <p className="mb-3 text-xs text-[var(--ink-muted)]">
        {lang === "es"
          ? "Las horas salen de entrada/salida reales. El navegador no lee la huella; el PIN o el adaptador ZKTeco marcan el fichaje."
          : "Hours come from real clock events. The browser cannot read a fingerprint; PIN or the ZKTeco adapter marks the punch."}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        {operator.fingerprintEnrolled && (
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="w-28 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
          />
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          onClick={() => apply(clockInOrOut(snap, operatorId, pin || null))}
        >
          {jornada.clockedIn ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {jornada.clockedIn
            ? lang === "es"
              ? "Salida"
              : "Clock out"
            : lang === "es"
              ? "Entrada"
              : "Clock in"}
        </button>
      </div>
      {!operator.fingerprintEnrolled && (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply(enrollOperatorPin(snap, operatorId, enroll));
            setEnroll("");
          }}
        >
          <input
            value={enroll}
            onChange={(e) => setEnroll(e.target.value)}
            placeholder={lang === "es" ? "Enrolar PIN 4–6 dígitos" : "Enroll 4–6 digit PIN"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold"
          >
            <Fingerprint className="h-4 w-4" />
            {lang === "es" ? "Enrolar" : "Enroll"}
          </button>
        </form>
      )}
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          let parsed: { kind?: "entrada" | "salida"; at?: string; deviceId?: string };
          try {
            parsed = JSON.parse(adapter) as { kind?: "entrada" | "salida"; at?: string; deviceId?: string };
          } catch {
            setMsg(lang === "es" ? "JSON del adaptador no válido" : "Invalid adapter JSON");
            return;
          }
          apply(
            ingestAdapterPunch(snap, {
              operatorId,
              kind: parsed.kind === "salida" ? "salida" : "entrada",
              at: parsed.at ?? new Date().toISOString(),
              deviceId: parsed.deviceId ?? "",
            }),
          );
          setAdapter("");
        }}
      >
        <input
          value={adapter}
          onChange={(e) => setAdapter(e.target.value)}
          placeholder='{"kind":"entrada","at":"…","deviceId":"ZK-SEV-01"}'
          className="min-w-[16rem] flex-1 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-[11px]"
        />
        <button type="submit" className="rounded-full border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold">
          {lang === "es" ? "Pegar punch pyzk" : "Paste pyzk punch"}
        </button>
      </form>
      {msg && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
    </Card>
  );
}

export function WmsShiftCloseCard({
  lang,
  snap,
  siteId,
}: {
  lang: Lang;
  snap: WmsSnapshot;
  siteId?: string;
}) {
  const sid = siteId ?? snap.sites[0]?.id ?? "";
  const close = buildShiftClose(snap, sid);
  const site = snap.sites.find((s) => s.id === sid);

  return (
    <Card
      title={lang === "es" ? "Cierre de jornada" : "Shift close"}
      subtitle={`${site?.city ?? sid} · ${close.day} · ${
        lang === "es"
          ? "solo fichajes y movimientos de ese día"
          : "only punches and movements from that day"
      }`}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone={close.stillIn ? "warn" : "good"}>
          {close.stillIn
            ? lang === "es"
              ? `${close.stillIn} aún dentro`
              : `${close.stillIn} still in`
            : lang === "es"
              ? "Nadie dentro"
              : "Nobody in"}
        </Badge>
        <Badge tone="brand">
          <Clock className="mr-1 inline h-3 w-3" />
          {close.hoursTotal.toFixed(1)} h
        </Badge>
        <Badge tone="neutral">
          {close.punchesTotal} {lang === "es" ? "fichajes" : "punches"}
        </Badge>
        <Badge tone="neutral">
          <ClipboardCheck className="mr-1 inline h-3 w-3" />
          {close.movements.length} {lang === "es" ? "movimientos" : "moves"}
        </Badge>
      </div>
      <p className="mb-3 text-xs text-[var(--ink-muted)]">
        {lang === "es"
          ? `Entradas ${close.inboundMoves} · salidas ${close.outboundMoves} · traslados ${close.transfers} · ajustes ${close.adjustments}. Sin fichaje no hay horas.`
          : `Inbound ${close.inboundMoves} · outbound ${close.outboundMoves} · transfers ${close.transfers} · adjustments ${close.adjustments}. No punch, no hours.`}
      </p>
      {close.operators.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Hoy no hay fichajes en este centro."
            : "No clock punches at this site today."}
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {close.operators.map((row) => (
            <li
              key={row.operator.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2"
            >
              <span>
                <span className="font-medium text-[var(--ink)]">{row.operator.name}</span>
                <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                  {row.operator.code} · {row.punches.length}{" "}
                  {lang === "es" ? "marcas" : "marks"}
                  {row.method ? ` · ${row.method}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={row.clockedIn ? "warn" : "good"}>
                  {row.hoursWorked.toFixed(1)} h
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
