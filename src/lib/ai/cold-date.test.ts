import { describe, expect, it } from "vitest";

import { coldByDate, coldByLabel, decayedScore } from "@/lib/ai/lead-scoring-core";
import type { Lead } from "@/lib/demo-data";

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "L1",
    name: "Ana",
    email: "a@x.com",
    phone: "+34",
    origin: "web_form",
    status: "nuevo",
    score: 80,
    scoreReasons: [],
    interestRoute: null,
    vehicle: "moto",
    campaign: null,
    owner: "miguel",
    createdAt: "2026-07-01",
    lastTouchAt: "2026-07-01",
    notes: "",
    ...over,
  } as Lead;
}

describe("coldByDate / coldByLabel", () => {
  it("da una fecha futura cuando el score está por encima del suelo", () => {
    const now = new Date("2026-07-01T12:00:00");
    const d = coldByDate(lead({ score: 80, lastTouchAt: "2026-07-01" }), 55, 14, now);
    expect(d.getTime()).toBeGreaterThan(now.getTime());
    const label = coldByLabel(lead({ score: 80, lastTouchAt: "2026-07-01" }), "es", 55, 14, now);
    expect(label).toMatch(/se enfría el/i);
  });

  it("decayedScore sigue sin reescribir el base", () => {
    const d = decayedScore(lead({ score: 80, lastTouchAt: "2026-06-01" }), new Date("2026-08-08"));
    expect(d.base).toBe(80);
    expect(d.effective).toBeLessThan(80);
  });
});
