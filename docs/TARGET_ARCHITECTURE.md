# Arquitectura objetivo — Campo Norte WMS

**Fase:** 0 (propuesta). No se mueve código hasta aprobación.  
**Principio:** evolucionar el dominio actual (`src/lib/wms`) hacia un sistema transaccional, sin reescritura.

---

## 1. Visión

Campo Norte WMS = **Warehouse Management System + Control Tower**, SaaS multi-tenant.

- PostgreSQL es la fuente de verdad en PRODUCTION MODE.
- DEMO MODE ejecuta el **mismo dominio** contra un store in-memory/local (el snapshot de hoy).
- La UI industrial existente se conserva.
- El CRM/Growth OS permanece como módulos de back-office, no como núcleo de inventario.

Prioridades (del encargo):

> CORRECTNESS > DATA INTEGRITY > SECURITY > OPERABILITY > MAINTAINABILITY > PERFORMANCE > UX > VISUAL POLISH

---

## 2. Modos de ejecución

```
┌─────────────────────────────────────────────────────────┐
│  UI  (components/wms + shell)                           │
│  habla comandos de dominio, no localStorage ni SQL      │
└───────────────────────────┬─────────────────────────────┘
                            │ WmsPort (commands + queries)
              ┌─────────────┴─────────────┐
              ▼                           ▼
     DemoWmsAdapter               PostgresWmsAdapter
     (snapshot actual             (Supabase Auth + SQL
      load/save localStorage)      RPC + RLS + Realtime)
```

| | DEMO MODE | PRODUCTION MODE |
|---|---|---|
| Activación | Sin `VITE_SUPABASE_*` **o** `VITE_WMS_MODE=demo` | Supabase configurado y `VITE_WMS_MODE=production` |
| Auth | Cuentas embebidas | Supabase Auth + `user_roles` |
| Datos | Seed TS `buildWmsSeed()` | Seed SQL + datos reales |
| Persistencia | `cn-wms-hub-v8` | Tablas `wms_*` / esquema `wms` |
| Integridad | Best-effort en un documento | Transacciones, constraints, ledger |
| Multi-tenant | Un org ficticio | `organization_id` + RLS |

Regla: **el login demo nunca escribe en tablas de producción.** Ya existe `forceLocalHub()` para el CRM; el WMS necesita el equivalente explícito (`forceDemoWms`).

El Hub CRM puede seguir en jsonb durante las fases 1–7. No bloquear el WMS a esperar la normalización CRM.

---

## 3. Estructura de carpetas (migración incremental)

No mover todo el día 1. Crear carpetas **cuando una fase las llene**. Evitar archivos vacíos.

```
src/
  modules/                 # UI + hooks por bounded context
    inventory/
    receiving/
    putaway/
    picking/
    replenishment/
    packing/
    shipping/
    returns/
    quality/
    warehouse/
    orders/
    waves/
    docks/
    yard/
    carriers/
    workforce/
    fleet/
    control-tower/
    analytics/
    billing/               # costes WMS (no Tesorería CRM)

  domain/                  # funciones puras (hoy: src/lib/wms)
    inventory/
    orders/
    warehouse/
    logistics/
    workforce/

  infrastructure/
    supabase/
    barcode/               # GS1 parser (Phase 2–3)
    carriers/              # CarrierAdapter
    devices/               # RF, ZKTeco agent ingest
    wms-store/             # Demo adapter + Postgres adapter

  shared/
    components/            # ui/* actuales
    hooks/
    utils/
    types/
```

**Mapeo inmediato (sin mover aún):**

| Hoy | Destino |
|---|---|
| `src/lib/wms/types.ts` | `domain/**` tipos |
| `src/lib/wms/*.ts` (picking, movements, …) | `domain/` por contexto |
| `src/components/wms/*` | `modules/*` |
| `src/lib/wms/index.ts` load/save | `infrastructure/wms-store/demo-store.ts` |
| `src/lib/supabase` | `infrastructure/supabase` |
| `src/lib/auth` | ampliar, no reemplazar |
| `src/lib/data` | CRM; no mezclar con ledger WMS |
| `MpsCrmApp.tsx` | shell; ir extrayendo secciones |

Criterio de split: un archivo > 700 líneas **y** varias responsabilidades. `seed.ts` puede seguir largo (es datos). `MpsCrmApp.tsx` se parte por secciones, no por “reescribir el CRM”.

---

## 4. Capas

```
┌──────────────┐
│ Presentation │  React. Sin reglas de stock. Sin SQL.
├──────────────┤
│ Application  │  casos de uso: ConfirmPick, AllocateOrder, ReceiveAsn…
│              │  orquesta dominio + persistencia + audit + alertas
├──────────────┤
│ Domain       │  puro, testeable, reloj inyectado, sin I/O
├──────────────┤
│ Infrastructure │ Postgres/RPC, barcode, carriers, local snapshot
└──────────────┘
```

Hoy presentación y aplicación están mezcladas (`commit` en el panel) y el dominio ya está relativamente limpio. El trabajo es **introducir application services** que llamen al store, no reescribir `confirmPick`.

### 4.1 Comandos de dominio (contrato estable)

Ejemplos que ya existen y deben permanecer como API:

- `confirmPick` / `skipPickLine` / `markShortage`
- `putawayReceivedPallet` / `confirmTransfer` / `applyReplenishment`
- `packPickedLines` / `stageOrderToDock` / `shipOutboundOrder`
- `confirmCycleCount`
- `receiveAsnPallet`

En producción, el adapter traduce el comando a:

```
BEGIN;
  INSERT inventory_transactions …;
  UPDATE inventory_balances …;
  INSERT audit_logs …;
COMMIT;
```

Nunca `UPDATE inventory_balances SET qty = $n` sin transacción de ledger.

---

## 5. Multi-tenant y RBAC

### 5.1 Jerarquía

```
organization
  ├── warehouses
  │     ├── warehouse_zones
  │     └── warehouse_locations
  ├── users (membership)
  └── roles / permissions
```

Un usuario pertenece a **una o más** organizaciones. El contexto activo (`organization_id`, `warehouse_id`) viaja en cada request y en RLS (`auth.jwt()` / `current_setting` / tabla `organization_members`).

Aislamiento:

- Tenant: ninguna fila WMS sin `organization_id`.
- Almacén: operaciones de planta exigen `warehouse_id` del membership o permiso cruzado (Dirección).
- DEMO: una org `org-camponorte` semilla.

### 5.2 Roles objetivo

| Rol | Equivale hoy | Notas |
|---|---|---|
| `ADMIN` | `admin` | IAM + todos los almacenes |
| `WAREHOUSE_MANAGER` | `ops` | Un o varios warehouses |
| `SUPERVISOR` | — | Turno / olas |
| `RECEIVING` | `OperatorRoleFloor.recepcion` | |
| `PICKER` | `picker` + parte de `guide` | |
| `PACKER` | — | Nuevo |
| `SHIPPER` | `expedicion` | |
| `FORKLIFT_OPERATOR` | `carretillero` | |
| `INVENTORY_CONTROLLER` | `calidad` (parcial) | Conteos |
| `AUDITOR` | — | Solo lectura + audit |
| `VIEWER` | parte de `booking` | KPIs, no mutar stock |

`booking` (Office) **no** debe mutar inventario. Conserva facturas/tesorería/costes.

Permisos granulares (`permission_code`): `inventory.read`, `inventory.adjust`, `picking.confirm`, `shipping.dispatch`, … El menú (`AppSection`) se deriva de permisos, no al revés.

**Servidor manda.** RLS + RPC `SECURITY DEFINER` con `SET search_path` y chequeo de rol. El frontend oculta botones; no autoriza.

### 5.3 Auth

- PRODUCTION: sesión Supabase. El rol se lee de `user_roles` / `mps_profiles` **evolucionado**, nunca de `user_metadata` como fuente de verdad.
- DEMO: cuentas actuales. Mapa fijo email → rol.
- Signup público: seguir recomendando OFF. Altas por invitación.

Migración de `mps_profiles.role`: ampliar el `CHECK` en Phase 1 **sin romper** `admin|ops|booking|guide|pending`. Añadir columna `wms_role` o tabla puente `user_roles` y deprecar el enum CRM después.

---

## 6. Inventario (núcleo)

### 6.1 Separación de responsabilidades

| Concepto | Tabla | Papel |
|---|---|---|
| Catálogo | `products`, `product_uoms` | Qué es el SKU |
| Lote / serie | `lots`, `serial_numbers` | Identidad de mercancía |
| Estado actual | `inventory_balances` | Stock por ubicación × lote × estado |
| Historia | `inventory_transactions` | Ledger append-only |
| Reservas | `inventory_reservations` | Allocation a pedido/ola |
| Ajustes / conteos | `inventory_adjustments`, `inventory_counts` | Excepciones |

`Pallet` actual se convierte en **unidad de manejo (HU / SSCC)** que *apunta* a balances, no al revés. Un palet 1:1 con hueco sigue siendo el caso feliz de Campo Norte; el modelo no lo exige.

### 6.2 Balance

Campos:

- `on_hand`
- `allocated`
- `picked`
- `packed`
- `staged`
- `blocked`
- `quarantined`

```
available = on_hand - allocated - blocked - quarantined
```

`picked/packed/staged` son cantidades **en tránsito de salida** (siguen on_hand del almacén hasta SHIP, o se mueven de ubicación pick → pack → dock). Decisión recomendada (documentar en Phase 3):

- **Opción A (recomendada, más simple):** `on_hand` siempre en una ubicación. PICK mueve qty de location origen → location dest (staging/pack). `allocated` baja al confirmar pick.
- **Opción B:** flags en el mismo hueco. Más cerca del snapshot actual, peor para yard/dock.

Elegir A al implementar el ledger. El snapshot demo puede seguir con palet.slotId.

### 6.3 Transacciones

Tipos: `RECEIPT | PUTAWAY | MOVE | ALLOCATE | DEALLOCATE | PICK | REPLENISH | PACK | STAGE | LOAD | SHIP | RETURN | ADJUSTMENT | COUNT | QUARANTINE | RELEASE`.

Mapeo desde `MovementType` actual (`entrada|salida|traslado|ajuste|inventario`):

| Hoy | Mañana |
|---|---|
| entrada | RECEIPT / PUTAWAY |
| salida | PICK / SHIP |
| traslado | MOVE / REPLENISH / STAGE / LOAD |
| ajuste | ADJUSTMENT |
| inventario | COUNT |

No borrar el tipo viejo en demo; traducir en el adapter.

Reglas:

- Toda mutación de balance inserta ≥1 transacción.
- Idempotencia: `idempotency_key` (RF scan, `correlation_id`).
- Stock negativo: prohibido salvo `warehouses.allow_negative_stock`.
- Race: `UPDATE … WHERE available >= qty` o `SELECT … FOR UPDATE` en RPC.

### 6.4 UOM

Unidad base por producto (`each` / `g` / `ml`). Conversiones en `product_uoms`:

```
1 BOX  = 12 UNIT
1 CASE =  1 BOX     (o 12 UNIT)
1 PALLET = 48 CASE
```

Toda transacción guarda `qty` en base **y** `qty_uom` + `uom_code` de captura. El palet actual (`unitsPerPallet`) es un UOM más.

### 6.5 Lotes y FEFO

`lots.expiry_date`, `manufacture_date`, `batch_code`.  
Estrategia por producto o por zona: `FIFO | FEFO | LIFO | MANUAL`.

Allocation elige lote según estrategia; MANUAL exige `lot_id` en el comando.

Alertas persistidas: `EXPIRING_SOON`, `EXPIRED`, `BLOCKED` (no solo cómputo en cliente).

---

## 7. Pedidos, allocation, olas

### Pedido

Estados: `CREATED → ALLOCATED → RELEASED → PICKING → PARTIALLY_PICKED → PICKED → PACKING → PACKED → STAGED → LOADED → SHIPPED` y `CANCELLED`.

Tabla `order_status_events` (quién, cuándo, from, to, reason).  
Transiciones en una sola función de dominio; el adapter las persiste.

`OutboundOrder` actual es la cabecera. Phase 4 añade `order_lines`.

### Allocation

Input: líneas, warehouse, estrategia de lote, zona, cut-off.  
Output: `inventory_reservations` + transacción `ALLOCATE`.  
Rechazo si `available` insuficiente (no recortar en silencio). Soft allocation vs hard: **hard** en este WMS (reserva hueco/lote).

### Waves

`waves` + `wave_orders` + `pick_tasks`.  
Criterios: prioridad, cliente, ruta, carrier, cut-off, zona, temperatura, almacén.

`PickWave` / `PickLine` actuales ≈ `waves` / `pick_tasks`. Evolucionar, no duplicar.

Tarea PICK: estados `PENDING | ASSIGNED | IN_PROGRESS | COMPLETED | SHORT | CANCELLED`.  
`markShortage` ya existe: debe crear SHORT y no mentir la qty.

---

## 8. Inbound, calidad, putaway, slotting

```
ASN → ARRIVAL → DOCK → RECEIVING → QC → PUTAWAY → AVAILABLE
```

Tablas: `suppliers`, `asn`, `asn_lines`, `receipts`, `receipt_lines`.  
Diferencias (parcial / exceso / faltante / daño / lote incorrecto) → `quality_incidents`.

Cuarentena: balance `quarantined`; **no available**. El status `cuarentena` del palet se mapea aquí.

Putaway: motor de reglas (capacidad, zona, temperatura, familia, compatibilidad, rotación, distancia). Phase 5: reutilizar `suggestPutawaySlot` y sustituir “primer libre” por score.  
Slotting (Phase 5+): recomendación con `reason` + `% distancia`; **nunca** mover sin confirmación.

---

## 9. Outbound físico

Packing: `packing_stations`, `packages`, `package_lines`.  
SSCC único (GS1, check digit) por palet/bulto/shipment.  
Shipping: `shipments`, `shipment_lines`, `shipment_packages`, `carrier_services`, `tracking_events`.

`CarrierAdapter`:

```ts
createShipment()
getLabel()
trackShipment()
cancelShipment()
```

Primera impl: `ManualCarrierAdapter` (el flujo actual de tracking escrito a mano). No `Mock` que invente números de tracking — contradice la honestidad del README.

---

## 10. Dock, yard, returns

Dock: `docks`, `dock_appointments`, `dock_events` + vista calendario.  
Yard: `yard_locations`, `yard_visits`, `vehicles`, `drivers`.  
Returns: `returns`, `return_lines`, `return_inspections` → RESTOCK / QUARANTINE / SCRAP.

Hoy solo hay `order.dock` string y huecos zona `muelle`. Phase 8 no borra eso: promociona el string a FK cuando el muelle exista.

---

## 11. RF / mobile / offline

UI: optimizar `WmsRfGun` + `WmsMobileHome` (PDA / teléfono / tablet).

Flujo: SCAN LOCATION → SCAN SKU/SSCC → CONFIRM QTY → COMPLETE (ya está).

Offline-first (Phase 10):

```
device_outbox (IndexedDB)
  event_id, command, payload, ts, device_id
sync → server idempotency_key
conflict → servidor gana en stock; dispositivo muestra SHORT / retry
```

No implementar IndexedDB antes de tener RPC idempotentes.

---

## 12. Control Tower, productividad, costes, alertas, IA

Torre: **qué pasa** + **qué debo hacer**. Datos de queries agregadas (no recálculo total del snapshot en el cliente cuando el almacén crezca).

Productividad: lines/h, units/h, accuracy, tiempo de tarea. Por rol/turno/zona. **Sin vigilancia de personas:** agregar, no perfiles biométricos; PIN ya es hash local.

Costes WMS: `cost/order|line|pallet|pick|ship` a partir de labor/carrier/handling/storage. Seguir **sin mezclar** con Tesorería del Hub.

Alertas: filas persistidas (`alerts`) con severity, status, entity, recommended_action. El motor actual `computeWmsAlerts` pasa a ser *detector* que upsert-a filas.

IA: no chatbot genérico. Input = queries WMS. Output = `{ finding, evidence, confidence, recommendation, optional_action }`. Nunca ejecuta PICK/SHIP/ADJUST sin confirmación humana (regla de oro, ahora también de planta).

---

## 13. Observabilidad

- `correlation_id` en comandos RF y RPC.
- Logs estructurados en `/api` y, más adelante, edge functions WMS.
- `audit_logs` append-only; la UI no borra.
- Errores de dominio (`wrong_sscc`, `insufficient_stock`) como códigos estables (ya el estilo `{ ok: false, error }`).

---

## 14. GS1 / barcode

Módulo `src/infrastructure/barcode/` (Phase 2, usable desde RF sin acoplar a la pantalla):

- Parseo GTIN, EAN-13, GS1-128, DataMatrix, SSCC.
- Extraer AI: `01` GTIN, `10` LOT, `17` EXP, `00` SSCC, `21` SERIAL.
- `classifyScan` actual se convierte en fachada de este parser + códigos de hueco Campo Norte (`A-03-02-1`).

---

## 15. Testing objetivo

Mantener tests de dominio (Vitest, puro). Añadir:

- Domain: FEFO, UOM, transiciones, shortage, expired lot, negative stock flag.
- Application: allocation no over-reserve.
- Integration: RPC Postgres (Supabase local o transacciones de test) para PICK/RECEIPT concurrentes.
- RLS: tests SQL de aislamiento de org.

No sustituir los 14 test files WMS: son la red de seguridad al extraer adapters.

---

## 16. Lo que no haremos

- No reemplazar Lucide ni la paleta.
- No meter inventario en `payload jsonb`.
- No unificar Tesorería CRM con costes WMS.
- No fingir telemetría de flota ni lecturas ZKTeco.
- No generar tracking de carrier.
- No ejecutar acciones críticas por IA.
- No un god rewrite de `MpsCrmApp` en una sola fase.
- No borrar módulos CRM “porque el producto ahora es WMS”.
