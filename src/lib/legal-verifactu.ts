/**
 * Marco legal Veri*FACTU / facturación agencia de viajes (ES).
 * Citas para demo interna y paquete de exportación a gestoría.
 * No sustituye asesoramiento fiscal: validar con gestoría de Campo Norte.
 */

export interface LegalCitation {
  id: string;
  short: string;
  title: string;
  boe?: string;
  articles: string[];
  why: string;
}

/** Bloque normativo que respalda el módulo Facturas / Veri*FACTU */
export const LEGAL_CITATIONS: LegalCitation[] = [
  {
    id: "LGT-29-2-j",
    short: "LGT art. 29.2.j)",
    title: "Ley 58/2003, de 17 de diciembre, General Tributaria",
    boe: "BOE-A-2003-23186 (redacción Ley 11/2021)",
    articles: [
      "Art. 29.2.j) — obligación de que los sistemas informáticos de facturación garanticen integridad, conservación, accesibilidad, legibilidad, trazabilidad e inalterabilidad de los registros.",
    ],
    why: "Base legal de la obligación de SIF / Veri*FACTU (anti ‘software de doble uso’).",
  },
  {
    id: "LEY-ANTIFRAUDE",
    short: "Ley 11/2021",
    title: "Ley 11/2021, de 9 de julio, de medidas de prevención y lucha contra el fraude fiscal",
    boe: "BOE-A-2021-11473",
    articles: [
      "Introduce / refuerza el art. 29.2.j) LGT sobre sistemas informáticos de facturación.",
    ],
    why: "Origen de la ‘ley antifraude’ que obliga a adaptar el software de facturación.",
  },
  {
    id: "RD-1007-2023",
    short: "RD 1007/2023 (RRSIF)",
    title:
      "Real Decreto 1007/2023, de 5 de diciembre — Reglamento de requisitos de sistemas informáticos de facturación (RRSIF / Veri*FACTU)",
    boe: "BOE-A-2023-24840",
    articles: [
      "Arts. 7–8 — requisitos de los SIF y de los registros de facturación (hash encadenado, firma, inalterabilidad).",
      "Art. 14 y ss. — sistemas de emisión de facturas verificables (VERI*FACTU) y remisión a la AEAT.",
      "Disposición adicional segunda — Agencias de viajes: requisitos del art. 8 exigibles a las agencias que expidan facturas (casos DA 4ª Reglamento de facturación).",
    ],
    why: "Reglamento técnico Veri*FACTU. La DA 2ª menciona expresamente a las agencias de viajes.",
  },
  {
    id: "OM-HAC-1177-2024",
    short: "Orden HAC/1177/2024",
    title:
      "Orden HAC/1177/2024, de 17 de octubre — especificaciones técnicas de los SIF / registros de facturación",
    boe: "BOE (Orden HAC/1177/2024)",
    articles: [
      "Anexo · listas L8A / L8B — campo ClaveRegimen.",
      "Valor 05 = Régimen especial de las agencias de viajes (IVA e IGIC).",
    ],
    why: "Define cómo etiquetar REAV en el registro Veri*FACTU (clave 05).",
  },
  {
    id: "RD-LEY-15-2025",
    short: "RD-ley 15/2025",
    title:
      "Real Decreto-ley 15/2025 — aplazamiento de obligatoriedad RRSIF / Veri*FACTU",
    articles: [
      "Obligados IS: sistemas adaptados antes del 1 de enero de 2027.",
      "Resto de obligados art. 3.1 RRSIF (p. ej. IRPF actividades económicas): antes del 1 de julio de 2027.",
      "Periodo anterior = ventana de preparación / pruebas.",
    ],
    why: "Calendario real de entrada en vigor (aplazado respecto a 2026).",
  },
  {
    id: "REAV-LIVA",
    short: "LIVA arts. 141–147",
    title: "Ley 37/1992, de 28 de diciembre, del IVA — Régimen especial de agencias de viajes (REAV)",
    boe: "BOE-A-1992-28740",
    articles: [
      "Arts. 141–147 — ámbito, base imponible (margen), tipo y particularidades de facturación REAV.",
    ],
    why: "Régimen IVA típico de agencia/organizador de circuitos cuando vende en nombre propio con proveedores ajenos.",
  },
  {
    id: "RD-1619-2012",
    short: "RD 1619/2012",
    title: "Real Decreto 1619/2012 — Reglamento de obligaciones de facturación",
    boe: "BOE-A-2012-14696",
    articles: [
      "Contenido mínimo de factura, plazos, facturas rectificativas.",
      "Disposición adicional cuarta — supuestos especiales (relevantes para agencias / facturación por cuenta).",
      "Art. 16 — recibos en determinados supuestos del régimen especial.",
    ],
    why: "Qué debe contener la factura y cómo se emite/rectifica; enlace con DA 2ª del RD 1007/2023.",
  },
  {
    id: "AEAT-REAV-SII",
    short: "AEAT · Clave 05 REAV",
    title: "Criterio AEAT — Libro registro / facturas emitidas bajo REAV",
    articles: [
      "Clave régimen especial / trascendencia = 05 (REAV).",
      "Operaciones sujetas no exentas: calificación S1; base = margen; tipo y cuota coherentes; importe total de factura.",
      "Exentas: clave E6 cuando proceda; importe total y base exenta = contraprestación.",
      "Facturas mixtas régimen general + REAV: claves 01 y 05 (primera 05).",
    ],
    why: "Detalle operativo para gestoría y para el XML / registro Veri*FACTU.",
  },
];

export const VERIFACTU_CHECKLIST = [
  {
    id: "sif",
    item: "SIF certificado / conforme RRSIF (integridad, hash, inalterabilidad)",
    legalRef: "RD 1007/2023 arts. 7–8 · LGT 29.2.j)",
  },
  {
    id: "reav05",
    item: "ClaveRegimen = 05 en operaciones REAV",
    legalRef: "Orden HAC/1177/2024 L8A/L8B · AEAT FAQ REAV",
  },
  {
    id: "mención",
    item: "Mención en factura: «Régimen especial de las agencias de viajes» cuando aplique REAV",
    legalRef: "LIVA 141–147 · RD 1619/2012",
  },
  {
    id: "remision",
    item: "Modo Veri*FACTU: remisión automática de registros a AEAT (o SIF no Veri*FACTU con requisitos equivalentes)",
    legalRef: "RD 1007/2023 art. 14 y ss.",
  },
  {
    id: "rectificativa",
    item: "Facturas rectificativas trazables (sin borrar el registro original)",
    legalRef: "RD 1619/2012 · RRSIF inalterabilidad",
  },
  {
    id: "export",
    item: "Exportación periódica a gestoría: CSV/XML + libro de facturas + pagos conciliados",
    legalRef: "Buenas prácticas + obligaciones de conservación LGT",
  },
  {
    id: "plazo",
    item: "Deadline IS: 01/01/2027 · resto: 01/07/2027 (tras RD-ley 15/2025)",
    legalRef: "RD-ley 15/2025 · art. 3.1 RRSIF",
  },
] as const;

export const GESTORIA_EXPORT_FIELDS = [
  "numero_factura",
  "fecha_emision",
  "fecha_operacion",
  "cliente_nombre",
  "cliente_nif",
  "cliente_direccion",
  "reserva_id",
  "expedicion",
  "base_imponible_margen",
  "tipo_iva",
  "cuota_iva",
  "importe_total",
  "clave_regimen",
  "calificacion_operacion",
  "mencion_reav",
  "verifactu_hash",
  "verifactu_estado_aeat",
  "medio_pago",
  "importe_cobrado",
  "fecha_cobro",
  "referencia_pago",
  "estado_factura",
] as const;
