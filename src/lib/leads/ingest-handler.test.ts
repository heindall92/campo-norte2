/**
 * Prueba de la función de servidor `api/leads/ingest.ts` ejecutándose de verdad
 * en Node: autenticación, validación, deduplicación, cruce con la cartera,
 * scoring y escritura. Supabase se sustituye por un doble de `fetch` que habla
 * el mismo REST, así que se ejerce el camino completo sin necesitar la nube.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import handler from "../../../api/leads/ingest";
import type { Client, Lead } from "@/lib/demo-data";

const SECRET = "secreto-de-prueba";

type Json = Record<string, unknown>;

function makeRes() {
  const out: { code: number; body: unknown; headers: Record<string, string> } = {
    code: 0,
    body: null,
    headers: {},
  };
  return {
    out,
    res: {
      status(code: number) {
        out.code = code;
        return {
          json(body: unknown) {
            out.body = body;
          },
          end() {
            out.body = null;
          },
        };
      },
      setHeader(k: string, v: string) {
        out.headers[k] = v;
      },
    },
  };
}

/** Doble de Supabase REST: guarda en memoria y responde como PostgREST. */
function stubSupabase(seed: { leads?: Lead[]; clients?: Client[] } = {}) {
  const leads = new Map<string, Lead>((seed.leads ?? []).map((l) => [l.id, l]));
  const clients = seed.clients ?? [];
  const runLog: Json[] = [];

  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url.toString();
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "GET" && href.includes("/mps_leads?")) {
      const email = decodeURIComponent(href.split("eq.")[1] ?? "").split("&")[0] ?? "";
      const found = [...leads.values()].filter((l) => l.email === email);
      return new Response(JSON.stringify(found.map((l) => ({ id: l.id, payload: l }))), {
        status: 200,
      });
    }
    if (method === "GET" && href.includes("/mps_clients?")) {
      const email = decodeURIComponent(href.split("eq.")[1] ?? "").split("&")[0] ?? "";
      const found = clients.filter((c) => c.email === email);
      return new Response(JSON.stringify(found.map((c) => ({ id: c.id, payload: c }))), {
        status: 200,
      });
    }
    if (method === "POST" && href.includes("/mps_leads")) {
      const body = JSON.parse(String(init?.body)) as { id: string; payload: Lead };
      leads.set(body.id, body.payload);
      return new Response("", { status: 201 });
    }
    if (method === "POST" && href.includes("/mps_run_log")) {
      runLog.push(JSON.parse(String(init?.body)) as Json);
      return new Response("", { status: 201 });
    }
    return new Response("no encontrado", { status: 404 });
  });

  return { leads, runLog, fetchMock };
}

function baseClient(over: Partial<Client> = {}): Client {
  return {
    id: "C-1",
    name: "Marta Vidal",
    email: "marta@camponorte.demo",
    phone: "+34 600 00 00 00",
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
    ...over,
  };
}

function post(body: Json, headers: Record<string, string> = {}) {
  return {
    method: "POST",
    headers: { "x-mps-key": SECRET, "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers },
    body,
  };
}

beforeEach(() => {
  process.env.LEADS_INGEST_SECRET = SECRET;
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-de-prueba";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LEADS_INGEST_SECRET;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("POST /api/leads/ingest", () => {
  it("acepta el formulario público de la propia app (mismo origen)", async () => {
    process.env.ALLOWED_ORIGINS = "https://example.com";
    const { fetchMock, leads } = stubSupabase();
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = makeRes();

    await handler(
      {
        method: "POST",
        headers: { origin: "https://example.com", "x-forwarded-for": "10.2.2.2" },
        body: { name: "Ana", email: "form@example.com" },
      },
      res,
    );

    expect(out.code).toBe(201);
    expect(leads.size).toBe(1);
    delete process.env.ALLOWED_ORIGINS;
  });

  it("rechaza un origen que no es la app", async () => {
    process.env.ALLOWED_ORIGINS = "https://example.com";
    process.env.VERCEL_ENV = "production";
    const { fetchMock } = stubSupabase();
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = makeRes();

    await handler(
      {
        method: "POST",
        headers: { origin: "https://sitio-malo.example", "x-forwarded-for": "10.3.3.3" },
        body: { name: "Ana", email: "malo@example.com" },
      },
      res,
    );

    expect(out.code).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.VERCEL_ENV;
  });

  it("rechaza sin credencial ni origen", async () => {
    const { fetchMock } = stubSupabase();
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = makeRes();

    await handler(
      { method: "POST", headers: {}, body: { name: "Ana", email: "ana@example.com" } },
      res,
    );

    expect(out.code).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("acepta firma HMAC del cuerpo", async () => {
    const { fetchMock, leads } = stubSupabase();
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = makeRes();

    const body = { name: "Ana", email: "ana@example.com" };
    const raw = JSON.stringify(body);
    const signature = `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}`;

    await handler(
      { method: "POST", headers: { "x-mps-signature": signature, "x-forwarded-for": "10.1.1.1" }, body },
      res,
    );

    expect(out.code).toBe(201);
    expect(leads.size).toBe(1);
  });

  it("rechaza una firma que no cuadra", async () => {
    const { fetchMock } = stubSupabase();
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = makeRes();

    await handler(
      {
        method: "POST",
        headers: { "x-mps-signature": "sha256=deadbeef" },
        body: { name: "Ana", email: "ana@example.com" },
      },
      res,
    );

    expect(out.code).toBe(401);
  });

  it("rechaza un email inválido antes de tocar la base", async () => {
    const { fetchMock } = stubSupabase();
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = makeRes();

    await handler(post({ name: "Ana", email: "no-es-email" }), res);

    expect(out.code).toBe(400);
    expect(out.body).toMatchObject({ field: "email" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("crea el lead, lo puntúa y lo guarda", async () => {
    const { fetchMock, leads, runLog } = stubSupabase();
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = makeRes();

    await handler(
      post({
        name: "Elena Ruiz",
        email: "elena@example.com",
        interestRoute: "ARGENTINA_PUNA",
        vehicle: "4x4",
        utmSource: "instagram",
        utmCampaign: "stories-puna",
      }),
      res,
    );

    expect(out.code).toBe(201);
    const body = out.body as { ok: boolean; lead: { score: number; reasons: string[]; owner: string } };
    expect(body.ok).toBe(true);
    expect(body.lead.score).toBeGreaterThan(0);
    expect(body.lead.reasons.length).toBeGreaterThan(0);
    expect(body.lead.owner).toBe("Laura"); // no es referido ni supera 85

    const saved = [...leads.values()][0]!;
    expect(saved.email).toBe("elena@example.com");
    expect(saved.origin).toBe("instagram");
    expect(saved.campaign).toBe("stories-puna");
    expect(saved.score).toBe(body.lead.score);

    // Queda constancia de la ejecución: es la prueba de vida del sistema.
    expect(runLog.some((r) => r.job === "leads.ingest" && r.status === "ok")).toBe(true);
  });

  it("un cliente conocido entra con más puntuación que un desconocido", async () => {
    const conocido = stubSupabase({ clients: [baseClient({ email: "marta@camponorte.demo" })] });
    vi.stubGlobal("fetch", conocido.fetchMock);
    const a = makeRes();
    await handler(post({ name: "Marta Vidal", email: "marta@camponorte.demo" }), a.res);

    const anonimo = stubSupabase();
    vi.stubGlobal("fetch", anonimo.fetchMock);
    const b = makeRes();
    await handler(post({ name: "Nadie", email: "nadie@example.com" }), b.res);

    const scoreConocido = (a.out.body as { lead: { score: number; knownClient: boolean } }).lead;
    const scoreAnonimo = (b.out.body as { lead: { score: number } }).lead;

    expect(scoreConocido.knownClient).toBe(true);
    expect(scoreConocido.score).toBeGreaterThan(scoreAnonimo.score);
  });

  it("un segundo envío del mismo email fusiona en vez de duplicar", async () => {
    const existing: Lead = {
      id: "L-YA",
      name: "Ana",
      email: "ana@example.com",
      origin: "unknown",
      campaign: null,
      status: "en_contacto",
      score: 50,
      scoreReasons: [],
      interestRoute: "NAMIBIA",
      vehicle: null,
      createdAt: "2026-07-01",
      lastTouchAt: "2026-07-01",
      owner: "Laura",
    };
    const { fetchMock, leads } = stubSupabase({ leads: [existing] });
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = makeRes();

    await handler(
      post({ name: "Ana Beltrán", email: "ana@example.com", vehicle: "moto", utmSource: "brevo" }),
      res,
    );

    expect(out.code).toBe(200);
    expect(out.body).toMatchObject({ merged: true });
    expect(leads.size).toBe(1); // no se ha creado ficha nueva
    const saved = leads.get("L-YA")!;
    expect(saved.name).toBe("Ana Beltrán");
    expect(saved.interestRoute).toBe("NAMIBIA"); // lo que ya sabíamos, intacto
    expect(saved.vehicle).toBe("moto"); // lo nuevo, añadido
    expect(saved.status).toBe("en_contacto"); // el trabajo del equipo, respetado
  });

  it("si la base falla responde 503 con Retry-After, sin perder el lead en silencio", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = typeof url === "string" ? url : url.toString();
      if (href.includes("mps_run_log")) return new Response("", { status: 201 });
      throw new Error("conexión rechazada");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = makeRes();

    await handler(post({ name: "Ana", email: "ana@example.com" }), res);

    expect(out.code).toBe(503);
    expect(out.headers["Retry-After"]).toBe("30");
  });

  it("no acepta métodos que no sean POST", async () => {
    const { res, out } = makeRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(out.code).toBe(405);
  });
});
