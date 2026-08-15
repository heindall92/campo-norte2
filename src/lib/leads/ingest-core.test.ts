import { describe, expect, it } from "vitest";
import {
  campaignFromPayload,
  inferOriginFromForm,
  leadFromPayload,
  mergeLead,
  pickOwner,
  validateLeadPayload,
} from "@/lib/leads/ingest-core";
import type { Lead } from "@/lib/demo-data";

describe("validateLeadPayload", () => {
  it("rechaza un cuerpo que no es objeto", () => {
    expect(validateLeadPayload("hola")).toMatchObject({ ok: false, field: "body" });
    expect(validateLeadPayload(null)).toMatchObject({ ok: false, field: "body" });
  });

  it("exige email con forma válida", () => {
    expect(validateLeadPayload({ name: "Ana" })).toMatchObject({ ok: false, field: "email" });
    expect(validateLeadPayload({ name: "Ana", email: "ana@" })).toMatchObject({
      ok: false,
      field: "email",
    });
  });

  it("exige nombre", () => {
    expect(validateLeadPayload({ email: "ana@example.com" })).toMatchObject({
      ok: false,
      field: "name",
    });
  });

  it("normaliza email, recorta texto y descarta valores no permitidos", () => {
    const result = validateLeadPayload({
      name: "  Ana Beltrán  ",
      email: "  ANA@Example.COM ",
      interestRoute: "namibia",
      vehicle: "MOTO",
      origin: "no-existe",
      message: "x".repeat(5_000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe("ana@example.com");
    expect(result.value.name).toBe("Ana Beltrán");
    expect(result.value.interestRoute).toBe("NAMIBIA");
    expect(result.value.vehicle).toBe("moto");
    // Un origen inventado no se cuela: se infiere después.
    expect(result.value.origin).toBeUndefined();
    expect(result.value.message?.length).toBe(2_000);
  });

  it("deja en null una ruta que no existe en el catálogo", () => {
    const result = validateLeadPayload({
      name: "Ana",
      email: "ana@example.com",
      interestRoute: "MARTE",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.interestRoute).toBeNull();
  });
});

describe("inferOriginFromForm", () => {
  it("respeta el origen explícito", () => {
    expect(inferOriginFromForm({ name: "A", email: "a@b.com", origin: "feria" })).toBe("feria");
  });

  it("deduce el canal desde los UTM", () => {
    expect(inferOriginFromForm({ name: "A", email: "a@b.com", utmSource: "instagram" })).toBe(
      "instagram",
    );
    expect(inferOriginFromForm({ name: "A", email: "a@b.com", utmSource: "brevo" })).toBe(
      "brevo_click",
    );
    expect(
      inferOriginFromForm({ name: "A", email: "a@b.com", utmMedium: "referido de un cliente" }),
    ).toBe("referral");
    expect(inferOriginFromForm({ name: "A", email: "a@b.com", utmSource: "google" })).toBe(
      "web_form",
    );
  });

  it("sin señal, el origen queda desconocido — no se inventa", () => {
    expect(inferOriginFromForm({ name: "A", email: "a@b.com" })).toBe("unknown");
  });
});

describe("reparto y campaña", () => {
  it("los referidos y los leads calientes van a Sofía", () => {
    expect(pickOwner("referral", 40)).toBe("Sofía");
    expect(pickOwner("web_form", 90)).toBe("Sofía");
    expect(pickOwner("web_form", 60)).toBe("Laura");
  });

  it("compone la campaña desde utm_campaign o utm_source", () => {
    expect(campaignFromPayload({ name: "A", email: "a@b.com", utmCampaign: "NL-oct" })).toBe(
      "NL-oct",
    );
    expect(campaignFromPayload({ name: "A", email: "a@b.com", utmSource: "ig" })).toBe("utm:ig");
    expect(campaignFromPayload({ name: "A", email: "a@b.com" })).toBeNull();
  });
});

describe("leadFromPayload / mergeLead", () => {
  const now = new Date("2026-08-01T10:00:00Z");

  it("crea el lead con fecha de hoy y sin puntuar todavía", () => {
    const lead = leadFromPayload(
      { name: "Ana", email: "ana@example.com", utmSource: "instagram" },
      now,
    );
    expect(lead.id).toMatch(/^L-/);
    expect(lead.origin).toBe("instagram");
    expect(lead.createdAt).toBe("2026-08-01");
    expect(lead.score).toBe(0);
    expect(lead.owner).toBe("Sin asignar");
  });

  it("al fusionar, el segundo envío suma datos y no borra los que había", () => {
    const existing: Lead = {
      ...leadFromPayload({ name: "Ana", email: "ana@example.com" }, new Date("2026-07-01")),
      id: "L-EXIST",
      interestRoute: "NAMIBIA",
      owner: "Laura",
      status: "en_contacto",
      score: 70,
    };

    const merged = mergeLead(
      existing,
      { name: "Ana Beltrán", email: "ana@example.com", vehicle: "4x4", utmSource: "brevo" },
      now,
    );

    expect(merged.id).toBe("L-EXIST");
    expect(merged.name).toBe("Ana Beltrán");
    expect(merged.interestRoute).toBe("NAMIBIA"); // no se pierde
    expect(merged.vehicle).toBe("4x4"); // se añade
    expect(merged.origin).toBe("brevo_click"); // se mejora el desconocido
    expect(merged.status).toBe("en_contacto"); // el trabajo hecho se respeta
    expect(merged.lastTouchAt).toBe("2026-08-01");
  });

  it("un lead descartado que vuelve a escribir se reabre", () => {
    const existing: Lead = {
      ...leadFromPayload({ name: "Pablo", email: "p@example.com" }, new Date("2026-01-01")),
      status: "descartado",
    };
    const merged = mergeLead(existing, { name: "Pablo", email: "p@example.com" }, now);
    expect(merged.status).toBe("nuevo");
  });
});
