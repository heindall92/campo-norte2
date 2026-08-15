import { WMS_DEMO_NOW } from "./alerts";
import type { OutboundOrder, PickWave, WmsSnapshot } from "./types";

export interface DayPriority {
  order: OutboundOrder;
  score: number;
  reasonEs: string;
  reasonEn: string;
  waveCodes: string[];
  pickDone: number;
  pickTotal: number;
  done: boolean;
}

const PRIORITY_SCORE: Record<OutboundOrder["priority"], number> = {
  express: 300,
  urgente: 200,
  normal: 100,
};

function wavesForOrder(waves: PickWave[], code: string): PickWave[] {
  return waves.filter((w) => w.lines.some((l) => l.orderCode === code));
}

function pickProgress(waves: PickWave[]) {
  const lines = waves.flatMap((w) => w.lines);
  const pickDone = lines.filter((l) => l.status === "picada").length;
  return { pickDone, pickTotal: lines.length };
}

/**
 * Heurística de olas del día: express > urgente > cut-off próximo > palets.
 * Enlaza pedidos de expedición con las olas de picking por `orderCode`.
 */
export function rankDayPriorities(
  snap: WmsSnapshot,
  siteId?: string,
  now = new Date(WMS_DEMO_NOW),
): DayPriority[] {
  const nowMs = now.getTime();
  const orders = snap.outbound.filter((o) => !siteId || o.siteId === siteId);

  return orders
    .map((order) => {
      const waves = wavesForOrder(snap.pickWaves, order.code);
      const { pickDone, pickTotal } = pickProgress(waves);
      const done = order.status === "expedido";
      const cut = new Date(order.cutOff).getTime();
      const hoursLeft = (cut - nowMs) / 3_600_000;
      let score = PRIORITY_SCORE[order.priority];
      const reasons: { es: string; en: string }[] = [
        { es: `prioridad ${order.priority}`, en: `${order.priority} priority` },
      ];

      if (!done && hoursLeft < 0) {
        score += 250;
        reasons.push({ es: "cut-off vencido", en: "cut-off overdue" });
      } else if (!done && hoursLeft <= 2) {
        score += 150;
        reasons.push({ es: "cut-off < 2 h", en: "cut-off < 2 h" });
      }

      score += order.pallets * 2;
      if (pickTotal) {
        score += (pickTotal - pickDone) * 3;
        reasons.push({
          es: `ola ${pickDone}/${pickTotal} líneas`,
          en: `wave ${pickDone}/${pickTotal} lines`,
        });
      } else if (!done) {
        reasons.push({ es: "sin ola impresa", en: "no printed wave" });
      }

      if (done) score = 0;

      return {
        order,
        score,
        reasonEs: reasons.map((r) => r.es).join(" · "),
        reasonEn: reasons.map((r) => r.en).join(" · "),
        waveCodes: waves.map((w) => w.code),
        pickDone,
        pickTotal,
        done,
      };
    })
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return b.score - a.score;
    });
}

export function navigateWmsSection(
  section: string,
  extra?: { waveId?: string; orderId?: string },
): void {
  if (typeof window === "undefined") return;
  try {
    if (extra?.waveId) sessionStorage.setItem("cn-wms-focus-wave", extra.waveId);
    else sessionStorage.removeItem("cn-wms-focus-wave");
    if (extra?.orderId) sessionStorage.setItem("cn-wms-focus-order", extra.orderId);
    else sessionStorage.removeItem("cn-wms-focus-order");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("mps-navigate", { detail: section }));
}

export function peekWmsFocus(): { waveId: string | null; orderId: string | null } {
  try {
    return {
      waveId: sessionStorage.getItem("cn-wms-focus-wave"),
      orderId: sessionStorage.getItem("cn-wms-focus-order"),
    };
  } catch {
    return { waveId: null, orderId: null };
  }
}
