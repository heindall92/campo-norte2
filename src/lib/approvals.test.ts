import { describe, expect, it } from "vitest";

import {
  approve,
  approvalsFromDrafts,
  createApproval,
  reject,
  sortApprovals,
  summarizeApprovals,
  type ApprovalRequest,
} from "@/lib/approvals";
import type { ContentDraft } from "@/lib/demo-data";

const NOW = new Date("2026-08-08T12:00:00Z");

function pending(over: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return createApproval({
    kind: "contenido",
    author: "ia",
    title: "Newsletter Mongolia",
    proposal: "Publicar en Brevo",
    createdAt: NOW.toISOString(),
    ...over,
  });
}

function draft(over: Partial<ContentDraft> = {}): ContentDraft {
  return {
    id: "D1",
    type: "newsletter",
    title: "Crónica Mongolia 2026",
    sourceTrip: "Mongolia 2026",
    status: "borrador_ia",
    excerpt: "…",
    subject: "Mongolia",
    body: "Cuerpo del email",
    channel: "Brevo",
    channelKind: "email_brevo",
    audience: "Suscriptores",
    owner: "Sofía",
    variables: [],
    arguments: [],
    updatedAt: NOW.toISOString(),
    ...over,
  };
}

describe("regla de oro: nada se ejecuta sin OK humano", () => {
  it("toda propuesta nace pendiente, incluso si se intenta forzar el estado", () => {
    const a = createApproval({
      kind: "email_lead",
      author: "ia",
      title: "Email a Ana",
      proposal: "Enviar seguimiento",
      // @ts-expect-error el estado no es parte de la entrada por diseño
      status: "aprobada",
    });
    expect(a.status).toBe("pendiente");
  });

  it("aprobar registra quién y cuándo", () => {
    const items = [pending({ id: "a1" })];
    const next = approve(items, "a1", "sofia@camponorte.demo", NOW);
    expect(next[0]!.status).toBe("aprobada");
    expect(next[0]!.resolvedBy).toBe("sofia@camponorte.demo");
    expect(next[0]!.resolvedAt).toBe(NOW.toISOString());
  });

  it("no se puede re-aprobar algo ya rechazado", () => {
    const items = reject([pending({ id: "a1" })], "a1", "miguel", "Tono equivocado", NOW);
    const next = approve(items, "a1", "miguel", NOW);
    expect(next[0]!.status).toBe("rechazada");
  });

  it("rechazar sin motivo no hace nada: el motivo es obligatorio", () => {
    const items = [pending({ id: "a1" })];
    expect(reject(items, "a1", "miguel", "   ", NOW)[0]!.status).toBe("pendiente");
    expect(reject(items, "a1", "miguel", "", NOW)[0]!.status).toBe("pendiente");
  });

  it("rechazar con motivo lo conserva para poder corregir", () => {
    const next = reject([pending({ id: "a1" })], "a1", "miguel", "Suena a folleto", NOW);
    expect(next[0]!.status).toBe("rechazada");
    expect(next[0]!.reason).toBe("Suena a folleto");
  });
});

describe("approvalsFromDrafts", () => {
  it("convierte borradores de la IA en propuestas pendientes", () => {
    const out = approvalsFromDrafts([draft()]);
    expect(out).toHaveLength(1);
    expect(out[0]!.author).toBe("ia");
    expect(out[0]!.status).toBe("pendiente");
    expect(out[0]!.payload).toBe("Cuerpo del email");
  });

  it("no duplica una propuesta ya existente para el mismo borrador", () => {
    const first = approvalsFromDrafts([draft()]);
    const second = approvalsFromDrafts([draft()], first);
    expect(second).toEqual([]);
  });
});

describe("summarizeApprovals", () => {
  it("cuenta solo pendientes y separa las de la IA", () => {
    const items = [
      pending({ id: "1", author: "ia" }),
      pending({ id: "2", author: "equipo", kind: "cambio_precio" }),
      { ...pending({ id: "3", author: "ia" }), status: "aprobada" as const },
    ];
    const s = summarizeApprovals(items);
    expect(s.pending).toBe(2);
    expect(s.fromAi).toBe(1);
    expect(s.byKind.cambio_precio).toBe(1);
  });
});

describe("sortApprovals", () => {
  it("pone pendientes primero y, dentro, las más antiguas", () => {
    const items = [
      { ...pending({ id: "res" }), status: "aprobada" as const },
      pending({ id: "nueva", createdAt: "2026-08-08T00:00:00Z" }),
      pending({ id: "vieja", createdAt: "2026-07-01T00:00:00Z" }),
    ];
    expect(sortApprovals(items).map((i) => i.id)).toEqual(["vieja", "nueva", "res"]);
  });
});
