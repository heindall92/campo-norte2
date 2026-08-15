import { describe, expect, it } from "vitest";
import {
  DEFAULT_HALF_LIFE_DAYS,
  daysSince,
  decayFactor,
  decayedScore,
  scoreLeadHeuristic,
} from "@/lib/ai/lead-scoring-core";
import { computeLeadStats, effectiveScore } from "@/lib/data/stats";
import type { Client, Lead } from "@/lib/demo-data";

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "L-1",
    name: "Test",
    email: "test@example.com",
    origin: "web_form",
    campaign: null,
    status: "nuevo",
    score: 80,
    scoreReasons: [],
    interestRoute: null,
    vehicle: null,
    createdAt: "2026-08-01",
    lastTouchAt: "2026-08-01",
    owner: "Sofía",
    ...over,
  };
}

describe("decayFactor", () => {
  it("un lead de hoy no se enfría", () => {
    expect(decayFactor(0)).toBe(1);
    expect(decayFactor(-3)).toBe(1);
  });

  it("a la vida media vale la mitad, y al doble la cuarta parte", () => {
    expect(decayFactor(DEFAULT_HALF_LIFE_DAYS)).toBeCloseTo(0.5, 5);
    expect(decayFactor(DEFAULT_HALF_LIFE_DAYS * 2)).toBeCloseTo(0.25, 5);
  });

  it("la vida media es configurable", () => {
    expect(decayFactor(7, 7)).toBeCloseTo(0.5, 5);
    expect(decayFactor(7, 0)).toBe(1); // sin vida media no hay enfriamiento
  });
});

describe("daysSince", () => {
  const now = new Date("2026-08-15T12:00:00Z");

  it("cuenta los días desde la fecha dada", () => {
    expect(Math.round(daysSince("2026-08-01", now))).toBe(14);
  });

  it("una fecha vacía o inválida no rompe: cuenta cero", () => {
    expect(daysSince(null, now)).toBe(0);
    expect(daysSince("no-es-fecha", now)).toBe(0);
  });
});

describe("decayedScore", () => {
  const now = new Date("2026-08-15T12:00:00Z");

  it("no toca el score guardado, solo calcula el efectivo", () => {
    const result = decayedScore(lead({ score: 90, lastTouchAt: "2026-08-01" }), now);
    expect(result.base).toBe(90);
    expect(result.effective).toBe(45); // 14 días = mitad
    expect(result.days).toBe(14);
  });

  it("usa createdAt cuando no hay último contacto", () => {
    const result = decayedScore(
      { score: 80, lastTouchAt: "", createdAt: "2026-08-15" },
      now,
    );
    expect(result.effective).toBe(80);
  });
});

describe("orden real de la cola", () => {
  const now = new Date("2026-08-15T12:00:00Z");

  it("un lead fresco de 60 adelanta a uno de 90 de hace un mes", () => {
    const viejo = lead({ id: "L-VIEJO", score: 90, lastTouchAt: "2026-07-16" });
    const fresco = lead({ id: "L-FRESCO", score: 60, lastTouchAt: "2026-08-15" });

    expect(effectiveScore(viejo, now)).toBeLessThan(effectiveScore(fresco, now));

    const { sorted } = computeLeadStats([viejo, fresco], now);
    expect(sorted[0]?.id).toBe("L-FRESCO");
  });

  it("a igualdad de frescura manda el score", () => {
    const alto = lead({ id: "L-ALTO", score: 80 });
    const bajo = lead({ id: "L-BAJO", score: 40 });
    const { sorted } = computeLeadStats([bajo, alto], new Date("2026-08-01T12:00:00Z"));
    expect(sorted[0]?.id).toBe("L-ALTO");
  });
});

describe("el cruce con la cartera cambia el score", () => {
  const client: Client = {
    id: "C-1",
    name: "Marta Vidal",
    email: "test@example.com",
    phone: "",
    city: "Barcelona",
    country: "España",
    dni: "",
    address: "",
    contactPerson: "",
    emergencyPhone: "",
    segment: "vip",
    status: "al_dia",
    paymentStatus: "al_dia",
    pendingBalance: 0,
    paymentMethod: "stripe",
    trips: 11,
    lastTripAt: "2025-11-20",
    nextInterest: null,
    ltv: 58_000,
    avgTicket: 5_270,
    preferredRoute: null,
    vehiclePref: null,
    experience: "experto",
    docsComplete: true,
    originPrimary: "referral",
    brevoOpens: 9,
    referrals: 3,
    nps: 10,
    owner: "Sofía",
    since: "2018",
    notes: "",
    history: [],
    reactivationPriority: 40,
    reactivationWhy: "",
    lastOutboundAt: null,
    returnProbability: 80,
    intelligenceSource: "seed",
  };

  it("un cliente conocido puntúa muy por encima del mismo lead sin cruzar", () => {
    const base = lead({ origin: "web_form", score: 0 });
    const anonimo = scoreLeadHeuristic(base, null);
    const conocido = scoreLeadHeuristic(base, client);

    // Este es el bug que arreglamos: el pipeline pasaba null y perdía la señal.
    expect(conocido.score).toBeGreaterThan(anonimo.score);
    expect(conocido.score - anonimo.score).toBeGreaterThanOrEqual(30);
    expect(conocido.reasons.join(" ")).toMatch(/repetidor/i);
  });
});
