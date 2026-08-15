"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type MobileTone = "neutral" | "accent" | "ok" | "warn" | "danger";

const CHIP_TONE: Record<MobileTone, string> = {
  neutral:
    "bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] text-[var(--ink-muted)]",
  accent:
    "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]",
  ok: "bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] text-[var(--ok)]",
  warn: "bg-[color-mix(in_oklab,var(--warn-ink)_16%,transparent)] text-[var(--warn-ink)]",
  danger:
    "bg-[color-mix(in_oklab,var(--danger)_14%,transparent)] text-[var(--danger)]",
};

export function MobileChip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: MobileTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold",
        CHIP_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function MobileMeter({ pct, className }: { pct: number; className?: string }) {
  return (
    <span
      className={cn(
        "block h-1.5 overflow-hidden rounded-full bg-[var(--field-bg)]",
        className,
      )}
    >
      <span
        className="block h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  );
}

const RING_STROKE: Record<MobileTone, string> = {
  neutral: "var(--ink-muted)",
  accent: "var(--accent)",
  ok: "var(--ok)",
  warn: "var(--warn-ink)",
  danger: "var(--danger)",
};

/** Anillo de progreso con el número dentro (score, prioridad, ocupación). */
export function MobileRing({
  value,
  tone = "accent",
  size = 42,
  label,
}: {
  value: number;
  tone?: MobileTone;
  size?: number;
  label?: string;
}) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  const color = RING_STROKE[tone];

  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${value}`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.16"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
        />
      </svg>
      <span
        className="text-[13px] font-bold tabular-nums"
        style={{ color }}
        aria-hidden
      >
        {value}
      </span>
    </span>
  );
}

/** Título grande de pantalla, patrón nativo iOS/Android. */
export function MobileScreenTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.7rem] font-bold leading-tight tracking-tight text-[var(--ink)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px] leading-snug text-[var(--ink-muted)] text-pretty">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Fila clave/valor de las fichas. */
export function MobileKv({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3 text-[13.5px]">
      <span className="shrink-0 text-[var(--ink-muted)]">{label}</span>
      <span className="min-w-0 text-right font-semibold text-[var(--ink)] tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function MobileCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.25rem] border border-[color-mix(in_oklab,var(--ink)_8%,transparent)] bg-[var(--glass-strong)] shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Chips de filtro con scroll horizontal (sangrado a los bordes). */
export function MobileFilterRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-9 shrink-0 rounded-full border px-3.5 text-[12.5px] font-semibold transition",
            value === o.id
              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
              : "border-[color-mix(in_oklab,var(--ink)_10%,transparent)] bg-[var(--glass-strong)] text-[var(--ink)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
