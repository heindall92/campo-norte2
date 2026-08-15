import {
  CONTENT_CHANNEL_LABEL,
  CONTENT_DRAFTS,
  type ContentChannelKind,
  type ContentDraft,
} from "@/lib/demo-data";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Check,
  Copy,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
} from "lucide-react";
import { useMemo, useState } from "react";

const CHANNEL_FILTERS: { id: "all" | ContentChannelKind; labelEs: string; labelEn: string }[] = [
  { id: "all", labelEs: "Todas", labelEn: "All" },
  { id: "email_brevo", labelEs: "Email / Brevo", labelEn: "Email / Brevo" },
  { id: "whatsapp_script", labelEs: "WhatsApp", labelEn: "WhatsApp" },
  { id: "mensaje_interno", labelEs: "Mensaje interno", labelEn: "Internal msg" },
  { id: "rrss", labelEs: "RRSS", labelEn: "Social" },
  { id: "pack_multimedia", labelEs: "Pack", labelEn: "Pack" },
];

function statusTone(s: ContentDraft["status"]): string {
  if (s === "listo_para_brevo" || s === "listo_para_envio") return "good";
  if (s === "en_revision") return "warn";
  return "neutral";
}

function channelIcon(kind: ContentChannelKind) {
  if (kind === "whatsapp_script") return MessageCircle;
  if (kind === "mensaje_interno") return Smartphone;
  if (kind === "email_brevo") return Mail;
  return Pencil;
}

function blankTemplate(lang: Lang): ContentDraft {
  return {
    id: `D-${Date.now().toString(36).slice(-4).toUpperCase()}`,
    type: "email_seguimiento",
    title: lang === "es" ? "Nueva plantilla" : "New template",
    sourceTrip: "—",
    status: "borrador_ia",
    channel: "Brevo / WhatsApp",
    channelKind: "email_brevo",
    audience: "",
    owner: "Laura",
    subject: "",
    excerpt: "",
    body: lang === "es" ? "Hola {nombre},\n\n" : "Hi {nombre},\n\n",
    variables: ["{nombre}", "{destino}"],
    arguments: [
      lang === "es"
        ? "Plantilla creada en Content Factory para edición del equipo"
        : "Template created in Content Factory for team editing",
    ],
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

export function ContentFactoryPanel({ lang }: { lang: Lang }) {
  const [drafts, setDrafts] = useState<ContentDraft[]>(() =>
    CONTENT_DRAFTS.map((d) => ({ ...d })),
  );
  const [filter, setFilter] = useState<"all" | ContentChannelKind>("all");
  const [activeId, setActiveId] = useState(CONTENT_DRAFTS[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const [baseline] = useState(() => CONTENT_DRAFTS.map((d) => ({ ...d })));

  const list = useMemo(() => {
    if (filter === "all") return drafts;
    return drafts.filter((d) => d.channelKind === filter);
  }, [drafts, filter]);

  const active = drafts.find((d) => d.id === activeId) ?? list[0] ?? null;

  function patchActive(patch: Partial<ContentDraft>) {
    if (!active) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === active.id
          ? { ...d, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : d,
      ),
    );
  }

  function save() {
    setEditing(false);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  async function copyForSend() {
    if (!active) return;
    const text = [
      active.channelKind === "email_brevo" ? `Asunto: ${active.subject}` : active.subject,
      "",
      active.body,
      "",
      `— Campo Norte · plantilla ${active.id} · revisar antes de enviar`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function resetActive() {
    if (!active) return;
    const original = baseline.find((d) => d.id === active.id);
    if (!original) return;
    setDrafts((prev) => prev.map((d) => (d.id === active.id ? { ...original } : d)));
    setEditing(false);
  }

  function createTemplate() {
    const t = blankTemplate(lang);
    setDrafts((prev) => [t, ...prev]);
    setActiveId(t.id);
    setEditing(true);
    setFilter("all");
  }

  if (!active) return null;

  const Icon = channelIcon(active.channelKind);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-4 shadow-[var(--shadow)] md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)] md:text-2xl">
              {lang === "es" ? "Fábrica de contenido" : "Content Factory"}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
              {lang === "es"
                ? "Plantillas editables para email (Brevo), guiones WhatsApp y mensajes internos. El CRM prepara el texto; el equipo revisa, pega y envía. Nada se dispara solo al cliente."
                : "Editable templates for email (Brevo), WhatsApp scripts and internal messages. CRM prepares the text; the team reviews, pastes and sends. Nothing auto-fires to the customer."}
            </p>
          </div>
          <button
            type="button"
            onClick={createTemplate}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {lang === "es" ? "Nueva plantilla" : "New template"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CHANNEL_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-semibold",
                filter === f.id
                  ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--ink)]"
                  : "border-[var(--glass-border)] text-[var(--ink-muted)]",
              )}
            >
              {lang === "es" ? f.labelEs : f.labelEn}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-3">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Biblioteca" : "Library"} · {list.length}
          </p>
          <ul className="max-h-[560px] space-y-1.5 overflow-y-auto">
            {list.map((d) => {
              const I = channelIcon(d.channelKind);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(d.id);
                      setEditing(false);
                    }}
                    className={cn(
                      "flex w-full gap-2 rounded-xl border px-2.5 py-2 text-left text-sm transition",
                      d.id === active.id
                        ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]"
                        : "border-transparent hover:bg-[var(--glass)]",
                    )}
                  >
                    <I className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[var(--ink)]">
                        {d.title}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--ink-muted)]">
                        {CONTENT_CHANNEL_LABEL[d.channelKind]} · {d.status.replaceAll("_", " ")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-4 shadow-[var(--shadow)] md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Icon className="h-5 w-5 text-[var(--accent)]" />
                {editing ? (
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 font-[family-name:var(--mps-display)] text-xl text-[var(--ink)]"
                    value={active.title}
                    onChange={(e) => patchActive({ title: e.target.value })}
                  />
                ) : (
                  <h3 className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)] md:text-2xl">
                    {active.title}
                  </h3>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                {active.id} · {active.sourceTrip} · {active.owner} · {active.updatedAt}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-semibold",
                  statusTone(active.status) === "good" &&
                    "border-emerald-500/40 text-emerald-700",
                  statusTone(active.status) === "warn" && "border-amber-500/40 text-amber-700",
                  statusTone(active.status) === "neutral" &&
                    "border-[var(--glass-border)] text-[var(--ink-muted)]",
                )}
              >
                {active.status.replaceAll("_", " ")}
              </span>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {lang === "es" ? "Editar plantilla" : "Edit template"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={save}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Save className="h-3.5 w-3.5" />
                  {lang === "es" ? "Guardar" : "Save"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void copyForSend()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied
                  ? lang === "es"
                    ? "Copiado"
                    : "Copied"
                  : lang === "es"
                    ? "Copiar para envío"
                    : "Copy to send"}
              </button>
              <button
                type="button"
                onClick={resetActive}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)]"
                title={lang === "es" ? "Restaurar original" : "Restore original"}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {savedFlash && (
            <p className="mt-2 text-xs font-semibold text-emerald-600">
              {lang === "es" ? "Plantilla guardada en la sesión." : "Template saved in session."}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Canal" : "Channel"}
              <select
                disabled={!editing}
                className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-3 py-2 text-sm text-[var(--ink)] disabled:opacity-70"
                value={active.channelKind}
                onChange={(e) =>
                  patchActive({
                    channelKind: e.target.value as ContentChannelKind,
                    channel: CONTENT_CHANNEL_LABEL[e.target.value as ContentChannelKind],
                  })
                }
              >
                {(Object.keys(CONTENT_CHANNEL_LABEL) as ContentChannelKind[]).map((k) => (
                  <option key={k} value={k}>
                    {CONTENT_CHANNEL_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Audiencia" : "Audience"}
              <input
                disabled={!editing}
                className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-3 py-2 text-sm text-[var(--ink)] disabled:opacity-70"
                value={active.audience}
                onChange={(e) => patchActive({ audience: e.target.value })}
              />
            </label>
          </div>

          <label className="mt-3 block text-xs text-[var(--ink-muted)]">
            {active.channelKind === "email_brevo"
              ? lang === "es"
                ? "Asunto del correo"
                : "Email subject"
              : lang === "es"
                ? "Primera línea / asunto"
                : "First line / subject"}
            <input
              disabled={!editing}
              className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-3 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-70"
              value={active.subject}
              onChange={(e) => patchActive({ subject: e.target.value })}
            />
          </label>

          <label className="mt-3 block text-xs text-[var(--ink-muted)]">
            {lang === "es" ? "Cuerpo de la plantilla (editable)" : "Template body (editable)"}
            <textarea
              disabled={!editing}
              rows={14}
              className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg0)] px-3 py-3 font-mono text-sm leading-relaxed text-[var(--ink)] outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-70"
              value={active.body}
              onChange={(e) => patchActive({ body: e.target.value })}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-xs text-[var(--ink-muted)]">
              {lang === "es" ? "Variables:" : "Variables:"}
            </span>
            {active.variables.map((v) => (
              <button
                key={v}
                type="button"
                disabled={!editing}
                onClick={() => editing && patchActive({ body: `${active.body}${v}` })}
                className="rounded-md border border-[var(--glass-border)] bg-[var(--glass)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--accent)] disabled:opacity-60"
              >
                {v}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              {lang === "es" ? "Por qué existe esta plantilla" : "Why this template exists"}
            </p>
            <ul className="mt-2 space-y-1.5">
              {active.arguments.map((a) => (
                <li key={a} className="flex gap-2 text-sm text-[var(--ink)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  {a}
                </li>
              ))}
            </ul>
            {editing && (
              <textarea
                rows={2}
                className="mt-2 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1.5 text-xs text-[var(--ink)]"
                value={active.arguments.join("\n")}
                onChange={(e) =>
                  patchActive({
                    arguments: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder={lang === "es" ? "Un argumento por línea" : "One argument per line"}
              />
            )}
          </div>

          <p className="mt-4 rounded-lg border border-dashed border-[var(--glass-border)] p-3 text-xs text-[var(--ink-muted)]">
            {lang === "es"
              ? "Uso: edita → Guarda → Copiar para envío → pega en Brevo o WhatsApp. El Growth OS no envía solo al cliente."
              : "Usage: edit → Save → Copy to send → paste into Brevo or WhatsApp. Growth OS never auto-sends to the customer."}
          </p>
        </section>
      </div>
    </div>
  );
}
