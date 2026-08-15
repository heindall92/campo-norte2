import { Check } from "lucide-react";

export function MobileTicketConfirm({
  open,
  title,
  subtitle,
  headline,
  meta,
  fields,
  chips,
  primaryLabel = "Hecho",
  onPrimary,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  headline: string;
  meta?: string;
  fields: { label: string; value: string }[];
  chips?: string[];
  primaryLabel?: string;
  onPrimary: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center overflow-y-auto bg-[color-mix(in_oklab,#ecfdf5_70%,#0f172a)] p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="my-auto w-full max-w-md pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[color-mix(in_oklab,#22c55e_35%,transparent)] blur-xl" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-lg">
              <Check className="h-7 w-7" strokeWidth={2.8} />
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#14532d]">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--ink-muted)] text-pretty">{subtitle}</p>
          )}
        </div>

        <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-xl dark:bg-[var(--glass-strong)]">
          <div className="px-5 pt-5 pb-4">
            <p className="text-lg font-bold text-[var(--ink)]">{headline}</p>
            {meta && <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{meta}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {fields.slice(0, 4).map((f) => (
                <div key={f.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                    {f.label}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--ink)]">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative px-5">
            <div className="border-t border-dashed border-[var(--field-border)]" />
          </div>

          <div className="flex flex-wrap gap-2 px-5 py-4">
            {(chips ?? []).map((c) => (
              <span
                key={c}
                className="rounded-full bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onPrimary}
          className="mt-4 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-sm font-bold text-white"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
