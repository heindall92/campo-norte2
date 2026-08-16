# Auditoría de arquitectura — Campo Norte WMS

**Fase:** 0 (solo lectura)  
**Repositorio:** [heindall92/campo-norte2](https://github.com/heindall92/campo-norte2)  
**Fecha:** 2026-08-16  
**Alcance:** árbol completo del workspace local clonado desde `main`.  
**Regla:** este documento no autoriza cambios de código. Describe el sistema tal como está.

---

## 1. Veredicto

Campo Norte es un **prototipo avanzado de WMS + Control Tower** con dominio operativo real (funciones puras, tests, flujos de planta) montado sobre un **CRM/Growth OS** anterior (leads, reservas, facturas, tesorería, IA).

Lo que funciona hoy es una **demo transaccional en memoria**: las reglas de picking, putaway, RF, conteo y expedición son coherentes *dentro del snapshot*, pero **no hay fuente de verdad PostgreSQL para el WMS**. El Hub CRM sí puede persistir en Supabase, pero como **JSON blobs**, no como modelo relacional.

El producto **no es software industrial todavía**. Es un simulador de planta de alta fidelidad, con identidad visual y UX ya útiles, y con una base de dominio que **se puede evolucionar** sin reescribir.

**Prioridad de la transformación:** integridad de datos y aislamiento de tenant. No visual polish.

---

## 2. Identidad del producto (conflicto documentado)

Existen **tres narrativas** en el repo. Hay que elegir una y no mezclarlas.

| Fuente | Qué dice que es el producto |
|---|---|
| `README.md` / `docs/WMS-ROADMAP.md` | WMS OS / torre de control logística (hubs Andalucía) |
| `docs/ESTADO.md` / `docs/FUERA-DE-NUCLEO.md` | Growth OS de **viajes + leads**; multi-org explícitamente fuera |
| Este encargo (Phase 0+) | **WMS SaaS empresarial** multiempresa / multialmacén |

`docs/FUERA-DE-NUCLEO.md` declara: «Una org / un Hub» y «Multi-org: no diseñar hasta haber 2 orgs reales». El WMS objetivo **exige** multi-tenant. Eso no es un bug: es un **cambio de producto** que hay que ratificar antes de Phase 1.

**Decisión propuesta (no ejecutada):** el núcleo pasa a ser WMS. El CRM (leads, clientes, reservas, facturas, tesorería, aprobaciones, conocimiento) se **conserva** como módulos adyacentes de back-office, no se borra.

---

## 3. Arquitectura actual

### 3.1 Stack

| Capa | Tecnología |
|---|---|
| UI | React 19, Vite 8, Tailwind 4, Lucide, Recharts |
| Lenguaje | TypeScript 6 (`type: module`) |
| Auth | Supabase Auth **opcional** + cuentas demo embebidas |
| Datos CRM | `localStorage` **o** Supabase (`payload jsonb`) |
| Datos WMS | **Solo** `localStorage` (`cn-wms-hub-v8`) |
| API | Vercel serverless (`api/ai`, `api/leads`, `api/cron`, `api/auth`) |
| Tests | Vitest, entorno Node, `src/**/*.test.ts` |
| Lint | oxlint |
| Deploy | Vercel (`vercel.json`, SPA rewrite, CSP, cron 06:00 UTC) |

No hay React Router. El enrutado es `window.location.pathname` (`/`, `/captura`, `/legal`) más un `section` en estado de `MpsCrmApp`.

No hay React Query, ni cola de jobs WMS, ni Realtime, ni Storage de ficheros operativos.

### 3.2 Árbol relevante

```
src/
  App.tsx                         # login / captura / legal / shell
  components/
    MpsCrmApp.tsx                 # 4292 líneas — shell + CRM + switch de secciones
    wms/                          # 14 paneles WMS
    ui/                           # primitivas Aurora (KPI, sparkline, badges)
  lib/
    wms/                          # dominio WMS (snapshot + funciones puras)
    data/                         # Data Hub CRM (local | supabase)
    auth/                         # roles CRM (admin/ops/booking/guide)
    ai/                           # scoring leads + RAG + chat
    supabase/client.ts
api/                              # IA, ingesta leads, cron, access-log
supabase/
  schema.sql                      # Hub CRM + perfiles + RLS (sin tablas WMS)
  access-log.sql
docs/                             # ESTADO, SECURITY, WMS-ROADMAP, GAP Aurora
```

No existe `src/modules/`, `src/domain/` ni `src/infrastructure/` como en la arquitectura objetivo.

### 3.3 Arranque

```
main.tsx
  AuthProvider
    NotificationsProvider
      DataHubProvider          ← CRM (leads/clientes/reservas/facturas)
        App
          MpsCrmApp            ← sección activa
            useWmsLive()       ← WMS (otro store, otro ciclo de vida)
```

**Hallazgo:** el WMS **no** pasa por `DataHubProvider`. Son dos universos de persistencia desacoplados.

### 3.4 Flujo de datos WMS (hoy)

```
buildWmsSeed()  ──primera visita──►  localStorage[cn-wms-hub-v8]
                                          │
UI (useWmsLive) ◄── loadWmsSnapshot() ────┤
     │                                    │
     └── commit(nextSnap) ── saveWmsSnapshot() ──► replace-all JSON
```

Toda mutación es:

1. Clonar el snapshot en memoria.
2. Devolver `{ ok, snap }` o `{ ok: false, error }`.
3. `commit(snap)` serializa **el documento entero**.

No hay transacciones SQL, no hay optimistic locking, no hay cola. La última pestaña gana.

### 3.5 Flujo de datos CRM (hoy)

```
preferredDataMode()
  VITE_DATA_MODE=local     → LocalDataStore (mps-growth-os-hub-v1)
  Supabase configurado     → SupabaseDataStore (tablas mps_*)
  login demo local         → forceLocalHub() ignora Supabase
```

Tablas: `mps_leads`, `mps_clients`, `mps_reservations`, `mps_invoices`, `mps_hub_meta`.  
Cada fila = `{ id, payload jsonb }`. El esquema de negocio vive en TypeScript, no en Postgres.

---

## 4. Módulos existentes

### 4.1 WMS — dominio (`src/lib/wms`)

| Archivo | Responsabilidad | Madurez |
|---|---|---|
| `types.ts` | Snapshot, SKU, Slot, Pallet, ASN, Order, Wave, Fleet, Operator | Sólido para demo |
| `seed.ts` (~1074 líneas) | Semilla Sevilla + Huelva | Demo coherente, ~8 SKU |
| `location.ts` | Código `Pasillo-Bahía-Nivel-Posición` | Listo para reutilizar |
| `picking.ts` | Confirmar / omitir / faltante; scan hueco+SSCC | Buena |
| `movements.ts` | Putaway por zona SKU, traslado, reposición MIN pick-face | Buena |
| `waves.ts` | Abrir ola desde pedido; asignar picker | Parcial (sin allocation FEFO) |
| `outbound.ts` | Pack cajas, stage muelle, ship, manifiesto | Buena para palet/caja |
| `cycle-count.ts` | Cola ABC/caducidad; ajuste firmado | Parcial (muta qty palet) |
| `rf.ts` | Cola + sesión scan; no confirma si no coincide | Buena |
| `catalog.ts` | CRUD SKU/categoría/palet/ASN/operario/flota | CRUD in-memory |
| `carriers.ts` | Catálogo + tracking **manual** | Sin adapter |
| `alerts.ts` | Batería, caducidad, cut-off, pick-face vacío | Derivado, no persistido |
| `economics.ts` / `stats.ts` | €/palet, €/línea, P&L 3PL, ocupación | Tarifas demo |
| `shifts.ts` / `roster.ts` / `jornada.ts` / `clock.ts` | Cupo 25/25/25, PIN, fichaje | Demo de planta |
| `org.ts` | `org_id` + filtro de snapshot | **No es RLS** |
| `onboard.ts` | Alta de hub con layout escrito | OK |
| `normalize.ts` | Migración de claves localStorage v7→v8 | OK |
| `fingerprint.ts` | Hash PIN; documenta que no es ZKTeco | Honesto |
| `priorities.ts` | Heurística del día → navegar sección | UI |

### 4.2 WMS — UI (`src/components/wms`)

| Panel | Sección `AppSection` |
|---|---|
| `WmsDashboardPanel` (en `WmsPanels.tsx`) | `dashboard` — torre |
| `WmsStockPanel` / `WmsCatalog` | `stock` |
| `WmsSlotsPanel` + `AislePicking` | `huecos` / `picking` |
| `WmsRfGunPanel` | `rf` |
| `WmsLiveOps` | `movimientos` |
| Cycle count (en paneles) | `inventario` |
| `WmsPalletsAdmin` | `palets` |
| `WmsFleetAdmin` | `flota` |
| `WmsInboundAdmin` | `recepcion` |
| Outbound (en `WmsPanels`) | `expedicion` |
| `WmsOperatorsAdmin` | `operarios` |
| `WmsSites` | `centros` |
| Costes (en `WmsPanels`) | `costes` |
| `WmsMobileHome` | inicio móvil planta |
| `WmsShifts` | cobertura turnos |
| `useWmsLive` | hook persistencia local |

### 4.3 CRM / Growth OS (conservar)

Leads (scoring, 4 modos, decay, ingest, cron), clientes, reservas, facturas Veri\*FACTU, tesorería, aprobaciones, equipo (dietas), conocimiento/RAG, automatizaciones n8n, propuesta/slides, calendario fiscal, IA contextual.

Estos módulos **no se eliminan**. Quedan fuera del ledger de inventario.

### 4.4 Auth y roles actuales

Cuatro roles de **CRM**, no de planta WMS:

| Rol código | Etiqueta UI | Alcance menú |
|---|---|---|
| `admin` | Dirección | Todo |
| `ops` | Almacén | WMS + hub + equipo |
| `booking` | Office | Costes, facturas, tesorería, poco de planta |
| `guide` | Planta | Huecos, picking, RF, movimientos, palets, flota |

RBAC = `ROLE_ALLOWED_SECTIONS` en el **frontend**. Postgres RLS cubre **solo** tablas CRM (`mps_*`). El WMS no tiene políticas.

Roles de planta (`picker`, `carretillero`, `recepcion`…) viven en `Operator.role` del snapshot, desconectados de `AppUser.role`. El puente es `operatorForAppUser()` por **nombre**.

---

## 5. Persistencia — mapa honesto

| Dato | Dónde vive | ¿Postgres? | ¿RLS tenant? |
|---|---|---|---|
| Snapshot WMS completo | `localStorage` `cn-wms-hub-v8` | No | No (`org.ts` filtra en cliente) |
| Leads / clientes / reservas / facturas | local **o** `mps_*` jsonb | Sí (blob) | Equipo, no `org_id` |
| Perfiles / roles CRM | `mps_profiles` | Sí | Sí (rol, no org) |
| Sesión | Supabase Auth o `mps-auth-user-v1` | Parcial | — |
| Notificaciones | `mps-notifications-v1` | No | — |
| Preferencias / apariencia / IA | varios `localStorage` | No | — |
| Aprobaciones | localStorage | No | — |
| Knowledge RAG | localStorage | No | — |
| Access log | `mps_access_log` (service role) | Sí | Lectura equipo |
| Lead outcomes / run log | `mps_lead_outcomes`, `mps_run_log` | Sí | Equipo |

**Conclusión:** no hay tablas `products`, `inventory_balances`, `orders`, `waves` ni `audit_logs` WMS. El roadmap ya lo admite: *«Tablas WMS en Postgres / RLS cuando haya stock real»*.

---

## 6. Qué es mock / demo / incompleto

### Demo (intencional y documentado)

- Semilla Sevilla (`CN-SEV-01`) + Huelva (`CN-HUE-02`).
- ~8 SKU, palets y huecos generados, olas `WAVE-A-0815-01` / `WAVE-REP-A-0815`.
- Tarifas 3PL (`WMS_TARIFF`) ficticias.
- Reloj de alertas anclado a `WMS_DEMO_NOW = 2026-08-15T11:00:00Z`.
- Muchas funciones de dominio aceptan `at` con default fijo de demo.
- Batería de flota: semilla o reporte manual; el cargador **no** inventa %.
- Huella ZKTeco: no se finge; PIN + agente LAN de ejemplo.
- Tracking de carrier: lo escribe el usuario.
- `seededFromDemo: true` en el snapshot.

Esto es **honestidad de producto**, no deuda oculta. Hay que **preservarlo** como DEMO MODE.

### Incompleto (parece WMS, no lo es todavía)

| Capacidad | Estado real |
|---|---|
| Multiempresa | Un `WmsOrg` en semilla; filtro JS |
| Multialmacén | 2 sites en el mismo JSON |
| Inventario | Qty en `Pallet`; no hay balance ni ledger reconstruible de verdad |
| UOM | Un enum en SKU; sin tabla de conversión |
| Lotes / FEFO | `lot` + `expiry` en palet; **nadie selecciona FEFO** al asignar |
| Allocation / reservas | La ola coge palets libres de pick-face (primeros N) |
| Pedidos | Cabecera sin `order_lines`; líneas nacen en la ola |
| Máquina de estados pedido | 5 estados sueltos; transiciones no centralizadas |
| GS1 | SSCC como string; `classifyScan` no parsea AI (01)(10)(17)(00) |
| Calidad / cuarentena | `PalletStatus` incluye `cuarentena`; sin flujo QC |
| Devoluciones | No existe |
| Yard | No existe |
| Dock calendar | String `dock` + ventana derivada del cut-off |
| Carrier adapter | Catálogo local + tracking manual |
| Packing station | Pack incrementa `qtyPacked` en la línea; no hay `packages` |
| SSCC generation | Alta manual / semilla; sin check digit GS1 |
| Offline RF | Cola en vivo del snapshot; sin outbox |
| Audit WMS | Movimientos operativos sí; no hay `audit_logs` actor/before/after |
| IA operacional WMS | El copilot es de leads/conocimiento CRM |
| Tests de concurrencia | No (no hay backend que competir) |

### Mock peligroso (corregir en fases, no borrar)

- `AuthProvider.roleFromMeta`: el rol de UI se toma de `user_metadata.role`, no de `mps_profiles`. El trigger de alta sí fuerza `pending`, pero **cualquier metadata posterior o JWT** puede pintar un rol distinto al de Postgres. RLS CRM está bien; **el menú WMS no**.
- `allowLocalDemoAuth()` permanece `true` aunque haya Supabase (salvo flags). `docs/SECURITY.md` dice lo contrario. Gana el código: `src/lib/runtime.ts`.
- Conteos y picking mutan `pallet.qty` en el documento. Hay `StockMovement` de acompañamiento, pero **el estado no se reconstruye desde el ledger**; el ledger es un log anexado.

---

## 7. Dependencias

### Runtime

`react`, `react-dom`, `@supabase/supabase-js`, `lucide-react`, `recharts`, `clsx`, `tailwind-merge`, `jspdf`.

Ausentes (y no hace falta añadirlos en Phase 0): router, state server, ORM, cola, GS1 lib, barcode renderer.

### Infra implícita

- Vercel (hosting + cron leads).
- Supabase (Auth + Postgres CRM).
- Opcional: Ollama / OpenAI / Anthropic / Gemini vía `api/ai/chat`.

### Scripts

`npm run dev | build | test | lint | preview | serve | demo:mobile`.

No hay `supabase/` CLI, no hay carpeta `supabase/migrations/`. El esquema se pega en el SQL Editor.

---

## 8. Archivos monolíticos (candidatos a partir, no a reescribir ahora)

| Archivo | Líneas | Problema |
|---|---|---|
| `src/components/MpsCrmApp.tsx` | 4292 | Shell + CRM + switch WMS + ajustes |
| `src/lib/demo-data.ts` | 1505 | Semilla CRM viajes |
| `src/components/OpsPanels.tsx` | 1264 | Paneles CRM |
| `src/lib/wms/seed.ts` | 1074 | Semilla WMS (aceptable como seed) |
| `src/components/N8nFlowBuilder.tsx` | 1032 | Fuera de núcleo WMS |
| `src/components/wms/WmsPanels.tsx` | 998 | Torre + stock + huecos + outbound + costes |
| `src/components/wms/AislePicking.tsx` | 786 | Digital twin + picking |

Umbral del encargo: 500–700 líneas. **No partir en Phase 0.** Anotar para Phase 1+ solo cuando se toque esa zona.

---

## 9. Modelo de dominio actual (WMS)

Entidades del snapshot:

```
WmsOrg
  └── WarehouseSite[]
        ├── Slot[]          (1 palet / hueco en semilla)
        ├── Pallet[]        (SSCC, lote, caducidad, qty, skuId)
        ├── FleetUnit[] / WallCharger[]
        ├── Operator[] / ClockPunch[]
        ├── InboundAsn[]    (contadores, no líneas ASN)
        ├── OutboundOrder[] (sin order_lines)
        └── CostLine[]
PickWave[] → PickLine[]     (sku, qty, slot, pallet, status)
Carrier[]                   (org)
StockMovement[]             (log, no ledger canónico)
```

**Inventario = palet en hueco.** No hay:

- `inventory_balances` por (warehouse, location, sku, lot, status)
- reservas (`allocated`)
- UOM base vs transaccional
- números de serie
- líneas de pedido / ASN

Regla `available = on_hand - allocated - blocked - quarantined` **no existe**. El equivalente implícito es: palet `en_ubicacion` en hueco no bloqueado y no en ola abierta.

Putaway sugiere el **primer hueco libre de la zona del SKU**, no capacidad/compatibilidad/distancia.

Reposición: `proposeReplenishments` si pick-face vacío y hay reserva encima (retráctil doble). No es MIN/MAX de SKU (aunque el SKU tiene `minStock`/`maxStock` para catálogo).

---

## 10. Seguridad (estado real)

Lo ya hecho (CRM) está documentado en `docs/SECURITY.md` y es de calidad:

- RLS por rol en `mps_*`.
- Alta con rol `pending`.
- Trigger anti auto-promoción.
- Guardas en `/api/ai/*` (CORS, rate limit).
- CSP / HSTS / noindex en Vercel.
- Service role fuera de `VITE_`.

Huecos para un WMS de producción:

1. **Cero RLS WMS** (no hay tablas).
2. Rol de UI desde `user_metadata`.
3. Demo auth coexistiendo con Supabase salvo flags.
4. Contraseña demo en el bundle (aceptable solo si DEMO MODE no toca datos reales).
5. Snapshot WMS en el navegador: cualquier usuario del dispositivo ve y edita el almacén.
6. Sin audit log de mutaciones WMS (quién cambió qty, desde qué dispositivo).
7. IDs no UUID (`sku-aceite`, `mv-pick-…`).
8. Acciones pendientes de panel: desactivar signup público; promover primer admin; `ALLOWED_ORIGINS`.

---

## 11. Testing actual

~30 ficheros `*.test.ts`. Dominio WMS cubierto con tests de funciones puras:

ubicación, picado, movimientos, RF, outbound, cycle-count, alerts, economics, shifts, jornada, onboard, floor-ops, ops-daily.

**No hay:** tests de RLS, de permisos WMS, de FEFO, de over-allocation, de stock negativo, de doble reserva, de scan duplicado a nivel persistido, de transiciones inválidas de pedido, de integración Supabase.

La Definition of Done del encargo **no se cumple** para ninguna capacidad WMS de producción: la UI funciona sobre un documento local.

---

## 12. UX / identidad (conservar)

- Tokens de 3 capas en `src/index.css` (Aurora pattern, paleta Campo Norte).
- Iconos Lucide (regla de oro del README).
- Shell escritorio + `MobileCrmShell` + `WmsMobileHome`.
- KPI con delta/sparkline, cola de atención, bandeja de aprobaciones (CRM).
- Torre: ocupación, alertas, €/palet, €/línea, huecos de turno.

No rediseñar. Industrializar estados (loading/error/empty) cuando haya red.

---

## 13. Deuda técnica (priorizada)

### P0 — impide producción WMS

1. Persistencia WMS = localStorage replace-all.
2. Sin modelo relacional ni ledger.
3. Sin tenant isolation real.
4. RBAC frontend-only; roles CRM ≠ roles de planta.
5. Auth UI no lee `mps_profiles`.

### P1 — integridad operativa

6. Qty de palet como fuente de verdad (no el ledger).
7. Sin allocation / reservas → over-pick posible entre pestañas.
8. UOM sin conversiones.
9. Pedidos sin líneas ni máquina de estados.
10. Reloj y `at` de demo incrustados en dominio.

### P2 — producto incompleto

11. God component `MpsCrmApp.tsx`.
12. CRM jsonb (aceptable temporalmente; no copiar ese patrón al WMS).
13. IA no habla el snapshot WMS.
14. RF sin offline.
15. Dualidad CRM viajes vs WMS (nombres `mps_*`, `MpsCrmApp`).

### P3 — higiene

16. Semilla ~8 SKU vs objetivo 50+.
17. IDs opacos no UUID.
18. Sin carpeta de migrations.
19. Documentación `ESTADO.md` desfasada respecto al WMS (sigue hablando de viajes como núcleo).

---

## 14. Funcionalidades existentes vs faltantes (matriz)

Leyenda: **E** existente (demo) · **P** parcial · **F** faltante · **N** no aplicar aún (fase posterior)

| Capacidad objetivo | Hoy | Notas |
|---|---|---|
| Multiempresa | P | Un org en snapshot |
| Multialmacén | E | 2 hubs |
| Ubicaciones | E | Código industrial real |
| SKU | E | CRUD |
| UOM configurable | F | Enum fijo |
| Lotes | E | Campo palet |
| Caducidades / FEFO | P | Alertas sí; selección no |
| SSCC | P | String; sin GS1 check |
| Inventario balances | F | |
| Ledger transacciones | P | `StockMovement` no canónico |
| Reservas / allocation | F | |
| Recepción / ASN | P | Sin `asn_lines`; recepción palet a palet |
| Putaway | P | Primera ubicación de zona |
| Slotting | F | |
| Picking / waves | P | Ola desde palets pick-face |
| Replenishment MIN/MAX | P | Pick-face vacío, no min/max SKU |
| Packing | P | `qtyPacked`; no packages/SSCC bulto |
| Staging / loading / shipping | P | Palet entero + manifiesto |
| Carriers adapter | F | Manual |
| Docks calendar | F | |
| Yard | F | |
| Returns | F | |
| Quality / quarantine | F | Status palet huérfano |
| Cycle count | P | Sesión no persistida como entidad |
| Workforce | P | Roster + PIN |
| Productividad | P | picksPerHour / hoursToday en seed |
| Flota | P | Sin telemetría (correcto) |
| Auditoría | F | |
| Costes | P | OPEX vs tarifa demo |
| KPIs torre | E | Derivados |
| Alertas persistidas | F | Se recalculan |
| IA operacional | F | Copilot CRM |
| RF mobile | P | Online, scan estricto |
| Offline sync | F | |
| DEMO + PRODUCTION mode | P | Flags auth/hub; WMS siempre demo |

---

## 15. Componentes y dominio reutilizables (no reemplazar)

Reutilizar tal cual, envolviendo persistencia después:

- Motor de ubicación (`location.ts`).
- Confirmación de picado / RF (`picking.ts`, `rf.ts`).
- Putaway por zona + reposición (`movements.ts`).
- Outbound pack/stage/ship (`outbound.ts`).
- Cycle count firmado (`cycle-count.ts`).
- Jornada / PIN (`jornada.ts`, `clock.ts`).
- Digital twin pasillo (`AislePicking.tsx`).
- Primitivas UI (`components/ui/*`).
- Tokens CSS.
- Tests de dominio: serán la batería de regresión al extraer un `WmsStore`.

**Contrato a extraer (Phase 1–3, no ahora):**

```ts
interface WmsStore {
  load(): Promise<WmsSnapshot>; // o queries por agregado
  commit(op: WmsCommand): Promise<WmsSnapshot>;
}
```

Implementaciones: `LocalSnapshotStore` (demo) y `PostgresWmsStore` (producción). La UI sigue hablando el mismo dominio.

---

## 16. Riesgos

| Riesgo | Impacto | Mitigación (plan, no código) |
|---|---|---|
| Reescritura del snapshot UI | Perder 13 fases de planta | Adapter, no replace |
| Copiar patrón jsonb al WMS | Imposible auditar stock | Tablas relacionales + RPC |
| Activar Supabase WMS sin DEMO MODE | Demo pública escribe “producción” | Flag de modo + seed aislado |
| Mezclar Tesorería CRM con P&L WMS | Doble conteo (ya se evitó una vez) | Seguir la regla del README |
| Roles CRM mapeados mal a RBAC planta | Picker con menú de Dirección | Tabla `permissions` nueva; no reutilizar `guide` como único rol |
| Reloj demo en dominio | Tests y alertas anclados a 2026-08-15 | Inyectar `clock` en Phase 3 |
| `MpsCrmApp` como cuello de botella | Cualquier módulo nuevo infla el god file | Secciones WMS ya están en `components/wms`; no meter más CRM ahí |

---

## 17. Plan de migración (resumen)

Detalle en [`MIGRATION_PLAN.md`](./MIGRATION_PLAN.md). Esquema en [`DATABASE_PLAN.md`](./DATABASE_PLAN.md). Destino en [`TARGET_ARCHITECTURE.md`](./TARGET_ARCHITECTURE.md).

Orden acordado con el encargo: **no implementar hasta revisión humana**.

1. Phase 0 — esta auditoría (hecha).
2. Phase 1 — tenant + Auth + RBAC (Postgres), sin mover inventario.
3. Phase 2 — warehouses / locations / products / UOM (convivir con snapshot).
4. Phase 3 — ledger + balances + lots (corte de integridad).
5. Phase 4+ — orders, inbound, waves, packing, dock, returns, RF, audit, tower, IA.

Hasta Phase 3 inclusive, **DEMO MODE sigue siendo el snapshot local**. PRODUCTION MODE nace vacío o con seed SQL coherente, nunca mezclado con `localStorage`.

---

## 18. Criterio de no destrucción

No borrar:

- Ningún panel WMS listado en §4.2.
- Data Hub CRM ni `supabase/schema.sql` actual.
- Tests existentes.
- Semilla demo ni cuentas `sofia@` / `norte2026` en DEMO MODE.
- Documentación de honestidad (`WMS-HUELLA.md`, no inventar telemetría).

Documentar y migrar cuando el código contradiga el ledger (p. ej. `confirmCycleCount` escribe `pallet.qty` directo). No silenciar la contradicción.

---

## 19. Entregable Phase 0

| Documento | Contenido |
|---|---|
| Este archivo | Arquitectura actual, deuda, riesgos |
| `TARGET_ARCHITECTURE.md` | Destino incremental |
| `DATABASE_PLAN.md` | Esquema PostgreSQL propuesto |
| `MIGRATION_PLAN.md` | Fases 1–14, gates, rollback |

**Stop.** Esperar revisión del usuario antes de Phase 1.
