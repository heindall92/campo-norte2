import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  ROLE_FLOOR_LABEL,
  SHIFT_LABEL,
  applyShiftMoves,
  assignOperatorShift,
  computeShiftCoverage,
  proposeShiftFills,
  remainingHireGaps,
  type Operator,
  type ShiftCode,
  type WmsSnapshot,
} from "@/lib/wms";
import { cn } from "@/lib/utils";
import { CalendarClock, Check, Moon, Sun, Sunset, UserRoundPlus } from "lucide-react";
import { useMemo, useState } from "react";

const SHIFT_ICON = { manana: Sun, tarde: Sunset, noche: Moon } as const;

export function WmsShiftBoard({
  lang,
  snap,
  siteId,
  onChange,
}: {
  lang: Lang;
  snap: WmsSnapshot;
  siteId: string;
  onChange: (next: WmsSnapshot) => void;
}) {
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const coverage = computeShiftCoverage(snap, siteId);
  const proposals = useMemo(() => proposeShiftFills(snap, siteId), [snap, siteId]);
  const hireGaps = remainingHireGaps(applyShiftMoves(snap, proposals), siteId);
  const ops = snap.operators.filter((o) => o.active && o.siteId === siteId);

  function moveOne(operatorId: string, toShift: ShiftCode) {
    const result = assignOperatorShift(snap, operatorId, toShift);
    if (!result.ok) return;
    onChange(result.snap);
    const op = snap.operators.find((o) => o.id === operatorId);
    setOkMsg(
      lang === "es"
        ? `${op?.name ?? operatorId} → ${SHIFT_LABEL[toShift].es}`
        : `${op?.name ?? operatorId} → ${SHIFT_LABEL[toShift].en}`,
    );
  }

  function coverGaps() {
    if (proposals.length === 0) return;
    onChange(applyShiftMoves(snap, proposals));
    setOkMsg(
      lang === "es"
        ? `Cubiertos ${proposals.length} huecos con excedente de plantilla`
        : `Filled ${proposals.length} gaps with surplus staff`,
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
          <CalendarClock className="h-4 w-4 text-[var(--accent)]" />
          {lang === "es" ? "Planificación de turnos" : "Shift planning"}
        </p>
        <button
          type="button"
          disabled={proposals.length === 0}
          onClick={coverGaps}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <UserRoundPlus className="h-4 w-4" />
          {lang === "es"
            ? `Cubrir huecos (${proposals.length})`
            : `Fill gaps (${proposals.length})`}
        </button>
      </div>

      {okMsg && (
        <p className="inline-flex items-center gap-1.5 rounded-xl bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--ok)]">
          <Check className="h-3.5 w-3.5" />
          {okMsg}
        </p>
      )}

      {proposals.length > 0 && (
        <p className="text-xs text-[var(--ink-muted)]">
          {lang === "es" ? "Propuesta: " : "Proposal: "}
          {proposals
            .map((m) =>
              lang === "es"
                ? `${m.operatorName} ${SHIFT_LABEL[m.fromShift].es} → ${SHIFT_LABEL[m.toShift].es}`
                : `${m.operatorName} ${SHIFT_LABEL[m.fromShift].en} → ${SHIFT_LABEL[m.toShift].en}`,
            )
            .join(" · ")}
        </p>
      )}

      {hireGaps.length > 0 && (
        <p className="text-xs text-[var(--ink-muted)]">
          {lang === "es"
            ? `Tras cubrir con excedente, sigue faltando contratar: ${hireGaps
                .map((g) => `${ROLE_FLOOR_LABEL[g.role].es} ${SHIFT_LABEL[g.shift].es} (${Math.abs(g.gap)})`)
                .join(", ")}.`
            : `After surplus fills, still hire: ${hireGaps
                .map((g) => `${ROLE_FLOOR_LABEL[g.role].en} ${SHIFT_LABEL[g.shift].en} (${Math.abs(g.gap)})`)
                .join(", ")}.`}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {(["manana", "tarde", "noche"] as const).map((shift) => {
          const Icon = SHIFT_ICON[shift];
          const people = ops.filter((o) => o.shift === shift);
          const rows = coverage.gaps.filter((g) => g.shift === shift);
          const missing = rows.filter((g) => g.gap < 0).length;
          return (
            <Card
              key={shift}
              title={SHIFT_LABEL[shift][lang]}
              subtitle={`${people.length} ${lang === "es" ? "asignados" : "assigned"}`}
            >
              <p className="mb-3 inline-flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                <Icon className="h-4 w-4 text-[var(--accent)]" />
                {missing
                  ? lang === "es"
                    ? `${missing} huecos de rol`
                    : `${missing} role gaps`
                  : lang === "es"
                    ? "Dotación cubierta"
                    : "Staffing covered"}
              </p>
              <ul className="mb-3 space-y-1.5 text-xs">
                {rows.map((g) => (
                  <li key={`${g.shift}-${g.role}`} className="flex items-center justify-between">
                    <span>{ROLE_FLOOR_LABEL[g.role][lang]}</span>
                    <Badge tone={g.gap < 0 ? "bad" : g.gap === 0 ? "good" : "neutral"}>
                      {g.actual}/{g.required}
                    </Badge>
                  </li>
                ))}
              </ul>
              <ul className="space-y-2">
                {people.map((o) => (
                  <ShiftPersonRow key={o.id} lang={lang} operator={o} onMove={moveOne} />
                ))}
                {people.length === 0 && (
                  <li className="text-xs text-[var(--ink-muted)]">
                    {lang === "es" ? "Nadie asignado" : "Nobody assigned"}
                  </li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ShiftPersonRow({
  lang,
  operator,
  onMove,
}: {
  lang: Lang;
  operator: Operator;
  onMove: (id: string, shift: ShiftCode) => void;
}) {
  return (
    <li className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">{operator.name}</p>
          <p className="font-mono text-[10px] text-[var(--ink-muted)]">{operator.code}</p>
        </div>
        <Badge tone="neutral">{ROLE_FLOOR_LABEL[operator.role][lang]}</Badge>
      </div>
      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {lang === "es" ? "Turno" : "Shift"}
        <select
          className={cn(
            "mt-1 w-full rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs",
          )}
          value={operator.shift}
          onChange={(e) => onMove(operator.id, e.target.value as ShiftCode)}
        >
          {(["manana", "tarde", "noche"] as const).map((s) => (
            <option key={s} value={s}>
              {SHIFT_LABEL[s][lang]}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}
