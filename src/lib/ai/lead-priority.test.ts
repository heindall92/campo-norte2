import { describe, expect, it } from "vitest";
import { rankLeads, fitAxis, intentAxis } from "@/lib/ai/lead-priority";
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
    interestRoute: "MONGOLIA",
    vehicle: "moto",
    createdAt: "2026-08-01",
    lastTouchAt: "2026-08-01",
    owner: "Sofía",
    ...over,
  };
}

function client(over: Partial<Client> = {}): Client {
  return {
    id: "C-1",
    name: "Marta Vidal",
    email: "marta@camponorte.demo",
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
    trips: 3,
    lastTripAt: "2025-11-20",
    nextInterest: "MONGOLIA",
    ltv: 20_000,
    avgTicket: 5_500,
    preferredRoute: "MONGOLIA",
    vehiclePref: "moto",
    experience: "experto",
    docsComplete: true,
    originPrimary: "referral",
    brevoOpens: 5,
    referrals: 2,
    nps: 9,
    owner: "Sofía",
    since: "2019",
    notes: "",
    history: [{ route: "MONGOLIA", date: "2024-09-07", vehicle: "moto", amount: 5_700 }],
    reactivationPriority: 40,
    reactivationWhy: "",
    ...over,
  };
}

const now = new Date("2026-08-15T12:00:00Z");

describe("rankLeads · urgencia", () => {
  it("un fresco de 60 adelanta a un 90 frío (score no se reescribe)", () => {
    const viejo = lead({ id: "V", score: 90, lastTouchAt: "2026-07-16" });
    const fresco = lead({ id: "F", score: 60, lastTouchAt: "2026-08-15" });
    const ranked = rankLeads({ leads: [viejo, fresco], mode: "urgencia", now });
    expect(ranked[0]?.lead.id).toBe("F");
    expect(viejo.score).toBe(90);
    expect(fresco.score).toBe(60);
  });
});

describe("rankLeads · dinero", () => {
  it("prioriza rutas con más margen esperado y explica el porqué", () => {
    const namibia = lead({
      id: "NAM",
      score: 90,
      interestRoute: "NAMIBIA",
      lastTouchAt: "2026-08-15",
    });
    const sinRuta = lead({
      id: "NO",
      score: 90,
      interestRoute: null,
      lastTouchAt: "2026-08-15",
    });
    const ranked = rankLeads({ leads: [sinRuta, namibia], mode: "dinero", now });
    expect(ranked[0]?.lead.id).toBe("NAM");
    expect(ranked[0]?.why).toMatch(/margen|margin/i);
    expect(namibia.score).toBe(90);
  });
});

describe("rankLeads · encaje", () => {
  it("cuadrante alto+alto va delante", () => {
    const ideal = lead({
      id: "IDEAL",
      origin: "referral",
      status: "cualificado",
      campaign: "vip",
      score: 88,
      lastTouchAt: "2026-08-15",
    });
    const flojo = lead({
      id: "FLOJO",
      origin: "unknown",
      status: "nuevo",
      interestRoute: null,
      vehicle: null,
      score: 40,
      lastTouchAt: "2026-08-15",
    });
    expect(fitAxis(ideal, null)).toBeGreaterThan(fitAxis(flojo, null));
    expect(intentAxis(ideal, now)).toBeGreaterThan(intentAxis(flojo, now));
    const ranked = rankLeads({ leads: [flojo, ideal], mode: "encaje", now });
    expect(ranked[0]?.lead.id).toBe("IDEAL");
    expect(ranked[0]?.why).toMatch(/llamar ya|call now/i);
  });
});

describe("rankLeads · parecido", () => {
  it("sube al lead que se parece a un convertidor", () => {
    const booker = client();
    const similar = lead({
      id: "SIM",
      origin: "referral",
      interestRoute: "MONGOLIA",
      vehicle: "moto",
      score: 70,
      lastTouchAt: "2026-08-15",
    });
    const different = lead({
      id: "DIFF",
      origin: "feria",
      interestRoute: "COLOMBIA",
      vehicle: "4x4",
      score: 70,
      lastTouchAt: "2026-08-15",
    });
    const ranked = rankLeads({
      leads: [different, similar],
      clients: [booker],
      mode: "parecido",
      now,
    });
    expect(ranked[0]?.lead.id).toBe("SIM");
    expect(ranked[0]?.why).toMatch(/Marta Vidal|parecido|like/i);
  });
});
