import { Check } from "lucide-react";

export function MobileSuccessDialog({
  open,
  title,
  description,
  doneLabel = "Hecho",
  onDone,
}: {
  open: boolean;
  title: string;
  description?: string;
  doneLabel?: string;
  onDone: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-[color-mix(in_oklab,#0f172a_40%,transparent)] p-5 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-7 text-center shadow-2xl dark:bg-[var(--glass-strong)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-[color-mix(in_oklab,#4ade80_35%,#ecfdf5)] [clip-path:polygon(50%_0%,63%_12%,80%_10%,88%_25%,98%_40%,92%_55%,98%_70%,88%_82%,70%_90%,50%_100%,30%_90%,12%_82%,2%_70%,8%_55%,2%_40%,12%_25%,20%_10%,37%_12%)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16a34a] text-white">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
        </div>
        <h2 className="text-xl font-bold text-[var(--ink)]">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)] text-pretty">
            {description}
          </p>
        )}
        <button
          type="button"
          onClick={onDone}
          className="mt-6 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-sm font-bold text-white"
        >
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
