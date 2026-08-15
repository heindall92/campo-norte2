/**
 * Bandeja de Aprobaciones — todo lo que espera un OK humano, en un solo sitio.
 *
 * Esto es la REGLA DE ORO del proyecto convertida en producto: "nada escribe
 * al viajero solo". Hasta ahora esa regla vivía en un documento; aquí vive en
 * la interfaz y es demostrable delante de un cliente.
 *
 * Diferencia con `attention.ts`, que es fácil de confundir:
 *
 *   attention.ts  → "esto se está pudriendo, míralo"      (riesgo temporal)
 *   approvals.ts  → "esto está redactado, ¿lo apruebas?"  (acción propuesta)
 *
 * Una propuesta SIEMPRE nace en `pendiente`. Nada se ejecuta sin pasar por
 * `aprobada`, y el rechazo es un estado final con motivo, no un borrado.
 */

import type { ContentDraft } from "@/lib/demo-data";

export type ApprovalStatus = "pendiente" | "aprobada" | "rechazada";

export type ApprovalKind =
  | "contenido"
  | "email_lead"
  | "cambio_precio"
  | "dato_cliente"
  | "documento";

/** Quién propuso. `ia` es el caso que la regla de oro vigila. */
export type ApprovalAuthor = "ia" | "equipo";

export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  author: ApprovalAuthor;
  status: ApprovalStatus;
  /** Qué se aprueba. */
  title: string;
  /** Qué haría exactamente si se aprueba. En lenguaje llano. */
  proposal: string;
  /** Texto literal que se publicaría o enviaría, si aplica. */
  payload?: string;
  createdAt: string;
  /** Entidad afectada, para navegar a donde se resuelve. */
  targetId?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  /** Obligatorio al rechazar: sin motivo no se aprende nada. */
  reason?: string;
}

export const APPROVAL_KIND_LABEL: Record<ApprovalKind, string> = {
  contenido: "Contenido",
  email_lead: "Email a lead",
  cambio_precio: "Cambio de precio",
  dato_cliente: "Dato de cliente",
  documento: "Documento",
};

const STORAGE_KEY = "mps-approvals-v1";

/* ------------------------------------------------------------------ *
 * Persistencia
 * ------------------------------------------------------------------ */

export function loadApprovals(): ApprovalRequest[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ApprovalRequest[]) : [];
  } catch {
    return [];
  }
}

export function saveApprovals(items: ApprovalRequest[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Cuota llena o modo privado: la bandeja no debe tumbar la app.
  }
}

/* ------------------------------------------------------------------ *
 * Transiciones
 * ------------------------------------------------------------------ */

/** Crea una propuesta. Siempre nace pendiente: no hay atajo. */
export function createApproval(
  input: Omit<ApprovalRequest, "id" | "status" | "createdAt"> & { id?: string; createdAt?: string },
): ApprovalRequest {
  return {
    ...input,
    id: input.id ?? `apr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "pendiente",
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function approve(
  items: ApprovalRequest[],
  id: string,
  by: string,
  now: Date = new Date(),
): ApprovalRequest[] {
  return items.map((it) =>
    it.id === id && it.status === "pendiente"
      ? { ...it, status: "aprobada", resolvedAt: now.toISOString(), resolvedBy: by }
      : it,
  );
}

/**
 * Rechaza con motivo. Sin motivo no se rechaza: el motivo es lo único que
 * permite corregir lo que la IA propone mal.
 */
export function reject(
  items: ApprovalRequest[],
  id: string,
  by: string,
  reason: string,
  now: Date = new Date(),
): ApprovalRequest[] {
  const trimmed = reason.trim();
  if (!trimmed) return items;
  return items.map((it) =>
    it.id === id && it.status === "pendiente"
      ? {
          ...it,
          status: "rechazada",
          resolvedAt: now.toISOString(),
          resolvedBy: by,
          reason: trimmed,
        }
      : it,
  );
}

/* ------------------------------------------------------------------ *
 * Colectores
 * ------------------------------------------------------------------ */

/**
 * Convierte borradores de la fábrica de contenido en propuestas.
 *
 * Es el caso real de la regla de oro: la IA redacta la newsletter, pero
 * quien la publica es una persona.
 */
export function approvalsFromDrafts(
  drafts: ContentDraft[],
  existing: ApprovalRequest[] = [],
): ApprovalRequest[] {
  const known = new Set(existing.map((a) => a.targetId));
  const out: ApprovalRequest[] = [];

  for (const d of drafts) {
    const id = `draft:${d.id}`;
    if (known.has(id)) continue;
    out.push(
      createApproval({
        id: `apr-${id}`,
        kind: "contenido",
        author: "ia",
        title: d.title,
        proposal: `Publicar en ${d.channel} el contenido generado tras la expedición.`,
        payload: d.body,
        targetId: id,
        createdAt: d.updatedAt,
      }),
    );
  }

  return out;
}

export interface ApprovalSummary {
  pending: number;
  fromAi: number;
  byKind: Partial<Record<ApprovalKind, number>>;
}

export function summarizeApprovals(items: ApprovalRequest[]): ApprovalSummary {
  const byKind: Partial<Record<ApprovalKind, number>> = {};
  let pending = 0;
  let fromAi = 0;

  for (const it of items) {
    if (it.status !== "pendiente") continue;
    pending += 1;
    if (it.author === "ia") fromAi += 1;
    byKind[it.kind] = (byKind[it.kind] ?? 0) + 1;
  }

  return { pending, fromAi, byKind };
}

/** Pendientes primero y, dentro, las más antiguas: nada se queda enterrado. */
export function sortApprovals(items: ApprovalRequest[]): ApprovalRequest[] {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === "pendiente") return -1;
      if (b.status === "pendiente") return 1;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
