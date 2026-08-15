"use client";

import { ROUTE_LABEL, type RouteCode, type VehicleMode } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";

/**
 * Página pública de captura (`/captura`).
 *
 * Envía a `POST /api/leads/ingest`, que valida, deduplica, cruza con la cartera
 * y puntúa en el servidor. Es el formulario que controlamos nosotros: el de
 * example.com solo tendría que apuntar al mismo endpoint.
 *
 * La clave de ingesta NO vive aquí. El navegador llama a `/api/leads/ingest`
 * desde el mismo origen y es la función quien exige la credencial; publicar la
 * clave en el bundle sería regalar la puerta de entrada.
 */

const ROUTES = Object.keys(ROUTE_LABEL) as RouteCode[];

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; score: number; priority: string; reasons: string[]; owner: string }
  | { kind: "error"; message: string };

export function LeadCaptureForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    interestRoute: "" as RouteCode | "",
    vehicle: "" as VehicleMode | "",
    message: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });

    const params = new URLSearchParams(window.location.search);

    try {
      const res = await fetch("/api/leads/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          interestRoute: form.interestRoute || null,
          vehicle: form.vehicle || null,
          message: form.message || undefined,
          utmSource: params.get("utm_source") ?? "web",
          utmMedium: params.get("utm_medium") ?? "formulario",
          utmCampaign: params.get("utm_campaign") ?? undefined,
        }),
      });

      // La respuesta puede no ser JSON (404 de Vite en `npm run dev`, error del
      // proxy…). Sin esto el usuario vería un error de JavaScript en crudo.
      const raw = await res.text();
      let data: {
        error?: string;
        lead?: { score: number; priority: string; reasons: string[]; owner: string };
      } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setStatus({
          kind: "error",
          message:
            res.status === 404
              ? "El endpoint /api/leads/ingest no está disponible aquí. En local hace falta `vercel dev`; en el despliegue de Vercel funciona."
              : `El servidor respondió ${res.status} y no era JSON.`,
        });
        return;
      }

      if (!res.ok || !data.lead) {
        setStatus({
          kind: "error",
          message: data.error ?? `El servidor respondió ${res.status}.`,
        });
        return;
      }

      setStatus({
        kind: "ok",
        score: data.lead.score,
        priority: data.lead.priority,
        reasons: data.lead.reasons,
        owner: data.lead.owner,
      });
      setForm({ name: "", email: "", phone: "", interestRoute: "", vehicle: "", message: "" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "No se pudo conectar con el servidor.",
      });
    }
  }

  return (
    <div className="mps-crm mps-bg min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <header className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
            Campo Norte
          </p>
          <h1 className="font-[family-name:var(--mps-display)] text-3xl text-[var(--ink)]">
            Cuéntanos qué ruta te mueve
          </h1>
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
            Te responde una persona del equipo. Sin respuestas automáticas y sin
            newsletters que no hayas pedido.
          </p>
        </header>

        {status.kind === "ok" ? (
          <section className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-[var(--ok)]" />
              <p className="text-lg font-semibold text-[var(--ink)]">Recibido, gracias</p>
            </div>
            <p className="text-sm text-[var(--ink-muted)]">
              Tu solicitud ya está en la cola de {status.owner}. Te escribirá una persona.
            </p>

            {/* Visible aquí porque esta página es también la demostración del
                motor: el score lo ha calculado el servidor, no el navegador. */}
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Lo que ha hecho el sistema (vista interna)
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--ink)]">
                {status.score}
                <span className="ml-1 text-sm font-semibold text-[var(--ink-muted)]">
                  /100 · {status.priority.replace("_", " ")}
                </span>
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-[var(--ink-muted)]">
                {status.reasons.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setStatus({ kind: "idle" })}
              className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
            >
              Enviar otra solicitud
            </button>
          </section>
        ) : (
          <form onSubmit={submit} className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
            <Field label="Nombre y apellidos">
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="mps-field w-full rounded-xl px-3 py-2.5 text-sm"
                autoComplete="name"
              />
            </Field>

            <Field label="Email">
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="mps-field w-full rounded-xl px-3 py-2.5 text-sm"
                autoComplete="email"
              />
            </Field>

            <Field label="Teléfono (opcional)">
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="mps-field w-full rounded-xl px-3 py-2.5 text-sm"
                autoComplete="tel"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ruta que te interesa">
                <select
                  value={form.interestRoute}
                  onChange={(e) => set("interestRoute", e.target.value as RouteCode | "")}
                  className="mps-field w-full rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value="">Aún no lo sé</option>
                  {ROUTES.map((r) => (
                    <option key={r} value={r}>
                      {ROUTE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Vehículo">
                <select
                  value={form.vehicle}
                  onChange={(e) => set("vehicle", e.target.value as VehicleMode | "")}
                  className="mps-field w-full rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value="">Indiferente</option>
                  <option value="moto">Moto</option>
                  <option value="4x4">4x4</option>
                </select>
              </Field>
            </div>

            <Field label="Cuéntanos algo más (opcional)">
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                className="mps-field w-full rounded-xl px-3 py-2.5 text-sm"
              />
            </Field>

            {status.kind === "error" && (
              <p className="flex items-start gap-2 rounded-xl border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] p-3 text-sm text-[var(--danger)]">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{status.message}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={status.kind === "sending"}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white",
                status.kind === "sending" && "opacity-70",
              )}
            >
              {status.kind === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar solicitud
            </button>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--ink-muted)]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              Usamos tus datos solo para responderte. Nada de envíos automáticos.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[var(--ink-muted)]">{label}</span>
      {children}
    </label>
  );
}
