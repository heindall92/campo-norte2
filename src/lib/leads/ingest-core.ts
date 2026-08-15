/**
 * Validación y normalización de la captura de leads.
 *
 * Node-safe (importes relativos, sin `import.meta.env`): lo usan tanto la
 * función de servidor `api/leads/ingest.ts` como los tests. Aquí no hay
 * efectos: solo validar, inferir y construir el lead.
 */

import type { Lead, LeadOrigin, RouteCode, VehicleMode } from "../demo-data.js";

export interface WebFormLeadPayload {
  name: string;
  email: string;
  phone?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  interestRoute?: RouteCode | null;
  vehicle?: VehicleMode | null;
  message?: string;
  origin?: LeadOrigin;
}

const ORIGINS: LeadOrigin[] = [
  "web_form",
  "instagram",
  "referral",
  "brevo_click",
  "feria",
  "unknown",
];

const ROUTES: RouteCode[] = [
  "MONGOLIA",
  "NAMIBIA",
  "ARGENTINA_PUNA",
  "COSTA_RICA",
  "NEPAL_MUSTANG",
  "ALASKA",
  "COLOMBIA",
  "TANZANIA",
  "CALIFORNIA",
];

/** Correo con forma razonable. No verifica que exista: eso lo dirá el rebote. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const MAX_LEN = 200;
const MAX_MESSAGE = 2_000;

function text(value: unknown, max = MAX_LEN): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export type ValidationResult =
  | { ok: true; value: WebFormLeadPayload }
  | { ok: false; error: string; field: string };

/**
 * Un formulario público es una puerta abierta: todo lo que entra es sospechoso
 * hasta que se demuestre lo contrario.
 */
export function validateLeadPayload(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "El cuerpo debe ser un objeto JSON", field: "body" };
  }
  const body = raw as Record<string, unknown>;

  const email = text(body.email).toLowerCase();
  if (!email) return { ok: false, error: "Falta el email", field: "email" };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "El email no tiene un formato válido", field: "email" };
  }

  const name = text(body.name);
  if (!name) return { ok: false, error: "Falta el nombre", field: "name" };

  const rawOrigin = text(body.origin);
  const origin = ORIGINS.includes(rawOrigin as LeadOrigin)
    ? (rawOrigin as LeadOrigin)
    : undefined;

  const rawRoute = text(body.interestRoute).toUpperCase();
  const interestRoute = ROUTES.includes(rawRoute as RouteCode)
    ? (rawRoute as RouteCode)
    : null;

  const rawVehicle = text(body.vehicle).toLowerCase();
  const vehicle: VehicleMode | null =
    rawVehicle === "moto" || rawVehicle === "4x4" ? (rawVehicle as VehicleMode) : null;

  return {
    ok: true,
    value: {
      name,
      email,
      phone: text(body.phone, 40) || undefined,
      utmSource: text(body.utmSource, 80) || undefined,
      utmCampaign: text(body.utmCampaign, 120) || undefined,
      utmMedium: text(body.utmMedium, 80) || undefined,
      interestRoute,
      vehicle,
      message: text(body.message, MAX_MESSAGE) || undefined,
      origin,
    },
  };
}

/** Traduce UTM / canal a uno de los orígenes del CRM. */
export function inferOriginFromForm(payload: WebFormLeadPayload): LeadOrigin {
  if (payload.origin) return payload.origin;
  const raw = `${payload.utmSource ?? ""} ${payload.utmMedium ?? ""}`.toLowerCase();
  if (/refer|amigo|cliente/.test(raw)) return "referral";
  if (/instagram|ig|meta|facebook|fb/.test(raw)) return "instagram";
  if (/brevo|newsletter|email|nl/.test(raw)) return "brevo_click";
  if (/feria|stand|evento/.test(raw)) return "feria";
  if (/google|web|landing|organic|cpc|form/.test(raw) || payload.utmSource) return "web_form";
  return "unknown";
}

/** Reparto por reglas: referidos y leads calientes a Sofía; el resto a Marta. */
export function pickOwner(origin: LeadOrigin, score: number): string {
  if (origin === "referral" || score >= 85) return "Sofía";
  return "Laura";
}

export function campaignFromPayload(payload: WebFormLeadPayload): string | null {
  const campaign = payload.utmCampaign?.trim();
  if (campaign) return campaign;
  return payload.utmSource ? `utm:${payload.utmSource}` : null;
}

/** Identificador estable y legible: L-<epoch36><aleatorio>. */
export function newLeadId(now: Date = new Date()): string {
  const stamp = now.getTime().toString(36).toUpperCase().slice(-6);
  const salt = Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `L-${stamp}${salt}`;
}

/** Lead nuevo a partir del formulario, todavía sin puntuar. */
export function leadFromPayload(payload: WebFormLeadPayload, now: Date = new Date()): Lead {
  const today = now.toISOString().slice(0, 10);
  return {
    id: newLeadId(now),
    name: payload.name,
    email: payload.email,
    origin: inferOriginFromForm(payload),
    campaign: campaignFromPayload(payload),
    status: "nuevo",
    score: 0,
    scoreReasons: [],
    interestRoute: payload.interestRoute ?? null,
    vehicle: payload.vehicle ?? null,
    createdAt: today,
    lastTouchAt: today,
    owner: "Sin asignar",
  };
}

/**
 * Fusión con un lead existente: el formulario nuevo aporta datos, no los borra.
 * Un segundo envío no crea ficha nueva ni pierde lo que ya sabíamos.
 */
export function mergeLead(existing: Lead, payload: WebFormLeadPayload, now: Date = new Date()): Lead {
  const origin = inferOriginFromForm(payload);
  return {
    ...existing,
    name: payload.name || existing.name,
    origin: origin !== "unknown" ? origin : existing.origin,
    campaign: campaignFromPayload(payload) ?? existing.campaign,
    interestRoute: payload.interestRoute ?? existing.interestRoute,
    vehicle: payload.vehicle ?? existing.vehicle,
    lastTouchAt: now.toISOString().slice(0, 10),
    status: existing.status === "descartado" ? "nuevo" : existing.status,
  };
}
