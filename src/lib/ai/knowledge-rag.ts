import {
  EXPEDITIONS,
  KNOWLEDGE_ANSWERS,
  ROUTE_LABEL,
  type Client,
  type Expedition,
  type KnowledgeItem,
} from "@/lib/demo-data";
import type { Invoice, Reservation } from "@/lib/ops-data";
import { aiChat, parseJsonFromModel } from "./chat";
import { aiChatStream } from "./chat-stream";
import {
  KNOWLEDGE_KIND_LABEL,
  loadKnowledgeDocs,
  type KnowledgeDoc,
} from "./knowledge-store";
import { aiReady, loadAiSettings, providerLabel } from "./settings";

export interface KnowledgeChunk {
  id: string;
  title: string;
  text: string;
  sourceLabel: string;
  kind: string;
  score?: number;
}

export interface KnowledgeAskResult {
  answer: string;
  sources: string[];
  chunksUsed: KnowledgeChunk[];
  /** ai = sintetizó con proveedor activo; retrieval = heurística extractiva local */
  engine: "ai" | "retrieval";
  /** Nombre del proveedor si engine === "ai" */
  provider?: string;
  why: string[];
}

export interface KnowledgeCorpusInput {
  docs?: KnowledgeDoc[];
  reservations?: Reservation[];
  invoices?: Invoice[];
  clients?: Client[];
  expeditions?: Expedition[];
  faq?: KnowledgeItem[];
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9áéíóúñü€%]+/i)
    .filter((t) => t.length > 2);
}

function scoreChunk(queryTokens: string[], chunk: KnowledgeChunk): number {
  const hay = tokenize(`${chunk.title} ${chunk.text} ${chunk.sourceLabel} ${chunk.kind}`);
  if (!hay.length || !queryTokens.length) return 0;
  const set = new Set(hay);
  let hits = 0;
  for (const t of queryTokens) {
    if (set.has(t)) hits += 1;
    else if (hay.some((h) => h.includes(t) || t.includes(h))) hits += 0.4;
  }
  const density = hits / queryTokens.length;
  const titleBoost = tokenize(chunk.title).some((t) => queryTokens.includes(t)) ? 0.25 : 0;
  // Playbook FAQ: boost if the question title overlaps a lot
  const faqBoost = chunk.id.startsWith("FAQ-") && titleBoost ? 0.35 : 0;
  return density + titleBoost + faqBoost;
}

export function buildKnowledgeChunks(input: KnowledgeCorpusInput = {}): KnowledgeChunk[] {
  const docs = input.docs ?? loadKnowledgeDocs();
  const reservations = input.reservations ?? [];
  const invoices = input.invoices ?? [];
  const expeditions = input.expeditions ?? EXPEDITIONS;
  const faq = input.faq ?? KNOWLEDGE_ANSWERS;
  const chunks: KnowledgeChunk[] = [];

  for (const d of docs) {
    chunks.push({
      id: d.id,
      title: d.title,
      text: d.content,
      sourceLabel: d.fileRef
        ? `${KNOWLEDGE_KIND_LABEL[d.kind]} · ${d.fileRef}`
        : KNOWLEDGE_KIND_LABEL[d.kind],
      kind: d.kind,
    });
  }

  for (const e of expeditions) {
    const margin = e.revenue > 0 ? ((e.revenue - e.cost) / e.revenue) * 100 : 0;
    chunks.push({
      id: `EXP-${e.id}`,
      title: `Expedición Hub · ${e.name}`,
      text: [
        `Ruta: ${ROUTE_LABEL[e.route]} (${e.route}).`,
        `Salida: ${e.departureAt}. Vehículo: ${e.vehicle}.`,
        `Ocupación: ${e.booked}/${e.seats}.`,
        `Ingresos: ${e.revenue.toLocaleString("es-ES")} € · Coste: ${e.cost.toLocaleString("es-ES")} €.`,
        `Margen bruto: ${margin.toFixed(1)} %.`,
      ].join(" "),
      sourceLabel: `Data Hub · Expedición ${e.id}`,
      kind: "historico",
    });
  }

  for (const r of reservations) {
    const lodges = r.itinerary.map((s) => `${s.day} ${s.place}: ${s.lodging}`).join("; ");
    const suppliers = r.logisticsContacts
      .map((c) => `${c.role}: ${c.name}${c.email ? ` <${c.email}>` : ""}`)
      .join("; ");
    chunks.push({
      id: `RES-${r.id}`,
      title: `Reserva ${r.id} · ${r.tripName}`,
      text: [
        `Cliente: ${r.clientName}. Ruta ${ROUTE_LABEL[r.route]}. Estado ${r.status}.`,
        `Importe ${r.totalAmount} € · depósito ${r.depositPaid} € · salida ${r.departureAt}.`,
        `Tour leader: ${r.tourLeader}.`,
        `Hoteles/lodges: ${lodges || "—"}.`,
        `Proveedores/contactos: ${suppliers || "—"}.`,
        `Notas internas: ${r.internalNotes}`,
      ].join(" "),
      sourceLabel: `Data Hub · Reserva ${r.id}`,
      kind: "hotel",
    });
  }

  for (const inv of invoices) {
    chunks.push({
      id: `INV-${inv.id}`,
      title: `Factura ${inv.number} · ${inv.expedition}`,
      text: [
        `Cliente ${inv.clientName} (${inv.clientNif}).`,
        `Base REAV ${inv.taxBase} € · IVA ${inv.vatAmount} € · Total ${inv.total} €.`,
        `Estado ${inv.status} · cobrado ${inv.amountCollected} € · régimen ${inv.regime}.`,
        `Fecha operación ${inv.operationDate}.`,
      ].join(" "),
      sourceLabel: `Data Hub · Factura ${inv.number}`,
      kind: "historico",
    });
  }

  for (const [i, k] of faq.entries()) {
    chunks.push({
      id: `FAQ-${i}`,
      title: k.q,
      text: `${k.a}\nPor qué importa: ${k.why.join(" · ")}`,
      sourceLabel: `Playbook · ${k.sources.join(", ")}`,
      kind: k.category,
    });
  }

  return chunks;
}

export function retrieveKnowledgeChunks(
  question: string,
  chunks: KnowledgeChunk[],
  topK = 6,
): KnowledgeChunk[] {
  const qTokens = tokenize(question);
  const ranked = chunks
    .map((c) => ({ ...c, score: scoreChunk(qTokens, c) }))
    .filter((c) => (c.score ?? 0) > 0.05)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (ranked.length >= Math.min(3, topK)) return ranked.slice(0, topK);

  return (ranked.length ? ranked : chunks.slice(0, topK)).slice(0, topK);
}

/** Heurística: respuesta extractiva sin LLM (siempre disponible). */
function synthesizeHeuristic(question: string, top: KnowledgeChunk[]): KnowledgeAskResult {
  if (!top.length) {
    return {
      answer:
        "No encontré nada en la base documental ni en el Hub para esa pregunta. Añade un documento en «Base documental» o completa reservas/expediciones.",
      sources: [],
      chunksUsed: [],
      engine: "retrieval",
      why: [
        "Sin contexto indexado el asistente no inventa cifras",
        "Activa la IA en Ajustes solo ayuda a redactar mejor — no inventa datos que no existan",
      ],
    };
  }

  const best = top[0];
  const isFaq = best.id.startsWith("FAQ-");
  const extras = top.slice(1, 3).map((c) => `• ${c.title}: ${c.text.slice(0, 220)}…`);

  return {
    answer: [
      isFaq
        ? `Respuesta del playbook (heurística, sin IA):`
        : `Según la base documental + Hub (heurística / retrieval, sin IA):`,
      ``,
      best.text,
      extras.length ? `\nTambién relevante:\n${extras.join("\n")}` : "",
      `\nPregunta: «${question}»`,
      `\nTip: si activas IA en Ajustes, la misma búsqueda se resume en lenguaje más claro.`,
    ]
      .filter(Boolean)
      .join("\n"),
    sources: top.map((c) => c.sourceLabel),
    chunksUsed: top,
    engine: "retrieval",
    why: [
      "Primero se buscan fragmentos (docs, playbook, reservas, facturas)",
      "Sin IA: se muestra el mejor fragmento tal cual — no se inventa nada",
      "Solo equipo interno — nunca se envía al viajero",
    ],
  };
}

async function synthesizeWithAi(
  question: string,
  top: KnowledgeChunk[],
): Promise<KnowledgeAskResult> {
  const settings = loadAiSettings();
  const label = providerLabel(settings);
  const context = top
    .map(
      (c, i) =>
        `[#${i + 1}] ${c.title}\nFuente: ${c.sourceLabel}\n${c.text.slice(0, 1200)}`,
    )
    .join("\n\n");

  const { content } = await aiChat(
    [
      {
        role: "system",
        content: [
          "Eres el Knowledge Assistant interno de Campo Norte (solo equipo).",
          "Responde en español con hechos del CONTEXTO. Si no está en el contexto, dilo claramente («no está en el sistema»).",
          "PROHIBIDO redactar mensajes al cliente o inventar hoteles/márgenes no citados.",
          "Devuelve JSON: answer (string), sources (array de strings de fuentes usadas), why (array de 2-3 razones de por qué importa al CEO).",
        ].join(" "),
      },
      {
        role: "user",
        content: `Pregunta del equipo:\n${question}\n\nCONTEXTO INDEXADO (RAG):\n${context || "(sin fragmentos — dilo si falta dato)"}`,
      },
    ],
    {
      settings,
      format: {
        type: "object",
        properties: {
          answer: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
          why: { type: "array", items: { type: "string" } },
        },
        required: ["answer", "sources"],
      },
    },
  );

  const raw = parseJsonFromModel(content) as Record<string, unknown>;
  const answer =
    typeof raw.answer === "string" && raw.answer.trim()
      ? raw.answer.trim()
      : content.trim();
  const sources = Array.isArray(raw.sources)
    ? (raw.sources as unknown[]).map(String)
    : top.map((c) => c.sourceLabel);
  const why = Array.isArray(raw.why)
    ? (raw.why as unknown[]).map(String)
    : [`Respuesta sintetizada con ${label} sobre fragmentos indexados`];

  return {
    answer,
    sources: sources.length ? sources : top.map((c) => c.sourceLabel),
    chunksUsed: top,
    engine: "ai",
    provider: label,
    why,
  };
}

/**
 * Pregunta al Knowledge Assistant.
 * Flujo fijo:
 * 1) Heurística / retrieval busca fragmentos (siempre).
 * 2) Si hay IA activa (Ajustes) → sintetiza con el proveedor; si falla → heurística.
 * 3) Si no hay IA → solo heurística.
 */
export async function askKnowledge(
  question: string,
  input: KnowledgeCorpusInput = {},
): Promise<KnowledgeAskResult> {
  const q = question.trim();
  if (!q) {
    return {
      answer: "Escribe una pregunta (ej. «¿Cuánto costó Mongolia 2025?»).",
      sources: [],
      chunksUsed: [],
      engine: "retrieval",
      why: [],
    };
  }

  const chunks = buildKnowledgeChunks(input);
  const top = retrieveKnowledgeChunks(q, chunks, 6);

  if (aiReady()) {
    try {
      return await synthesizeWithAi(q, top);
    } catch (err) {
      const fallback = synthesizeHeuristic(q, top);
      const detail = err instanceof Error ? err.message.slice(0, 120) : "error";
      return {
        ...fallback,
        why: [
          ...fallback.why,
          `IA no disponible (${detail}) — se usó heurística / retrieval`,
        ],
      };
    }
  }

  return synthesizeHeuristic(q, top);
}

/**
 * Misma pipeline que askKnowledge, pero la síntesis IA va en streaming
 * (texto libre; fuentes = fragmentos RAG). Heurística no streamea.
 */
export async function askKnowledgeStream(
  question: string,
  input: KnowledgeCorpusInput = {},
  onToken?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<KnowledgeAskResult> {
  const q = question.trim();
  if (!q) {
    return {
      answer: "Escribe una pregunta (ej. «¿Cuánto costó Mongolia 2025?»).",
      sources: [],
      chunksUsed: [],
      engine: "retrieval",
      why: [],
    };
  }

  const chunks = buildKnowledgeChunks(input);
  const top = retrieveKnowledgeChunks(q, chunks, 6);

  if (!aiReady()) {
    const h = synthesizeHeuristic(q, top);
    onToken?.(h.answer);
    return h;
  }

  try {
    const settings = loadAiSettings();
    const label = providerLabel(settings);
    const context = top
      .map(
        (c, i) =>
          `[#${i + 1}] ${c.title}\nFuente: ${c.sourceLabel}\n${c.text.slice(0, 900)}`,
      )
      .join("\n\n");

    const { content } = await aiChatStream(
      [
        {
          role: "system",
          content: [
            "Eres el Knowledge Assistant interno de Campo Norte (solo equipo).",
            "Responde en español, breve (bullets o tabla). Solo hechos del CONTEXTO.",
            "Si no está en el contexto, dilo («no está en el sistema»).",
            "PROHIBIDO redactar mensajes al viajero o inventar datos.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Pregunta:\n${question}\n\nCONTEXTO:\n${context || "(vacío)"}`,
        },
      ],
      { settings, onToken, signal },
    );

    return {
      answer: content.trim(),
      sources: top.map((c) => c.sourceLabel),
      chunksUsed: top,
      engine: "ai",
      provider: label,
      why: [
        `Síntesis en streaming con ${label}`,
        "Fuentes = fragmentos RAG del Hub + docs",
        "Solo equipo — nunca al viajero",
      ],
    };
  } catch (err) {
    const fallback = synthesizeHeuristic(q, top);
    onToken?.(fallback.answer);
    const detail = err instanceof Error ? err.message.slice(0, 120) : "error";
    return {
      ...fallback,
      why: [
        ...fallback.why,
        `IA stream no disponible (${detail}) — heurística`,
      ],
    };
  }
}
