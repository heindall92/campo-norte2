/** Base documental Knowledge (Fase 5). Registro interno — no es chat al cliente. */

export type KnowledgeDocKind =
  | "pdf"
  | "ruta"
  | "precio"
  | "coste"
  | "contrato"
  | "hotel"
  | "proveedor"
  | "historico"
  | "otro";

export interface KnowledgeDoc {
  id: string;
  title: string;
  kind: KnowledgeDocKind;
  /** Texto indexable (pegar extracto de PDF / ficha) */
  content: string;
  /** Etiqueta de archivo o ref externa */
  fileRef?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source: "seed" | "manual" | "hub";
}

export const KNOWLEDGE_DOCS_KEY = "mps-knowledge-docs-v1";

export const KNOWLEDGE_KIND_LABEL: Record<KnowledgeDocKind, string> = {
  pdf: "PDF",
  ruta: "Ruta",
  precio: "Precios",
  coste: "Costes",
  contrato: "Contrato",
  hotel: "Hotel",
  proveedor: "Proveedor",
  historico: "Histórico",
  otro: "Otro",
};

export const SEED_KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    id: "KD-MN-2025-COST",
    title: "Mongolia 2025 · cierre de costes",
    kind: "coste",
    fileRef: "Mongolia_2025_costes.pdf",
    tags: ["mongolia", "2025", "coste", "margen"],
    source: "seed",
    createdAt: "2025-10-02T10:00:00.000Z",
    updatedAt: "2025-10-02T10:00:00.000Z",
    content: [
      "Expedición Mongolia Chinggis Khan 2025 (moto).",
      "Ingresos brutos: 81.600 € (12 plazas × 6.800 €).",
      "Coste total cerrado: 55.200 € (operador local + hoteles UB + ger camps + mecánico + transfers + seguros grupo).",
      "Margen bruto: 26.400 € ≈ 32,4 %.",
      "Desglose costes: Bat-Erdene Travel 28.400 €; Kempinski Khan Palace (D0–D1) 6.200 €; Ger camps Terelj/Gorkhi 9.800 €; mecánico/spares 3.100 €; transfers aeropuerto 1.900 €; resto contingencia 5.800 €.",
      "Nota: cifra 2025 distinta de la expedición sep 2026 (E-26-05) aún abierta.",
    ].join("\n"),
  },
  {
    id: "KD-NA-HOTELS",
    title: "Namibia · hoteles y lodges usados",
    kind: "hotel",
    fileRef: "Namibia_lodges_ficha.pdf",
    tags: ["namibia", "hotel", "lodge", "ops"],
    source: "seed",
    createdAt: "2024-06-15T10:00:00.000Z",
    updatedAt: "2026-01-08T10:00:00.000Z",
    content: [
      "Hoteles / lodges estándar Namibia (paraíso África):",
      "Windhoek base: Hilton Windhoek (grupos) — contacto bookings@deserttrack.example.",
      "Sossusvlei: Desert Quiver Camp / lodge desierto — pensión media.",
      "Swakopmund: Strand Hotel Swakopmund — noche costa.",
      "Etosha: Okaukuejo / Halali (SANParks) según cupo año.",
      "Operador local: Desert Track Safaris.",
      "Regla: no cambiar lodge base sin validar Marta (margen y seguro).",
    ].join("\n"),
  },
  {
    id: "KD-AK-MARGIN",
    title: "Alaska · margen medio histórico",
    kind: "historico",
    fileRef: "Alaska_margen_2019-2025.xlsx",
    tags: ["alaska", "margen", "historico", "prudhoe"],
    source: "seed",
    createdAt: "2025-12-01T10:00:00.000Z",
    updatedAt: "2025-12-01T10:00:00.000Z",
    content: [
      "Alaska Prudhoe Bay — margen medio 2019–2025 (demo cerrado): 28,7 %.",
      "Última salida 2025: ingresos 74.400 € · coste 53.100 € · margen 28,6 % · ocupación 12/12.",
      "Ticket medio histórico ≈ 6.200 €. Coste medio/plaza ≈ 4.425 €.",
      "Sensibilidad: combustible y ferry encarecen 3–5 pp si no se cierra con 10+ meses.",
      "Objetivo casa ~30 %: Alaska está ligeramente por debajo — vigilar coste operador.",
    ].join("\n"),
  },
  {
    id: "KD-CONTRACT-BAT",
    title: "Contrato marco Bat-Erdene Travel (Mongolia)",
    kind: "contrato",
    fileRef: "Contrato_BatErdene_2025.pdf",
    tags: ["mongolia", "contrato", "proveedor"],
    source: "seed",
    createdAt: "2025-02-10T10:00:00.000Z",
    updatedAt: "2025-02-10T10:00:00.000Z",
    content: [
      "Proveedor: Bat-Erdene Travel · Ulaanbaatar.",
      "Incluye: pick-up aeropuerto, briefing D0, guías locales, logística ger camps, soporte mecánico coordinación.",
      "Pago: 40 % señal / 60 % 30 días antes de salida.",
      "Cancelación: según anexo — consultar Marta antes de confirmar cambio de fechas.",
      "Contacto ops: ops@baterdene.mn · +976 9900 1122.",
    ].join("\n"),
  },
  {
    id: "KD-PRICES-2026",
    title: "Tarifas públicas orientativas 2026",
    kind: "precio",
    fileRef: "Tarifas_2026.pdf",
    tags: ["precio", "2026", "ruta"],
    source: "seed",
    createdAt: "2026-01-15T10:00:00.000Z",
    updatedAt: "2026-01-15T10:00:00.000Z",
    content: [
      "Precios orientativos / persona (validar Marta antes de publicar):",
      "Mongolia moto ≈ 6.800 € · Namibia 4x4 ≈ 7.200 € · Alaska moto ≈ 6.200 €.",
      "Colombia Coffee Tour ≈ 5.400 € · Tanzania Big Five ≈ 6.500 €.",
      "Objetivo margen ~30 %. Knowledge informa; veto de precio es humano.",
    ].join("\n"),
  },
];

export function loadKnowledgeDocs(): KnowledgeDoc[] {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_DOCS_KEY);
    if (!raw) {
      localStorage.setItem(KNOWLEDGE_DOCS_KEY, JSON.stringify(SEED_KNOWLEDGE_DOCS));
      return structuredClone(SEED_KNOWLEDGE_DOCS);
    }
    const parsed = JSON.parse(raw) as KnowledgeDoc[];
    return Array.isArray(parsed) && parsed.length ? parsed : structuredClone(SEED_KNOWLEDGE_DOCS);
  } catch {
    return structuredClone(SEED_KNOWLEDGE_DOCS);
  }
}

export function saveKnowledgeDocs(docs: KnowledgeDoc[]): void {
  localStorage.setItem(KNOWLEDGE_DOCS_KEY, JSON.stringify(docs));
}

export function upsertKnowledgeDoc(
  docs: KnowledgeDoc[],
  input: Omit<KnowledgeDoc, "id" | "createdAt" | "updatedAt" | "source"> & {
    id?: string;
    source?: KnowledgeDoc["source"];
  },
): KnowledgeDoc[] {
  const now = new Date().toISOString();
  if (input.id) {
    return docs.map((d) =>
      d.id === input.id
        ? {
            ...d,
            title: input.title,
            kind: input.kind,
            content: input.content,
            fileRef: input.fileRef,
            tags: input.tags,
            updatedAt: now,
          }
        : d,
    );
  }
  const doc: KnowledgeDoc = {
    id: `KD-${Date.now().toString(36).toUpperCase()}`,
    title: input.title,
    kind: input.kind,
    content: input.content,
    fileRef: input.fileRef,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
    source: input.source ?? "manual",
  };
  return [doc, ...docs];
}

export function deleteKnowledgeDoc(docs: KnowledgeDoc[], id: string): KnowledgeDoc[] {
  return docs.filter((d) => d.id !== id);
}
