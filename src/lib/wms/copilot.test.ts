import { describe, expect, it } from "vitest";
import { askWmsCopilot } from "./copilot";
import { requireConfirmation } from "./permissions";
import { buildWmsSeed } from "./seed";

describe("wms copilot", () => {
  it("responde expediciones en riesgo con evidencia del snapshot", () => {
    const snap = buildWmsSeed();
    const ans = askWmsCopilot(snap, "¿Qué expediciones están en riesgo?", "site-sev");
    expect(ans.intent).toBe("shipment_risk");
    expect(ans.finding).toMatch(/\d/);
    expect(ans.evidence.some((e) => e.includes("OUT-SEV-8840"))).toBe(true);
    expect(ans.confidence).toBeGreaterThan(0.8);
    expect(ans.optionalAction?.requiresConfirmation).toBe(true);
  });

  it("prioriza la ola real, no 38 líneas inventadas", () => {
    const snap = buildWmsSeed();
    const pending = snap.pickWaves
      .find((w) => w.id === "wave-01")!
      .lines.filter((l) => l.status === "pendiente" || l.status === "en_curso").length;
    const ans = askWmsCopilot(snap, "¿Qué wave debería priorizar?", "site-sev");
    expect(ans.evidence.join(" ")).not.toContain("38 líneas");
    expect(ans.finding).toContain(String(pending));
  });

  it("no ejecuta sin confirmación", () => {
    expect(requireConfirmation(false)).toEqual({ ok: false, error: "confirmation_required" });
    expect(requireConfirmation(true)).toEqual({ ok: true });
  });

  it("no adivina el SKU si no viene en la pregunta", () => {
    const ans = askWmsCopilot(buildWmsSeed(), "¿Dónde debería colocar este SKU?", "site-sev");
    expect(ans.confidence).toBeLessThan(0.5);
    expect(ans.optionalAction).toBeNull();
  });
});
