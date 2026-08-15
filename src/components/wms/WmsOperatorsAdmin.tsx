import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  ROLE_FLOOR_LABEL,
  SHIFT_LABEL,
  clockWithPin,
  createOperator,
  deleteOperator,
  enrollOperatorPin,
  FINGERPRINT_STACK,
  hoursFromPunches,
  lastPunch,
  rosterCounts,
  updateOperator,
  type OperatorRoleFloor,
  type ShiftCode,
} from "@/lib/wms";
import { Fingerprint, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { WmsShiftBoard } from "./WmsShifts";
import { useWmsLive } from "./useWmsLive";

function euro(n: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

const ROLES = Object.keys(ROLE_FLOOR_LABEL) as OperatorRoleFloor[];
const SHIFTS: ShiftCode[] = ["manana", "tarde", "noche"];

export function WmsOperatorsPanel({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const [shiftFilter, setShiftFilter] = useState<ShiftCode | "all">("all");
  const [showVacant, setShowVacant] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<OperatorRoleFloor>("picker");
  const [shift, setShift] = useState<ShiftCode>("manana");
  const [vacantId, setVacantId] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [pinOp, setPinOp] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [clockOp, setClockOp] = useState<string | null>(null);
  const [clockPin, setClockPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const ops = snap.operators.filter((o) => {
    if (o.siteId !== siteId) return false;
    if (shiftFilter !== "all" && o.shift !== shiftFilter) return false;
    if (!showVacant && o.vacant) return false;
    return true;
  });
  const labor = ops.filter((o) => o.active).reduce((s, o) => s + o.hoursToday * o.costPerHour, 0);
  const counts = rosterCounts(snap.operators, siteId);
  const vacancies = snap.operators.filter((o) => o.vacant && o.siteId === siteId);
  const day = "2026-08-15";

  const clockHours = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of snap.operators) {
      const h = hoursFromPunches(snap.clockPunches, o.id, day);
      if (h > 0) m.set(o.id, h);
    }
    return m;
  }, [snap.clockPunches, snap.operators]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
            {lang === "es" ? "Operarios & RRHH operativo" : "Operators & floor HR"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "Cupo 25/25/25 en Sevilla: plazas vacantes sin identidad inventada. CRUD, PIN de picking y fichaje. La huella biométrica no se lee en el navegador."
              : "25/25/25 Sevilla roster: vacant slots without invented identities. CRUD, picking PIN and clock. The browser cannot read a fingerprint sensor."}
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
                {s.city}
              </option>
            ))}
          </select>
          <Badge tone="brand">
            {lang === "es" ? "Coste hoy" : "Cost today"} · {euro(labor, lang)}
          </Badge>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        {SHIFTS.map((s) => (
          <Card key={s} title={SHIFT_LABEL[s][lang]}>
            <p className="text-2xl font-semibold text-[var(--ink)]">{counts[s]?.total ?? 0}</p>
            <p className="text-xs text-[var(--ink-muted)]">
              {counts[s]?.hired ?? 0} {lang === "es" ? "de alta" : "hired"} · {counts[s]?.vacant ?? 0}{" "}
              {lang === "es" ? "pendientes" : "open"}
            </p>
          </Card>
        ))}
      </div>

      <WmsShiftBoard lang={lang} snap={snap} siteId={siteId} onChange={commit} />

      <Card title={lang === "es" ? "Alta / editar operario" : "Hire / edit operator"}>
        <form
          className="grid gap-2 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (editId) {
              const result = updateOperator(snap, editId, { name, code, role, shift, siteId });
              if (result.ok) {
                commit(result.snap);
                setEditId(null);
                setName("");
                setCode("");
                setMsg(null);
              } else setMsg(result.error);
              return;
            }
            const result = createOperator(snap, {
              vacantId: vacantId || undefined,
              name,
              code,
              role,
              shift,
              siteId,
              costPerHour: 13,
              certifications: [],
            });
            if (result.ok) {
              commit(result.snap);
              setName("");
              setCode("");
              setVacantId("");
              setMsg(null);
            } else setMsg(result.error);
          }}
        >
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={lang === "es" ? "Nombre real" : "Real name"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="OP-XXXX"
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
          />
          <select
            value={vacantId}
            onChange={(e) => setVacantId(e.target.value)}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          >
            <option value="">{lang === "es" ? "Nueva plaza (extra)" : "New extra seat"}</option>
            {vacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} · {SHIFT_LABEL[v.shift][lang]}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as OperatorRoleFloor)}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_FLOOR_LABEL[r][lang]}
              </option>
            ))}
          </select>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as ShiftCode)}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          >
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {SHIFT_LABEL[s][lang]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {editId
              ? lang === "es"
                ? "Guardar"
                : "Save"
              : lang === "es"
                ? "Dar de alta"
                : "Hire"}
          </button>
        </form>
        {msg && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
      </Card>

      <Card
        title={lang === "es" ? "Huella y fichaje" : "Fingerprint & clock"}
        subtitle={
          lang === "es"
            ? `El navegador no lee el sensor. Open source: ${FINGERPRINT_STACK.repos[0].name} · puerto 4370.`
            : `The browser cannot read the sensor. Open source: ${FINGERPRINT_STACK.repos[0].name} · port 4370.`
        }
      >
        <p className="mb-3 text-xs text-[var(--ink-muted)]">
          {lang === "es"
            ? "Hasta que un agente local (pyzk) empuje punches, el picking usa un PIN de 4–6 dígitos. No es plantilla biométrica."
            : "Until a local agent (pyzk) pushes punches, picking uses a 4–6 digit PIN. It is not a biometric template."}
        </p>
        <div className="flex flex-wrap gap-2">
          {FINGERPRINT_STACK.repos.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--glass-border)] px-3 py-1 text-xs text-[var(--ink)]"
            >
              {r.name}
            </a>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <select
          value={shiftFilter}
          onChange={(e) => setShiftFilter(e.target.value as ShiftCode | "all")}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        >
          <option value="all">{lang === "es" ? "Todos los turnos" : "All shifts"}</option>
          {SHIFTS.map((s) => (
            <option key={s} value={s}>
              {SHIFT_LABEL[s][lang]}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          <input type="checkbox" checked={showVacant} onChange={(e) => setShowVacant(e.target.checked)} />
          {lang === "es" ? "Mostrar plazas vacantes" : "Show vacant seats"}
        </label>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <tr>
                <th className="pb-2 pr-3">{lang === "es" ? "Operario" : "Operator"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Rol" : "Role"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Turno" : "Shift"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Horas" : "Hours"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Fichaje" : "Clock"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Huella/PIN" : "Print/PIN"}</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {ops.map((o) => {
                const last = lastPunch(snap.clockPunches, o.id);
                const hours = clockHours.get(o.id) ?? o.hoursToday;
                return (
                  <tr key={o.id} className="border-t border-[var(--glass-border)]">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{o.name}</p>
                      <p className="font-mono text-xs text-[var(--ink-muted)]">{o.code}</p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={o.vacant ? "warn" : "neutral"}>{ROLE_FLOOR_LABEL[o.role][lang]}</Badge>
                    </td>
                    <td className="py-2.5 pr-3">{SHIFT_LABEL[o.shift][lang]}</td>
                    <td className="py-2.5 pr-3">{hours.toFixed(1)}</td>
                    <td className="py-2.5 pr-3 text-xs text-[var(--ink-muted)]">
                      {last ? `${last.kind} · ${last.method}` : "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={o.fingerprintEnrolled ? "good" : "neutral"}>
                        {o.fingerprintEnrolled
                          ? lang === "es"
                            ? "PIN listo"
                            : "PIN ready"
                          : lang === "es"
                            ? "sin enrolar"
                            : "not enrolled"}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      {!o.vacant && (
                        <>
                          <button
                            type="button"
                            className="mr-1 rounded-full border border-[var(--glass-border)] p-1.5"
                            title="PIN"
                            onClick={() => setPinOp(o.id)}
                          >
                            <Fingerprint className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="mr-1 rounded-full border border-[var(--glass-border)] px-2 py-1 text-[11px] font-semibold"
                            onClick={() => setClockOp(o.id)}
                          >
                            {lang === "es" ? "Fichar" : "Clock"}
                          </button>
                          <button
                            type="button"
                            className="mr-1 rounded-full border border-[var(--glass-border)] p-1.5"
                            onClick={() => {
                              setEditId(o.id);
                              setName(o.name);
                              setCode(o.code);
                              setRole(o.role);
                              setShift(o.shift);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-[var(--glass-border)] p-1.5"
                            onClick={() => {
                              const result = deleteOperator(snap, o.id);
                              if (result.ok) commit(result.snap);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {pinOp && (
        <Card title={lang === "es" ? "Enrolar PIN de picking" : "Enroll picking PIN"}>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const result = enrollOperatorPin(snap, pinOp, pin);
              if (result.ok) {
                commit(result.snap);
                setPinOp(null);
                setPin("");
                setMsg(null);
              } else setMsg(result.error);
            }}
          >
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="****"
              className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
            />
            <button type="submit" className="rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">
              {lang === "es" ? "Guardar PIN" : "Save PIN"}
            </button>
            <button type="button" className="text-sm" onClick={() => setPinOp(null)}>
              {lang === "es" ? "Cancelar" : "Cancel"}
            </button>
          </form>
        </Card>
      )}

      {clockOp && (
        <Card title={lang === "es" ? "Marcar entrada / salida" : "Clock in / out"}>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const last = lastPunch(snap.clockPunches, clockOp);
              const kind = last?.kind === "entrada" ? "salida" : "entrada";
              const result = clockWithPin(snap, clockOp, clockPin, kind);
              if (result.ok) {
                commit(result.snap);
                setClockOp(null);
                setClockPin("");
                setMsg(null);
              } else setMsg(result.error);
            }}
          >
            <input
              value={clockPin}
              onChange={(e) => setClockPin(e.target.value)}
              placeholder={lang === "es" ? "PIN" : "PIN"}
              className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
            />
            <button type="submit" className="rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">
              {lastPunch(snap.clockPunches, clockOp)?.kind === "entrada"
                ? lang === "es"
                  ? "Salida"
                  : "Clock out"
                : lang === "es"
                  ? "Entrada"
                  : "Clock in"}
            </button>
            <button type="button" className="text-sm" onClick={() => setClockOp(null)}>
              {lang === "es" ? "Cancelar" : "Cancel"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
