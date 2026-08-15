import { cn } from "@/lib/utils";

/** Bolita roja intermitente para campana con no leídas. */
export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-[var(--danger)] ring-2 ring-[var(--bg0)] animate-[notif-blink_1.05s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}
