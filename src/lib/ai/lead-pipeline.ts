import type { Client, Lead } from "@/lib/demo-data";
import { ORIGIN_LABEL, ROUTE_LABEL } from "@/lib/demo-data";
import { blankLead } from "@/lib/data/seed";
import {
  campaignFromPayload,
  inferOriginFromForm,
  pickOwner,
  type WebFormLeadPayload,
} from "@/lib/leads/ingest-core";
import { applyScoreToLead, scoreLead } from "./lead-scoring";
import { aiReady, providerLabel } from "./settings";

export type { WebFormLeadPayload };
export { campaignFromPayload, inferOriginFromForm, pickOwner };

export type PipelineStepId =
  | "ingest"
  | "create_or_merge"
  | "dedupe"
  | "classify_ai"
  | "origin"
  | "dashboard"
  | "notify"
  | "follow_up";

export interface PipelineStepLog {
  id: PipelineStepId;
  label: string;
  status: "ok" | "skip" | "warn";
  detail: string;
  at: string;
}

export interface LeadPipelineResult {
  lead: Lead;
  wasDuplicate: boolean;
  steps: PipelineStepLog[];
  owner: string;
  followUpAt: string;
  engine: "ollama" | "heuristic";
  notification: {
    actor: string;
    statusLabel: string;
    body: string;
    detail: string;
  };
}

function step(
  id: PipelineStepId,
  label: string,
  status: PipelineStepLog["status"],
  detail: string,
): PipelineStepLog {
  return { id, label, status, detail, at: new Date().toISOString() };
}



function followUpIso(hoursFromNow = 24): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
}

/**
 * Orquestación A-01 + A-02 (backstage):
 * Formulario → crear/merge lead → dedupe → clasificar IA (Ollama) → origen →
 * dashboard (vía Hub) → avisar responsable → programar seguimiento.
 * Nunca escribe al viajero.
 */
export async function runLeadCapturePipeline(
  payload: WebFormLeadPayload,
  existingLeads: Lead[],
  options?: { forceHeuristic?: boolean; clients?: Client[] },
): Promise<LeadPipelineResult> {
  const steps: PipelineStepLog[] = [];
  const email = payload.email.trim().toLowerCase();
  const now = new Date().toISOString().slice(0, 10);

  steps.push(
    step(
      "ingest",
      "Nuevo formulario web",
      "ok",
      `Payload recibido: ${payload.name || "(sin nombre)"} · ${email || "(sin email)"}`,
    ),
  );

  if (!email || !email.includes("@")) {
    throw new Error("Email inválido — el flujo se detiene (dato mínimo del formulario)");
  }

  const origin = inferOriginFromForm(payload);
  const campaign = campaignFromPayload(payload);

  const dup = existingLeads.find((l) => l.email.toLowerCase() === email);
  let lead: Lead;
  let wasDuplicate = false;

  if (dup) {
    wasDuplicate = true;
    lead = {
      ...dup,
      name: payload.name.trim() || dup.name,
      origin: origin !== "unknown" ? origin : dup.origin,
      campaign: campaign ?? dup.campaign,
      interestRoute: payload.interestRoute ?? dup.interestRoute,
      vehicle: payload.vehicle ?? dup.vehicle,
      lastTouchAt: now,
      status: dup.status === "descartado" ? "nuevo" : dup.status,
    };
    steps.push(
      step(
        "dedupe",
        "Buscar duplicados",
        "warn",
        `Duplicado por email → merge en ${dup.id} (no se crea ficha nueva)`,
      ),
    );
    steps.push(
      step(
        "create_or_merge",
        "Crear / actualizar Lead",
        "ok",
        `Actualizado ${lead.id} · estado ${lead.status}`,
      ),
    );
  } else {
    lead = blankLead();
    lead.name = payload.name.trim() || "Lead web";
    lead.email = email;
    lead.origin = origin;
    lead.campaign = campaign;
    lead.interestRoute = payload.interestRoute ?? null;
    lead.vehicle = payload.vehicle ?? null;
    lead.status = "nuevo";
    lead.createdAt = now;
    lead.lastTouchAt = now;
    steps.push(
      step("dedupe", "Buscar duplicados", "ok", "Sin duplicado por email — alta nueva"),
    );
    steps.push(
      step(
        "create_or_merge",
        "Crear Lead",
        "ok",
        `Alta ${lead.id} en Data Hub / Lead Intelligence`,
      ),
    );
  }

  steps.push(
    step(
      "origin",
      "Añadir origen / UTM",
      origin === "unknown" ? "warn" : "ok",
      `Origen=${ORIGIN_LABEL[origin]} · campaña=${campaign ?? "—"} · medium=${payload.utmMedium ?? "—"}`,
    ),
  );

  // Cruce con la cartera: si quien rellena el formulario ya es cliente, su
  // historial entra en el score. Sin esto un repetidor puntuaba como extraño.
  const linkedClient =
    (options?.clients ?? []).find(
      (c) => c.email.trim().toLowerCase() === lead.email.trim().toLowerCase(),
    ) ?? null;

  const scoreResult = await scoreLead(lead, linkedClient, {
    forceHeuristic: options?.forceHeuristic,
  });
  lead = applyScoreToLead(lead, scoreResult);
  if (payload.message?.trim()) {
    lead.scoreReasons = [
      ...lead.scoreReasons.slice(0, 6),
      `Nota form: ${payload.message.trim().slice(0, 120)}`,
    ];
  }

  const engine = scoreResult.source === "ollama" ? "ollama" : "heuristic";
  steps.push(
    step(
      "classify_ai",
      "Clasificar con IA",
      "ok",
      `Score ${scoreResult.score}/100 · ${scoreResult.priority} · motor=${engine === "ollama" && aiReady() ? providerLabel() : "heurística"} · ${scoreResult.reasons.slice(0, 2).join(" · ")}`,
    ),
  );

  const owner = pickOwner(lead.origin, lead.score);
  lead.owner = owner;

  steps.push(
    step(
      "dashboard",
      "Actualizar Dashboard",
      "ok",
      "KPIs de leads/origen/score se recalculan al persistir en el Hub (misma fuente que el cuadro de mando)",
    ),
  );

  const followUpAt = followUpIso(lead.score >= 80 ? 4 : 24);
  const followLabel =
    lead.score >= 80
      ? "Seguimiento prioritario en ~4 h"
      : "Seguimiento estándar en ~24 h";

  steps.push(
    step(
      "notify",
      "Avisar responsable",
      "ok",
      `Aviso interno → ${owner} (cola notificaciones CRM). Nunca mensaje al viajero.`,
    ),
  );

  steps.push(
    step(
      "follow_up",
      "Programar seguimiento",
      "ok",
      `${followLabel} · ${followUpAt.slice(0, 16).replace("T", " ")} · owner ${owner}`,
    ),
  );

  const routeHint = lead.interestRoute ? ROUTE_LABEL[lead.interestRoute] : "sin ruta";
  return {
    lead,
    wasDuplicate,
    steps,
    owner,
    followUpAt,
    engine,
    notification: {
      actor: lead.name,
      statusLabel: wasDuplicate ? "LEAD MERGE + SCORE" : "LEAD NUEVO + SCORE",
      body: `${lead.id} · score ${lead.score} · ${ORIGIN_LABEL[lead.origin]} · ${routeHint} → avisar a ${owner}`,
      detail: `${followLabel}. Razones: ${lead.scoreReasons.slice(0, 3).join(" · ")}`,
    },
  };
}
