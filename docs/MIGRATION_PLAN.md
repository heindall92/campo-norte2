# Plan de migración incremental — Campo Norte WMS

**Fase actual:** 0 completa (auditoría). **Stop hasta aprobación humana.**  
**Regla:** cada fase deja DEMO MODE usable. Si una fase rompe tests, lint, typecheck o build, no se avanza.

Comandos de cierre de fase (obligatorios):

```bash
npx tsc -b --pretty false
npm run lint
npm test
npm run build
```

Actualizar `docs/ESTADO.md` al terminar cada fase (memoria entre agentes). Commits pequeños, mensajes `feat(wms): …` / `feat(inventory): …`.

---

## Gate de aprobación Phase 0

Antes de Phase 1 el usuario debe confirmar:

1. El **núcleo del producto** pasa a WMS (el CRM se conserva, deja de ser el centro).
2. Multi-tenant **sí** (anula la prohibición de `docs/FUERA-DE-NUCLEO.md` para este repo).
3. DEMO MODE + PRODUCTION MODE como se describe en `TARGET_ARCHITECTURE.md`.
4. Inventario palet-céntrico evoluciona a **balances + ledger** (Opción A de ubicaciones).
5. No se reescribe `MpsCrmApp` ni se borran módulos CRM.

Si algún punto se rechaza, se ajusta este plan **antes** de tocar código.

---

## Principios de migración

1. **Adapter, no replace.** `confirmPick` y compañía se quedan; cambia quién persiste el `snap` o el equivalente relacional.
2. **Dual run.** En fases 2–3 el demo snapshot sigue; Postgres se rellena en paralelo o detrás de flag.
3. **Un corte de integridad.** El día que PRODUCTION MODE escriba stock, el ledger es obligatorio. No hay “un semanito actualizando qty a mano”.
4. **No mocks de persistencia** si Supabase está en PRODUCTION MODE.
5. **No commits gigantes.** Una fase = varios commits temáticos, un PR mental.
6. **No borrar historial git.**

---

## Mapa de fases → código existente

| Fase | Qué se toca (previsto) | Qué no se toca |
|---|---|---|
| 0 | Solo `docs/*` | Código app |
| 1 | `auth/*`, `roles.ts`, `supabase/schema` + migrations, `AuthProvider` | Dominio picking |
| 2 | catálogo/ubicaciones + tablas; `catalog.ts` detrás de port | Ledger |
| 3 | `movements`/`cycle-count`/`picking` escriben ledger vía port | UI masiva |
| 4 | `waves.ts`, `outbound` cabecera → líneas | Packing stations |
| 5 | `catalog` ASN, `movements` putaway | Yard |
| 6 | `picking`, `rf`, replenishment MIN/MAX | Offline |
| 7 | `outbound.ts` packages/SSCC | Carrier API real |
| 8 | docks/yard nuevos; `carriers.ts` adapter manual | — |
| 9 | returns/quality/cycle sessions | — |
| 10 | `WmsRfGun`, IndexedDB | — |
| 11 | audit RPC, logs | — |
| 12 | `WmsPanels` torre sobre queries | Rediseño visual |
| 13 | `ask-bus` + findings WMS | Chat genérico |
| 14 | índices, QA, seed 50 SKU, dual mode pulido | Features nuevas |

---

## PHASE 0 — Audit + architecture

**Estado:** hecha 2026-08-16.

Entregables:

- `docs/ARCHITECTURE_AUDIT.md`
- `docs/TARGET_ARCHITECTURE.md`
- `docs/DATABASE_PLAN.md`
- `docs/MIGRATION_PLAN.md`

**DoD:** el equipo humano ha leído y aprobado el gate de arriba.

---

## PHASE 1 — Multi-tenant + Auth + RBAC

**Objetivo:** identidad empresarial sin mover stock.

### Hacer

- Carpeta `supabase/migrations/` + baseline del `schema.sql` CRM.
- Tablas `wms_organizations`, members, roles, permissions, user_roles.
- Seed de roles del encargo.
- `AuthProvider`: leer rol desde `mps_profiles` **y/o** `wms_user_roles`, **dejar de usar** `user_metadata.role` como fuente de verdad (bug actual).
- Mapear UI: `admin→ADMIN`, `ops→WAREHOUSE_MANAGER`, `guide→PICKER` (o FORKLIFT si hay employee vinculado), `booking→VIEWER` + permisos de billing CRM.
- Permisos de menú derivados; `canAccessSection` lee permisos, con fallback a la matriz actual para DEMO.
- Flag `VITE_WMS_MODE=demo|production`.
- Tests: mapping de roles; usuario `pending` no ve WMS.

### No hacer

- Tablas de inventario.
- Partir `MpsCrmApp`.
- Desactivar cuentas demo (siguen en DEMO MODE).

### Riesgo

Romper login demo. Mitigación: si `allowLocalDemoAuth()` y provider local, mapa fijo; no llamar a Postgres.

### DoD

- Typecheck, lint, test, build verdes.
- Documentar en `docs/SECURITY.md` el nuevo flujo (y corregir la contradicción demo-vs-Supabase).
- RLS de membership verificado a mano (SQL) + nota de tests RLS pendientes de Phase 11.

---

## PHASE 2 — Warehouse + Locations + Products + UOM

**Objetivo:** catálogo real conviviendo con el snapshot.

### Hacer

- Tablas warehouse/zone/location/product/uom (ver `DATABASE_PLAN.md`).
- Parser barcode stub `src/infrastructure/barcode/` (GS1 mínimo + códigos de hueco actuales). `classifyScan` delega sin cambiar UX RF.
- Port `WmsCatalogRepository`. Demo: sigue en snapshot. Prod: SQL.
- CRUD UI actual (`WmsCatalog`, `WmsSites`) habla el port.
- UOM: migrar `Sku.uom` enum → `product_uoms` con conversiones default (ud/caja/kg/palet).
- Generación de locations: reutilizar `generateSiteSlots` / `onboardSite` escribiendo filas.

### No hacer

- Cortar localStorage WMS.
- 50 SKU todavía (se puede ampliar seed TS de forma coherente si no rompe tests).

### DoD

- Onboarding de centro demo sigue funcionando offline.
- Tests `location` + `onboard` + `catalog` verdes.
- Conversion UOM cubierta por test (12 UNIT = 1 CASE).

---

## PHASE 3 — Inventory ledger + balances + lots

**Corte de integridad.** A partir de aquí PRODUCTION MODE no existe sin ledger.

### Hacer

- Tablas lots, HU/palet, balances, transactions, reservations (vacías), adjustments, counts.
- RPC `wms_apply_inventory_tx`.
- Adapter: `confirmPick`, `putaway`, `transfer`, `cycle-count`, `receiveAsnPallet` pasan por un `InventoryService` de dominio que:
  - en DEMO: muta snapshot **y** append `StockMovement` (como ahora) + tipos mapeados;
  - en PROD: RPC.
- Reloj inyectable: eliminar defaults `2026-08-15` del dominio (pasar `now` desde el caller). `WMS_DEMO_NOW` solo en tests/seed.
- Regla `available`. Rechazo de stock negativo.
- FEFO: función de dominio que ordena lots; todavía no allocation de pedidos (Phase 4), pero sí helper testeado.

### Cuidado

`confirmCycleCount` hoy hace `pallet.qty = input.qty`. Debe emitir `COUNT`/`ADJUSTMENT`. Test de regresión de variance.

### DoD

- Tests nuevos: no negativo, lote caducado no available, reconstrucción `SUM(tx) = on_hand` en un caso seed.
- Demo picking/RF/conteo **igual de usables**.
- Documentar `docs/INVENTORY.md` (puede nacer en esta fase; el índice del encargo se completa al cierre de cada fase).

---

## PHASE 4 — Orders + allocation + reservations

### Hacer

- `order_lines`. Backfill: una línea sintética por pedido demo a partir de olas existentes **o** seed reescrito coherente.
- Máquina de estados + `order_status_events`.
- Allocation: stock available + location + lot FEFO/FIFO + warehouse. Crea `inventory_reservations`. Prohibido over-allocate (test).
- `openWaveFromOrder` deja de “coger los primeros N palets” como único criterio; consume reservas.

### No hacer

- Packing stations nuevas.

### DoD

- Test: dos pedidos no reservan el mismo available.
- Pedido no pasa a SHIPPED desde CREATED.
- UI expedición sigue abriendo ola.

---

## PHASE 5 — Receiving + ASN + putaway

### Hacer

- `asn_lines`, receipts, diferencias → incidencias.
- Flujo ASN → muelle → QC stub (pass-through si no hay inspección) → putaway.
- `suggestPutawaySlot` evoluciona a score (zona + capacidad + pick-face vs reserva). Sigue siendo recomendación.
- Cerrar ASN al ubicar el último (ya existe `closeAsnIfLocated`).

### DoD

- Recepción parcial y lote incorrecto generan incidencia (test).
- UI `WmsInboundAdmin` sin perder CRUD.

---

## PHASE 6 — Waves + picking + replenishment

### Hacer

- Entidades wave persistidas.
- Pick tasks con SHORT explícito (`markShortage` ya está).
- Replenishment MIN/MAX usando `min_stock`/`max_stock` del producto **además** del hueco pick-face vacío.
- Tipos PLANNED / URGENT / AUTO.
- RF cola deriva de tasks persistidas en PROD; en DEMO de snapshot (como ahora).

### DoD

- Tests picking + rf + movements + nuevo MIN/MAX.
- Jorge sigue sin picar si no fichó (jornada).

---

## PHASE 7 — Packing + SSCC + shipping

### Hacer

- Packages / package_lines. `qtyPacked` actual se proyecta a packages.
- Generador SSCC único (aplicación + unique SQL). No inventar tracking.
- `ManualCarrierAdapter` (createShipment = noop + getLabel futuro + track = lectura manual).
- Manifiesto de muelle sobre packages + HU.

### DoD

- Tests outbound existentes + SSCC unique.
- No se puede pack > picked.

---

## PHASE 8 — Dock + yard + carriers

### Hacer

- Tablas docks/appointments; vista Dock Calendar (nueva sección o pestaña en expedición/recepción).
- Yard mínimo (visita + estados). No hace falta telemetría de puertas.
- String `dock` → FK con fallback.

### DoD

- Calendario lee appointments reales (demo seed).
- Carrier adapter sigue manual.

---

## PHASE 9 — Returns + quality + cycle counting

### Hacer

- Returns flow.
- Quality inspections; cuarentena bloquea available (Phase 3 ya tiene columna).
- Count sessions persistidas; ABC / location / SKU / lot.

### DoD

- Stock en cuarentena no sale en allocation (test).
- Conteo genera adjustment + audit actor.

---

## PHASE 10 — RF mobile + offline sync

### Hacer

- Outbox IndexedDB + replay.
- Idempotency keys en RPC (Phase 3–6 deben haber dejado el hueco).
- Conflicto: servidor gana; UI muestra SHORT / `task_stale` (código ya existe).

### No hacer

- App nativa.

### DoD

- Test de dominio de merge/idempotencia (simulado).
- UX PDA: flujo de 3 scans intacto.

---

## PHASE 11 — Audit + observability + security hardening

### Hacer

- `wms_audit_logs` en todas las RPC de stock.
- Correlation id en RF y API.
- Tests RLS (org A no lee org B).
- Cerrar contradicciones de flags demo en producción (`VITE_STRICT_AUTH` documentado como obligatorio en prod).
- Pendientes de panel: signup OFF, primer admin, `ALLOWED_ORIGINS` — checklist `docs/SECURITY.md`.

### DoD

- UI no puede borrar audit.
- Checklist producción actualizado.

---

## PHASE 12 — Control Tower

### Hacer

- Queries/vistas torre: disponibilidad, pedidos, olas, picking %, receiving delay, dock, shipment risk, coverage, fleet, incidents, cut-off.
- Cola **qué debo hacer** (acciones: ASIGNAR PICKER, etc.) reutilizando `AttentionPanel` pattern, no un dashboard de vanidad.
- Alertas persistidas (Phase 11–12).

### No hacer

- Rediseño visual. Conservar StatCard / alertas actuales.

### DoD

- Cada KPI de la torre tiene una decisión asociada documentada en `docs/ARCHITECTURE.md`.

---

## PHASE 13 — AI Operational Copilot

### Hacer

- Herramientas que **solo** leen vistas WMS (expediciones en riesgo, SKU stockout, slotting hint, wave priority, delay causes).
- Output estructurado; `optional_action` requiere confirmación (bandeja aprobaciones existente).
- No reutilizar prompts de leads sin aislamiento.

### DoD

- Preguntas del encargo contestadas con evidence del ledger/seed.
- Cero acciones de stock autónomas.

---

## PHASE 14 — Performance, QA, production readiness

### Hacer

- Seed SQL coherente ≥50 SKU.
- Índices (plan §19).
- Integration tests concurrencia (dos PICK al mismo balance).
- Lighthouse/accesibilidad básico en RF y torre.
- Documentación completa de la lista del encargo (`ARCHITECTURE`, `DATABASE`, `INVENTORY`, `ORDER_FLOW`, `RECEIVING`, `PICKING`, `SHIPPING`, `SECURITY`, `API`, `DEPLOYMENT`, `TESTING`, `ROADMAP`).
- Dual mode verificado: demo sin env vs prod con Supabase.

### DoD

- Definition of Done del encargo para flujos críticos: UI + backend + persistencia + permisos + errores + estados + audit + tests + responsive + docs.
- Roadmap `docs/WMS-ROADMAP.md` actualizado (fases 1–13 históricas se conservan como “hecho en demo”; nuevas fases enterprise aparte).

---

## Rollback

| Fase | Rollback |
|---|---|
| 1–2 | DROP tablas `wms_*` nuevas; CRM intacto; snapshot local intacto |
| 3+ | Migraciones down solo si no hay stock real. Si hay stock: freeze writes, no DROP ledger |
| UI | feature flag `VITE_WMS_MODE=demo` vuelve al snapshot |

Nunca `migrate down` en producción con transacciones de inventario.

---

## Paralelismo permitido

Mientras Phase 1–3 no estén verdes, **no** desarrollar en paralelo packing/yard/IA sobre datos falsos nuevos.

Sí se puede, en paralelo y sin mezclar PRs:

- Documentación de dominio.
- Tests de funciones puras que aún no dependen de SQL (FEFO helper, UOM math, state machine) — preferible **dentro** de la fase que los usa.
- Limpieza de tipos en `types.ts` **aditiva** (campos optional), no rupturas.

---

## Criterios para decir “esta fase está rota”

- `npm test` rojo.
- Build/typecheck rojo.
- DEMO: no se puede picar la ola semilla o la pistola RF no confirma un scan correcto.
- PRODUCTION flag on: se puede mutar stock sin fila de ledger.
- Un rol VIEWER confirma un pick desde la UI **y** el servidor lo acepta.

---

## Primera acción tras aprobación

Único siguiente paso (Phase 1, cuando el usuario diga):

1. Crear `supabase/migrations/20260816100000_baseline_crm.sql` (copia de schema actual).
2. Crear `20260816120000_create_wms_tenant_rbac.sql`.
3. Corregir `AuthProvider` para no fiarse de `user_metadata.role`.
4. Introducir `VITE_WMS_MODE` sin cambiar el snapshot WMS.

Hasta ese “adelante”, **cero cambios de aplicación**.
