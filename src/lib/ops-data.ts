import type { PaymentChannel, RouteCode, VehicleMode } from "./demo-data";
import { GESTORIA_EXPORT_FIELDS } from "./legal-verifactu";

export type ReservationStatus =
  | "reservado"
  | "docs_pendientes"
  | "prep_viaje"
  | "en_curso"
  | "cerrado";

export type InvoiceStatus = "borrador" | "emitida" | "enviada_aeat" | "anulada" | "cobrada";

export type TaxRegime = "reav" | "general" | "exento_e6";

export interface LogisticsContact {
  role: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  notes?: string;
}

export interface StayStop {
  day: string;
  place: string;
  lodging: string;
  meals: string;
  contact?: string;
}

export interface PrepItem {
  label: string;
  done: boolean;
  owner: string;
}

export interface Reservation {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  expeditionId: string;
  route: RouteCode;
  tripName: string;
  vehicle: VehicleMode;
  status: ReservationStatus;
  bookedAt: string;
  departureAt: string;
  pax: number;
  totalAmount: number;
  depositPaid: number;
  paymentChannel: PaymentChannel;
  paymentRefs: string[];
  tourLeader: string;
  logisticsContacts: LogisticsContact[];
  itinerary: StayStop[];
  prep: PrepItem[];
  internalNotes: string;
}

export interface Invoice {
  id: string;
  number: string;
  reservationId: string;
  clientId: string;
  clientName: string;
  clientNif: string;
  clientAddress: string;
  issueDate: string;
  operationDate: string;
  expedition: string;
  /** Base imponible = margen (REAV) */
  taxBase: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  regime: TaxRegime;
  /** ClaveRégimen Veri*FACTU / libros */
  regimeKey: "05" | "01";
  operationClass: "S1" | "E6";
  reavMention: boolean;
  status: InvoiceStatus;
  paymentChannel: PaymentChannel;
  amountCollected: number;
  collectedAt: string | null;
  paymentRef: string | null;
  verifactuHash: string;
  aeatStatus: "pendiente" | "aceptado" | "rechazado" | "no_aplica_aun";
  rectifies: string | null;
}

export const PAYMENT_LABEL: Record<PaymentChannel, string> = {
  stripe: "Stripe (tarjeta)",
  transferencia: "Transferencia SEPA",
  deposito: "Depósito / señal",
  efectivo: "Efectivo",
  paypal: "PayPal",
};

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  reservado: "Reservado",
  docs_pendientes: "Docs pendientes",
  prep_viaje: "Prep. viaje",
  en_curso: "En curso",
  cerrado: "Cerrado",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  borrador: "Borrador",
  emitida: "Emitida",
  enviada_aeat: "Enviada AEAT",
  anulada: "Anulada",
  cobrada: "Cobrada",
};

export const TAX_REGIME_LABEL: Record<TaxRegime, string> = {
  reav: "REAV (clave 05)",
  general: "Régimen general (01)",
  exento_e6: "Exento E6",
};

export const RESERVATIONS: Reservation[] = [
  {
    id: "R-4821",
    clientId: "C-003",
    clientName: "Marta Vidal",
    clientPhone: "+34 600 11 22 02",
    expeditionId: "E-26-05",
    route: "MONGOLIA",
    tripName: "Mongolia · Chinggis Khan · sep 2026",
    vehicle: "moto",
    status: "prep_viaje",
    bookedAt: "2026-04-12",
    departureAt: "2026-09-08",
    pax: 1,
    totalAmount: 6_800,
    depositPaid: 2_000,
    paymentChannel: "stripe",
    paymentRefs: ["pi_3MpsLv_deposit", "TRF-ES-88421"],
    tourLeader: "Jorge Peña",
    logisticsContacts: [
      {
        role: "Operador local Ulaanbaatar",
        name: "Bat-Erdene Travel",
        phone: "+976 9900 1122",
        whatsapp: "+976 9900 1122",
        email: "ops@baterdene.mn",
        notes: "Pick-up aeropuerto + briefing día 0",
      },
      {
        role: "Mecánico ruta",
        name: "Tuguldur Garage",
        phone: "+976 8811 3344",
        notes: "Spare parts kit · disponible en Ger camp día 3–7",
      },
      {
        role: "Hotel base UB",
        name: "Kempinski Khan Palace (contacto reservas)",
        phone: "+976 11 463 463",
        email: "groups@kempinski-ub.example",
      },
    ],
    itinerary: [
      {
        day: "D0–D1",
        place: "Ulaanbaatar",
        lodging: "Kempinski Khan Palace · habitación twin",
        meals: "Cena bienvenida · desayuno hotel",
        contact: "groups@kempinski-ub.example",
      },
      {
        day: "D2–D4",
        place: "Terelj / Gorkhi",
        lodging: "Ger camp Terelj Nomads",
        meals: "Pensión completa (cocina campamento)",
        contact: "Bat-Erdene Travel",
      },
      {
        day: "D5–D8",
        place: "Estepa central",
        lodging: "Campamentos móviles · ger",
        meals: "PC + picnic ruta",
      },
      {
        day: "D9–D10",
        place: "Ulaanbaatar",
        lodging: "Kempinski · late check-out",
        meals: "Desayuno · cena despedida",
      },
    ],
    prep: [
      { label: "Pasaporte + visado Mongolia", done: true, owner: "Marta Vega" },
      { label: "Licencia moto + seguro viaje", done: true, owner: "Marta Vega" },
      { label: "Briefing mecánico / packing list", done: false, owner: "Jorge Peña" },
      { label: "Confirmación hoteles + ger camps", done: true, owner: "Luis Ortega" },
      { label: "Transfer aeropuerto UB", done: true, owner: "Bat-Erdene Travel" },
      { label: "Saldo restante cobrado", done: false, owner: "Marta Vega" },
    ],
    internalNotes: "VIP 11 expediciones. Preferencia habitación silenciosa. No enviar NL automática.",
  },
  {
    id: "R-4822",
    clientId: "C-088",
    clientName: "Sergio Molina",
    clientPhone: "+34 600 11 22 04",
    expeditionId: "E-26-04",
    route: "COLOMBIA",
    tripName: "Colombia · Coffee Tour · ago 2026",
    vehicle: "4x4",
    status: "docs_pendientes",
    bookedAt: "2026-06-01",
    departureAt: "2026-08-18",
    pax: 2,
    totalAmount: 10_800,
    depositPaid: 3_000,
    paymentChannel: "transferencia",
    paymentRefs: ["SEPA-ES91-20260601"],
    tourLeader: "Luis Ortega",
    logisticsContacts: [
      {
        role: "Operador Eje Cafetero",
        name: "Andes 4x4 Ops",
        phone: "+57 300 555 0199",
        whatsapp: "+57 300 555 0199",
        email: "ops@andes4x4.example",
      },
      {
        role: "Finca / alojamiento",
        name: "Hacienda El Roble",
        phone: "+57 6 850 2211",
        notes: "Cenas grupo · menú sin gluten pax 2",
      },
    ],
    itinerary: [
      {
        day: "D1",
        place: "Medellín",
        lodging: "Hotel Dann Carlton",
        meals: "Cena bienvenida",
      },
      {
        day: "D2–D5",
        place: "Eje Cafetero",
        lodging: "Hacienda El Roble",
        meals: "PC · picnic miradores",
        contact: "Hacienda El Roble",
      },
      {
        day: "D6–D7",
        place: "Salento / Cocora",
        lodging: "Ecohotel Salento",
        meals: "MP",
      },
    ],
    prep: [
      { label: "Pasaportes pareja", done: true, owner: "Marta Vega" },
      { label: "Vacunas / seguro", done: false, owner: "Cliente" },
      { label: "Confirmación finca + menús", done: true, owner: "Luis Ortega" },
      { label: "4x4 rental + combustible plan", done: false, owner: "Andes 4x4 Ops" },
    ],
    internalNotes: "Pareja. Señal por transferencia SEPA. Falta documentación pax 2.",
  },
  {
    id: "R-4823",
    clientId: "C-077",
    clientName: "Ana Beltrán",
    clientPhone: "+34 600 11 22 08",
    expeditionId: "E-26-03",
    route: "NAMIBIA",
    tripName: "Namibia · paraíso África · jun 2026",
    vehicle: "4x4",
    status: "cerrado",
    bookedAt: "2025-11-20",
    departureAt: "2026-06-05",
    pax: 1,
    totalAmount: 6_200,
    depositPaid: 6_200,
    paymentChannel: "transferencia",
    paymentRefs: ["SEPA-ES91-20251120", "SEPA-ES91-20260401"],
    tourLeader: "Luis Ortega",
    logisticsContacts: [
      {
        role: "Operador Windhoek",
        name: "Desert Track Safaris",
        phone: "+264 61 220 110",
        email: "bookings@deserttrack.example",
      },
      {
        role: "Lodge Sossusvlei",
        name: "Sossus Dune Lodge",
        phone: "+264 63 693 001",
      },
    ],
    itinerary: [
      {
        day: "D1–D2",
        place: "Windhoek",
        lodging: "Hilton Windhoek",
        meals: "Desayuno",
      },
      {
        day: "D3–D5",
        place: "Sossusvlei",
        lodging: "Sossus Dune Lodge",
        meals: "PC",
        contact: "Sossus Dune Lodge",
      },
      {
        day: "D6–D8",
        place: "Swakopmund / costa",
        lodging: "Strand Hotel",
        meals: "MP · cena mariscos D7",
      },
    ],
    prep: [
      { label: "Documentación completa", done: true, owner: "Marta Vega" },
      { label: "Factura REAV emitida + cobro", done: true, owner: "Marta Vega" },
      { label: "Post-viaje NPS", done: true, owner: "Sofía Navarro" },
    ],
    internalNotes: "Viaje cerrado. Factura F-2026-0148 cobrada. Candidata referidos.",
  },
  {
    id: "R-4820",
    clientId: "C-055",
    clientName: "Carlos Méndez",
    clientPhone: "+34 600 11 22 06",
    expeditionId: "E-26-06",
    route: "TANZANIA",
    tripName: "Tanzania · Big Five · oct 2026",
    vehicle: "moto",
    status: "reservado",
    bookedAt: "2026-07-02",
    departureAt: "2026-10-12",
    pax: 1,
    totalAmount: 7_400,
    depositPaid: 1_500,
    paymentChannel: "paypal",
    paymentRefs: ["PAYID-MPS-7400-DEP"],
    tourLeader: "Luis Ortega",
    logisticsContacts: [
      {
        role: "Operador Arusha",
        name: "Kilimanjaro Ride Ops",
        phone: "+255 754 111 222",
        whatsapp: "+255 754 111 222",
      },
      {
        role: "Camp Serengeti",
        name: "Serian Serengeti South",
        phone: "+255 768 900 100",
        notes: "Full board · water stations moto",
      },
    ],
    itinerary: [
      {
        day: "D1",
        place: "Arusha",
        lodging: "Arusha Coffee Lodge",
        meals: "Cena",
      },
      {
        day: "D2–D6",
        place: "Serengeti / Ngorongoro",
        lodging: "Serian camp + lodge crater",
        meals: "PC",
        contact: "Kilimanjaro Ride Ops",
      },
    ],
    prep: [
      { label: "Depósito PayPal recibido", done: true, owner: "Marta Vega" },
      { label: "Vacuna fiebre amarilla", done: false, owner: "Cliente" },
      { label: "Bloqueo lodges", done: true, owner: "Luis Ortega" },
      { label: "Saldo 30 días antes", done: false, owner: "Marta Vega" },
    ],
    internalNotes: "Embajador. Señal PayPal. Recordar saldo por transferencia.",
  },
];

export const INVOICES: Invoice[] = [
  {
    id: "INV-148",
    number: "F-2026-0148",
    reservationId: "R-4823",
    clientId: "C-077",
    clientName: "Ana Beltrán",
    clientNif: "31222333R",
    clientAddress: "C/ Pacífico 12, 29002 Málaga",
    issueDate: "2026-04-01",
    operationDate: "2026-06-05",
    expedition: "Namibia · jun 2026",
    taxBase: 1_450,
    vatRate: 21,
    vatAmount: 304.5,
    total: 6_200,
    regime: "reav",
    regimeKey: "05",
    operationClass: "S1",
    reavMention: true,
    status: "cobrada",
    paymentChannel: "transferencia",
    amountCollected: 6_200,
    collectedAt: "2026-04-01",
    paymentRef: "SEPA-ES91-20260401",
    verifactuHash: "a3f1…c92e (demo)",
    aeatStatus: "aceptado",
    rectifies: null,
  },
  {
    id: "INV-161",
    number: "F-2026-0161",
    reservationId: "R-4821",
    clientId: "C-003",
    clientName: "Marta Vidal",
    clientNif: "25111222L",
    clientAddress: "Av. Diagonal 440, 08037 Barcelona",
    issueDate: "2026-04-12",
    operationDate: "2026-09-08",
    expedition: "Mongolia · sep 2026",
    taxBase: 1_620,
    vatRate: 21,
    vatAmount: 340.2,
    total: 2_000,
    regime: "reav",
    regimeKey: "05",
    operationClass: "S1",
    reavMention: true,
    status: "enviada_aeat",
    paymentChannel: "stripe",
    amountCollected: 2_000,
    collectedAt: "2026-04-12",
    paymentRef: "pi_3MpsLv_deposit",
    verifactuHash: "b7c2…11aa (demo)",
    aeatStatus: "aceptado",
    rectifies: null,
  },
  {
    id: "INV-162",
    number: "F-2026-0162",
    reservationId: "R-4822",
    clientId: "C-088",
    clientName: "Sergio Molina",
    clientNif: "28888999M",
    clientAddress: "Plaza Nueva 3, 41001 Sevilla",
    issueDate: "2026-06-01",
    operationDate: "2026-08-18",
    expedition: "Colombia · ago 2026",
    taxBase: 780,
    vatRate: 21,
    vatAmount: 163.8,
    total: 3_000,
    regime: "reav",
    regimeKey: "05",
    operationClass: "S1",
    reavMention: true,
    status: "emitida",
    paymentChannel: "transferencia",
    amountCollected: 3_000,
    collectedAt: "2026-06-01",
    paymentRef: "SEPA-ES91-20260601",
    verifactuHash: "pendiente remisión",
    aeatStatus: "pendiente",
    rectifies: null,
  },
  {
    id: "INV-170",
    number: "F-2026-0170",
    reservationId: "R-4820",
    clientId: "C-055",
    clientName: "Carlos Méndez",
    clientNif: "16000444C",
    clientAddress: "C/ Ercilla 8, 48009 Bilbao",
    issueDate: "2026-07-02",
    operationDate: "2026-10-12",
    expedition: "Tanzania · oct 2026",
    taxBase: 410,
    vatRate: 21,
    vatAmount: 86.1,
    total: 1_500,
    regime: "reav",
    regimeKey: "05",
    operationClass: "S1",
    reavMention: true,
    status: "borrador",
    paymentChannel: "paypal",
    amountCollected: 1_500,
    collectedAt: "2026-07-02",
    paymentRef: "PAYID-MPS-7400-DEP",
    verifactuHash: "—",
    aeatStatus: "no_aplica_aun",
    rectifies: null,
  },
];

function csvEscape(v: string | number | boolean | null) {
  const s = v == null ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Paquete listo para gestoría: libro de facturas + pagos + metadatos Veri*FACTU/REAV */
export function buildGestoriaExportCsv(invoices: Invoice[] = INVOICES): string {
  const header = GESTORIA_EXPORT_FIELDS.join(";");
  const rows = invoices.map((inv) =>
    [
      inv.number,
      inv.issueDate,
      inv.operationDate,
      inv.clientName,
      inv.clientNif,
      inv.clientAddress,
      inv.reservationId,
      inv.expedition,
      inv.taxBase.toFixed(2),
      inv.vatRate,
      inv.vatAmount.toFixed(2),
      inv.total.toFixed(2),
      inv.regimeKey,
      inv.operationClass,
      inv.reavMention ? "SI" : "NO",
      inv.verifactuHash,
      inv.aeatStatus,
      PAYMENT_LABEL[inv.paymentChannel],
      inv.amountCollected.toFixed(2),
      inv.collectedAt ?? "",
      inv.paymentRef ?? "",
      INVOICE_STATUS_LABEL[inv.status],
    ]
      .map(csvEscape)
      .join(";"),
  );
  return [header, ...rows].join("\n");
}

export function downloadGestoriaPack(invoices: Invoice[] = INVOICES) {
  const csv = buildGestoriaExportCsv(invoices);
  const legalIndex = [
    "# Paquete gestoría Campo Norte",
    `# Generado: ${new Date().toISOString()}`,
    "# Incluye: libro facturas (CSV ;), claves REAV 05, hash Veri*FACTU demo, conciliación pagos",
    "# Normas de referencia: LGT 29.2.j) · Ley 11/2021 · RD 1007/2023 · Orden HAC/1177/2024 · RD-ley 15/2025 · LIVA 141-147 · RD 1619/2012",
    "# Validar con gestoría antes de presentación oficial.",
    "",
    csv,
  ].join("\n");

  const blob = new Blob([legalIndex], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `camponorte-gestoria-facturas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
