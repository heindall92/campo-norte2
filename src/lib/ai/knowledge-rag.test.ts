import { describe, expect, it } from "vitest";
import {
  askKnowledge,
  buildKnowledgeChunks,
  retrieveKnowledgeChunks,
} from "./knowledge-rag";
import type { KnowledgeItem } from "@/lib/demo-data";

const faq: KnowledgeItem[] = [
  {
    q: "¿Cuánto costó Mongolia 2025?",
    a: "Coste operativo demo Mongolia 2025: 120.000 €.",
    category: "margen",
    why: ["Mide margen real por ruta"],
    sources: ["Demo FAQ"],
  },
];

describe("knowledge retrieval heuristic", () => {
  it("ranks FAQ question above unrelated chunks", () => {
    const chunks = buildKnowledgeChunks({
      faq,
      reservations: [],
      invoices: [],
      expeditions: [],
      docs: [],
    });
    const top = retrieveKnowledgeChunks("coste mongolia 2025", chunks, 3);
    expect(top[0]?.id).toMatch(/^FAQ-/);
    expect(top[0]?.text).toContain("120.000");
  });

  it("askKnowledge without AI returns retrieval engine", async () => {
    const res = await askKnowledge("¿Cuánto costó Mongolia 2025?", {
      faq,
      reservations: [],
      invoices: [],
      expeditions: [],
      docs: [],
    });
    expect(res.engine).toBe("retrieval");
    expect(res.answer.toLowerCase()).toMatch(/mongolia|120\.000|heurístic|retrieval/);
    expect(res.chunksUsed.length).toBeGreaterThan(0);
  });
});
