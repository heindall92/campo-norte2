import { describe, expect, it } from "vitest";
import { priorityFromScore, scoreLeadHeuristic } from "@/lib/ai/lead-scoring";
import { compressTail } from "@/lib/ai/lead-scoring-core";
import { CLIENTS, type Client, type Lead } from "@/lib/demo-data";
import {
  isReavPriceShape,
  reavVatAmount,
  reavVatMatches,
} from "@/lib/invoice-math";
import { buildGestoriaExportCsv, INVOICES } from "@/lib/ops-data";

function baseLead(over: Partial<Lead> = {}): Lead {
  return {
    id: "L-TEST",
    name: "Test Lead",
    email: "test@example.com",
    origin: "unknown",
    campaign: null,
    interestRoute: null,
    vehicle: null,
    status: "nuevo",
    score: 0,
    scoreReasons: [],
    owner: "Sofía",
    createdAt: "2026-01-01",
    lastTouchAt: "2026-01-01",
    ...over,
  };
}

describe("lead scoring heuristic", () => {
  it("priorityFromScore bands", () => {
    expect(priorityFromScore(90)).toBe("muy_alta");
    expect(priorityFromScore(75)).toBe("alta");
    expect(priorityFromScore(55)).toBe("media");
    expect(priorityFromScore(40)).toBe("baja");
  });

  it("boosts referral + destination over unknown", () => {
    const cold = scoreLeadHeuristic(baseLead({ origin: "unknown" }));
    const hot = scoreLeadHeuristic(
      baseLead({
        origin: "referral",
        interestRoute: "MONGOLIA",
        status: "cualificado",
      }),
    );
    expect(hot.score).toBeGreaterThan(cold.score);
    expect(hot.source).toBe("heuristic");
    expect(hot.reasons.some((r) => /refer|Canal/i.test(r))).toBe(true);
  });

  it("clamps score to 0–100", () => {
    const r = scoreLeadHeuristic(
      baseLead({
        origin: "referral",
        interestRoute: "MONGOLIA",
        vehicle: "moto",
        campaign: "NL",
        status: "reservado",
      }),
    );
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("REAV invoice math", () => {
  it("computes VAT on margin (tax base), not on total", () => {
    expect(reavVatAmount(410, 21)).toBe(86.1);
    expect(reavVatMatches(410, 21, 86.1)).toBe(true);
    expect(reavVatMatches(410, 21, 99)).toBe(false);
  });

  it("allows total > taxBase + VAT (REAV shape)", () => {
    expect(isReavPriceShape(410, 86.1, 1500)).toBe(true);
    expect(isReavPriceShape(900, 189, 1000)).toBe(false);
  });

  it("seed invoices keep REAV VAT coherence", () => {
    for (const inv of INVOICES) {
      expect(reavVatMatches(inv.taxBase, inv.vatRate, inv.vatAmount)).toBe(true);
      expect(isReavPriceShape(inv.taxBase, inv.vatAmount, inv.total)).toBe(true);
    }
  });

  it("gestoría CSV includes header and one row per invoice", () => {
    const csv = buildGestoriaExportCsv(INVOICES);
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toContain("numero_factura");
    expect(lines.length).toBe(INVOICES.length + 1);
  });
});

describe("correcciones de la heurística", () => {
  const base: Lead = {
    id: "L1",
    name: "Ana",
    email: "ana@example.com",
    origin: "referral",
    campaign: "verano",
    status: "nuevo",
    score: 0,
    scoreReasons: [],
    interestRoute: "NAMIBIA",
    vehicle: "moto",
    createdAt: "2026-08-01T00:00:00Z",
    lastTouchAt: "2026-08-01T00:00:00Z",
    owner: "Laura",
  };

  function client(over: Partial<Client> = {}): Client {
    return {
      ...CLIENTS[0]!,
      email: "ana@example.com",
      trips: 3,
      ltv: 30_000,
      brevoOpens: 9,
      history: [],
      ...over,
    };
  }

  it("premia haber viajado a la ruta de interés, sea cual sea", () => {
    const namibia = scoreLeadHeuristic(base, client({
      history: [{ route: "NAMIBIA", date: "2024-01-01", vehicle: "moto", amount: 8000 }],
    }));
    expect(namibia.reasons.some((r) => /Namibia/i.test(r))).toBe(true);
  });

  it("no privilegia Mongolia sobre el resto de rutas", () => {
    const mongolia = scoreLeadHeuristic(
      { ...base, interestRoute: "MONGOLIA" },
      client({ history: [{ route: "MONGOLIA", date: "2024-01-01", vehicle: "moto", amount: 8000 }] }),
    );
    const alaska = scoreLeadHeuristic(
      { ...base, interestRoute: "ALASKA" },
      client({ history: [{ route: "ALASKA", date: "2024-01-01", vehicle: "moto", amount: 8000 }] }),
    );
    expect(mongolia.score).toBe(alaska.score);
  });

  it("no premia un historial en una ruta que ya no interesa", () => {
    const otra = scoreLeadHeuristic(
      { ...base, interestRoute: "ALASKA" },
      client({ history: [{ route: "MONGOLIA", date: "2024-01-01", vehicle: "moto", amount: 8000 }] }),
    );
    expect(otra.reasons.some((r) => /Mongolia/i.test(r))).toBe(false);
  });

  it("dos perfiles excelentes distintos NO empatan en 100", () => {
    const bueno = scoreLeadHeuristic(base, client({ trips: 1, ltv: 12_000, brevoOpens: 6 }));
    const mejor = scoreLeadHeuristic(base, client({
      trips: 5,
      ltv: 60_000,
      brevoOpens: 20,
      history: [{ route: "NAMIBIA", date: "2024-01-01", vehicle: "moto", amount: 9000 }],
    }));
    expect(mejor.score).toBeGreaterThanOrEqual(bueno.score);
    expect(mejor.score).toBeLessThan(100);
    expect(bueno.score).toBeLessThan(100);
  });

  it("la compresión es estrictamente creciente y nunca alcanza 100", () => {
    expect(compressTail(50)).toBe(50);
    expect(compressTail(80)).toBe(80);
    expect(compressTail(97)).toBeGreaterThan(compressTail(90));
    expect(compressTail(124)).toBeGreaterThan(compressTail(109));
    expect(compressTail(1000)).toBeLessThan(100);
  });
});
