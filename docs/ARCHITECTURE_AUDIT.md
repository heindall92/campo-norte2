# Auditoría de arquitectura — Campo Norte WMS

> **Phase 0.** Inventario factual del repo. No se ha modificado el sistema
> operativo. Tip auditado: `c706aa6` · `feat(wms): fase 20 — súper en box/palet/carro y etiquetas por lado`.
>
> Fecha: 2026-08-16 · Rama: `cursor/wms-fase14-cierre-muelle-7cfa`
>
> Complementa: `docs/ESTADO.md`, `docs/WMS-ROADMAP.md`, `docs/FUERA-DE-NUCLEO.md`.
> Índice de producto: `docs/ARCHITECTURE.md`. Roadmap brief 0–14: `docs/ROADMAP.md`.
> Planes: `docs/TARGET_ARCHITECTURE.md`, `docs/DATABASE_PLAN.md`, `docs/MIGRATION_PLAN.md`.

---

## 1 · Qué es este producto hoy

Campo Norte es un **SaaS WMS de planta** (Vite + React 19 + TypeScript + Tailwind 4 + Vitest) construido **encima** de un CRM de viajes conservado (auth, roles, Data Hub, facturas, tesorería, aprobaciones, IA).

Hay **dos silos de datos** que no se hablan:

| Silo | Persistencia | Dominio |
|---|---|---|
| WMS `src/lib/wms` | **Solo localStorage** `cn-wms-hub-v8` | Stock, huecos, olas, picking, muelle, merma, voz |
| CRM `src/lib/data` | localStorage **o** Supabase JSONB | Leads, clientes, reservas de **viaje**, facturas |

`supabase/schema.sql` no contiene tablas WMS. Login demo (`sofia@camponorte.demo` / `norte2026`) fuerza Hub local (`forceLocalHub`). El snapshot WMS lleva `seededFromDemo: true`.

**Regla de oro vigente:** no inventar tracking, SSCC, telemetría de flota, lecturas de huella, SKU de cerveza/vino/especias ni carta de porte. Twin digital en letras A/B/C. Tesorería del Hub ≠ P&L WMS.

---

## 2 · Arquitectura actual

```
navegador
  ├── AuthProvider          local demo  +  Supabase Auth
  ├── DataHubProvider       CRM: LocalDataStore | SupabaseDataStore
  └── App → MpsCrmApp.tsx   (4446 líneas: shell, menú, secciones)
        ├── paneles CRM     tesorería, leads, facturas, IA…
        └── paneles WMS     cada uno llama useWmsLive() → copia propia
              └── src/lib/wms/*.ts   motor puro (snapshot in → snapshot out)

api/ (Vercel)               leads ingest, cron rescore, proxy IA, access-log
                            ── no hay endpoints WMS ──

Postgres / Supabase         mps_* (CRM + perfiles + RLS)
                            ── cero tablas WMS en schema.sql ──
```

No existen `src/modules/`, `src/domain/` ni `src/infrastructure/` como carpetas de producto. El WMS vive en dos montones: `src/lib/wms` (dominio) y `src/components/wms` (UI).

---

## 3 · Árbol relevante

```
src/
  main.tsx
  App.tsx
  components/
    MpsCrmApp.tsx              shell único (CRM + WMS)
    ui/                        StatCard, StatusBadge, tablas, gráficas
    wms/                       16 paneles + useWmsLive.ts
  lib/
    wms/                       45 archivos de dominio + tests (fase 20)
    data/                      Data Hub CRM
    auth/                      roles admin/ops/booking/guide
    supabase/client.ts
    runtime.ts                 forceLocalHub, flags demo
    ai/, leads/, treasury.ts, approvals.ts, …
api/
  leads/ingest.ts
  cron/rescore.ts
  ai/chat.ts
  ollama/chat.ts
  auth/access-log.ts
supabase/
  schema.sql                   CRM + RLS (sin WMS)
  access-log.sql
docs/
  ESTADO.md, WMS-ROADMAP.md, FUERA-DE-NUCLEO.md, WMS-HUELLA.md, SECURITY.md
scripts/
  wms-zk-agent.example.py      ejemplo; el SaaS no lee ZKTeco
```

---

## 4 · Módulos WMS existentes (fase 1–20)

| Módulo actual | Archivos | Qué hace de verdad |
|---|---|---|
| Tipos / semilla | `types.ts`, `seed.ts` (1115), `normalize.ts` | Snapshot monolítico; hubs Sevilla + Huelva de demo |
| Org | `org.ts` | Un tenant `org-camponorte`. `rlsMode: "snapshot"` (filtro en memoria) |
| Ubicación | `location.ts`, `onboard.ts` | Código `Pasillo-Bahía-Nivel-Posición`. Alta de centro escrita por el usuario |
| Catálogo | `catalog.ts` | CRUD SKU, categoría, palet, ASN, operario, flota. SSCC **escrito**, no generado |
| Picking | `picking.ts` | Ticket → hueco → SSCC → qty. Omitir / faltante |
| Olas | `waves.ts` | Abrir ola desde pedido con palets reales de pick face |
| Movimientos | `movements.ts` | Putaway, traslado, reposición cara vacía, inter-centro |
| Cycle count | `cycle-count.ts` | Cola por caducidad / ABC A / conteo viejo. Confirma qty+SSCC |
| Outbound | `outbound.ts` | Embalar, manifiesto print, cargar muelle, expedir (tracking manual) |
| Carriers | `carriers.ts` | Catálogo + ventana de muelle = cut-off − 90 min. Sin adapter |
| Planta | `floor.ts` (512) | Súper → código operario, load unit, fleje, etiqueta escrita, muelle |
| Merma | `merma.ts` | Baja stock si se declara. No fabrica pasillo de merma |
| Voz | `voice.ts` | Dictado + mandos. Web Speech. Prefs en LS |
| Faltante hueco | `slot-fix.ts` | Aviso desde aparato; jefe escribe la cuenta |
| RF | `rf.ts` | Cola derivada del snapshot. Escaneo real vs palet |
| Jornada | `jornada.ts`, `clock.ts`, `roster.ts` | PIN / adapter / manual. Gate: no pica si no fichó |
| Economía | `economics.ts`, `stats.ts`, `alerts.ts` | P&L 3PL **tarifario demo**. No se mezcla con tesorería Hub |
| Turnos | `shifts.ts` | Cubrir huecos con excedente; no inventa operarios |

UI: `WmsPanels.tsx` (1240), `AislePicking.tsx` (1035), `WmsFloorBoard.tsx` (748), `WmsLiveOps.tsx` (701), pistola, voz, inbound, palets, flota, operarios, centros, móvil.

---

## 5 · Dependencias

| Paquete | Uso |
|---|---|
| `react` 19 / `react-dom` | UI |
| `vite` 8 + `@vitejs/plugin-react` | Build |
| `tailwindcss` 4 | Estilos |
| `@supabase/supabase-js` | Auth + Data Hub CRM. **No** se usa para stock |
| `lucide-react` | Iconos (regla: no otros packs) |
| `recharts` | Gráficas torre / tesorería |
| `jspdf` | PDF facturas CRM |
| `vitest` / `oxlint` / `typescript` | Calidad |

No hay ORM, cola, bus de eventos, generador de SSCC, SDK de transportista ni librería de códigos de barras.

---

## 6 · Flujo de datos WMS (hoy)

```
buildWmsSeed() ──primera visita──► localStorage cn-wms-hub-v8
                                         │
useWmsLive() ──useState por montaje──► copia en memoria del panel
                                         │
acción (confirmPick, declareMerma…) ──función pura──► nuevo snapshot
                                         │
commit() ──saveWmsSnapshot──► localStorage
                                         │
otro panel ──NO se entera──► sigue con su copia
```

`WmsSites.tsx` ni siquiera usa el hook: lee y escribe LS a mano.

CRM (otro flujo): `DataHubProvider` único → `LocalDataStore` o `SupabaseDataStore` (`mps_leads` … `mps_invoices` como JSONB). Login demo pone `forceLocalHub=1` y el CRM no toca Postgres.

---

## 7 · Persistencia

### localStorage (claves)

| Clave | Qué |
|---|---|
| `cn-wms-hub-v8` (legacy v7) | **Todo el WMS** |
| `cn-wms-headset-on`, `cn-wms-voice-prefs` | Preferencia auriculares |
| `mps-growth-os-hub-v1` | Data Hub CRM local |
| `mps-force-local-hub-v1` | Login demo → Hub local |
| `mps-auth-user-v1` | Sesión demo |
| `mps-approvals-v1`, `mps-ai-*`, `mps-notifications-v1`, … | Satélites CRM |

### Supabase (real, en `schema.sql`)

`mps_hub_meta`, `mps_leads`, `mps_clients`, `mps_reservations` (**viajes**), `mps_invoices`, `mps_profiles`, `mps_lead_outcomes`, `mps_run_log`, `mps_access_log`.

RLS: `mps_is_team()`, `mps_can_write()`, `mps_is_admin()`, `mps_can_bill()`. Alta nueva = `pending`.

### Qué es mock / demo

- Snapshot WMS entero (`seededFromDemo: true`). Reloj `WMS_DEMO_NOW = 2026-08-15T11:00:00Z`.
- P&L 3PL con tarifas embebidas (`WMS_TARIFF`).
- Flota: batería solo `seed` o `manual`. Cargador `telemetry: "none"`.
- Huella: PIN hash, no plantilla biométrica. ZKTeco = script de ejemplo.
- Tracking / SSCC de caja: null hasta que alguien los escribe.
- Guía verbal 8–37: relato, no layout del twin (sigue A/B/C).

### Qué está incompleto (huecos honestos del propio código)

Tipos `OperatorRoleFloor` incluye `"calidad"` y `PalletStatus` incluye `"cuarentena"` **sin flujo**. `SlotStatus` incluye `"reservado"` pero no hay motor de reserva ATP. Carrier sin adapter. Dock = campo de texto + ventana derivada del cut-off.

---

## 8 · Auth y permisos

| Rol código | UI | Demo | WMS |
|---|---|---|---|
| `admin` | Dirección | sofia@ | todo |
| `ops` | Almacén | luis@ | núcleo WMS |
| `booking` | Office | marta@ | costes, recepción, expedición, CRM $ |
| `guide` | Planta | jorge@ | pasillo, picar, RF, movimientos, inventario |
| `pending` | — | — | sin acceso (solo Supabase) |

Permisos = lista de secciones de menú (`ROLE_ALLOWED_SECTIONS`). No hay RLS de stock. No hay auditoría de mutaciones WMS en servidor.

---

## 9 · Tests

36 archivos · **184 tests** en el tip fase 20 (`npm test`). ~20 de dominio WMS, 0 de componentes WMS. Lint: oxlint (avisos previos, sin error en fase 20). Build: `tsc -b && vite build`.

---

## 10 · Riesgos

| # | Riesgo | Por qué importa |
|---|---|---|
| R1 | **Dos copias de verdad** (CRM Postgres vs WMS LS) | Un refresh o dos pestañas pisan stock. No hay lock. |
| R2 | **`useWmsLive` por componente** | Torre y pistola pueden divergir en la misma sesión. |
| R3 | **Snapshot JSON único** | Un blob de ~todos los arrays. Sin transacciones por palet. |
| R4 | **Sin reservas de stock** | Dos olas pueden apuntar al mismo palet si se fuerzan; `palletsInOpenWaves` es un Set, no ATP. |
| R5 | **Putaway = primer hueco libre de la zona** | `suggestPutawaySlot` ordena zona + no-pickFace + código. Sin capacidad, familia, rotación ni distancia. |
| R6 | **Reposición = pick face vacío + reserva encima** | No hay MIN/MAX. `Sku.minStock` / `maxStock` existen y no disparan olas. |
| R7 | **Cycle count no escribe adjustment** | Confirma qty en el palet; no hay sesión ni transacción de ajuste tipada. |
| R8 | **Receiving = ASN plano** | `lines` y `palletsExpected` son números. Sin `asn_lines`, incidencias ni QC. |
| R9 | **Shipping = status en el pedido** | No hay `shipments`, paquetes, eventos de tracking ni adapter. |
| R10 | **Login demo apaga Postgres** | `forceLocalHub` también dejaría ciego un WMS remoto futuro. |
| R11 | **`MpsCrmApp.tsx` 4446 líneas** | Un solo archivo enruta todo el producto. |
| R12 | **P&L WMS tarifario** | Si se trata como caja real, se inventa dinero. Ya está separado de tesorería; hay que mantenerlo. |

---

## 11 · Deuda técnica (no borrar: migrar)

1. Estado WMS no compartido (`useWmsLive` + `WmsSites` a mano).
2. Persistencia WMS 100 % cliente.
3. Semilla y UI monolíticas (`seed.ts`, `WmsPanels`, `AislePicking`, `MpsCrmApp`).
4. `docs/FUERA-DE-NUCLEO.md` aún dice «núcleo = viajes + leads» — choca con el producto WMS.
5. Reloj demo congelado en alertas / cycle-count / merma del día.
6. Extracts relacionales inexistentes: movements viven dentro del JSON.
7. Sin `org_members` WMS; un solo org hardcodeado (correcto: no inventar el segundo).
8. Tests solo de funciones puras; la pistola y el pasillo no tienen test de UI.
9. API serverless sin superficie WMS (aceptable hasta que el ledger salga del navegador).
10. Borrador de persistencia/reservas se empezó en un hilo y **se revirtió** al abrir Phase 0 para no dejar el árbol a medias. No hay `wms-schema.sql` en el tip.

---

## 12 · Funcionalidades existentes (matriz)

| Capacidad | ¿En memoria? | ¿Persistida de verdad? | ¿Permisos finos? | ¿Auditoría? |
|---|---|---|---|---|
| Picking / olas / RF / voz | Sí | LS | Sección de menú | Movements en el JSON |
| Putaway / traslado / inter-centro | Sí | LS | Sección | Ídem |
| Reposición pick-face vacío | Propuesta + ejecutar | LS | Sección | Ídem |
| Packing (qtyPacked, SSCC escrito, load unit, estaciones/bultos) | Sí | LS | Sección | Ídem |
| Shipping (stage + ship) | Sí | LS | Sección | Tracking manual |
| Cycle count (cola + confirmar) | Sí | LS | Sección | Ajuste implícito en palet |
| Merma / slot-fix | Sí | LS | Sección | Eventos en JSON |
| Jornada / PIN / roster | Sí | LS | Sección | clockPunches |
| Catálogo / ASN / palets / flota | Sí | LS | Sección | No |
| Torre / alertas / P&L 3PL | Sí (calculado) | LS + tarifas demo | Sección | No |
| Reservas ATP | No | — | — | — |
| Yard / dock calendar | Calendar sí / yard no | LS | Sección | Eventos de cita |
| Returns / QC | No (tipos huérfanos) | — | — | — |
| SSCC generator | Solo con prefijo escrito (interno, no GS1) | LS | Sección | Audit `pack.open` |
| Carrier adapter | Mock etiquetado | LS | Sección | Eventos source=mock |
| Slotting (recomendación + confirmación) | No | — | — | — |
| MIN/MAX replenishment | Campos en SKU, sin motor | — | — | — |
| Multiempresa real | Schema mental `org_id` | Un org | — | — |

---

## 13 · Funcionalidades faltantes (brief del usuario, mapeadas)

Pedidas y **ausentes** en el tip fase 20. No se implementan en Phase 0.

| Brief | Hueco actual |
|---|---|
| 15 Replenishment MIN/MAX + ola | `proposeReplenishments` solo cara vacía |
| 16 Receiving ASN/líneas/incidencias | ASN agregado; sin suppliers ni QC |
| 17 Quality / quarantine | Status `cuarentena` sin flujo; stock sí pica |
| 18 Putaway rules (capacidad, familia, distancia) | `suggestPutawaySlot` zona + código |
| 19 Slotting con confirmación | No existe |
| 20 Packing stations / packages | **Oleada 8:** estaciones/bultos escritos; peso/dims null si no se teclean |
| 21 SSCC único + etiqueta | **Oleada 8:** registro único; generar solo con prefijo; print sin tracking |
| 22 Shipping shipments/events | **Oleada 9:** timestamps; tracking null si no se escribe |
| 23 CarrierAdapter + mock | **Oleada 9:** MockCarrierAdapter etiquetado; no importa seur |
| 24 Dock calendar / appointments | **Oleada 10:** muelles escritos; cupo 1 solo si está escrito |
| 25 Yard visits / vehicles | No existe (y no hay telemetría de flota de calle) |
| 26 Returns | No existe |
| 27 Cycle count sessions + adjustments | Tareas efímeras, sin sesión |

También faltan (deuda, no brief): persistencia Postgres WMS, RLS por `org_id`, provider de estado único, reservas de stock.

---

## 14 · Componentes reutilizables (conservar)

- `src/components/ui/*` (StatCard, StatusBadge, HierarchyTable, ViewTotals).
- `CrmChrome` Badge/Card.
- Auth, roles, shell, i18n es/en.
- Data Hub CRM (no mezclar con stock).
- Motor puro `src/lib/wms/*.ts`: las firmas `snap → { ok, snap }` son el núcleo a **envolver**, no a reescribir.
- Lucide. Tokens CSS 3 capas.

---

## 15 · Plan de migración (resumen)

Detalle en `docs/MIGRATION_PLAN.md`. Orden que respeta integridad > seguridad > operabilidad:

0. **Esta auditoría** (hecha). Esperar revisión humana.
1. Estado compartido (`WmsLiveProvider`) sin cambiar dominio.
2. Ledger Postgres + RLS (un tenant) + revisión optimista. Semilla si no hay backend.
3. Reservas de stock (hold / consume / release) sobre el motor actual.
4. Extraer tablas operativas (movements, reservations) sin tirar el JSON de golpe.
5. Recibir / QC / putaway rules / MIN-MAX — un módulo por commit.
6. Packing stations, SSCC, shipments, CarrierAdapter mock.
7. Dock calendar, yard, returns — solo con datos que planta describa.
8. Mover carpetas hacia `src/modules/*` **después** de que el ledger sea la fuente de verdad.

**No** reescribir la UI de planta en el primer paso. **No** inventar segunda empresa, SKU, pasillos 8–37 en el twin, ni tracking.

---

## 16 · Decisión de Phase 0

Un hilo anterior empezó persistencia/reservas (`reserve.ts`, `wms-schema.sql`, provider). Se **revirtió** al entrar en Phase 0 para no mezclar un sistema a medias con la auditoría. El tip sigue siendo fase 20. Nada de eso se da por hecho hasta que se revise este plan.
