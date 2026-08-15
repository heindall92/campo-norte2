import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "positive" | "negative" | "warning" | "info" | "neutral";

const TONE_STYLE: Record<StatusTone, { color: string; background: string }> = {
  positive: { color: "var(--positive)", background: "var(--positive-soft)" },
  negative: { color: "var(--negative)", background: "var(--negative-soft)" },
  warning: { color: "var(--warning)", background: "var(--warning-soft)" },
  info: { color: "var(--info)", background: "var(--info-soft)" },
  neutral: { color: "var(--text-secondary)", background: "var(--neutral-soft)" },
};

interface StatusBadgeProps {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}

/** Etiqueta de estado. Consume solo tokens semánticos: nunca un color literal. */
export function StatusBadge({ tone = "neutral", children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        className,
      )}
      style={TONE_STYLE[tone]}
    >
      {children}
    </span>
  );
}
