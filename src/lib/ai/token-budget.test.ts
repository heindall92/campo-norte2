import { describe, expect, it } from "vitest";

import { conciseSystemPrompt, estimateTokens, formatTokenK } from "@/lib/ai/token-budget";

describe("token-budget", () => {
  it("estima tokens por longitud", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });

  it("formatea miles con k", () => {
    expect(formatTokenK(1200)).toBe("1.2k");
    expect(formatTokenK(42)).toBe("42");
  });

  it("pide respuestas cortas en el system prompt", () => {
    const p = conciseSystemPrompt(400);
    expect(p).toMatch(/Lectura rápida/);
    expect(p).toMatch(/viajero/);
  });
});
