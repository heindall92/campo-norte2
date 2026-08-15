"use client";

import { cn } from "@/lib/utils";

/** Interruptor estilo iOS (switch). */
export function AppleSwitch({
  checked,
  onChange,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** md = iOS estándar; sm = compacto para sidebars */
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative shrink-0 rounded-full transition-colors duration-200 ease-out",
        sm ? "h-[18px] w-[32px]" : "h-[31px] w-[51px]",
        checked ? "bg-[#34c759]" : "bg-[#e9e9eb] dark:bg-[#39393d]",
      )}
    >
      <span
        className={cn(
          "absolute rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-out",
          sm
            ? cn("top-[2px] left-[2px] h-[14px] w-[14px]", checked && "translate-x-[14px]")
            : cn("top-[2px] left-[2px] h-[27px] w-[27px]", checked && "translate-x-[20px]"),
        )}
      />
    </button>
  );
}
