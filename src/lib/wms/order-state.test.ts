import { describe, expect, it } from "vitest";
import { applyOrderEvent, canOrderEvent, lifecycleFromLegacy } from "./order-state";

describe("order lifecycle", () => {
  it("rechaza transiciones inválidas y registra las válidas", () => {
    const at = "2026-08-15T10:00:00.000Z";
    const bad = applyOrderEvent("CREATED", "ship", at);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe("invalid_transition");

    const allocated = applyOrderEvent("CREATED", "allocate", at);
    expect(allocated.ok).toBe(true);
    if (!allocated.ok) return;
    expect(allocated.transition).toEqual({
      at,
      from: "CREATED",
      to: "ALLOCATED",
      event: "allocate",
    });

    expect(canOrderEvent("SHIPPED", "cancel")).toBe(false);
    expect(applyOrderEvent("SHIPPED", "cancel", at).ok).toBe(false);
  });

  it("mapea el pedido de planta sin inventar ALLOCATED", () => {
    expect(lifecycleFromLegacy("pendiente")).toBe("CREATED");
    expect(lifecycleFromLegacy("picking")).toBe("PICKING");
    expect(lifecycleFromLegacy("muelle")).toBe("STAGED");
    expect(lifecycleFromLegacy("expedido")).toBe("SHIPPED");
  });
});
