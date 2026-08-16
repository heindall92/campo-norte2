import { seedInventoryCore } from "./inventory-core";
import { seedMemberships } from "./tenant";
import { slotRecordId } from "./location";
import { generateSiteSlots } from "./onboard";
import { CAMPO_NORTE_ORG } from "./org";
import { dockWindowFor } from "./carriers";
import { ensureShiftRoster } from "./roster";
import { WMS_DEMO_NOW } from "./alerts";
import {
  SYSTEM_CATEGORIES,
  type Carrier,
  type CostLine,
  type FleetUnit,
  type InboundAsn,
  type Operator,
  type OutboundOrder,
  type Pallet,
  type PickWave,
  type Sku,
  type Slot,
  type StockMovement,
  type WallCharger,
  type WarehouseSite,
  type WmsSnapshot,
} from "./types";

function hire(op: Omit<Operator, "vacant" | "fingerprintEnrolled" | "pinHash">): Operator {
  return { ...op, vacant: false, fingerprintEnrolled: false, pinHash: null };
}

function withBattery(
  unit: Omit<FleetUnit, "batterySource" | "batteryReportedAt" | "chargerId">,
  chargerId: string | null = null,
): FleetUnit {
  return {
    ...unit,
    batterySource: "seed",
    batteryReportedAt: "2026-08-15T07:00:00.000Z",
    chargerId,
  };
}

const SITE_SEV: WarehouseSite = {
  id: "site-sev",
  orgId: CAMPO_NORTE_ORG.id,
  code: "CN-SEV-01",
  name: "Hub Campo Norte Sevilla",
  city: "Sevilla",
  region: "Andalucía",
  country: "ES",
  sqm: 42_000,
  slotsTotal: 8_640,
  temperatureModes: ["seco", "fresco", "congelado", "picking", "muelle", "crossdock"],
};

const SITE_HUE: WarehouseSite = {
  id: "site-hue",
  orgId: CAMPO_NORTE_ORG.id,
  code: "CN-HUE-02",
  name: "Cámara fría Huelva",
  city: "Huelva",
  region: "Andalucía",
  country: "ES",
  sqm: 18_500,
  slotsTotal: 3_200,
  temperatureModes: ["fresco", "congelado", "muelle"],
};

const SKUS: Sku[] = [
  {
    id: "sku-aceite",
    sku: "ALI-ACE-5L",
    name: "Aceite de oliva 5 L",
    category: "alimentacion_seca",
    uom: "caja",
    unitsPerPallet: 48,
    weightKg: 720,
    abc: "A",
    minStock: 120,
    maxStock: 800,
  },
  {
    id: "sku-arroz",
    sku: "ALI-ARR-1K",
    name: "Arroz redondo 1 kg",
    category: "alimentacion_seca",
    uom: "caja",
    unitsPerPallet: 80,
    weightKg: 640,
    abc: "A",
    minStock: 200,
    maxStock: 1200,
  },
  {
    id: "sku-leche",
    sku: "FRE-LEC-1L",
    name: "Leche entera 1 L",
    category: "frescos",
    uom: "caja",
    unitsPerPallet: 60,
    weightKg: 630,
    abc: "A",
    minStock: 180,
    maxStock: 900,
  },
  {
    id: "sku-jamon",
    sku: "FRE-JAM-BO",
    name: "Jamón loncheado bandeja",
    category: "perecederos",
    uom: "caja",
    unitsPerPallet: 100,
    weightKg: 280,
    abc: "A",
    minStock: 80,
    maxStock: 400,
  },
  {
    id: "sku-helado",
    sku: "CON-HEL-2L",
    name: "Helado vainilla 2 L",
    category: "congelados",
    uom: "caja",
    unitsPerPallet: 40,
    weightKg: 320,
    abc: "B",
    minStock: 60,
    maxStock: 300,
  },
  {
    id: "sku-agua",
    sku: "BEB-AGU-1.5",
    name: "Agua mineral 1,5 L",
    category: "bebidas",
    uom: "caja",
    unitsPerPallet: 72,
    weightKg: 864,
    abc: "B",
    minStock: 150,
    maxStock: 1000,
  },
  {
    id: "sku-detergente",
    sku: "NF-DET-3L",
    name: "Detergente líquido 3 L",
    category: "no_food",
    uom: "caja",
    unitsPerPallet: 36,
    weightKg: 540,
    abc: "C",
    minStock: 40,
    maxStock: 240,
  },
  {
    id: "sku-yogur",
    sku: "FRE-YOG-PACK",
    name: "Yogur natural pack 8",
    category: "frescos",
    uom: "caja",
    unitsPerPallet: 90,
    weightKg: 360,
    abc: "A",
    minStock: 100,
    maxStock: 500,
  },
];

function buildSlots(): Slot[] {
  /** Rack selectivo: montantes azules · travesaños · 2 palets/bahía · 4 niveles */
  const seville = generateSiteSlots(
    SITE_SEV.id,
    [
      { zone: "seco", aisle: "A", racks: 12, levels: 4 },
      { zone: "seco", aisle: "B", racks: 10, levels: 4 },
      { zone: "fresco", aisle: "C", racks: 8, levels: 3 },
      { zone: "congelado", aisle: "D", racks: 6, levels: 3 },
      { zone: "picking", aisle: "P", racks: 6, levels: 2 },
      { zone: "muelle", aisle: "M", racks: 4, levels: 1 },
    ],
    { occupy: true },
  );
  const huelva = generateSiteSlots(
    SITE_HUE.id,
    [
      { zone: "fresco", aisle: "F", racks: 6, levels: 3 },
      { zone: "congelado", aisle: "G", racks: 4, levels: 3 },
      { zone: "muelle", aisle: "M", racks: 3, levels: 1 },
    ],
    { salt: 400, occupy: true },
  );
  return [...seville, ...huelva];
}

function buildPallets(slots: Slot[]): Pallet[] {
  const pallets: Pallet[] = [];
  const occupy = slots.filter((s) => s.status === "ocupado" || s.status === "reservado");
  occupy.forEach((slot, i) => {
    const sku = SKUS[i % SKUS.length]!;
    const id = `pal-${String(i + 1).padStart(4, "0")}`;
    const pallet: Pallet = {
      id,
      sscc: `00384100${String(1000000000 + i).slice(-10)}`,
      skuId: sku.id,
      qty: Math.max(8, sku.unitsPerPallet - (i % 12)),
      lot: `L26${String((i % 40) + 1).padStart(2, "0")}`,
      expiry:
        sku.category === "frescos" || sku.category === "perecederos" || sku.category === "congelados"
          ? `2026-${String(((i % 4) + 8)).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`
          : null,
      status: slot.zone === "muelle" ? "muelle" : slot.status === "reservado" ? "picking" : "en_ubicacion",
      slotId: slot.id,
      siteId: slot.siteId,
      receivedAt: `2026-08-${String((i % 12) + 1).padStart(2, "0")}T0${(i % 8) + 1}:15:00.000Z`,
      supplier: ["Aceites del Sur", "Lácteos Guadalquivir", "Bebidas Atlánticas", "Hogar Andalucía"][i % 4]!,
      asnId: null,
    };
    slot.palletId = id;
    pallets.push(pallet);
  });
  return pallets;
}

const OPERATORS: Operator[] = [
  hire({
    id: "op-01",
    code: "OP-1201",
    name: "Carmen Ruiz",
    role: "supervisor",
    shift: "manana",
    siteId: SITE_SEV.id,
    active: true,
    certifications: ["carretilla", "ATP", "brigada"],
    costPerHour: 18.5,
    picksPerHour: 0,
    movesToday: 14,
    hoursToday: 6.5,
    overtimeHoursWeek: 2,
    hiredAt: "2019-03-12",
  }),
  hire({
    id: "op-02",
    code: "OP-1344",
    name: "Antonio Méndez",
    role: "carretillero",
    shift: "manana",
    siteId: SITE_SEV.id,
    active: true,
    certifications: ["carretilla", "retractil"],
    costPerHour: 14.2,
    picksPerHour: 0,
    movesToday: 48,
    hoursToday: 7,
    overtimeHoursWeek: 4,
    hiredAt: "2021-06-01",
  }),
  hire({
    id: "op-03",
    code: "OP-1410",
    name: "Lucía Navarro",
    role: "picker",
    shift: "manana",
    siteId: SITE_SEV.id,
    active: true,
    certifications: ["picking", "scanner"],
    costPerHour: 12.8,
    picksPerHour: 92,
    movesToday: 610,
    hoursToday: 6.8,
    overtimeHoursWeek: 0,
    hiredAt: "2023-01-18",
  }),
  hire({
    id: "op-04",
    code: "OP-1522",
    name: "Pedro Salas",
    role: "recepcion",
    shift: "tarde",
    siteId: SITE_SEV.id,
    active: true,
    certifications: ["muelle", "scanner"],
    costPerHour: 13.1,
    picksPerHour: 0,
    movesToday: 22,
    hoursToday: 5.5,
    overtimeHoursWeek: 1,
    hiredAt: "2022-09-05",
  }),
  hire({
    id: "op-05",
    code: "OP-1608",
    name: "Elena Cortés",
    role: "expedicion",
    shift: "tarde",
    siteId: SITE_SEV.id,
    active: true,
    certifications: ["muelle", "ADR-lite"],
    costPerHour: 13.4,
    picksPerHour: 0,
    movesToday: 19,
    hoursToday: 5,
    overtimeHoursWeek: 3,
    hiredAt: "2020-11-22",
  }),
  hire({
    id: "op-06",
    code: "OP-1711",
    name: "Hassan El Amrani",
    role: "carretillero",
    shift: "noche",
    siteId: SITE_SEV.id,
    active: true,
    certifications: ["carretilla", "retractil", "congelado"],
    costPerHour: 15.6,
    picksPerHour: 0,
    movesToday: 31,
    hoursToday: 4.2,
    overtimeHoursWeek: 6,
    hiredAt: "2018-04-30",
  }),
  hire({
    id: "op-07",
    code: "OP-1820",
    name: "María Isabel León",
    role: "calidad",
    shift: "manana",
    siteId: SITE_SEV.id,
    active: true,
    certifications: ["calidad", "IFS"],
    costPerHour: 16.0,
    picksPerHour: 0,
    movesToday: 9,
    hoursToday: 6,
    overtimeHoursWeek: 0,
    hiredAt: "2017-08-14",
  }),
  hire({
    id: "op-08",
    code: "OP-1903",
    name: "Jorge Peña",
    role: "picker",
    shift: "tarde",
    siteId: SITE_SEV.id,
    active: true,
    certifications: ["picking"],
    costPerHour: 12.5,
    picksPerHour: 78,
    movesToday: 420,
    hoursToday: 5.8,
    overtimeHoursWeek: 2,
    hiredAt: "2024-02-01",
  }),
  hire({
    id: "op-09",
    code: "OP-2104",
    name: "Fátima Gallego",
    role: "picker",
    shift: "manana",
    siteId: SITE_HUE.id,
    active: true,
    certifications: ["picking", "scanner", "fresco"],
    costPerHour: 12.9,
    picksPerHour: 84,
    movesToday: 310,
    hoursToday: 6.2,
    overtimeHoursWeek: 1,
    hiredAt: "2023-05-09",
  }),
  hire({
    id: "op-10",
    code: "OP-2218",
    name: "Raúl Campos",
    role: "carretillero",
    shift: "tarde",
    siteId: SITE_HUE.id,
    active: true,
    certifications: ["retractil", "retractil_doble", "congelado"],
    costPerHour: 15.1,
    picksPerHour: 0,
    movesToday: 27,
    hoursToday: 5.4,
    overtimeHoursWeek: 3,
    hiredAt: "2020-02-17",
  }),
  hire({
    id: "op-11",
    code: "OP-2301",
    name: "Inés Mora",
    role: "recepcion",
    shift: "manana",
    siteId: SITE_HUE.id,
    active: true,
    certifications: ["muelle", "ATP"],
    costPerHour: 13.3,
    picksPerHour: 0,
    movesToday: 11,
    hoursToday: 6,
    overtimeHoursWeek: 0,
    hiredAt: "2022-11-03",
  }),
];

const FLEET_BASE: Omit<FleetUnit, "batterySource" | "batteryReportedAt" | "chargerId">[] = [
  {
    id: "fl-01",
    code: "FL-E-01",
    brand: "Toyota",
    model: "Traigo 48",
    kind: "contrapesada",
    status: "operativa",
    batteryPct: 72,
    hoursToday: 5.4,
    hoursTotal: 6120,
    operatorId: "op-02",
    siteId: SITE_SEV.id,
    nextServiceAt: "2026-09-02",
    costPerHour: 9.8,
  },
  {
    id: "fl-02",
    code: "FL-E-02",
    brand: "Jungheinrich",
    model: "ETV 216",
    kind: "retractil",
    status: "operativa",
    batteryPct: 58,
    hoursToday: 4.8,
    hoursTotal: 4890,
    operatorId: "op-06",
    siteId: SITE_SEV.id,
    nextServiceAt: "2026-08-28",
    costPerHour: 11.2,
  },
  {
    id: "fl-07",
    code: "FL-E-07",
    brand: "Crown",
    model: "RR 5700 Stand-up",
    kind: "retractil_doble",
    status: "operativa",
    batteryPct: 76,
    hoursToday: 5.6,
    hoursTotal: 980,
    operatorId: "op-02",
    siteId: SITE_SEV.id,
    nextServiceAt: "2026-10-18",
    costPerHour: 12.4,
  },
  {
    id: "fl-03",
    code: "FL-E-03",
    brand: "Still",
    model: "EXU-S 22",
    kind: "transpaleta",
    status: "cargando",
    batteryPct: 18,
    hoursToday: 3.1,
    hoursTotal: 3200,
    operatorId: null,
    siteId: SITE_SEV.id,
    nextServiceAt: "2026-10-10",
    costPerHour: 4.5,
  },
  {
    id: "fl-04",
    code: "FL-E-04",
    brand: "Crown",
    model: "SP 3500",
    kind: "recogepedidos",
    status: "operativa",
    batteryPct: 81,
    hoursToday: 6.0,
    hoursTotal: 2100,
    operatorId: "op-03",
    siteId: SITE_SEV.id,
    nextServiceAt: "2026-11-01",
    costPerHour: 7.4,
  },
  {
    id: "fl-05",
    code: "FL-E-05",
    brand: "Linde",
    model: "L14",
    kind: "apilador",
    status: "mantenimiento",
    batteryPct: 44,
    hoursToday: 0,
    hoursTotal: 7800,
    operatorId: null,
    siteId: SITE_SEV.id,
    nextServiceAt: "2026-08-16",
    costPerHour: 6.1,
  },
  {
    id: "fl-06",
    code: "FL-E-06",
    brand: "Toyota",
    model: "BT Reflex",
    kind: "retractil",
    status: "operativa",
    batteryPct: 65,
    hoursToday: 5.2,
    hoursTotal: 1540,
    operatorId: "op-02",
    siteId: SITE_HUE.id,
    nextServiceAt: "2026-12-05",
    costPerHour: 10.5,
  },
  {
    id: "fl-08",
    code: "FL-E-08",
    brand: "Crown",
    model: "RR 5700 Stand-up",
    kind: "retractil_doble",
    status: "operativa",
    batteryPct: 69,
    hoursToday: 4.1,
    hoursTotal: 640,
    operatorId: "op-10",
    siteId: SITE_HUE.id,
    nextServiceAt: "2026-11-12",
    costPerHour: 12.4,
  },
  {
    id: "fl-09",
    code: "FL-E-09",
    brand: "Still",
    model: "EXH 25",
    kind: "transpaleta",
    status: "operativa",
    batteryPct: 88,
    hoursToday: 5.0,
    hoursTotal: 1100,
    operatorId: "op-09",
    siteId: SITE_HUE.id,
    nextServiceAt: "2026-12-20",
    costPerHour: 4.2,
  },
  {
    id: "fl-10",
    code: "FL-E-10",
    brand: "Toyota",
    model: "LWE 200",
    kind: "toro",
    status: "operativa",
    batteryPct: 64,
    hoursToday: 4.4,
    hoursTotal: 890,
    operatorId: "op-03",
    siteId: SITE_SEV.id,
    nextServiceAt: "2026-11-20",
    costPerHour: 3.8,
  },
  {
    id: "fl-11",
    code: "FL-E-11",
    brand: "Hyster",
    model: "H2.5XT",
    kind: "montacargas",
    status: "operativa",
    batteryPct: 55,
    hoursToday: 3.8,
    hoursTotal: 2400,
    operatorId: "op-02",
    siteId: SITE_SEV.id,
    nextServiceAt: "2026-10-30",
    costPerHour: 10.2,
  },
  {
    id: "fl-12",
    code: "FL-E-12",
    brand: "Still",
    model: "EXH-S 20",
    kind: "toro",
    status: "operativa",
    batteryPct: 71,
    hoursToday: 2.1,
    hoursTotal: 410,
    operatorId: null,
    siteId: SITE_HUE.id,
    nextServiceAt: "2027-01-08",
    costPerHour: 3.6,
  },
];

const FLEET: FleetUnit[] = FLEET_BASE.map((unit) =>
  withBattery(unit, unit.id === "fl-03" ? "chg-01" : unit.id === "fl-10" ? "chg-02" : null),
);

const CHARGERS: WallCharger[] = [
  {
    id: "chg-01",
    code: "CHG-A-01",
    siteId: SITE_SEV.id,
    zone: "seco",
    assignedFleetId: "fl-03",
    telemetry: "none",
  },
  {
    id: "chg-02",
    code: "CHG-A-02",
    siteId: SITE_SEV.id,
    zone: "picking",
    assignedFleetId: "fl-10",
    telemetry: "none",
  },
  {
    id: "chg-03",
    code: "CHG-M-01",
    siteId: SITE_SEV.id,
    zone: "muelle",
    assignedFleetId: null,
    telemetry: "none",
  },
  {
    id: "chg-h1",
    code: "CHG-H-01",
    siteId: SITE_HUE.id,
    zone: "fresco",
    assignedFleetId: null,
    telemetry: "none",
  },
];

const INBOUND: InboundAsn[] = [
  {
    id: "in-01",
    code: "ASN-260815-01",
    supplier: "Aceites del Sur",
    eta: "2026-08-15T08:30:00.000Z",
    dock: "M-01",
    status: "ubicando",
    lines: 12,
    palletsExpected: 28,
    palletsDone: 19,
    siteId: SITE_SEV.id,
  },
  {
    id: "in-02",
    code: "ASN-260815-02",
    supplier: "Lácteos Guadalquivir",
    eta: "2026-08-15T10:00:00.000Z",
    dock: "M-03",
    status: "en_muelle",
    lines: 8,
    palletsExpected: 16,
    palletsDone: 0,
    siteId: SITE_SEV.id,
  },
  {
    id: "in-03",
    code: "ASN-260815-03",
    supplier: "Frío Atlántico",
    eta: "2026-08-15T14:00:00.000Z",
    dock: "M-02",
    status: "previsto",
    lines: 6,
    palletsExpected: 22,
    palletsDone: 0,
    siteId: SITE_SEV.id,
  },
  {
    id: "in-04",
    code: "ASN-260814-09",
    supplier: "Bebidas Atlánticas",
    eta: "2026-08-14T16:20:00.000Z",
    dock: "M-04",
    status: "cerrado",
    lines: 4,
    palletsExpected: 10,
    palletsDone: 10,
    siteId: SITE_SEV.id,
  },
  {
    id: "in-05",
    code: "ASN-260815-H1",
    supplier: "Frío Atlántico",
    eta: "2026-08-15T09:15:00.000Z",
    dock: "M-01",
    status: "descargando",
    lines: 9,
    palletsExpected: 18,
    palletsDone: 7,
    siteId: SITE_HUE.id,
  },
];

const CARRIERS: Carrier[] = [
  {
    id: "car-seur",
    orgId: CAMPO_NORTE_ORG.id,
    code: "SEUR",
    name: "SEUR",
    kind: "nacional",
    cutoffDefault: "18:00",
    active: true,
  },
  {
    id: "car-dhl",
    orgId: CAMPO_NORTE_ORG.id,
    code: "DHL",
    name: "DHL Freight",
    kind: "internacional",
    cutoffDefault: "16:30",
    active: true,
  },
  {
    id: "car-carreras",
    orgId: CAMPO_NORTE_ORG.id,
    code: "CARR",
    name: "Carreras Grupo Logístico",
    kind: "frigorifico",
    cutoffDefault: "17:00",
    active: true,
  },
  {
    id: "car-xpo",
    orgId: CAMPO_NORTE_ORG.id,
    code: "XPO",
    name: "XPO Logistics",
    kind: "nacional",
    cutoffDefault: "19:00",
    active: true,
  },
];

function withCarrier(
  order: Omit<OutboundOrder, "carrierId" | "tracking" | "dockWindowStart" | "dockWindowEnd">,
  carrierId: string,
): OutboundOrder {
  const window = dockWindowFor(order.cutOff);
  return {
    ...order,
    carrierId,
    tracking: null,
    dockWindowStart: window.start,
    dockWindowEnd: window.end,
  };
}

const OUTBOUND: OutboundOrder[] = [
  withCarrier(
    {
      id: "out-01",
      code: "OUT-SEV-8841",
      customer: "Tienda CN · Dos Hermanas",
      cutOff: "2026-08-15T12:00:00.000Z",
      dock: "M-05",
      status: "picking",
      lines: 64,
      pallets: 9,
      priority: "urgente",
      siteId: SITE_SEV.id,
    },
    "car-seur",
  ),
  withCarrier(
    {
      id: "out-02",
      code: "OUT-SEV-8842",
      customer: "Tienda CN · Utrera",
      cutOff: "2026-08-15T15:00:00.000Z",
      dock: "M-06",
      status: "pendiente",
      lines: 41,
      pallets: 6,
      priority: "normal",
      siteId: SITE_SEV.id,
    },
    "car-carreras",
  ),
  withCarrier(
    {
      id: "out-03",
      code: "OUT-SEV-8840",
      customer: "Tienda CN · Alcalá",
      cutOff: "2026-08-15T09:30:00.000Z",
      dock: "M-07",
      status: "muelle",
      lines: 38,
      pallets: 5,
      priority: "express",
      siteId: SITE_SEV.id,
    },
    "car-dhl",
  ),
  withCarrier(
    {
      id: "out-04",
      code: "OUT-SEV-8838",
      customer: "Cash & Carry · Huelva",
      cutOff: "2026-08-14T18:00:00.000Z",
      dock: "M-08",
      status: "expedido",
      lines: 72,
      pallets: 12,
      priority: "normal",
      siteId: SITE_SEV.id,
    },
    "car-xpo",
  ),
  withCarrier(
    {
      id: "out-05",
      code: "OUT-HUE-2201",
      customer: "Tienda CN · Lepe",
      cutOff: "2026-08-15T13:30:00.000Z",
      dock: "M-02",
      status: "picking",
      lines: 22,
      pallets: 4,
      priority: "urgente",
      siteId: SITE_HUE.id,
    },
    "car-carreras",
  ),
];

const COSTS: CostLine[] = [
  { id: "c1", month: "2026-08", siteId: SITE_SEV.id, center: "mano_obra", label: "Nómina operativa", amountEur: 186_400, budgetEur: 180_000 },
  { id: "c2", month: "2026-08", siteId: SITE_SEV.id, center: "energia", label: "Electricidad + frío", amountEur: 41_200, budgetEur: 38_000 },
  { id: "c3", month: "2026-08", siteId: SITE_SEV.id, center: "flota", label: "Flota eléctrica + servicio", amountEur: 18_750, budgetEur: 17_500 },
  { id: "c4", month: "2026-08", siteId: SITE_SEV.id, center: "espacio", label: "Alquiler / amortización", amountEur: 92_000, budgetEur: 92_000 },
  { id: "c5", month: "2026-08", siteId: SITE_SEV.id, center: "merma", label: "Merma y caducidad", amountEur: 7_840, budgetEur: 6_500 },
  { id: "c6", month: "2026-08", siteId: SITE_SEV.id, center: "terceros", label: "Transporte última milla", amountEur: 54_300, budgetEur: 52_000 },
  { id: "c7", month: "2026-08", siteId: SITE_SEV.id, center: "it", label: "WMS + scanners + red", amountEur: 6_100, budgetEur: 6_200 },
  { id: "c8", month: "2026-07", siteId: SITE_SEV.id, center: "mano_obra", label: "Nómina operativa", amountEur: 179_900, budgetEur: 180_000 },
  { id: "c9", month: "2026-07", siteId: SITE_SEV.id, center: "energia", label: "Electricidad + frío", amountEur: 39_100, budgetEur: 38_000 },
  { id: "c10", month: "2026-08", siteId: SITE_HUE.id, center: "mano_obra", label: "Nómina operativa Huelva", amountEur: 64_800, budgetEur: 62_000 },
  { id: "c11", month: "2026-08", siteId: SITE_HUE.id, center: "energia", label: "Cámara fría Huelva", amountEur: 28_400, budgetEur: 26_500 },
  { id: "c12", month: "2026-08", siteId: SITE_HUE.id, center: "flota", label: "Retráctil doble + transpaletas", amountEur: 7_200, budgetEur: 7_000 },
];

const MOVEMENTS: StockMovement[] = [
  {
    id: "mv-01",
    at: "2026-08-15T07:12:00.000Z",
    type: "entrada",
    skuId: "sku-aceite",
    palletId: null,
    fromSlotId: null,
    toSlotId: slotRecordId(SITE_SEV.id, "M-01-01-1"),
    qty: 48,
    operatorId: "op-04",
    fleetId: "fl-01",
    note: "Descarga ASN-260815-01",
  },
  {
    id: "mv-02",
    at: "2026-08-15T07:40:00.000Z",
    type: "traslado",
    skuId: "sku-aceite",
    palletId: null,
    fromSlotId: slotRecordId(SITE_SEV.id, "M-01-01-1"),
    toSlotId: slotRecordId(SITE_SEV.id, "A-03-02-1"),
    qty: 48,
    operatorId: "op-02",
    fleetId: "fl-07",
    note: "Putaway pasillo A · retráctil doble",
  },
  {
    id: "mv-03",
    at: "2026-08-15T08:05:00.000Z",
    type: "salida",
    skuId: "sku-leche",
    palletId: null,
    fromSlotId: slotRecordId(SITE_SEV.id, "C-02-01-1"),
    toSlotId: slotRecordId(SITE_SEV.id, "M-05-01-1"),
    qty: 60,
    operatorId: "op-03",
    fleetId: "fl-04",
    note: "Wave tienda Dos Hermanas",
  },
  {
    id: "mv-04",
    at: "2026-08-15T08:22:00.000Z",
    type: "ajuste",
    skuId: "sku-jamon",
    palletId: null,
    fromSlotId: slotRecordId(SITE_SEV.id, "C-04-02-1"),
    toSlotId: slotRecordId(SITE_SEV.id, "C-04-02-1"),
    qty: -2,
    operatorId: "op-07",
    fleetId: null,
    note: "Calidad · merma visual",
  },
  {
    id: "mv-05",
    at: "2026-08-15T09:10:00.000Z",
    type: "inventario",
    skuId: "sku-agua",
    palletId: null,
    fromSlotId: slotRecordId(SITE_SEV.id, "B-06-03-1"),
    toSlotId: slotRecordId(SITE_SEV.id, "B-06-03-1"),
    qty: 0,
    operatorId: "op-08",
    fleetId: null,
    note: "Conteo cíclico OK",
  },
];

export function buildWmsSeed(): WmsSnapshot {
  const slots = buildSlots();
  const pallets = buildPallets(slots);
  seedDockAndPickFaceGap(slots, pallets);
  const pickWaves = buildPickWaves(slots, pallets);
  return {
    org: CAMPO_NORTE_ORG,
    seededFromDemo: true,
    sites: [SITE_SEV, SITE_HUE],
    categories: SYSTEM_CATEGORIES,
    skus: SKUS,
    slots,
    pallets,
    fleet: FLEET,
    chargers: CHARGERS,
    operators: ensureShiftRoster(OPERATORS),
    clockPunches: [],
    inbound: INBOUND,
    asnLines: [],
    asnIncidents: [],
    outbound: OUTBOUND,
    carriers: CARRIERS,
    costs: COSTS,
    movements: MOVEMENTS,
    pickWaves,
    loadUnits: [],
    superAssignments: [],
    mermaEvents: [],
    slotFixes: [],
    auditLogs: [],
    reservations: [],
    countSessions: [],
    countLines: [],
    slottingRules: [],
    slottingRecommendations: [],
    ...seedInventoryCore({
      orgId: CAMPO_NORTE_ORG.id,
      skus: SKUS,
      pallets,
      now: WMS_DEMO_NOW,
    }),
    ledgerRevision: 0,
    memberships: seedMemberships(CAMPO_NORTE_ORG.id),
  };
}

/** Palet en muelle para putaway + un pick face vacío con reserva encima (retráctil doble). */
function seedDockAndPickFaceGap(slots: Slot[], pallets: Pallet[]): void {
  const dock = slots.find((s) => s.siteId === SITE_SEV.id && s.zone === "muelle" && s.status === "libre");
  if (dock) {
    const id = "pal-dock-01";
    pallets.push({
      id,
      sscc: "003841009900000001",
      skuId: "sku-arroz",
      qty: 80,
      lot: "L26D1",
      expiry: null,
      status: "muelle",
      slotId: dock.id,
      siteId: SITE_SEV.id,
      receivedAt: "2026-08-15T08:40:00.000Z",
      supplier: "Aceites del Sur",
      asnId: null,
    });
    dock.palletId = id;
    dock.status = "ocupado";
  }

  const reserves = slots.filter(
    (s) => s.siteId === SITE_SEV.id && s.aisle === "A" && s.level === 2 && Boolean(s.palletId),
  );
  const reserve = reserves[4] ?? reserves.at(-1);
  if (!reserve?.palletId) return;
  const face = slots.find(
    (s) =>
      s.siteId === SITE_SEV.id &&
      s.aisle === "A" &&
      s.rack === reserve.rack &&
      s.pickFace &&
      s.position === reserve.position,
  );
  if (!face || face.palletId === reserve.palletId) return;
  if (face.palletId) {
    const old = pallets.find((p) => p.id === face.palletId);
    if (old) {
      old.status = "expedido";
      old.slotId = null;
    }
  }
  face.palletId = null;
  face.status = "libre";
}

function buildPickWaves(slots: Slot[], pallets: Pallet[]): PickWave[] {
  const palletOf = (slot: Slot) => pallets.find((p) => p.id === slot.palletId);

  const aisleA = slots.filter((s) => s.siteId === SITE_SEV.id && s.aisle === "A" && s.pickFace && s.palletId);
  const lines = aisleA.slice(0, 8).map((slot, i) => {
    const pallet = palletOf(slot);
    return {
      id: `pl-${i + 1}`,
      waveId: "wave-01",
      orderCode: i < 4 ? "OUT-SEV-8841" : "OUT-SEV-8842",
      skuId: pallet?.skuId ?? "sku-aceite",
      qty: [6, 4, 12, 8, 3, 10, 5, 7][i] ?? 4,
      qtyPicked: 0,
      qtyPacked: 0,
      cartonSscc: null,
      pickPack: "caja" as const,
      slotId: slot.id,
      palletId: slot.palletId,
      status: "pendiente" as const,
      sequence: i + 1,
    };
  });

  const reserveA = slots.filter(
    (s) => s.siteId === SITE_SEV.id && s.aisle === "A" && !s.pickFace && s.level === 2 && s.palletId,
  );

  const huevaPick = slots.filter(
    (s) => s.siteId === SITE_HUE.id && s.aisle === "F" && s.pickFace && s.palletId,
  );

  return [
    {
      id: "wave-01",
      code: "WAVE-A-0815-01",
      aisle: "A",
      siteId: SITE_SEV.id,
      kind: "picking",
      status: "abierta",
      operatorId: "op-03",
      fleetId: "fl-04",
      printedAt: "2026-08-15T07:55:00.000Z",
      lines,
    },
    {
      id: "wave-02",
      code: "WAVE-B-0815-02",
      aisle: "B",
      siteId: SITE_SEV.id,
      kind: "picking",
      status: "en_curso",
      operatorId: "op-08",
      fleetId: "fl-04",
      printedAt: "2026-08-15T08:10:00.000Z",
      lines: slots
        .filter((s) => s.siteId === SITE_SEV.id && s.aisle === "B" && s.pickFace && s.palletId)
        .slice(0, 5)
        .map((slot, i) => {
          const pallet = palletOf(slot);
          return {
            id: `pl-b-${i + 1}`,
            waveId: "wave-02",
            orderCode: "OUT-SEV-8840",
            skuId: pallet?.skuId ?? "sku-agua",
            qty: 4 + i,
            qtyPicked: i < 2 ? 4 + i : 0,
            qtyPacked: 0,
            cartonSscc: null,
      pickPack: "caja" as const,
            slotId: slot.id,
            palletId: slot.palletId,
            status: (i < 2 ? "picada" : i === 2 ? "en_curso" : "pendiente") as PickWave["lines"][number]["status"],
            sequence: i + 1,
          };
        }),
    },
    {
      id: "wave-rep",
      code: "WAVE-REP-A-0815",
      aisle: "A",
      siteId: SITE_SEV.id,
      kind: "reposicion",
      status: "abierta",
      operatorId: "op-02",
      fleetId: "fl-07",
      printedAt: "2026-08-15T07:40:00.000Z",
      lines: reserveA.slice(0, 4).map((slot, i) => {
        const pallet = palletOf(slot);
        return {
          id: `pl-rep-${i + 1}`,
          waveId: "wave-rep",
          orderCode: "REP-A-FACE",
          skuId: pallet?.skuId ?? "sku-arroz",
          qty: pallet?.qty ?? 40,
          qtyPicked: 0,
          qtyPacked: 0,
          cartonSscc: null,
      pickPack: "caja" as const,
          slotId: slot.id,
          palletId: slot.palletId,
          status: "pendiente" as const,
          sequence: i + 1,
        };
      }),
    },
    {
      id: "wave-hue",
      code: "WAVE-F-HUE-01",
      aisle: "F",
      siteId: SITE_HUE.id,
      kind: "picking",
      status: "abierta",
      operatorId: "op-09",
      fleetId: "fl-09",
      printedAt: "2026-08-15T08:20:00.000Z",
      lines: huevaPick.slice(0, 5).map((slot, i) => {
        const pallet = palletOf(slot);
        return {
          id: `pl-hue-${i + 1}`,
          waveId: "wave-hue",
          orderCode: "OUT-HUE-2201",
          skuId: pallet?.skuId ?? "sku-leche",
          qty: 3 + i,
          qtyPicked: 0,
          qtyPacked: 0,
          cartonSscc: null,
      pickPack: "caja" as const,
          slotId: slot.id,
          palletId: slot.palletId,
          status: "pendiente" as const,
          sequence: i + 1,
        };
      }),
    },
  ];
}
