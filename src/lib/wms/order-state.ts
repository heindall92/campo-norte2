/**
 * Máquina de estados del brief. No sustituye `OutboundOrder.status` (español)
 * hasta que se cablee: aquí se valida y se registra la transición.
 */

export const ORDER_STATES = [
  "CREATED",
  "ALLOCATED",
  "RELEASED",
  "PICKING",
  "PARTIALLY_PICKED",
  "PICKED",
  "PACKING",
  "PACKED",
  "STAGED",
  "LOADED",
  "SHIPPED",
  "CANCELLED",
] as const;

export type OrderLifecycle = (typeof ORDER_STATES)[number];

export type OrderEvent =
  | "allocate"
  | "release"
  | "start_pick"
  | "pick_partial"
  | "pick_complete"
  | "start_pack"
  | "pack_complete"
  | "stage"
  | "load"
  | "ship"
  | "cancel";

export interface OrderTransition {
  at: string;
  from: OrderLifecycle;
  to: OrderLifecycle;
  event: OrderEvent;
}

export type OrderStateError = "invalid_transition" | "terminal" | "unknown_state";

const TERMINAL: ReadonlySet<OrderLifecycle> = new Set(["SHIPPED", "CANCELLED"]);

const EDGES: Record<OrderEvent, Partial<Record<OrderLifecycle, OrderLifecycle>>> = {
  allocate: { CREATED: "ALLOCATED" },
  release: { ALLOCATED: "RELEASED", CREATED: "RELEASED" },
  start_pick: { RELEASED: "PICKING", ALLOCATED: "PICKING", CREATED: "PICKING" },
  pick_partial: { PICKING: "PARTIALLY_PICKED", PARTIALLY_PICKED: "PARTIALLY_PICKED" },
  pick_complete: { PICKING: "PICKED", PARTIALLY_PICKED: "PICKED" },
  start_pack: { PICKED: "PACKING", PARTIALLY_PICKED: "PACKING" },
  pack_complete: { PACKING: "PACKED", PICKED: "PACKED" },
  stage: { PACKED: "STAGED", PICKED: "STAGED" },
  load: { STAGED: "LOADED" },
  ship: { LOADED: "SHIPPED", STAGED: "SHIPPED" },
  cancel: {
    CREATED: "CANCELLED",
    ALLOCATED: "CANCELLED",
    RELEASED: "CANCELLED",
    PICKING: "CANCELLED",
    PARTIALLY_PICKED: "CANCELLED",
    PACKING: "CANCELLED",
  },
};

/** Pedido actual de planta → ciclo de vida. No inventa ALLOCATED. */
export function lifecycleFromLegacy(
  status: "pendiente" | "picking" | "embalaje" | "muelle" | "expedido",
): OrderLifecycle {
  if (status === "picking") return "PICKING";
  if (status === "embalaje") return "PACKING";
  if (status === "muelle") return "STAGED";
  if (status === "expedido") return "SHIPPED";
  return "CREATED";
}

export function legacyFromLifecycle(
  state: OrderLifecycle,
): "pendiente" | "picking" | "embalaje" | "muelle" | "expedido" {
  if (state === "PICKING" || state === "PARTIALLY_PICKED" || state === "PICKED" || state === "RELEASED" || state === "ALLOCATED") {
    return state === "ALLOCATED" || state === "RELEASED" ? "pendiente" : "picking";
  }
  if (state === "PACKING" || state === "PACKED") return "embalaje";
  if (state === "STAGED" || state === "LOADED") return "muelle";
  if (state === "SHIPPED") return "expedido";
  return "pendiente";
}

export function applyOrderEvent(
  from: OrderLifecycle,
  event: OrderEvent,
  at: string,
): { ok: true; to: OrderLifecycle; transition: OrderTransition } | { ok: false; error: OrderStateError } {
  if (!ORDER_STATES.includes(from)) return { ok: false, error: "unknown_state" };
  if (TERMINAL.has(from)) return { ok: false, error: "terminal" };
  const to = EDGES[event]?.[from];
  if (!to) return { ok: false, error: "invalid_transition" };
  return { ok: true, to, transition: { at, from, to, event } };
}

export function canOrderEvent(from: OrderLifecycle, event: OrderEvent): boolean {
  return applyOrderEvent(from, event, "1970-01-01T00:00:00.000Z").ok;
}
