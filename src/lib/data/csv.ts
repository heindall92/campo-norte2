import type { Client, Lead, LeadOrigin, LeadStatus, RouteCode, VehicleMode } from "@/lib/demo-data";
import type { ImportResult } from "./types";
import { blankLead } from "./seed";
import { blankClient } from "@/components/ClientFormModal";

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };

  const delim = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";

  function splitLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function col(headers: string[], row: string[], ...names: string[]): string {
  for (const name of names) {
    const idx = headers.indexOf(name.toLowerCase());
    if (idx >= 0 && row[idx] != null && row[idx] !== "") return row[idx];
  }
  return "";
}

function escapeCsv(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const ORIGINS = new Set<LeadOrigin>([
  "web_form",
  "instagram",
  "referral",
  "brevo_click",
  "feria",
  "unknown",
]);

const STATUSES = new Set<LeadStatus>([
  "nuevo",
  "en_contacto",
  "cualificado",
  "reservado",
  "descartado",
]);

function asOrigin(v: string): LeadOrigin {
  const key = v.trim().toLowerCase().replace(/\s+/g, "_") as LeadOrigin;
  return ORIGINS.has(key) ? key : "unknown";
}

function asStatus(v: string): LeadStatus {
  const key = v.trim().toLowerCase().replace(/\s+/g, "_") as LeadStatus;
  return STATUSES.has(key) ? key : "nuevo";
}

function asRoute(v: string): RouteCode | null {
  if (!v.trim()) return null;
  return v.trim().toUpperCase().replace(/\s+/g, "_") as RouteCode;
}

function asVehicle(v: string): VehicleMode | null {
  const x = v.trim().toLowerCase();
  if (x === "moto" || x === "4x4") return x;
  return null;
}

/** CSV leads: id,name,email,origin,campaign,status,score,interest_route,vehicle,owner,created_at */
export function importLeadsFromCsv(text: string, existing: Lead[]): ImportResult & { leads: Lead[] } {
  const { headers, rows } = parseCsv(text);
  const errors: string[] = [];
  if (!headers.length) {
    return { added: 0, updated: 0, leads: existing, errors: ["CSV vacío o sin cabecera"] };
  }

  const byId = new Map(existing.map((l) => [l.id, l]));
  const byEmail = new Map(existing.map((l) => [l.email.toLowerCase(), l]));
  let added = 0;
  let updated = 0;

  rows.forEach((row, i) => {
    const line = i + 2;
    const email = col(headers, row, "email", "correo", "mail");
    const name = col(headers, row, "name", "nombre");
    if (!email && !name) {
      errors.push(`Línea ${line}: falta name/email`);
      return;
    }

    const id = col(headers, row, "id") || undefined;
    const prev =
      (id && byId.get(id)) || (email ? byEmail.get(email.toLowerCase()) : undefined);

    const base = prev ? { ...prev } : blankLead();
    if (id) base.id = id;
    if (name) base.name = name;
    if (email) base.email = email;
    const origin = col(headers, row, "origin", "origen", "utm_source");
    if (origin) base.origin = asOrigin(origin);
    const campaign = col(headers, row, "campaign", "campaña", "campana", "utm_campaign");
    base.campaign = campaign || null;
    const status = col(headers, row, "status", "estado");
    if (status) base.status = asStatus(status);
    const score = col(headers, row, "score");
    if (score) base.score = Number(score) || base.score;
    const route = col(headers, row, "interest_route", "destino", "route");
    if (route) base.interestRoute = asRoute(route);
    const vehicle = col(headers, row, "vehicle", "vehiculo", "vehículo");
    if (vehicle) base.vehicle = asVehicle(vehicle);
    const owner = col(headers, row, "owner", "responsable");
    if (owner) base.owner = owner;
    const created = col(headers, row, "created_at", "fecha", "created");
    if (created) base.createdAt = created.slice(0, 10);
    base.lastTouchAt = new Date().toISOString().slice(0, 10);
    if (!prev) {
      base.scoreReasons = [
        base.origin === "unknown"
          ? "Importado sin origen — completar UTM/canal"
          : `Importado · origen ${base.origin}`,
      ];
    }

    byId.set(base.id, base);
    byEmail.set(base.email.toLowerCase(), base);
    if (prev) updated++;
    else added++;
  });

  return { added, updated, errors, leads: [...byId.values()] };
}

/** CSV clients: id,name,email,phone,city,country,dni,segment,status,owner */
export function importClientsFromCsv(
  text: string,
  existing: Client[],
): ImportResult & { clients: Client[] } {
  const { headers, rows } = parseCsv(text);
  const errors: string[] = [];
  if (!headers.length) {
    return { added: 0, updated: 0, clients: existing, errors: ["CSV vacío o sin cabecera"] };
  }

  const byId = new Map(existing.map((c) => [c.id, c]));
  const byEmail = new Map(existing.map((c) => [c.email.toLowerCase(), c]));
  let added = 0;
  let updated = 0;

  rows.forEach((row, i) => {
    const line = i + 2;
    const email = col(headers, row, "email", "correo");
    const name = col(headers, row, "name", "nombre");
    if (!email && !name) {
      errors.push(`Línea ${line}: falta name/email`);
      return;
    }
    const id = col(headers, row, "id") || undefined;
    const prev =
      (id && byId.get(id)) || (email ? byEmail.get(email.toLowerCase()) : undefined);
    const base = prev ? { ...prev } : blankClient();
    if (id) base.id = id;
    if (name) base.name = name;
    if (email) base.email = email;
    const phone = col(headers, row, "phone", "telefono", "teléfono", "móvil", "movil");
    if (phone) base.phone = phone;
    const city = col(headers, row, "city", "ciudad");
    if (city) base.city = city;
    const country = col(headers, row, "country", "pais", "país");
    if (country) base.country = country;
    const dni = col(headers, row, "dni", "nif", "pasaporte");
    if (dni) base.dni = dni;
    const segment = col(headers, row, "segment", "segmento");
    if (segment) base.segment = segment as Client["segment"];
    const status = col(headers, row, "status", "estado");
    if (status) base.status = status as Client["status"];
    const owner = col(headers, row, "owner", "responsable");
    if (owner) base.owner = owner;
    const notes = col(headers, row, "notes", "notas");
    if (notes) base.notes = notes;
    const ltv = col(headers, row, "ltv");
    if (ltv) base.ltv = Number(ltv) || base.ltv;

    byId.set(base.id, base);
    byEmail.set(base.email.toLowerCase(), base);
    if (prev) updated++;
    else added++;
  });

  return { added, updated, errors, clients: [...byId.values()] };
}

export function exportLeadsCsv(leads: Lead[]): string {
  const header = [
    "id",
    "name",
    "email",
    "origin",
    "campaign",
    "status",
    "score",
    "interest_route",
    "vehicle",
    "owner",
    "created_at",
    "last_touch_at",
  ];
  const rows = leads.map((l) =>
    [
      l.id,
      l.name,
      l.email,
      l.origin,
      l.campaign,
      l.status,
      l.score,
      l.interestRoute,
      l.vehicle,
      l.owner,
      l.createdAt,
      l.lastTouchAt,
    ]
      .map(escapeCsv)
      .join(";"),
  );
  return [header.join(";"), ...rows].join("\n");
}

export function exportClientsCsv(clients: Client[]): string {
  const header = [
    "id",
    "name",
    "email",
    "phone",
    "city",
    "country",
    "dni",
    "segment",
    "status",
    "ltv",
    "owner",
    "notes",
  ];
  const rows = clients.map((c) =>
    [
      c.id,
      c.name,
      c.email,
      c.phone,
      c.city,
      c.country,
      c.dni,
      c.segment,
      c.status,
      c.ltv,
      c.owner,
      c.notes,
    ]
      .map(escapeCsv)
      .join(";"),
  );
  return [header.join(";"), ...rows].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
