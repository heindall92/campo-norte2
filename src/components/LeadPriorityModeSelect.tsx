"use client";

import {
  LEAD_PRIORITY_MODES,
  leadPriorityModeHint,
  leadPriorityModeLabel,
  type LeadPriorityMode,
} from "@/lib/ai/lead-priority";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LeadPriorityModeSelect({
  value,
  onChange,
  lang,
  compact = false,
  className,
}: {
  value: LeadPriorityMode;
  onChange: (mode: LeadPriorityMode) => void;
  lang: Lang;
  compact?: boolean;
  className?: string;
}) {
  const es = lang === "es";
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span
        className={cn(
          "font-semibold uppercase tracking-wide text-[var(--ink-muted)]",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        {es ? "Ordenar por" : "Sort by"}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LeadPriorityMode)}
        className={cn(
          "w-full rounded-xl border border-[color-mix(in_oklab,var(--ink)_12%,transparent)] bg-[var(--glass-strong)] text-[var(--ink)]",
          compact ? "px-2.5 py-2 text-[13px]" : "px-3 py-2.5 text-sm",
        )}
        aria-label={es ? "Modo de priorización de leads" : "Lead priority mode"}
      >
        {LEAD_PRIORITY_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {leadPriorityModeLabel(mode, lang)} — {leadPriorityModeHint(mode, lang)}
          </option>
        ))}
      </select>
    </label>
  );
}
