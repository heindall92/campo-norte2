/** Dominio WMS — Campo Norte Logística (fase 8: catálogo, prioridades, roster y fichaje). */

export type WarehouseZone = "seco" | "fresco" | "congelado" | "picking" | "muelle" | "crossdock";

export type SlotStatus = "libre" | "ocupado" | "reservado" | "bloqueado" | "inventario";

export type PalletStatus = "en_ubicacion" | "en_transito" | "picking" | "muelle" | "expedido" | "cuarentena";

export type CategoryCode =
  | "alimentacion_seca"
  | "frescos"
  | "congelados"
  | "bebidas"
  | "no_food"
  | "perecederos";

export type FleetKind =
  | "contrapesada"
  | "retractil"
  | "retractil_doble"
  | "transpaleta"
  | "recogepedidos"
  | "apilador"
  | "toro"
  | "montacargas";

/** De dónde sale el % de batería. Nunca se fabrica telemetría de cargador. */
export type BatterySource = "unknown" | "seed" | "manual";

export type FleetStatus = "operativa" | "cargando" | "mantenimiento" | "fuera_servicio";

export type ShiftCode = "manana" | "tarde" | "noche";

export type OperatorRoleFloor = "carretillero" | "picker" | "recepcion" | "expedicion" | "supervisor" | "calidad";

export type MovementType = "entrada" | "salida" | "traslado" | "ajuste" | "inventario";

/** Motivo de merma que escribe planta. No se inventa. */
export type MermaReason = "caida" | "rota" | "otra";

/**
 * Rotura o caída declarada. Si no se declara y se coge otra caja,
 * el hueco queda con un faltante invisible.
 */
export interface MermaEvent {
  id: string;
  at: string;
  siteId: string;
  skuId: string;
  palletId: string;
  fromSlotId: string | null;
  qty: number;
  reason: MermaReason;
  note: string;
  operatorId: string | null;
  /** Hueco del área de merma si lo escriben. null = declarado y aún sin ubicar. */
  mermaSlotId: string | null;
}

/**
 * Faltante de hueco que el jefe tiene que cuadrar en el sistema.
 * El operario no debería ir a la oficina: avisa desde el aparato.
 * La cantidad contada la escribe el jefe; no se inventa.
 */
export type SlotFixReason = "merma" | "de_mas" | "roto" | "pico_mal" | "otra";

export type SlotFixStatus = "pendiente" | "arreglado";

export interface SlotFix {
  id: string;
  at: string;
  siteId: string;
  slotId: string;
  palletId: string | null;
  skuId: string;
  /** Lo que decía el sistema al avisar. */
  systemQty: number;
  /** Lo que pidió el ticket. */
  takeQty: number;
  /** Lo que cuenta el jefe. null mientras está pendiente. */
  countedQty: number | null;
  reason: SlotFixReason | null;
  note: string;
  reportedBy: string | null;
  fixedBy: string | null;
  status: SlotFixStatus;
  fixedAt: string | null;
}

/** Línea de picado para operario (escáner de pasillo). */
export type PickLineStatus = "pendiente" | "en_curso" | "picada" | "faltante" | "omitida";

/** Caja entera o unidades de dentro de un contenedor (droguería / inner pack). */
export type PickPack = "caja" | "contenedor";

export interface PickLine {
  id: string;
  waveId: string;
  orderCode: string;
  skuId: string;
  qty: number;
  qtyPicked: number;
  /** Unidades embaladas. Nunca mayor que qtyPicked; 0 si aún no se ha embalado. */
  qtyPacked: number;
  /** SSCC de caja suelta. Solo si lo escribe el operario; nunca se fabrica. */
  cartonSscc: string | null;
  pickPack: PickPack;
  slotId: string;
  palletId: string | null;
  status: PickLineStatus;
  sequence: number;
}

export interface PickWave {
  id: string;
  code: string;
  aisle: string;
  siteId: string;
  /** picking = cara baja; reposicion = reserva alta con retráctil doble */
  kind: "picking" | "reposicion";
  status: "abierta" | "en_curso" | "cerrada";
  operatorId: string | null;
  fleetId: string | null;
  printedAt: string;
  lines: PickLine[];
}

export type CarrierKind = "nacional" | "internacional" | "frigorifico" | "paqueteria";

export interface WmsOrg {
  id: string;
  legalName: string;
  plan: string;
  billingCurrency: "EUR";
  /**
   * Aislamiento de tenant en el snapshot (org_id).
   * RLS Postgres real queda para infra; aquí el filtro es de dominio.
   */
  rlsMode: "snapshot" | "postgres";
  /** Si es true, applyInventoryTx admite buckets o available < 0. Por defecto no. */
  allowNegativeInventory?: boolean;
}

export interface Carrier {
  id: string;
  orgId: string;
  code: string;
  name: string;
  kind: CarrierKind;
  cutoffDefault: string;
  active: boolean;
}

export interface WarehouseSite {
  id: string;
  orgId: string;
  code: string;
  name: string;
  city: string;
  region: string;
  country: string;
  sqm: number;
  slotsTotal: number;
  temperatureModes: WarehouseZone[];
}

export interface ProductCategory {
  id: string;
  code: string;
  labelEs: string;
  labelEn: string;
  system: boolean;
}

export interface Sku {
  id: string;
  sku: string;
  name: string;
  /** id de ProductCategory (sistema o creada) */
  category: string;
  uom: "ud" | "caja" | "kg" | "palet";
  unitsPerPallet: number;
  weightKg: number;
  abc: "A" | "B" | "C";
  minStock: number;
  maxStock: number;
}

export interface Slot {
  id: string;
  /** Código escaneable: Pasillo-Bahía-Nivel-Posición (A-03-02-1) */
  code: string;
  siteId: string;
  zone: WarehouseZone;
  aisle: string;
  /** Bahía / tramo entre montantes */
  rack: number;
  /** Nivel 1 = cara de picking; superiores = reserva */
  level: number;
  /** Posición en bahía (1–2 en rack selectivo / doble deep) */
  position: 1 | 2;
  /** Cara de picking (nivel bajo, accesible a pie / reach) */
  pickFace: boolean;
  status: SlotStatus;
  capacityPallets: number;
  palletId: string | null;
  lastCountedAt: string | null;
}

export interface Pallet {
  id: string;
  sscc: string;
  skuId: string;
  qty: number;
  lot: string;
  expiry: string | null;
  status: PalletStatus;
  slotId: string | null;
  siteId: string;
  receivedAt: string;
  supplier: string;
  /** ASN del que se descargó. null en semilla o alta manual. */
  asnId: string | null;
}

export interface FleetUnit {
  id: string;
  code: string;
  brand: string;
  model: string;
  kind: FleetKind;
  status: FleetStatus;
  /** null = no hay lectura. No inventar % desde el cargador de pared. */
  batteryPct: number | null;
  batterySource: BatterySource;
  batteryReportedAt: string | null;
  chargerId: string | null;
  hoursToday: number;
  hoursTotal: number;
  operatorId: string | null;
  siteId: string;
  nextServiceAt: string;
  costPerHour: number;
}

/** Cargador de pared. Sin telemetría en el navegador: solo etiqueta y asignación. */
export interface WallCharger {
  id: string;
  code: string;
  siteId: string;
  zone: string;
  assignedFleetId: string | null;
  telemetry: "none";
}

export interface Operator {
  id: string;
  code: string;
  name: string;
  role: OperatorRoleFloor;
  shift: ShiftCode;
  siteId: string;
  active: boolean;
  /** Plaza de cupo (25/turno) sin identidad real. */
  vacant: boolean;
  certifications: string[];
  costPerHour: number;
  picksPerHour: number;
  movesToday: number;
  hoursToday: number;
  overtimeHoursWeek: number;
  hiredAt: string;
  fingerprintEnrolled: boolean;
  /** Hash del PIN de verificación — no es plantilla biométrica. */
  pinHash: string | null;
}

export type ClockMethod = "pin" | "adapter" | "manual";

export interface ClockPunch {
  id: string;
  operatorId: string;
  siteId: string;
  kind: "entrada" | "salida";
  at: string;
  method: ClockMethod;
  note: string;
}

export interface InboundAsn {
  id: string;
  code: string;
  supplier: string;
  eta: string;
  dock: string;
  status: "previsto" | "en_muelle" | "descargando" | "ubicando" | "cerrado";
  lines: number;
  palletsExpected: number;
  palletsDone: number;
  siteId: string;
}

export interface OutboundOrder {
  id: string;
  code: string;
  customer: string;
  cutOff: string;
  dock: string;
  status: "pendiente" | "picking" | "embalaje" | "muelle" | "expedido";
  lines: number;
  pallets: number;
  priority: "normal" | "urgente" | "express";
  siteId: string;
  carrierId: string | null;
  tracking: string | null;
  dockWindowStart: string | null;
  dockWindowEnd: string | null;
}

/** Palet, caja suelta o carro. Lo que el operario termina de montar en pasillo. */
export type LoadUnitKind = "palet" | "caja" | "carro";

export type LoadUnitStatus = "abierta" | "completa" | "flejada" | "etiquetada" | "en_muelle";

/**
 * Unidad de carga que el operario fleja, etiqueta y deja en el pasillo de muelle.
 * La etiqueta no se fabrica: la escribe quien la pega.
 */
export interface LoadUnit {
  id: string;
  kind: LoadUnitKind;
  orderId: string;
  orderCode: string;
  siteId: string;
  operatorId: string | null;
  /** Pasillo de muelle del pedido (el que ve en pantalla). */
  dockAisle: string;
  lineIds: string[];
  qty: number;
  labelCode: string | null;
  strapped: boolean;
  labeled: boolean;
  dockSlotId: string | null;
  status: LoadUnitStatus;
  createdAt: string;
}

/** El patrón o un técnico asigna un súper (pedido) al código del operario. */
export interface SuperAssignment {
  id: string;
  orderId: string;
  operatorId: string;
  assignedBy: string | null;
  at: string;
  /** Cómo tomar el súper: box, palet o carro. Lo dice quien asigna; no se deduce del pedido. */
  loadKind: LoadUnitKind | null;
  /** Palets/cajas/carros que dice el operario al terminar. null = aún no ha dicho. */
  unitsMade: number | null;
  /** Etiquetas a imprimir. En palet: 2 por unidad (una por lado). */
  labelsPrinted: number;
}

export interface CostLine {
  id: string;
  month: string; // YYYY-MM
  siteId: string;
  center: "mano_obra" | "energia" | "flota" | "espacio" | "merma" | "terceros" | "it";
  label: string;
  amountEur: number;
  budgetEur: number;
}

export interface StockMovement {
  id: string;
  at: string;
  type: MovementType;
  skuId: string;
  palletId: string | null;
  fromSlotId: string | null;
  toSlotId: string | null;
  qty: number;
  operatorId: string | null;
  fleetId: string | null;
  note: string;
}

/** Bitácora append-only. No se borra desde la UI. */
export interface WmsAuditLog {
  id: string;
  actorId: string | null;
  organizationId: string;
  warehouseId: string | null;
  action: string;
  entity: string;
  entityId: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  timestamp: string;
  reason: string;
  deviceId: string | null;
  correlationId: string;
}

export interface WmsSnapshot {
  org: WmsOrg;
  /** true = semilla local de almacén, no es el Data Hub de producción */
  seededFromDemo: boolean;
  sites: WarehouseSite[];
  categories: ProductCategory[];
  skus: Sku[];
  slots: Slot[];
  pallets: Pallet[];
  fleet: FleetUnit[];
  chargers: WallCharger[];
  operators: Operator[];
  clockPunches: ClockPunch[];
  inbound: InboundAsn[];
  outbound: OutboundOrder[];
  carriers: Carrier[];
  costs: CostLine[];
  movements: StockMovement[];
  pickWaves: PickWave[];
  loadUnits: LoadUnit[];
  superAssignments: SuperAssignment[];
  mermaEvents: MermaEvent[];
  slotFixes: SlotFix[];
  auditLogs: WmsAuditLog[];
  reservations: StockReservation[];
  products: WmsProduct[];
  productUoms: WmsProductUom[];
  lots: WmsLot[];
  serialNumbers: WmsSerialNumber[];
  inventoryBalances: InventoryBalance[];
  inventoryReservations: InventoryReservation[];
  inventoryTransactions: InventoryTransaction[];
  inventoryAdjustments: InventoryAdjustment[];
  inventoryCounts: InventoryCount[];
}

export type InventoryTxType =
  | "RECEIPT"
  | "PUTAWAY"
  | "MOVE"
  | "ALLOCATE"
  | "DEALLOCATE"
  | "PICK"
  | "REPLENISH"
  | "PACK"
  | "STAGE"
  | "LOAD"
  | "SHIP"
  | "RETURN"
  | "ADJUSTMENT"
  | "COUNT"
  | "QUARANTINE"
  | "RELEASE";

/** Catálogo de inventario. Proyección de `skus` — no inventa EAN ni SKU. */
export interface WmsProduct {
  id: string;
  orgId: string;
  sku: string;
  name: string;
  ean: string | null;
  status: "active" | "inactive";
  category: string;
}

export interface WmsProductUom {
  id: string;
  orgId: string;
  productId: string;
  uom: string;
  isBase: boolean;
  factorToBase: number;
}

export interface WmsLot {
  id: string;
  orgId: string;
  productId: string;
  lot: string;
  expiry: string | null;
  receivedAt: string;
  blocked: boolean;
}

/** Vacío en semilla: no hay seriales reales que persistir. */
export interface WmsSerialNumber {
  id: string;
  orgId: string;
  productId: string;
  serial: string;
  lot: string | null;
  status: "in_stock" | "shipped";
}

/**
 * Estado actual de un grano (org, sku, lote, ubicación).
 * `available = onHand - allocated - blocked - quarantined` (siempre recalculado).
 */
export interface InventoryBalance {
  id: string;
  orgId: string;
  skuId: string;
  lot: string | null;
  locationId: string;
  onHand: number;
  allocated: number;
  available: number;
  picked: number;
  packed: number;
  staged: number;
  blocked: number;
  quarantined: number;
  revision: number;
  updatedAt: string;
}

export interface InventoryReservation {
  id: string;
  orgId: string;
  skuId: string;
  lot: string | null;
  locationId: string;
  qty: number;
  status: "open" | "released" | "consumed";
  orderCode: string;
  waveId: string | null;
  lineId: string | null;
  palletId: string | null;
  createdAt: string;
  revision: number;
}

/** Ledger histórico. Append-only. */
export interface InventoryTransaction {
  id: string;
  orgId: string;
  type: InventoryTxType;
  skuId: string;
  lot: string | null;
  fromLocationId: string | null;
  toLocationId: string | null;
  qty: number;
  countedQty: number | null;
  uom: string;
  reason: string;
  refType: string | null;
  refId: string | null;
  palletId: string | null;
  createdAt: string;
  actorId: string | null;
}

export interface InventoryAdjustment {
  id: string;
  orgId: string;
  skuId: string;
  lot: string | null;
  locationId: string;
  qty: number;
  reason: string;
  txId: string;
  createdAt: string;
  actorId: string | null;
}

export interface InventoryCount {
  id: string;
  orgId: string;
  skuId: string;
  lot: string | null;
  locationId: string;
  expectedQty: number;
  countedQty: number;
  variance: number;
  txId: string;
  createdAt: string;
  actorId: string | null;
}

/** Hold de stock. No es reserva de viaje CRM. */
export interface StockReservation {
  id: string;
  organizationId: string;
  warehouseId: string;
  palletId: string;
  skuId: string;
  qty: number;
  status: "hold" | "consumed" | "released";
  orderCode: string;
  waveId: string | null;
  lineId: string | null;
  at: string;
  revision: number;
}

export const CATEGORY_LABEL: Record<CategoryCode, { es: string; en: string }> = {
  alimentacion_seca: { es: "Alimentación seca", en: "Dry grocery" },
  frescos: { es: "Frescos", en: "Fresh" },
  congelados: { es: "Congelados", en: "Frozen" },
  bebidas: { es: "Bebidas", en: "Beverages" },
  no_food: { es: "No food", en: "Non-food" },
  perecederos: { es: "Perecederos", en: "Perishables" },
};

export const ZONE_LABEL: Record<WarehouseZone, { es: string; en: string }> = {
  seco: { es: "Seco", en: "Dry" },
  fresco: { es: "Fresco", en: "Fresh" },
  congelado: { es: "Congelado", en: "Frozen" },
  picking: { es: "Picking", en: "Picking" },
  muelle: { es: "Muelle", en: "Dock" },
  crossdock: { es: "Cross-dock", en: "Cross-dock" },
};

export const CARRIER_KIND_LABEL: Record<CarrierKind, { es: string; en: string }> = {
  nacional: { es: "Nacional", en: "Domestic" },
  internacional: { es: "Internacional", en: "International" },
  frigorifico: { es: "Frigorífico", en: "Reefer" },
  paqueteria: { es: "Paquetería", en: "Parcel" },
};

export const FLEET_KIND_LABEL: Record<FleetKind, { es: string; en: string }> = {
  contrapesada: { es: "Contrapesada", en: "Counterbalance" },
  retractil: { es: "Retráctil", en: "Reach truck" },
  retractil_doble: { es: "Retráctil doble (stand-up)", en: "Stand-up double reach" },
  transpaleta: { es: "Transpaleta", en: "Pallet truck" },
  recogepedidos: { es: "Recogepedidos", en: "Order picker" },
  apilador: { es: "Apilador", en: "Stacker" },
  toro: { es: "Torito / transpaleta conductor", en: "Walkie pallet truck" },
  montacargas: { es: "Montacargas", en: "High-lift forklift" },
};

export const SYSTEM_CATEGORIES: ProductCategory[] = (
  Object.keys(CATEGORY_LABEL) as CategoryCode[]
).map((id) => ({
  id,
  code: id,
  labelEs: CATEGORY_LABEL[id].es,
  labelEn: CATEGORY_LABEL[id].en,
  system: true,
}));

export function categoryLabel(
  code: string,
  lang: "es" | "en",
  categories: ProductCategory[] = SYSTEM_CATEGORIES,
): string {
  const found = categories.find((c) => c.id === code || c.code === code);
  if (found) return lang === "es" ? found.labelEs : found.labelEn;
  const sys = CATEGORY_LABEL[code as CategoryCode];
  return sys ? sys[lang] : code;
}

export const WMS_STORAGE_KEY = "cn-wms-hub-v8";
export const WMS_STORAGE_KEY_LEGACY = ["cn-wms-hub-v7"];
