import { describe, expect, it } from "vitest";

import type { Reservation } from "@/lib/ops-data";
import { buildTeamOps, TEAM_DAY_RATE } from "@/lib/team-ops";

function reservation(over: Partial<Reservation> = {}): Reservation {
  return {
    id: "R1",
    clientId: "C1",
    clientName: "Luis Paz",
    clientPhone: "+34600000000",
    expeditionId: "E1",
    route: "MONGOLIA",
    tripName: "Mongolia 2026",
    vehicle: "moto",
    status: "reservado",
    bookedAt: "2026-06-01",
    departureAt: "2026-09-10",
    pax: 2,
    totalAmount: 8000,
    depositPaid: 2000,
    paymentChannel: "transferencia",
    paymentRefs: [],
    tourLeader: "Jorge Peña",
    logisticsContacts: [{ role: "Hotel", name: "Hotel Local", phone: "+976" }],
    itinerary: [
      { day: "1", place: "UB", lodging: "A", meals: "B" },
      { day: "2", place: "Steppe", lodging: "C", meals: "D" },
      { day: "3", place: "Gobi", lodging: "E", meals: "F" },
    ],
    prep: [],
    internalNotes: "",
    ...over,
  };
}

describe("buildTeamOps", () => {
  it("conecta el tour leader del equipo y estima coste por días", () => {
    const snap = buildTeamOps([reservation()]);
    expect(snap.byMember).toHaveLength(1);
    expect(snap.byMember[0]?.name).toBe("Jorge Peña");
    expect(snap.byMember[0]?.role).toBe("guide");
    expect(snap.pendingCost).toBe(TEAM_DAY_RATE.guide * 3);
    expect(snap.costByDepartureMonth["2026-09"]).toBe(TEAM_DAY_RATE.guide * 3);
  });

  it("no cuenta contactos logísticos externos como coste de equipo", () => {
    const snap = buildTeamOps([reservation()]);
    expect(snap.assignments.every((a) => a.personName !== "Hotel Local")).toBe(true);
  });

  it("separa coste cerrado del pendiente", () => {
    const snap = buildTeamOps([
      reservation({ id: "R1", status: "cerrado" }),
      reservation({ id: "R2", status: "prep_viaje", tourLeader: "Luis Ortega" }),
    ]);
    expect(snap.closedCost).toBe(TEAM_DAY_RATE.guide * 3);
    expect(snap.pendingCost).toBe(TEAM_DAY_RATE.ops * 3);
  });
});
