import { MPS_ANNEX } from "./assumptions.js";

export type LeadOrigin =
  | "web_form"
  | "instagram"
  | "referral"
  | "brevo_click"
  | "feria"
  | "unknown";

export type LeadStatus = "nuevo" | "en_contacto" | "cualificado" | "reservado" | "descartado";

export type ClientSegment =
  | "activo"
  | "recurrente"
  | "dormido"
  | "vip"
  | "embajador"
  | "en_riesgo"
  | "prospecto_newsletter";

export type ClientStatus = "al_dia" | "seguimiento" | "dormido" | "alta_prioridad";

export type PaymentStatus =
  | "al_dia"
  | "deposito_pendiente"
  | "saldo_pendiente"
  | "vence_pronto";

/** Medios de cobro habituales en agencia de viajes ES (sin Bizum: límite 500 €/día y riesgo fiscal). */
export type PaymentChannel =
  | "stripe"
  | "transferencia"
  | "deposito"
  | "efectivo"
  | "paypal";

/** Migra datos antiguos (`bizum`) a transferencia SEPA. */
export function normalizePaymentChannel(value: unknown): PaymentChannel {
  if (value === "stripe" || value === "transferencia" || value === "deposito" || value === "efectivo" || value === "paypal") {
    return value;
  }
  return "transferencia";
}

export type ExperienceLevel = "principiante" | "intermedio" | "avanzado" | "experto";

export type VehicleMode = "moto" | "4x4";

export type ReservationStatus =
  | "reservado"
  | "docs_pendientes"
  | "prep_viaje"
  | "en_curso"
  | "cerrado";

export type InvoiceStatus = "borrador" | "emitida" | "enviada_aeat" | "anulada" | "cobrada";

/** Régimen IVA — agencias de viaje ES (REAV clave 05) */
export type TaxRegime = "reav" | "general" | "exento_e6";

export type RouteCode =
  | "MONGOLIA"
  | "NAMIBIA"
  | "ARGENTINA_PUNA"
  | "COSTA_RICA"
  | "NEPAL_MUSTANG"
  | "ALASKA"
  | "COLOMBIA"
  | "TANZANIA"
  | "CALIFORNIA";

export interface Lead {
  id: string;
  name: string;
  email: string;
  origin: LeadOrigin;
  campaign: string | null;
  status: LeadStatus;
  score: number;
  scoreReasons: string[];
  interestRoute: RouteCode | null;
  vehicle: VehicleMode | null;
  createdAt: string;
  lastTouchAt: string;
  owner: string;
}

export interface ClientTrip {
  route: RouteCode;
  date: string;
  vehicle: VehicleMode;
  amount: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  /** DNI / pasaporte (dato operativo de viaje) */
  dni: string;
  address: string;
  contactPerson: string;
  emergencyPhone: string;
  segment: ClientSegment;
  status: ClientStatus;
  paymentStatus: PaymentStatus;
  pendingBalance: number;
  /** Canal preferido / habitual de cobro */
  paymentMethod: PaymentChannel;
  trips: number;
  lastTripAt: string | null;
  nextInterest: RouteCode | null;
  ltv: number;
  avgTicket: number;
  preferredRoute: RouteCode | null;
  vehiclePref: VehicleMode | null;
  experience: ExperienceLevel;
  docsComplete: boolean;
  originPrimary: LeadOrigin;
  brevoOpens: number;
  referrals: number;
  nps: number | null;
  owner: string;
  since: string;
  notes: string;
  history: ClientTrip[];
  reactivationPriority: number;
  reactivationWhy: string;
  /** Última llamada/WhatsApp saliente del equipo (null/undefined = nunca contactado) */
  lastOutboundAt?: string | null;
  /** Probabilidad estimada de recompra 0–100 (Customer Intelligence) */
  returnProbability?: number;
  /** Cola operativa: contactar este mes (aviso interno, no mensaje al cliente) */
  contactThisMonth?: boolean;
  intelligenceSource?: "seed" | "heuristic" | "ollama";
  intelligenceAt?: string | null;
}

export interface Expedition {
  id: string;
  route: RouteCode;
  name: string;
  vehicle: VehicleMode;
  departureAt: string;
  seats: number;
  booked: number;
  revenue: number;
  cost: number;
  originMix: Partial<Record<LeadOrigin, number>>;
}

export interface MonthlyKpi {
  month: string;
  revenue: number;
  bookings: number;
  leads: number;
  attributedPct: number;
  marginPct: number;
}

export type ContentChannelKind =
  | "email_brevo"
  | "whatsapp_script"
  | "mensaje_interno"
  | "rrss"
  | "pack_multimedia";

export type ContentDraftType =
  | "newsletter"
  | "whatsapp"
  | "email_seguimiento"
  | "resumen_expedicion"
  | "secuencia_interna"
  | "sms_aviso";

export interface ContentDraft {
  id: string;
  type: ContentDraftType;
  title: string;
  sourceTrip: string;
  status: "borrador_ia" | "en_revision" | "listo_para_brevo" | "listo_para_envio";
  excerpt: string;
  /** Asunto (email) o primera línea (WhatsApp) */
  subject: string;
  /** Cuerpo editable de la plantilla */
  body: string;
  channel: string;
  channelKind: ContentChannelKind;
  audience: string;
  owner: string;
  /** Variables disponibles {nombre}, {destino}, etc. */
  variables: string[];
  /** Argumentos de negocio */
  arguments: string[];
  updatedAt: string;
}

export interface AutomationJob {
  id: string;
  name: string;
  from: string;
  to: string;
  status: "ok" | "aviso" | "error";
  lastRun: string;
  note: string;
  /** Gatillo creíble del flujo */
  trigger: string;
  /** Frecuencia / volumen demo */
  cadence: string;
  /** Argumentos de negocio: por qué existe este flujo */
  arguments: string[];
  /** Qué NO hace (regla de oro) */
  neverDoes: string;
  runs30d: number;
}

export const ORIGIN_LABEL: Record<LeadOrigin, string> = {
  web_form: "Formulario web",
  instagram: "Instagram / RRSS",
  referral: "Referido",
  brevo_click: "Clic Brevo",
  feria: "Feria / evento",
  unknown: "Sin origen",
};

export const ROUTE_LABEL: Record<RouteCode, string> = {
  MONGOLIA: "Mongolia · Chinggis Khan",
  NAMIBIA: "Namibia · paraíso África",
  ARGENTINA_PUNA: "Argentina · La Puna",
  COSTA_RICA: "Costa Rica · Full Experience",
  NEPAL_MUSTANG: "Nepal · Mustang",
  ALASKA: "Alaska · Prudhoe Bay",
  COLOMBIA: "Colombia · Coffee Tour",
  TANZANIA: "Tanzania · Big Five",
  CALIFORNIA: "California · Pacific Road",
};

export const LEADS: Lead[] = [
  {
    id: "L-1042",
    name: "María Gálvez",
    email: "maria.g@example.com",
    origin: "referral",
    campaign: null,
    status: "cualificado",
    score: 94,
    scoreReasons: ["Referida por cliente 3+ expediciones", "Interés Mongolia moto", "Presupuesto alineado"],
    interestRoute: "MONGOLIA",
    vehicle: "moto",
    createdAt: "2026-07-22",
    lastTouchAt: "2026-07-28",
    owner: "Sofía",
  },
  {
    id: "L-1041",
    name: "Jordi Puig",
    email: "jordi.puig@example.com",
    origin: "brevo_click",
    campaign: "NL-namibia-2027",
    status: "en_contacto",
    score: 83,
    scoreReasons: ["Clic CTA Namibia", "Abrió 5/7 NL", "Viajó Costa Rica 2024"],
    interestRoute: "NAMIBIA",
    vehicle: "4x4",
    createdAt: "2026-07-20",
    lastTouchAt: "2026-07-27",
    owner: "Laura",
  },
  {
    id: "L-1038",
    name: "Elena Ruiz",
    email: "elena.ruiz@example.com",
    origin: "web_form",
    campaign: "utm_ig_stories_puna",
    status: "nuevo",
    score: 76,
    scoreReasons: ["Formulario completo", "UTM Instagram", "Pregunta por La Puna 4x4"],
    interestRoute: "ARGENTINA_PUNA",
    vehicle: "4x4",
    createdAt: "2026-07-26",
    lastTouchAt: "2026-07-26",
    owner: "Sin asignar",
  },
  {
    id: "L-1035",
    name: "Carlos Méndez",
    email: "c.mendez@example.com",
    origin: "feria",
    campaign: "AdventureTravel-26",
    status: "en_contacto",
    score: 69,
    scoreReasons: ["Lead feria", "Interés Alaska", "Sin historial previo"],
    interestRoute: "ALASKA",
    vehicle: "moto",
    createdAt: "2026-07-12",
    lastTouchAt: "2026-07-25",
    owner: "Sofía",
  },
  {
    id: "L-1031",
    name: "Ana Beltrán",
    email: "ana.b@example.com",
    origin: "instagram",
    campaign: null,
    status: "nuevo",
    score: 48,
    scoreReasons: ["DM sin formulario", "Origen parcial", "Sin ruta clara"],
    interestRoute: null,
    vehicle: null,
    createdAt: "2026-07-27",
    lastTouchAt: "2026-07-27",
    owner: "Sin asignar",
  },
  {
    id: "L-1028",
    name: "Pablo Soto",
    email: "pablo.soto@example.com",
    origin: "unknown",
    campaign: null,
    status: "nuevo",
    score: 26,
    scoreReasons: ["Sin origen", "Solo email en bandeja Sofía", "Falta contexto"],
    interestRoute: null,
    vehicle: null,
    createdAt: "2026-07-18",
    lastTouchAt: "2026-07-18",
    owner: "Sofía (bandeja)",
  },
  {
    id: "L-1024",
    name: "Lucía Fernández",
    email: "lucia.f@example.com",
    origin: "web_form",
    campaign: "utm_google_brand",
    status: "cualificado",
    score: 88,
    scoreReasons: ["Búsqueda de marca", "2º viaje potencial", "Nepal Mustang moto"],
    interestRoute: "NEPAL_MUSTANG",
    vehicle: "moto",
    createdAt: "2026-07-15",
    lastTouchAt: "2026-07-29",
    owner: "Laura",
  },
  {
    id: "L-1019",
    name: "Raúl Ortega",
    email: "raul.o@example.com",
    origin: "brevo_click",
    campaign: "NL-reactivacion-dormidos",
    status: "en_contacto",
    score: 79,
    scoreReasons: ["Cliente dormido", "Clic Colombia", "LTV histórico alto"],
    interestRoute: "COLOMBIA",
    vehicle: "moto",
    createdAt: "2026-07-10",
    lastTouchAt: "2026-07-28",
    owner: "Sofía",
  },
];

export const CLIENTS: Client[] = [
  {
    id: "C-012",
    name: "Isabel Navarro",
    email: "isabel.navarro@example.com",
    phone: "+34 600 11 22 01",
    city: "Madrid",
    country: "España",
    dni: "",
    address: "C/ Serrano 45, 28001 Madrid",
    contactPerson: "Isabel Navarro",
    emergencyPhone: "+34 600 11 22 91",
    segment: "dormido",
    status: "alta_prioridad",
    paymentStatus: "al_dia",
    pendingBalance: 0,
    paymentMethod: "transferencia",
    trips: 2,
    lastTripAt: "2023-09-14",
    nextInterest: "MONGOLIA",
    ltv: 11_200,
    avgTicket: 5_600,
    preferredRoute: "MONGOLIA",
    vehiclePref: "moto",
    experience: "avanzado",
    docsComplete: true,
    originPrimary: "referral",
    brevoOpens: 14,
    referrals: 1,
    nps: 10,
    owner: "Sofía",
    since: "09/2021",
    notes: "Pidió Patagonia en 2023; muy buena relación. Preferir llamada, no NL fría.",
    history: [
      { route: "MONGOLIA", date: "2021-09-10", vehicle: "moto", amount: 5_400 },
      { route: "NEPAL_MUSTANG", date: "2023-09-14", vehicle: "moto", amount: 5_800 },
    ],
    reactivationPriority: 96,
    reactivationWhy: "2 expediciones, NPS 10, 34 meses sin viaje — llamada de Sofía",
    lastOutboundAt: null,
    returnProbability: 88,
    contactThisMonth: true,
    intelligenceSource: "seed",
  },
  {
    id: "C-003",
    name: "Marta Vidal",
    email: "laura.vidal@example.com",
    phone: "+34 600 11 22 02",
    city: "Barcelona",
    country: "España",
    dni: "",
    address: "Av. Diagonal 440, 08037 Barcelona",
    contactPerson: "Marta Vidal",
    emergencyPhone: "+34 600 11 22 92",
    segment: "vip",
    status: "al_dia",
    paymentStatus: "saldo_pendiente",
    pendingBalance: 4_800,
    paymentMethod: "stripe",
    trips: 11,
    lastTripAt: "2025-11-20",
    nextInterest: "ALASKA",
    ltv: 58_000,
    avgTicket: 5_270,
    preferredRoute: "ALASKA",
    vehiclePref: "moto",
    experience: "experto",
    docsComplete: true,
    originPrimary: "referral",
    brevoOpens: 42,
    referrals: 4,
    nps: 10,
    owner: "Sofía",
    since: "06/2018",
    notes: "Núcleo fiel 10+. Embajadora natural. Reserva Mongolia con saldo pendiente.",
    history: [
      { route: "CALIFORNIA", date: "2024-09-15", vehicle: "moto", amount: 5_100 },
      { route: "ALASKA", date: "2025-11-20", vehicle: "moto", amount: 6_200 },
    ],
    reactivationPriority: 35,
    reactivationWhy: "VIP activo — no ‘despertar’; pedir referidos",
    lastOutboundAt: "2026-06-12",
    returnProbability: 40,
    contactThisMonth: false,
    intelligenceSource: "seed",
  },
  {
    id: "C-041",
    name: "Sofía Torres",
    email: "miguel.torres@example.com",
    phone: "+34 600 11 22 03",
    city: "Valencia",
    country: "España",
    dni: "",
    address: "C/ Colón 22, 46004 Valencia",
    contactPerson: "Sofía Torres",
    emergencyPhone: "+34 600 11 22 93",
    segment: "dormido",
    status: "seguimiento",
    paymentStatus: "al_dia",
    pendingBalance: 0,
    paymentMethod: "transferencia",
    trips: 1,
    lastTripAt: "2024-03-02",
    nextInterest: "NAMIBIA",
    ltv: 5_600,
    avgTicket: 5_600,
    preferredRoute: "NAMIBIA",
    vehiclePref: "4x4",
    experience: "intermedio",
    docsComplete: true,
    originPrimary: "web_form",
    brevoOpens: 9,
    referrals: 0,
    nps: 9,
    owner: "Laura",
    since: "01/2024",
    notes: "Sin follow-up post-viaje documentado. Abre NL Namibia.",
    history: [{ route: "NAMIBIA", date: "2024-03-02", vehicle: "4x4", amount: 5_600 }],
    reactivationPriority: 84,
    reactivationWhy: "NPS 9 · 18 meses · engagement Brevo alto",
    lastOutboundAt: null,
    returnProbability: 82,
    contactThisMonth: true,
    intelligenceSource: "seed",
  },
  {
    id: "C-088",
    name: "Sergio Molina",
    email: "sergio.molina@example.com",
    phone: "+34 600 11 22 04",
    city: "Sevilla",
    country: "España",
    dni: "",
    address: "Plaza Nueva 3, 41001 Sevilla",
    contactPerson: "Sergio Molina / Elena (pareja)",
    emergencyPhone: "+34 600 11 22 94",
    segment: "activo",
    status: "al_dia",
    paymentStatus: "deposito_pendiente",
    pendingBalance: 7_800,
    paymentMethod: "transferencia",
    trips: 1,
    lastTripAt: "2026-05-10",
    nextInterest: "COLOMBIA",
    ltv: 5_400,
    avgTicket: 5_400,
    preferredRoute: "COSTA_RICA",
    vehiclePref: "4x4",
    experience: "principiante",
    docsComplete: false,
    originPrimary: "instagram",
    brevoOpens: 5,
    referrals: 0,
    nps: 9,
    owner: "Laura",
    since: "03/2026",
    notes: "Docs pax 2 pendientes. Señal SEPA Colombia.",
    history: [{ route: "COSTA_RICA", date: "2026-05-10", vehicle: "4x4", amount: 5_400 }],
    reactivationPriority: 58,
    reactivationWhy: "Activo reciente — convertir en embajador",
  },
  {
    id: "C-120",
    name: "Nuria Pons",
    email: "nuria.pons@example.com",
    phone: "+34 600 11 22 05",
    city: "Palma",
    country: "España",
    dni: "",
    address: "C/ Sant Miquel 18, 07002 Palma",
    contactPerson: "Nuria Pons",
    emergencyPhone: "+34 600 11 22 95",
    segment: "en_riesgo",
    status: "dormido",
    paymentStatus: "al_dia",
    pendingBalance: 0,
    paymentMethod: "paypal",
    trips: 1,
    lastTripAt: "2022-07-01",
    nextInterest: "ARGENTINA_PUNA",
    ltv: 4_900,
    avgTicket: 4_900,
    preferredRoute: "ARGENTINA_PUNA",
    vehiclePref: "4x4",
    experience: "intermedio",
    docsComplete: false,
    originPrimary: "brevo_click",
    brevoOpens: 22,
    referrals: 0,
    nps: 8,
    owner: "Sofía",
    since: "05/2022",
    notes: "Ficha incompleta de origen histórico. Completar antes de llamar.",
    history: [{ route: "ARGENTINA_PUNA", date: "2022-07-01", vehicle: "4x4", amount: 4_900 }],
    reactivationPriority: 72,
    reactivationWhy: "4 años · abre NL · riesgo de pérdida definitiva",
    lastOutboundAt: null,
    returnProbability: 70,
    contactThisMonth: true,
    intelligenceSource: "seed",
  },
  {
    id: "C-055",
    name: "Carlos Méndez",
    email: "carlos.mendez@example.com",
    phone: "+34 600 11 22 06",
    city: "Bilbao",
    country: "España",
    dni: "",
    address: "C/ Ercilla 8, 48009 Bilbao",
    contactPerson: "Carlos Méndez",
    emergencyPhone: "+34 600 11 22 96",
    segment: "embajador",
    status: "al_dia",
    paymentStatus: "deposito_pendiente",
    pendingBalance: 5_900,
    paymentMethod: "paypal",
    trips: 3,
    lastTripAt: "2025-06-12",
    nextInterest: "TANZANIA",
    ltv: 16_800,
    avgTicket: 5_600,
    preferredRoute: "NAMIBIA",
    vehiclePref: "moto",
    experience: "avanzado",
    docsComplete: true,
    originPrimary: "feria",
    brevoOpens: 18,
    referrals: 3,
    nps: 10,
    owner: "Sofía",
    since: "04/2022",
    notes: "Trajo 3 amigos. Señal PayPal Tanzania. Embajador Content Factory.",
    history: [
      { route: "NAMIBIA", date: "2023-06-01", vehicle: "moto", amount: 5_500 },
      { route: "MONGOLIA", date: "2024-09-07", vehicle: "moto", amount: 5_700 },
      { route: "CALIFORNIA", date: "2025-06-12", vehicle: "moto", amount: 5_600 },
    ],
    reactivationPriority: 50,
    reactivationWhy: "Embajador — nutrir relación, no reactivar frío",
  },
  {
    id: "C-201",
    name: "Héctor Blanco",
    email: "hector.blanco@example.com",
    phone: "+34 600 11 22 07",
    city: "Zaragoza",
    country: "España",
    dni: "",
    address: "Paseo Independencia 21, 50001 Zaragoza",
    contactPerson: "Héctor Blanco",
    emergencyPhone: "+34 600 11 22 97",
    segment: "prospecto_newsletter",
    status: "seguimiento",
    paymentStatus: "al_dia",
    pendingBalance: 0,
    paymentMethod: "stripe",
    trips: 0,
    lastTripAt: null,
    nextInterest: "NEPAL_MUSTANG",
    ltv: 0,
    avgTicket: 0,
    preferredRoute: null,
    vehiclePref: "moto",
    experience: "principiante",
    docsComplete: false,
    originPrimary: "brevo_click",
    brevoOpens: 11,
    referrals: 0,
    nps: null,
    owner: "Laura",
    since: "11/2025",
    notes: "Suscriptor engajado. Aún no cliente. Nurturing vía Brevo editado por equipo.",
    history: [],
    reactivationPriority: 30,
    reactivationWhy: "Prospecto — no confundir con dormido",
  },
  {
    id: "C-077",
    name: "Ana Beltrán",
    email: "ana.beltran@example.com",
    phone: "+34 600 11 22 08",
    city: "Málaga",
    country: "España",
    dni: "",
    address: "C/ Pacífico 12, 29002 Málaga",
    contactPerson: "Ana Beltrán",
    emergencyPhone: "+34 600 11 22 98",
    segment: "recurrente",
    status: "al_dia",
    paymentStatus: "al_dia",
    pendingBalance: 0,
    paymentMethod: "transferencia",
    trips: 4,
    lastTripAt: "2026-03-03",
    nextInterest: "COSTA_RICA",
    ltv: 21_500,
    avgTicket: 5_375,
    preferredRoute: "COSTA_RICA",
    vehiclePref: "4x4",
    experience: "avanzado",
    docsComplete: true,
    originPrimary: "referral",
    brevoOpens: 16,
    referrals: 1,
    nps: 9,
    owner: "Laura",
    since: "02/2020",
    notes: "Prefiere 4x4. Namibia 2026 facturada y cobrada (REAV).",
    history: [
      { route: "COSTA_RICA", date: "2026-03-03", vehicle: "4x4", amount: 5_500 },
      { route: "COLOMBIA", date: "2024-01-20", vehicle: "4x4", amount: 5_200 },
    ],
    reactivationPriority: 40,
    reactivationWhy: "Recurrente sana — upsell premium con cuidado",
  },
];


export const SEGMENT_LABEL: Record<ClientSegment, string> = {
  activo: "Activo",
  recurrente: "Recurrente",
  dormido: "Dormido",
  vip: "VIP",
  embajador: "Embajador",
  en_riesgo: "En riesgo",
  prospecto_newsletter: "Prospecto NL",
};

export const STATUS_LABEL: Record<ClientStatus, string> = {
  al_dia: "Al día",
  seguimiento: "En seguimiento",
  dormido: "Dormido",
  alta_prioridad: "Alta prioridad",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  al_dia: "Al día",
  deposito_pendiente: "Depósito pendiente",
  saldo_pendiente: "Saldo pendiente",
  vence_pronto: "Vence pronto",
};

export const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
  experto: "Experto",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentChannel, string> = {
  stripe: "Stripe (tarjeta)",
  transferencia: "Transferencia SEPA",
  deposito: "Depósito / señal",
  efectivo: "Efectivo",
  paypal: "PayPal",
};


export const EXPEDITIONS: Expedition[] = [
  {
    id: "E-26-01",
    route: "ARGENTINA_PUNA",
    name: "La Puna · oct 2025",
    vehicle: "4x4",
    departureAt: "2025-10-28",
    seats: 12,
    booked: 12,
    revenue: 72_000,
    cost: 48_200,
    originMix: { referral: 4, brevo_click: 3, web_form: 3, unknown: 2 },
  },
  {
    id: "E-26-02",
    route: "COSTA_RICA",
    name: "Costa Rica · mar 2026",
    vehicle: "4x4",
    departureAt: "2026-03-03",
    seats: 12,
    booked: 11,
    revenue: 58_000,
    cost: 39_500,
    originMix: { web_form: 4, instagram: 3, referral: 2, unknown: 2 },
  },
  {
    id: "E-26-03",
    route: "NAMIBIA",
    name: "Namibia · jun 2026",
    vehicle: "4x4",
    departureAt: "2026-06-05",
    seats: 12,
    booked: 12,
    revenue: 84_000,
    cost: 56_700,
    originMix: { referral: 5, brevo_click: 4, web_form: 2, unknown: 1 },
  },
  {
    id: "E-26-04",
    route: "MONGOLIA",
    name: "Mongolia · sep 2026",
    vehicle: "moto",
    departureAt: "2026-09-07",
    seats: 12,
    booked: 10,
    revenue: 68_000,
    cost: 47_600,
    originMix: { web_form: 3, referral: 3, brevo_click: 2, unknown: 2 },
  },
  {
    id: "E-26-05",
    route: "CALIFORNIA",
    name: "Pacific Road · sep 2026",
    vehicle: "moto",
    departureAt: "2026-09-15",
    seats: 14,
    booked: 13,
    revenue: 71_500,
    cost: 48_000,
    originMix: { brevo_click: 5, web_form: 4, referral: 3, feria: 1 },
  },
  {
    id: "E-26-06",
    route: "NEPAL_MUSTANG",
    name: "Nepal Mustang · abr 2027 (abierta)",
    vehicle: "moto",
    departureAt: "2027-04-23",
    seats: 12,
    booked: 5,
    revenue: 32_000,
    cost: 19_500,
    originMix: { referral: 2, web_form: 2, unknown: 1 },
  },
];

export const MONTHLY_KPIS: MonthlyKpi[] = [
  { month: "Ene", revenue: 42_000, bookings: 8, leads: 24, attributedPct: 22, marginPct: 28 },
  { month: "Feb", revenue: 48_000, bookings: 9, leads: 27, attributedPct: 28, marginPct: 29 },
  { month: "Mar", revenue: 58_000, bookings: 11, leads: 31, attributedPct: 33, marginPct: 32 },
  { month: "Abr", revenue: 51_000, bookings: 10, leads: 29, attributedPct: 36, marginPct: 30 },
  { month: "May", revenue: 55_000, bookings: 10, leads: 34, attributedPct: 41, marginPct: 31 },
  { month: "Jun", revenue: 84_000, bookings: 12, leads: 30, attributedPct: 44, marginPct: 32 },
  { month: "Jul", revenue: 46_000, bookings: 8, leads: 36, attributedPct: 48, marginPct: 29 },
];

export const CONTENT_CHANNEL_LABEL: Record<ContentChannelKind, string> = {
  email_brevo: "Email / Brevo",
  whatsapp_script: "WhatsApp (script humano)",
  mensaje_interno: "Mensaje interno equipo",
  rrss: "RRSS",
  pack_multimedia: "Pack multimedia",
};

export const CONTENT_DRAFTS: ContentDraft[] = [
  {
    id: "D-01",
    type: "newsletter",
    title: "NL · Después de Namibia (Brevo)",
    sourceTrip: "Namibia · jun 2026",
    status: "en_revision",
    channel: "Brevo · newsletter",
    channelKind: "email_brevo",
    audience: "Suscriptores + viajeros Namibia + dormidos África",
    owner: "Sofía / Marta",
    subject: "Namibia no se cuenta. Se conduce.",
    excerpt:
      "Tono Masters of the Roads. Tres momentos del viaje + CTA suave. Edición humana antes de publicar en Brevo.",
    body: `Hola {nombre},

Hay rutas que no caben en un vídeo de 30 segundos. Namibia es una de ellas: el silencio entre dunas, el polvo en la carcasa y ese momento en el que el grupo entiende por qué vinimos.

Tres notas del Tour Leader (David):
1) Sossusvlei al amanecer — el grupo completo, sin prisas.
2) Swakopmund — cena de cierre, tres referidos espontáneos.
3) Lo que no se publica: la confianza del día a día en el 4x4.

Si te late África otra vez (o por primera vez), responde a este correo o escribe a hola@camponorte.demo. Lo cerramos contigo.

Nosotros lo organizamos todo. Tú conduces.

— Equipo Campo Norte`,
    variables: ["{nombre}", "{destino}", "{proxima_salida}"],
    arguments: [
      "Namibia 12/12 y margen ~32 %: prueba social real",
      "Ahorra a Sofía la página en blanco (12–18 h/sem en contenido)",
      "Brevo es el canal de envío; el CRM solo prepara la plantilla",
      "Segmenta dormidos África sin spam automático",
    ],
    updatedAt: "2026-07-28",
  },
  {
    id: "D-04",
    type: "email_seguimiento",
    title: "Email · Seguimiento post-viaje (Brevo)",
    sourceTrip: "Costa Rica · mar 2026",
    status: "listo_para_brevo",
    channel: "Brevo · transaccional / NL 1:1",
    channelKind: "email_brevo",
    audience: "Viajeros con salida cerrada hace 7–14 días",
    owner: "Laura",
    subject: "{nombre}, ¿cómo fue la vuelta a casa tras {destino}?",
    excerpt:
      "Plantilla post-viaje para pedir NPS/referidos con tono cercano. El envío lo dispara el equipo en Brevo, no un bot.",
    body: `Hola {nombre},

Ya han pasado unos días desde {destino}. Esperamos que el polvo (o la arena) se haya asentado y que el recuerdo siga vivo.

Nos encantaría saber cómo lo viviste — una nota tuya vale más que mil métricas. Si conoces a alguien que encaje con Campo Norte, cuéntanoslo: los mejores viajes casi siempre empiezan por un referido.

Cuando quieras mirar la siguiente ruta, aquí estamos.
hola@camponorte.demo · +34 900 00 00 01

Un abrazo,
{owner}
Campo Norte`,
    variables: ["{nombre}", "{destino}", "{owner}", "{fecha_viaje}"],
    arguments: [
      "El momento post-viaje es el de mayor NPS y referidos",
      "Plantilla editable evita emails fríos o genéricos",
      "No es secuencia automática: Marta/Sofía eligen cuándo enviar",
      "Conecta con Customer Intelligence (embajador / recurrente)",
    ],
    updatedAt: "2026-07-25",
  },
  {
    id: "D-05",
    type: "whatsapp",
    title: "WhatsApp · Guion reactivación dormido",
    sourceTrip: "Lista dormidos · prioridad alta",
    status: "en_revision",
    channel: "WhatsApp (el equipo pega y envía)",
    channelKind: "whatsapp_script",
    audience: "Clientes dormidos priorizados (Isabel, Sofía T., Nuria…)",
    owner: "Sofía",
    subject: "Hola {nombre}, soy Sofía de Campo Norte",
    excerpt:
      "Guion corto para pegar en WhatsApp. La IA no envía: solo prepara el texto. Sofía llama o escribe.",
    body: `Hola {nombre}, soy Sofía de Campo Norte.

Vi que hace tiempo que no salimos juntos a la carretera ({ultimo_viaje}). Estaba pensando en ti con {destino_interes}.

¿Te va bien un momento esta semana para hablar sin compromiso? Si prefieres llamada, dime cuándo.

Un abrazo`,
    variables: ["{nombre}", "{ultimo_viaje}", "{destino_interes}"],
    arguments: [
      "Reactivación es palanca #1 hacia 1M € — pero Campo Norte vende trato humano",
      "El CRM abre wa.me con el texto listo; la persona pulsa enviar",
      "Evita el error de ‘secuencia WhatsApp automática’ que rompería la marca",
      "Prioridad sale de Customer Intelligence (score reactivación)",
    ],
    updatedAt: "2026-07-29",
  },
  {
    id: "D-06",
    type: "whatsapp",
    title: "WhatsApp · Confirmación docs reserva",
    sourceTrip: "Reservas · docs pendientes",
    status: "listo_para_envio",
    channel: "WhatsApp ops (Laura)",
    channelKind: "whatsapp_script",
    audience: "Reservas en estado docs_pendientes",
    owner: "Laura",
    subject: "Documentación para {destino}",
    excerpt:
      "Recordatorio amable de pasaporte/seguro/vacunas. Pegable en WhatsApp desde la ficha de reserva.",
    body: `Hola {nombre}, te escribe Marta de Campo Norte.

Para tu salida a {destino} ({fecha_salida}) nos faltan todavía:
{lista_docs}

Cuando puedas, mándanos fotos/PDF por este mismo chat o a hola@camponorte.demo.
Sin eso no podemos cerrar lodges y transfers con el operador.

Gracias — cualquier duda, aquí estamos.`,
    variables: ["{nombre}", "{destino}", "{fecha_salida}", "{lista_docs}"],
    arguments: [
      "Docs pendientes bloquean prep_viaje en logística",
      "Mensaje humano > email olvidado en spam",
      "Editable por reserva (lista_docs distinta en cada caso)",
      "No automatiza el envío: Marta decide el momento",
    ],
    updatedAt: "2026-07-27",
  },
  {
    id: "D-07",
    type: "sms_aviso",
    title: "Mensaje · Aviso interno Tour Leader",
    sourceTrip: "Ops · T-7",
    status: "listo_para_envio",
    channel: "Slack / email interno / SMS equipo",
    channelKind: "mensaje_interno",
    audience: "Tour Leaders + office (nunca al viajero)",
    owner: "Sistema → Marta/David/Ramón",
    subject: "[T-7] Prep {destino} · {reserva_id}",
    excerpt:
      "Plantilla de aviso interno 7 días antes: checklist, contactos locales y saldo pendiente.",
    body: `Aviso interno — no reenviar al cliente.

Reserva {reserva_id} · {cliente} · {destino} · salida {fecha_salida}
Vehículo: {vehiculo} · Pax: {pax}
Saldo pendiente: {saldo} €
Docs OK: {docs_ok}

Contactos logística:
{contactos}

Checklist abierta:
{checklist_pendiente}

Owner comercial: {owner}`,
    variables: [
      "{reserva_id}",
      "{cliente}",
      "{destino}",
      "{fecha_salida}",
      "{vehiculo}",
      "{pax}",
      "{saldo}",
      "{docs_ok}",
      "{contactos}",
      "{checklist_pendiente}",
      "{owner}",
    ],
    arguments: [
      "Reduce pings a Sofía preguntando ‘¿está todo listo?’",
      "Une Reservas & logística con el canal interno del equipo",
      "Plantilla editable = cada TL ve el formato que necesita",
      "Cumple la regla de oro: cero mensajes automáticos al viajero",
    ],
    updatedAt: "2026-07-22",
  },
  {
    id: "D-02",
    type: "resumen_expedicion",
    title: "LinkedIn + IG · Mongolia (carrusel)",
    sourceTrip: "Mongolia · sep 2026",
    status: "borrador_ia",
    channel: "LinkedIn + Instagram",
    channelKind: "rrss",
    audience: "Audiencia RRSS · prospectos premium moto",
    owner: "Sofía",
    subject: "Mongolia no es un destino. Es una línea en el mapa.",
    excerpt:
      "Carrusel 5 slides: hook → ruta → ritual → ops → CTA. Estilo sobrio, sin emojis forzados.",
    body: `SLIDE 1 — Hook
Mongolia no es un destino. Es una línea en el mapa que solo se entiende en moto.

SLIDE 2 — Ruta
UB → Terelj → estepa central → regreso.

SLIDE 3 — Ritual
Briefing al amanecer. El Tour Leader hace que el grupo llegue entero.

SLIDE 4 — Ops
Lodges, comidas y operador local ya cerrados en el CRM.

SLIDE 5 — CTA
Próxima salida Mongolia · example.com

Pie LinkedIn: 1 pregunta al final. Sin hashtags basura.`,
    variables: ["{destino}", "{utm_campaign}", "{url}"],
    arguments: [
      "Producto hero de marca con UTM medible",
      "Slide ops diferencia a Campo Norte de agencias solo Instagram",
      "Revisión humana obligatoria antes de publicar",
    ],
    updatedAt: "2026-07-26",
  },
  {
    id: "D-03",
    type: "secuencia_interna",
    title: "Blog + guion YouTube + resumen interno",
    sourceTrip: "La Puna · oct 2025",
    status: "listo_para_brevo",
    channel: "Blog · YouTube · Drive interno",
    channelKind: "pack_multimedia",
    audience: "SEO + comunidad + briefing equipo",
    owner: "Marta / Content",
    subject: "La Puna en 4x4: altitud, silencio y el grupo",
    excerpt:
      "Pack triple: post ~800 palabras, guion 8 min y resumen ops. El equipo elige qué publicar.",
    body: `A) BLOG (~800 palabras)
Estructura: apertura real → 3 días clave → qué organiza Campo Norte → para quién es → CTA.

B) GUION YOUTUBE (8 min)
0:00 Hook · 0:40 Promesa · 2:00 Día tipo · 4:30 Ops · 6:30 Testimonio · 7:20 CTA

C) RESUMEN INTERNO (no publicar)
Ocupación 12/12 · 1 incidencia meteo · referidos potenciales: 4 → Lead Intelligence`,
    variables: ["{destino}", "{ocupacion}", "{referidos}"],
    arguments: [
      "Una salida debe dejar activo reutilizable",
      "Resumen interno alimenta Knowledge y referidos",
      "SEO/YT apoyan el gap a 1M €",
    ],
    updatedAt: "2026-07-20",
  },
  {
    id: "D-08",
    type: "email_seguimiento",
    title: "Email · Factura / cobro saldo (Brevo)",
    sourceTrip: "Facturas · saldo pendiente",
    status: "en_revision",
    channel: "Brevo · email cobro",
    channelKind: "email_brevo",
    audience: "Clientes con saldo_pendiente o deposito_pendiente",
    owner: "Laura",
    subject: "Saldo pendiente · {destino} · {factura_numero}",
    excerpt:
      "Plantilla educada de cobro con enlace a transferencia/Stripe. Adjunta mención de factura PDF.",
    body: `Hola {nombre},

Te escribo por el saldo pendiente de tu reserva a {destino}.

Importe pendiente: {saldo} €
Factura: {factura_numero}
Forma de pago preferida: {medio_pago}

Puedes responder a este correo cuando esté transferido o usar el enlace de pago que te pasamos.
Si hay cualquier duda con fechas o documentación, dímelo y lo vemos.

Gracias,
Marta · Campo Norte
hola@camponorte.demo`,
    variables: ["{nombre}", "{destino}", "{saldo}", "{factura_numero}", "{medio_pago}"],
    arguments: [
      "Une Facturas Veri*FACTU con comunicación humana de cobro",
      "Plantilla evita tonos agresivos o inconsistentes",
      "Editable por importe/medio (Stripe, SEPA…)",
      "El PDF de factura se adjunta manualmente desde el módulo Facturas",
    ],
    updatedAt: "2026-07-28",
  },
];

export const AUTOMATIONS: AutomationJob[] = [
  {
    id: "A-01",
    name: "Captura web → ficha lead + UTM + campaña",
    from: "example.com / formularios",
    to: "Data Hub · CRM",
    status: "ok",
    lastRun: "hace 3 min",
    note: "Cada lead entra con origen, campaña, destino y vehículo. Pipeline orquestado: dedupe → score Ollama → aviso owner → seguimiento. Sin ficha no hay Growth OS.",
    trigger: "Submit formulario o landing de expedición",
    cadence: "Tiempo real · ~30–40 leads/mes",
    arguments: [
      "Hoy >70 % de reservas sin origen medible — este flujo cierra esa fuga",
      "UTM + campaña + destino permiten atribución en el dashboard",
      "Deduplica por email/teléfono antes de crear ficha (evita doble seguimiento)",
      "Clasifica con Ollama API (o heurística) — la IA no habla con el viajero",
    ],
    neverDoes: "No envía email ni WhatsApp al lead",
    runs30d: 38,
  },
  {
    id: "A-02",
    name: "Scoring explicable + cola comercial",
    from: "Data Hub",
    to: "Lead Intelligence → owner",
    status: "ok",
    lastRun: "hace 3 min",
    note: "Reglas + señales Brevo. Score auditables. Aviso interno a Sofía/Marta.",
    trigger: "Alta o actualización de lead",
    cadence: "Tras cada alta · re-score diario",
    arguments: [
      "Sofía no puede triar 25–40 leads/mes a ojo: el score ordena la cola",
      "Razones visibles (referido, clic NL, destino) = confianza del CEO",
      "Owner asignado por reglas (VIP/referido → Sofía; resto → Marta)",
    ],
    neverDoes: "No cualifica ni responde al lead automáticamente",
    runs30d: 112,
  },
  {
    id: "A-03",
    name: "Brevo (lectura) → engagement en ficha",
    from: "Brevo API (solo lectura)",
    to: "CRM · scoring · CI",
    status: "ok",
    lastRun: "hace 42 min",
    note: "Opens/clicks alimentan score y listas de dormidos. Envío sigue en Brevo manual.",
    trigger: "Webhook / sync horaria de eventos",
    cadence: "Cada hora + diario completo",
    arguments: [
      "Brevo ya es el canal: no lo sustituimos, lo escuchamos",
      "Un dormido que abre 5 NL no es lo mismo que uno frío — prioriza llamadas",
      "Content Factory usa engagement para elegir a quién no molestar",
    ],
    neverDoes: "No dispara campañas ni secuencias al cliente",
    runs30d: 720,
  },
  {
    id: "A-04",
    name: "Reserva confirmada → checklist logística",
    from: "CRM · Reservas",
    to: "Ops · Tour Leader · proveedores",
    status: "ok",
    lastRun: "hace 1 h",
    note: "Crea prep: docs, lodges, comidas, contactos locales, saldo. Vista 360º del viaje.",
    trigger: "Estado reserva = reservado / prep_viaje",
    cadence: "Por reserva · recordatorios T-30/T-14/T-7",
    arguments: [
      "«Nosotros lo organizamos todo» exige trazabilidad de lodges, comidas y operadores",
      "Tour Leader (Jorge/Luis) ve contactos y stops sin preguntar a Sofía",
      "Docs pendientes bloquean prep_viaje → alerta interna, no al cliente",
    ],
    neverDoes: "No escribe al viajero ni al hotel en su nombre",
    runs30d: 24,
  },
  {
    id: "A-05",
    name: "Webhooks de cobro (Stripe · PayPal · SEPA)",
    from: "Pasarelas / banco",
    to: "Reserva + Factura + saldo cliente",
    status: "ok",
    lastRun: "hace 18 min",
    note: "Concilia depósito/saldo. Actualiza paymentStatus y genera borrador de factura REAV.",
    trigger: "Pago recibido o fallido",
    cadence: "Tiempo real",
    arguments: [
      "Multi-canal: Stripe, transferencia SEPA, PayPal, efectivo, depósito",
      "Saldo pendiente visible en ficha cliente (como un CRM de verdad)",
      "Evita Excel paralelo de Marta para conciliar señales",
    ],
    neverDoes: "No cobra ni reintenta cargos sin acción humana",
    runs30d: 56,
  },
  {
    id: "A-06",
    name: "Factura REAV → registro Veri*FACTU",
    from: "Módulo Facturas",
    to: "SIF / AEAT (cuando activo) + gestoría",
    status: "ok",
    lastRun: "hace 12 min",
    note: "Export gestoría + hash REAV 05 operativo. Remisión AEAT en modo preparado (plazo IS 01/01/2027) — no es un fallo, es cumplimiento por fases.",
    trigger: "Emitir / cobrar factura",
    cadence: "Por factura · export semanal gestoría",
    arguments: [
      "Obligación SIF: LGT 29.2.j) + RD 1007/2023; agencias en DA 2ª",
      "REAV clave 05 (Orden HAC/1177/2024) — sin esto la gestoría no puede cerrar",
      "Plazo IS 01/01/2027 (RD-ley 15/2025): construir ahora evita prisas",
    ],
    neverDoes: "No presenta impuestos; exporta paquete listo para gestoría",
    runs30d: 18,
  },
  {
    id: "A-07",
    name: "Cola dormidos / VIP → aviso interno",
    from: "Customer Intelligence",
    to: "Slack / email Sofía·Marta",
    status: "ok",
    lastRun: "hace 6 h",
    note: "Lista priorizada con motivo. La llamada la hace una persona.",
    trigger: "Cron diario 08:00 + score reactivación > 70",
    cadence: "Diario laborable",
    arguments: [
      "≈55–65 % clientes con 1 viaje: reactivación es palanca #1 a 1M €",
      "Prioridad = LTV × meses dormido × engagement — no spam",
      "Embajadores y VIP tienen playbooks distintos (referidos vs despertar)",
    ],
    neverDoes: "Nunca envía WhatsApp/email automático al cliente",
    runs30d: 22,
  },
  {
    id: "A-08",
    name: "Cierre de expedición → Content Factory",
    from: "Ops · viaje cerrado",
    to: "Borradores NL / IG / resumen interno",
    status: "ok",
    lastRun: "hace 1 d",
    note: "IA genera borrador; equipo edita tono Campo Norte y publica en Brevo/RRSS.",
    trigger: "Reserva/expedición = cerrado + NPS opcional",
    cadence: "Por salida cerrada",
    arguments: [
      "Sofía gasta 12–18 h/sem en contenido: este flujo le devuelve horas",
      "Material real del viaje (ocupación, anécdotas ops) > copy genérico",
      "Publicación siempre con revisión humana de marca",
    ],
    neverDoes: "No publica ni envía NL sin aprobación",
    runs30d: 3,
  },
  {
    id: "A-09",
    name: "Dashboard vivo (ocupación · margen · origen)",
    from: "Hub + Reservas + Facturas",
    to: "Dashboard ejecutivo",
    status: "ok",
    lastRun: "hace 5 min",
    note: "KPIs YTD, gap a 1M, margen por salida, mapa de procedencia.",
    trigger: "Cambio en reserva, pago o lead atribuido",
    cadence: "Cada 5 min + snapshot diario",
    arguments: [
      "Sin cuadro de mando el CEO decide con intuición y Excel",
      "Atribución visible fuerza disciplina de UTM en captación",
      "Margen por expedición alinea precio con objetivo ~30 %",
    ],
    neverDoes: "No toma decisiones de precio solo; informa al humano",
    runs30d: 8_640,
  },
  {
    id: "A-10",
    name: "Export semanal → gestoría (CSV Veri*FACTU/REAV)",
    from: "Facturas + pagos",
    to: "Paquete gestoría / Drive",
    status: "ok",
    lastRun: "hace 2 d",
    note: "Libro de facturas, claves 05, hashes, conciliación de cobros. Listo para asesor.",
    trigger: "Cron lunes 07:30 o botón manual",
    cadence: "Semanal + bajo demanda",
    arguments: [
      "La gestoría necesita un extracto único, no 4 Excels",
      "Campos alineados a AEAT/REAV y checklist RRSIF",
      "Conservación y trazabilidad = menos fricción en inspección",
    ],
    neverDoes: "No sustituye a la gestoría ni presenta modelos fiscales",
    runs30d: 5,
  },
  {
    id: "A-11",
    name: "Knowledge RAG interno (ops · margen · playbooks)",
    from: "Drive / fichas / hojas",
    to: "Asistente Knowledge (solo equipo)",
    status: "ok",
    lastRun: "hace 20 min",
    note: "Responde con fuentes. Para Marta/David/Sofía — no expuesto al cliente.",
    trigger: "Pregunta interna o indexación nocturna",
    cadence: "Index diario · Q&A bajo demanda",
    arguments: [
      "El conocimiento no puede vivir solo en la cabeza de Sofía",
      "Respuestas citan hoja/ficha: auditables",
      "Acelera onboarding de Tour Leaders y office",
    ],
    neverDoes: "No chat público ni respuestas a viajeros",
    runs30d: 86,
  },
  {
    id: "A-12",
    name: "Deep links humanos (tel · WhatsApp · ficha)",
    from: "CRM · ficha 360º",
    to: "Acción del owner en el móvil",
    status: "ok",
    lastRun: "hace 12 min",
    note: "Un clic abre llamada o WhatsApp con contexto. El mensaje lo escribe la persona.",
    trigger: "Click en ficha cliente / reserva",
    cadence: "Bajo demanda",
    arguments: [
      "Campo Norte vende trato humano: la tech acorta el camino hasta la conversación",
      "Contexto (saldo, docs, último viaje) en pantalla antes de marcar",
      "Misma UX que un CRM serio de operaciones, no un chatbot",
    ],
    neverDoes: "No genera ni envía el mensaje al cliente",
    runs30d: 64,
  },
];


export type KnowledgeItem = {
  q: string;
  a: string;
  sources: string[];
  /** Por qué esta pregunta importa en el Growth OS */
  why: string[];
  category: "ops" | "margen" | "clientes" | "legal" | "contenido" | "stack";
};

export const KNOWLEDGE_ANSWERS: KnowledgeItem[] = [
  {
    category: "margen",
    q: "¿Cuál fue el margen de Namibia junio 2026?",
    a: "Margen bruto ≈ 32,5 % (84.000 € ingresos − 56.700 € coste). Ocupación 12/12. Si la hoja de costes no está cerrada por Marta/David, marcar como provisional en el dashboard.",
    sources: ["Hoja Reservas 2026", "Ficha E-26-03 Namibia", "Dashboard ejecutivo"],
    why: [
      "El CEO decide precio y repetición de ruta con margen real, no con intuición",
      "Objetivo de negocio ~30 %: Namibia está por encima — argumento para repetir y comunicar",
      "Sin esta respuesta en Knowledge, Sofía vuelve a Excel y pierde horas",
    ],
  },
  {
    category: "margen",
    q: "¿Qué precio mínimo mantiene ~30 % en Mongolia moto?",
    a: "Con coste medio demo ≈ 4.760 €/plaza a ocupación plena, ticket orientativo ≈ 6.800 €/persona para ~30 % de margen. SUPUESTO a validar con Marta/David antes de publicar precio.",
    sources: ["Modelo coste/margen por ruta", "Expedición Mongolia sep 2026", "Assumptions avg_ticket"],
    why: [
      "Evita vender ‘de oído’ por debajo de coste+margen",
      "Content Factory y web comercial deben usar el mismo número",
      "El Knowledge no fija precio solo: informa; el veto es humano",
    ],
  },
  {
    category: "clientes",
    q: "¿A quién reactivar primero este mes?",
    a: "Isabel Navarro (prioridad 96), Sofía Torres (84), Nuria Pons (72). Criterio: LTV × meses dormido × engagement Brevo. La llamada la hace Sofía o quien él delegue — no un bot.",
    sources: ["Customer Intelligence", "Eventos Brevo (lectura)", "Segmento dormidos"],
    why: [
      "≈55–65 % de clientes con un solo viaje: reactivación es palanca #1 a 1M €",
      "Sin ranking, el tiempo comercial se gasta en leads fríos",
      "Refuerza la regla de oro: el sistema prioriza; la persona contacta",
    ],
  },
  {
    category: "clientes",
    q: "¿Quiénes son VIP / embajadores y qué no hacer con ellos?",
    a: "VIP ejemplo: Marta Vidal (11 viajes, LTV 58k). Embajador: Carlos Méndez (3 referidos). No ‘despertar’ con NL fría: pedir referidos, invitaciones premium o testimonio. Playbook distinto al dormido.",
    sources: ["Fichas C-003 / C-055", "Customer Intelligence segmentos"],
    why: [
      "Tratar un VIP como dormido quema la relación",
      "Los embajadores son el canal de referidos más barato",
      "Content Factory puede pedir testimonio solo a este segmento",
    ],
  },
  {
    category: "ops",
    q: "¿Qué lodges y comidas hay confirmados en Mongolia sep 2026 (Marta Vidal)?",
    a: "Reserva R-4821: Kempinski UB (D0–D1 y D9–D10), Ger camp Terelj (D2–D4), campamentos móviles estepa (D5–D8). Comidas: cena bienvenida, PC en camps, picnic ruta, cena despedida. Contactos: Bat-Erdene Travel, Tuguldur Garage, Kempinski groups.",
    sources: ["Reservas & logística R-4821", "Checklist prep viaje"],
    why: [
      "«Nosotros lo organizamos todo» debe ser consultable en 10 segundos",
      "Tour Leader (Jorge) no depende del WhatsApp de Sofía",
      "Es la fuente de verdad que alimenta Content Factory y Knowledge",
    ],
  },
  {
    category: "ops",
    q: "¿Qué reservas tienen documentación pendiente?",
    a: "Ejemplo demo: R-4822 Sergio Molina (Colombia) — vacunas/seguro y plan 4x4 pendientes. Estado docs_pendientes. Contactar por WhatsApp con plantilla D-06 de Content Factory.",
    sources: ["Reservas & logística", "Content Factory D-06", "Ficha cliente C-088"],
    why: [
      "Docs bloquean prep_viaje y lodges con operador",
      "Une CRM + plantilla humana sin automatizar el envío",
      "Reduce riesgo de salida con pax incompleto",
    ],
  },
  {
    category: "ops",
    q: "¿Quién es el Tour Leader y el operador local de Namibia jun 2026?",
    a: "Tour Leader: Luis Ortega. Operador Windhoek: Desert Track Safaris (+264 61 220 110). Lodge Sossusvlei: Sossus Dune Lodge. Viaje cerrado (R-4823) — útil como playbook para la siguiente edición.",
    sources: ["R-4823", "TEAM assumptions", "Historial Ana Beltrán"],
    why: [
      "El conocimiento no puede vivir solo en la cabeza de Sofía",
      "Acelera onboarding de office y TL nuevos",
      "Base para RAG interno Fase 5",
    ],
  },
  {
    category: "margen",
    q: "¿Cómo vamos respecto al objetivo 1M € 2027?",
    a: "Anexo demo: run-rate actual ~800k; gap +200k (~25 %). Palancas: +18 viajeros / +4 salidas, reactivación dormidos (10–15 reservas/año), mejor ocupación y ajuste de precio moderado. Ver dashboard YTD y pace anualizado.",
    sources: ["Dashboard ejecutivo", "MPS_ANNEX", "PROPUESTA.md"],
    why: [
      "Una sola pantalla evita reunir 4 Excels antes de cada decisión",
      "Conecta Growth OS con el business case del CEO",
      "Argumenta por qué Data Hub + CI no son ‘tech por tech’",
    ],
  },
  {
    category: "margen",
    q: "¿Qué % de reservas sigue sin origen atribuido?",
    a: "Diagnóstico brief: >70 % sin origen medible hoy. Meta 6 meses: 95 % leads/reservas con origen (UTM, referido, feria, Brevo…). El Data Hub + captura web cierran esa fuga.",
    sources: ["Assumptions gap_attribution", "Lead Intelligence", "Data Hub"],
    why: [
      "Sin origen no hay ROI de canal ni presupuesto inteligente",
      "Es el cuello de botella #1 técnico del negocio",
      "Justifica Fase 1 (quick win) del roadmap",
    ],
  },
  {
    category: "legal",
    q: "¿Qué clave Veri*FACTU / REAV usamos en facturas de viaje?",
    a: "Régimen especial agencias de viajes: ClaveRégimen = 05 (Orden HAC/1177/2024 L8A/L8B). Mención en factura: «Régimen especial de las agencias de viajes» (LIVA arts. 141–147). Base imponible = margen. Plazo IS: 01/01/2027 (RD-ley 15/2025).",
    sources: ["Módulo Facturas", "legal-verifactu.ts", "AEAT FAQ REAV"],
    why: [
      "La gestoría necesita respuestas citadas, no humo",
      "Evita facturar en régimen general por error",
      "Argumenta el módulo Facturas en la demo en la demo",
    ],
  },
  {
    category: "legal",
    q: "¿Qué exportamos a gestoría cada semana?",
    a: "CSV con número, fechas, cliente NIF/dirección, reserva, base margen, IVA, total, clave 05, calificación S1/E6, mención REAV, hash Veri*FACTU, estado AEAT, medio de pago y cobro. Botón «Exportar a gestoría» + PDFs individuales.",
    sources: ["GESTORIA_EXPORT_FIELDS", "A-10 automatización", "invoice-pdf"],
    why: [
      "Un extracto único sustituye 4 Excels",
      "Trazabilidad ante inspección / RRSIF",
      "Demuestra que el CRM alimenta backoffice real",
    ],
  },
  {
    category: "contenido",
    q: "¿Qué plantilla uso para reactivar un dormido por WhatsApp?",
    a: "Content Factory D-05 «WhatsApp · Guion reactivación dormido». Variables {nombre}, {ultimo_viaje}, {destino_interes}. Copiar → pegar en WhatsApp. Sofía envía; la IA no escribe al cliente.",
    sources: ["Content Factory D-05", "Customer Intelligence", "Regla de oro"],
    why: [
      "Evita mensajes improvisados que rompen el tono Campo Norte",
      "Une CI (quién) + Content (qué decir) + acción humana",
      "Es el argumento central frente a ‘automatizar WhatsApp’",
    ],
  },
  {
    category: "contenido",
    q: "¿Qué publicar tras cerrar una expedición?",
    a: "Pack típico: NL Brevo (D-01/estilo), carrusel RRSS (D-02), blog+guion+resumen interno (D-03). Flujo A-08 genera borrador; el equipo edita tono y publica. Resumen interno alimenta referidos a Lead Intelligence.",
    sources: ["Content Factory", "Automatización A-08", "Knowledge ops"],
    why: [
      "Una salida debe dejar activo reutilizable",
      "Reduce las 12–18 h/sem de Sofía en contenido",
      "Prueba social real > copy genérico",
    ],
  },
  {
    category: "stack",
    q: "¿Qué stack propone el Growth OS y por qué no un bot al cliente?",
    a: "Airtable/Postgres + n8n/Make + Brevo (lectura/envío manual) + panel web interno + SIF/Veri*FACTU. Campo Norte vende trato humano: la tech trabaja detrás. Toda interacción con el viajero es persona (Sofía/Marta/TL).",
    sources: ["assumptions.stack", "GOLDEN_RULE", "PROPUESTA.md"],
    why: [
      "Alinea con capacidad part-time de la demo",
      "Responde la objeción ‘¿más software?’ con realismo",
      "Protege la marca premium frente a automatismos fríos",
    ],
  },
  {
    category: "stack",
    q: "¿Cómo se crea o edita una automatización en el ecosistema?",
    a: "Ecosistema CRM → editor estilo n8n: crear/editar/duplicar/exportar JSON. Nodos con values, form y API. Ejemplo: captura web → set values → HTTP Hub → IF → CRM / aviso interno. Nunca nodo de envío automático al cliente.",
    sources: ["N8nFlowBuilder", "flow-data.ts", "A-01…A-12"],
    why: [
      "Sofía ve que no son 4 zaps opacos",
      "Export JSON = puente real a n8n/Make",
      "Argumenta mantenibilidad part-time del sistema",
    ],
  },
  {
    category: "ops",
    q: "¿Qué saldos pendientes hay abiertos y por qué medio se cobran?",
    a: "Ejemplos demo: Marta Vidal saldo 4.800 € (Stripe/transfer), Sergio Molina 7.800 € (SEPA depósito Colombia), Carlos Méndez 5.900 € (PayPal Tanzania). Medios: Stripe, SEPA, PayPal, depósito, efectivo. Sin Bizum (límite diario y riesgo fiscal). Conciliación vía webhooks A-05.",
    sources: ["Customer Intelligence", "Reservas", "Facturas", "A-05"],
    why: [
      "Office deja de conciliar en Excel paralelo",
      "Une ficha cliente + reserva + factura",
      "Visibilidad de caja operativa para el CEO",
    ],
  },
  {
    category: "clientes",
    q: "¿Cuál es el ticket medio y LTV de referencia?",
    a: "Ticket medio supuesto ≈ 5.300 € (800k / 150 viajeros). LTV ejemplos: VIP Marta 58k, embajador Carlos 16,8k, dormido Isabel 11,2k. Usar para priorizar reactivación y upsell premium con cuidado.",
    sources: ["assumptions.avg_ticket", "CLIENTS demo", "Dashboard"],
    why: [
      "Sin LTV la prioridad comercial es ciega",
      "Argumenta por qué no todos los leads valen igual",
      "Conecta scoring con dinero real",
    ],
  },
  {
    category: "margen",
    q: "¿Cuántas plazas quedan en la próxima Mongolia?",
    a: "Demo E-26-04 Mongolia sep 2026: 10/12 plazas (ocup. ~83 %). Revisar ficha de expedición y reservas asociadas antes de confirmar nuevos pax.",
    sources: ["EXPEDITIONS", "Reservas", "Dashboard margen/ocupación"],
    why: [
      "Ocupación es palanca directa del margen",
      "Evita overbooking o vender tarde sin visibilidad",
      "Pregunta típica de office/CEO en el día a día",
    ],
  },
];

export function routeMargins() {
  return EXPEDITIONS.map((e) => {
    const margin = e.revenue - e.cost;
    const marginPct = e.revenue > 0 ? (margin / e.revenue) * 100 : 0;
    const occupancy = e.seats > 0 ? (e.booked / e.seats) * 100 : 0;
    return { ...e, margin, marginPct, occupancy };
  });
}

export function originBreakdown() {
  const totals: Record<LeadOrigin, number> = {
    web_form: 0,
    instagram: 0,
    referral: 0,
    brevo_click: 0,
    feria: 0,
    unknown: 0,
  };
  for (const e of EXPEDITIONS) {
    for (const [k, v] of Object.entries(e.originMix)) {
      totals[k as LeadOrigin] += v ?? 0;
    }
  }
  return (Object.keys(totals) as LeadOrigin[]).map((origin) => ({
    origin,
    label: ORIGIN_LABEL[origin],
    value: totals[origin],
  }));
}

export function progressToMillion() {
  const ytd = MONTHLY_KPIS.reduce((s, m) => s + m.revenue, 0);
  const pace = Math.round((ytd / 7) * 12);
  return {
    ytd,
    pace,
    target: MPS_ANNEX.revenueTarget2027,
    currentRunRate: MPS_ANNEX.revenueCurrent,
    gap: MPS_ANNEX.revenueTarget2027 - MPS_ANNEX.revenueCurrent,
  };
}

export function leadStats() {
  const sorted = [...LEADS].sort((a, b) => b.score - a.score);
  const unknown = LEADS.filter((l) => l.origin === "unknown").length;
  const avg = Math.round(LEADS.reduce((s, l) => s + l.score, 0) / LEADS.length);
  return { sorted, unknown, avg, total: LEADS.length };
}
