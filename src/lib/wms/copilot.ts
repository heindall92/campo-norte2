import type { AppSection } from "@/lib/notifications";
import { WMS_DEMO_NOW } from "./alerts";
import { rankPutawayCandidates, suggestPutawaySlot, zoneForCategory } from "./movements";
import { recommendTowerActions } from "./tower";
import type { Sku, WmsSnapshot } from "./types";

export type CopilotIntent =
  | "shipment_risk"
  | "sku_stockout"
  | "slot_sku"
  | "prioritize_wave"
  | "delay_cause"
  | "unknown";

export interface CopilotAction {
  kind: "OPEN_SHIPPING" | "OPEN_RECEIVING" | "OPEN_PICKING" | "ASSIGN_PICKER" | "OPEN_PUTAWAY";
  labelEs: string;
  labelEn: string;
  section: AppSection;
  waveId?: string;
  orderId?: string;
  skuId?: string;
  requiresConfirmation: true;
}

export interface CopilotAnswer {
  intent: CopilotIntent;
  finding: string;
  evidence: string[];
  confidence: number;
  recommendation: string;
  optionalAction: CopilotAction | null;
}

export const COPILOT_PROMPTS = [
  "¿Qué expediciones están en riesgo?",
  "¿Qué SKUs tienen riesgo de ruptura?",
  "¿Dónde debería colocar este SKU?",
  "¿Qué wave debería priorizar?",
  "¿Qué está causando retrasos?",
] as const;

function detectIntent(question: string): CopilotIntent {
  const q = question.toLowerCase();
  if (/expedic|shipment|riesgo.*pedido|orders? in risk/.test(q)) return "shipment_risk";
  if (/ruptura|stockout|sku.*riesgo|sin stock|quiebre/.test(q)) return "sku_stockout";
  if (/coloc|ubicar|slot|d[oó]nde.*sku|putaway/.test(q)) return "slot_sku";
  if (/wave|ola|prioriz/.test(q)) return "prioritize_wave";
  if (/retraso|delay|caus/.test(q)) return "delay_cause";
  return "unknown";
}

function findSkuInQuestion(snap: WmsSnapshot, question: string): Sku | null {
  const q = question.toLowerCase();
  return (
    snap.skus.find(
      (s) => q.includes(s.sku.toLowerCase()) || q.includes(s.name.toLowerCase()) || q.includes(s.id),
    ) ?? null
  );
}

function unitsBySku(snap: WmsSnapshot, siteId?: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of snap.pallets) {
    if (siteId && p.siteId !== siteId) continue;
    if (p.status === "expedido") continue;
    map.set(p.skuId, (map.get(p.skuId) ?? 0) + p.qty);
  }
  return map;
}

function shipmentRisk(snap: WmsSnapshot, siteId: string | undefined, now: Date): CopilotAnswer {
  const nowMs = now.getTime();
  const rows = snap.outbound.filter((o) => {
    if (siteId && o.siteId !== siteId) return false;
    if (o.status === "expedido" || o.status === "pendiente") return false;
    return new Date(o.cutOff).getTime() <= nowMs + 2 * 60 * 60 * 1000;
  });
  const evidence = rows.map(
    (o) => `${o.code} · ${o.status} · muelle ${o.dock} · cut-off ${o.cutOff.slice(11, 16)} UTC`,
  );
  const first = rows[0];
  return {
    intent: "shipment_risk",
    finding: rows.length
      ? `${rows.length} expedición(es) con cut-off vencido o a ≤2 h.`
      : "Ninguna expedición abierta está dentro de la ventana de riesgo de 2 h.",
    evidence: evidence.length ? evidence : ["Snapshot: outbound filtrado por cut-off y status ≠ expedido/pendiente."],
    confidence: 0.92,
    recommendation: rows.length
      ? `Revisar ${first!.code} en muelle ${first!.dock} antes que el resto.`
      : "No hay acción de expedición urgente en este centro.",
    optionalAction: first
      ? {
          kind: "OPEN_SHIPPING",
          labelEs: "Abrir expedición (requiere confirmación)",
          labelEn: "Open shipping (confirmation required)",
          section: "expedicion",
          orderId: first.id,
          requiresConfirmation: true,
        }
      : null,
  };
}

function skuStockout(snap: WmsSnapshot, siteId: string | undefined): CopilotAnswer {
  const units = unitsBySku(snap, siteId);
  const risk = snap.skus
    .map((s) => ({ sku: s, qty: units.get(s.id) ?? 0 }))
    .filter((r) => r.qty < r.sku.minStock)
    .sort((a, b) => a.qty / a.sku.minStock - b.qty / b.sku.minStock);
  const evidence = risk.map((r) => `${r.sku.sku} · ${r.sku.name} · ${r.qty} < mín ${r.sku.minStock}`);
  return {
    intent: "sku_stockout",
    finding: risk.length
      ? `${risk.length} SKU por debajo del mínimo del catálogo.`
      : "Ningún SKU del catálogo está bajo el mínimo en este recorte.",
    evidence: evidence.length ? evidence : ["Comparado qty viva (palets no expedidos) vs minStock."],
    confidence: 0.88,
    recommendation: risk[0]
      ? `Priorizar reposición o recepción de ${risk[0].sku.sku}.`
      : "No hay ruptura de mínimo en el snapshot.",
    optionalAction: risk[0]
      ? {
          kind: "OPEN_RECEIVING",
          labelEs: "Ir a recepción (requiere confirmación)",
          labelEn: "Go to receiving (confirmation required)",
          section: "recepcion",
          skuId: risk[0].sku.id,
          requiresConfirmation: true,
        }
      : null,
  };
}

function slotSku(snap: WmsSnapshot, siteId: string | undefined, question: string): CopilotAnswer {
  const sku = findSkuInQuestion(snap, question);
  if (!sku) {
    return {
      intent: "slot_sku",
      finding: "Hace falta el código o nombre del SKU. No se adivina.",
      evidence: ["La pregunta no cita ningún SKU del catálogo (p. ej. ALI-ACE-5L)."],
      confidence: 0.35,
      recommendation: "Repite la pregunta con el SKU concreto.",
      optionalAction: null,
    };
  }
  const pallet =
    snap.pallets.find(
      (p) => p.skuId === sku.id && p.status === "muelle" && (!siteId || p.siteId === siteId),
    ) ??
    snap.pallets.find((p) => p.skuId === sku.id && p.status !== "expedido" && (!siteId || p.siteId === siteId));
  const zone = zoneForCategory(sku.category);
  const ranked = pallet ? rankPutawayCandidates(snap, pallet, { limit: 1 })[0] : null;
  const suggested = pallet ? suggestPutawaySlot(snap, pallet) : null;
  const evidence = [
    `${sku.sku} · zona preferida ${zone} (categoría ${sku.category})`,
    suggested
      ? `Hueco libre propuesto ${suggested.code} · ${suggested.zone} · viaje ${ranked?.travelPct ?? "—"}% (pasillos, no metros)`
      : "No hay hueco libre fuera de muelle en este recorte.",
  ];
  return {
    intent: "slot_sku",
    finding: suggested
      ? `Colocar ${sku.sku} en ${suggested.code} (${suggested.zone}).`
      : `Zona ${zone} para ${sku.sku}; no hay hueco libre que proponer.`,
    evidence,
    confidence: suggested ? 0.8 : 0.55,
    recommendation: suggested
      ? "Confirma el putaway en RF. La IA no mueve el palet."
      : "Espera un hueco libre o elige destino a mano.",
    optionalAction: suggested
      ? {
          kind: "OPEN_PUTAWAY",
          labelEs: "Abrir RF / ubicar (requiere confirmación)",
          labelEn: "Open RF / putaway (confirmation required)",
          section: "rf",
          skuId: sku.id,
          requiresConfirmation: true,
        }
      : null,
  };
}

function prioritizeWave(snap: WmsSnapshot, siteId: string | undefined, now: Date): CopilotAnswer {
  const actions = recommendTowerActions(snap, siteId, now);
  const waveAct = actions.find((a) => a.kind === "ASSIGN_PICKER" || a.kind === "OPEN_PICKING");
  const waves = snap.pickWaves.filter((w) => (!siteId || w.siteId === siteId) && w.status !== "cerrada");
  const scored = waves
    .map((w) => {
      const pending = w.lines.filter((l) => l.status === "pendiente" || l.status === "en_curso").length;
      const order = snap.outbound.find((o) => w.lines.some((l) => l.orderCode === o.code));
      const cut = order ? new Date(order.cutOff).getTime() : Number.POSITIVE_INFINITY;
      return { w, pending, cut, order };
    })
    .filter((r) => r.pending > 0)
    .sort((a, b) => a.cut - b.cut || b.pending - a.pending);
  const top = scored[0];
  return {
    intent: "prioritize_wave",
    finding: top
      ? `Priorizar ${top.w.code}: ${top.pending} líneas y cut-off ${top.order?.cutOff.slice(11, 16) ?? "—"} UTC.`
      : "No hay olas abiertas con líneas pendientes.",
    evidence: scored.slice(0, 4).map(
      (r) => `${r.w.code} · ${r.pending} líneas · ${r.w.operatorId ?? "sin picker"} · ${r.order?.code ?? "sin pedido"}`,
    ),
    confidence: top ? 0.9 : 0.7,
    recommendation: top
      ? top.w.operatorId
        ? `Abrir picking de ${top.w.code}.`
        : `Asignar picker a ${top.w.code} (no se asigna solo).`
      : "Nada que priorizar.",
    optionalAction: waveAct
      ? {
          kind: waveAct.kind === "ASSIGN_PICKER" ? "ASSIGN_PICKER" : "OPEN_PICKING",
          labelEs: `${waveAct.actionEs} (requiere confirmación)`,
          labelEn: `${waveAct.actionEn} (confirmation required)`,
          section: waveAct.section,
          waveId: waveAct.waveId,
          orderId: waveAct.orderId,
          requiresConfirmation: true,
        }
      : top
        ? {
            kind: top.w.operatorId ? "OPEN_PICKING" : "ASSIGN_PICKER",
            labelEs: top.w.operatorId
              ? "Abrir picar (requiere confirmación)"
              : "Asignar picker (requiere confirmación)",
            labelEn: top.w.operatorId ? "Open picking (confirmation required)" : "Assign picker (confirmation required)",
            section: top.w.operatorId ? "picking" : "expedicion",
            waveId: top.w.id,
            orderId: top.order?.id,
            requiresConfirmation: true,
          }
        : null,
  };
}

function delayCause(snap: WmsSnapshot, siteId: string | undefined, now: Date): CopilotAnswer {
  const nowMs = now.getTime();
  const lateAsn = snap.inbound.filter(
    (a) =>
      (!siteId || a.siteId === siteId) &&
      a.status !== "cerrado" &&
      new Date(a.eta).getTime() < nowMs &&
      a.palletsDone < a.palletsExpected,
  );
  const fixes = snap.slotFixes.filter((f) => (!siteId || f.siteId === siteId) && f.status === "pendiente");
  const lateShip = snap.outbound.filter(
    (o) =>
      (!siteId || o.siteId === siteId) &&
      o.status !== "expedido" &&
      o.status !== "pendiente" &&
      new Date(o.cutOff).getTime() < nowMs,
  );
  const evidence = [
    ...lateAsn.map((a) => `ASN ${a.code} · ETA pasada · ${a.palletsDone}/${a.palletsExpected}`),
    ...lateShip.map((o) => `${o.code} · cut-off vencido · ${o.status}`),
    ...fixes.map((f) => `Faltante hueco ${f.slotId}`),
  ];
  const finding = evidence.length
    ? `Retrasos por ${lateAsn.length} ASN, ${lateShip.length} expediciones y ${fixes.length} huecos.`
    : "No hay ASN tardíos, cut-off vencidos ni faltantes pendientes en este recorte.";
  return {
    intent: "delay_cause",
    finding,
    evidence: evidence.length ? evidence : ["ASN, outbound y slotFixes del snapshot."],
    confidence: 0.86,
    recommendation: lateAsn[0]
      ? `Recibir ${lateAsn[0].code} primero.`
      : lateShip[0]
        ? `Cerrar ${lateShip[0].code} en muelle.`
        : "Sin causa de retraso en los datos vivos.",
    optionalAction: lateAsn[0]
      ? {
          kind: "OPEN_RECEIVING",
          labelEs: "Ir a recepción (requiere confirmación)",
          labelEn: "Go to receiving (confirmation required)",
          section: "recepcion",
          requiresConfirmation: true,
        }
      : lateShip[0]
        ? {
            kind: "OPEN_SHIPPING",
            labelEs: "Revisar expedición (requiere confirmación)",
            labelEn: "Review shipping (confirmation required)",
            section: "expedicion",
            orderId: lateShip[0].id,
            requiresConfirmation: true,
          }
        : null,
  };
}

/** Responde con el snapshot. No llama a un LLM. No ejecuta la acción. */
export function askWmsCopilot(
  snap: WmsSnapshot,
  question: string,
  siteId?: string,
  now = new Date(WMS_DEMO_NOW),
): CopilotAnswer {
  const intent = detectIntent(question);
  if (intent === "shipment_risk") return shipmentRisk(snap, siteId, now);
  if (intent === "sku_stockout") return skuStockout(snap, siteId);
  if (intent === "slot_sku") return slotSku(snap, siteId, question);
  if (intent === "prioritize_wave") return prioritizeWave(snap, siteId, now);
  if (intent === "delay_cause") return delayCause(snap, siteId, now);
  return {
    intent: "unknown",
    finding: "Pregunta fuera del copilot de planta.",
    evidence: ["Intents: expediciones en riesgo, ruptura de SKU, slotting, prioridad de ola, causas de retraso."],
    confidence: 0.2,
    recommendation: "Usa una de las cinco preguntas operativas.",
    optionalAction: null,
  };
}
