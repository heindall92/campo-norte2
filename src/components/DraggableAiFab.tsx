"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  ariaLabel: string;
  className?: string;
  onClick: () => void;
};

const STORAGE_KEY = "mps-ai-fab-pos-v1";

/**
 * FAB de IA arrastrable (cursor-grab). Persiste posición en localStorage.
 * Click sin drag abre el asistente; un arrastre > 6px no dispara click.
 */
export function DraggableAiFab({ ariaLabel, className, onClick }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { x: number; y: number };
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) setPos(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  const clamp = useCallback((x: number, y: number) => {
    const w = typeof window !== "undefined" ? window.innerWidth : 400;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    const size = 56;
    return {
      x: Math.min(Math.max(8, x), w - size - 8),
      y: Math.min(Math.max(8, y), h - size - 8),
    };
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = drag.current;
      if (!d?.active) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
      const next = clamp(d.origX + dx, d.origY + dy);
      setPos(next);
    }
    function onUp() {
      const d = drag.current;
      if (!d) return;
      d.active = false;
      if (d.moved && pos) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [clamp, pos]);

  const style =
    pos != null
      ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" as const }
      : undefined;

  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      className={cn(
        "mps-ai-fab is-alive fixed z-40 touch-none",
        pos == null && "bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6",
        className,
      )}
      style={style}
      onPointerDown={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        drag.current = {
          active: true,
          moved: false,
          startX: e.clientX,
          startY: e.clientY,
          origX: rect.left,
          origY: rect.top,
        };
        el.setPointerCapture(e.pointerId);
      }}
      onClick={() => {
        if (drag.current?.moved) return;
        onClick();
      }}
    >
      <Sparkles className="h-5 w-5" />
    </button>
  );
}
