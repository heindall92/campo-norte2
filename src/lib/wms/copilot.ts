import { rebuildBalancesFromPallets, skuAvailable, skuOnHand } from "./inventory";
import { computeTowerActions } from "./tower-actions";
import { computeWmsAlerts } from "./alerts";
import type { WmsSnapshot } from "./types";

export interface WmsCopilotAnswer {
  finding: string;
  evidence: string[];
  confidence: number;
  recommendation: string;
  optional_action: string | null;
}

const WMS_HINT = /palet|ola|pick|stock|muelle|caduc|sscc|repos|almac|wave|dock|fefo|asn|hueco|sku|expedic|recep/i;

export function looksLikeWmsQuestion(question: string): boolean {
  return WMS_HINT.test(question);
}

/**
 * Copiloto operacional sobre el snapshot. Nunca ejecuta pick/ship/ajuste.
 * Devuelve hallazgo + evidencia + confianza + recomendación + acción opcional.
 */
export function answerWmsCopilot(snap: WmsSnapshot, question: string, siteId?: string): WmsCopilotAnswer {
  const q = question.toLowerCase();
  const actions = computeTowerActions(snap, siteId);
  const alerts = computeWmsAlerts(snap, new Date("2026-08-15T12:00:00.000Z"), siteId);
  const balances = rebuildBalancesFromPallets(snap);

  if (/fefo|caduc/.test(q)) {
    const soon = snap.pallets.filter((p) => p.expiry && p.status !== "expedido").slice(0, 5);
    return {
      finding: soon.length
        ? `${soon.length} palets con fecha de caducidad en el snapshot; FEFO debe salir primero.`
        : "No hay palets con caducidad en el recorte consultado.",
      evidence: soon.map((p) => `${p.sscc} · lote ${p.lot} · ${p.expiry}`),
      confidence: soon.length ? 0.86 : 0.4,
      recommendation: "Priorizar olas FEFO y bloquear putaway de lotes cortos en reserva alta.",
      optional_action: actions.find((a) => a.kind === "CORTE_FEFO")?.id ?? null,
    };
  }

  if (/repos|min|max|pick.?face/.test(q)) {
    const repo = actions.filter((a) => a.kind === "REPOSICION");
    return {
      finding: repo.length
        ? `Hay ${repo.length} reposiciones pendientes (cara vacía o bajo mínimo).`
        : "No hay reposición urgente derivada del snapshot.",
      evidence: repo.slice(0, 5).map((a) => a.detailEs),
      confidence: 0.8,
      recommendation: "Lanzar ola de reposición con retráctil doble; no inventar huecos.",
      optional_action: repo[0]?.id ?? null,
    };
  }

  if (/picker|ola|wave/.test(q)) {
    const assign = actions.filter((a) => a.kind === "ASIGNAR_PICKER" || a.kind === "LANZAR_OLA");
    return {
      finding: assign.length
        ? `${assign.length} acciones de ola/picker abiertas.`
        : "Todas las olas abiertas tienen picker o no hay pedidos pendientes.",
      evidence: assign.slice(0, 6).map((a) => a.titleEs),
      confidence: 0.84,
      recommendation: "Asignar picker y lanzar ola; el copiloto no confirma el pick.",
      optional_action: assign[0]?.id ?? null,
    };
  }

  if (/stock|disponible|available|sku/.test(q)) {
    const low = snap.skus.filter((s) => skuOnHand(snap, s.id) < s.minStock).slice(0, 6);
    return {
      finding: low.length
        ? `${low.length} SKU bajo mínimo (on_hand vs minStock). Available descuenta allocated/bloqueado/cuarentena.`
        : "Ningún SKU del catálogo está bajo mínimo en on_hand.",
      evidence: low.map((s) => {
        const on = skuOnHand(snap, s.id);
        const av = skuAvailable(snap, s.id);
        return `${s.sku} on_hand=${on} available=${av} min=${s.minStock}`;
      }),
      confidence: 0.9,
      recommendation: "Reponer o comprar; no ajustar ledger a mano desde el chat.",
      optional_action: actions.find((a) => a.kind === "REPOSICION")?.id ?? null,
    };
  }

  const quarantined = balances.filter((b) => b.quarantined > 0).length;
  const openOut = snap.outbound.filter((o) => o.status !== "expedido").length;
  return {
    finding: `${alerts.length} alertas, ${actions.length} acciones de torre, ${openOut} pedidos abiertos, ${quarantined} HU en cuarentena.`,
    evidence: [
      ...actions.slice(0, 3).map((a) => a.titleEs),
      ...alerts.slice(0, 3).map((a) => a.titleEs),
    ],
    confidence: 0.72,
    recommendation: "Revisar Control Tower; el copiloto no ejecuta movimientos.",
    optional_action: actions[0]?.id ?? null,
  };
}

export function formatCopilotAnswer(answer: WmsCopilotAnswer, lang: "es" | "en"): string {
  const conf = Math.round(answer.confidence * 100);
  if (lang === "en") {
    return [
      `Finding: ${answer.finding}`,
      `Evidence:\n${answer.evidence.map((e) => `- ${e}`).join("\n") || "- (none)"}`,
      `Confidence: ${conf}%`,
      `Recommendation: ${answer.recommendation}`,
      `Optional action: ${answer.optional_action ?? "none"}`,
      "I will not confirm pick, ship or adjustments from chat.",
    ].join("\n\n");
  }
  return [
    `Hallazgo: ${answer.finding}`,
    `Evidencia:\n${answer.evidence.map((e) => `- ${e}`).join("\n") || "- (ninguna)"}`,
    `Confianza: ${conf}%`,
    `Recomendación: ${answer.recommendation}`,
    `Acción opcional: ${answer.optional_action ?? "ninguna"}`,
    "No confirmo pick, expedición ni ajustes desde el chat.",
  ].join("\n\n");
}
