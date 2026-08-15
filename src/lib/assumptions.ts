/**
 * Campo Norte Logística — supuestos del business case WMS (demo ficticia).
 * Cifras inventadas para demostrar el ecosistema de almacén.
 */

export const MPS_ANNEX = {
  revenueCurrent: 28_500_000,
  revenueTarget2027: 34_000_000,
  travelersCurrent: 0,
  travelersTarget: 0,
  departuresCurrent: 0,
  departuresTarget: 0,
  clientsReal: 86,
  subscribers: 0,
  marginTargetPct: 18,
  motoShareApprox: 0,
  /** Palets vivos en hub Sevilla (demo) */
  palletsLive: 4200,
  /** Huecos totales hub */
  slotsTotal: 8640,
  /** Operarios activos multi-turno */
  operatorsActive: 186,
  /** Flota eléctrica */
  fleetUnits: 48,
} as const;

export const COMPANY = {
  name: "Campo Norte",
  legal: "Campo Norte Logística, S.L.",
  tagline: "El almacén bajo control. Cada hueco, cada palet, cada euro.",
  promise: "Torre de control para centros tipo hipermercado y hubs europeos.",
  founded: 2015,
  website: "https://example.com",
  email: "ops@camponorte.demo",
  phone: "+34 900 00 00 01",
  ceo: "Sofía Navarro",
  ceoTitle: "Directora general",
} as const;

export const TEAM = [
  { name: "Sofía Navarro", role: "Directora general · P&L del ecosistema" },
  { name: "Marta Vega", role: "Office · facturación, costes y control" },
  { name: "Luis Ortega", role: "Jefe de almacén · Sevilla hub" },
  { name: "Jorge Peña", role: "Operario / carretillero · planta" },
] as const;

export const MPS_ASSUMPTIONS = [
  {
    id: "slot_accuracy",
    label: "Precisión de ubicación",
    value: "≥ 99,5 %",
    rationale: "Sin hueco correcto no hay picking fiable ni inventario cíclico creíble.",
  },
  {
    id: "pallet_trace",
    label: "Trazabilidad por palet",
    value: "SSCC + lote + caducidad",
    rationale: "Modelo retail Andalucía / cold-chain alemán: el palet es la unidad de verdad.",
  },
  {
    id: "fleet_util",
    label: "Utilización flota eléctrica",
    value: "70–85 % turno",
    rationale: "Batería, horas y coste/hora visibles; mantenimiento anticipado.",
  },
  {
    id: "labor_share",
    label: "Peso de mano de obra",
    value: "45–55 % del coste centro",
    rationale: "Turnos, extras y productividad por rol — RRHH operativo, no nómina legal.",
  },
  {
    id: "shrink",
    label: "Merma objetivo",
    value: "< 0,35 % valor stock",
    rationale: "Caducidad, calidad y ajustes inventariados en el mismo hub.",
  },
  {
    id: "cut_off",
    label: "Cumplimiento cut-off tienda",
    value: "≥ 97 %",
    rationale: "Olas de expedición con prioridad express/urgente/normal.",
  },
  {
    id: "energy",
    label: "Energía + frío",
    value: "Monitorizado vs presupuesto",
    rationale: "En hubs con cámara, la energía es el segundo coste después de gente.",
  },
  {
    id: "stack",
    label: "Stack del ecosistema",
    value: "WMS + flota + RRHH ops + costes + IA interna",
    rationale: "Misma base Campo Norte (auth, hub, shell); dominio de almacén encima.",
  },
] as const;

export const GOLDEN_RULE =
  "La torre de control no sustituye al jefe de almacén: orquesta huecos, gente y euros para que la planta decida mejor.";
