# Arquitectura objetivo — Campo Norte WMS

> Phase 0. Propuesta. **No se ha movido código.**
> El objetivo no es más carpetas: es un WMS transaccional, con una verdad
> de stock, permisos y auditoría. La UI de planta se conserva.

---

## 1 · Principios

1. **Correctness > integridad > seguridad > operabilidad > mantenibilidad > rendimiento > UX > polish.**
2. Si una decisión visual choca con el stock, gana el stock.
3. El motor actual (`snap → resultado`) se **envuelve**; no se tira.
4. Migración incremental. Un archivo >700 líneas con varias responsabilidades se parte **cuando** se toque ese módulo, no en un big-bang.
5. Un solo tenant real: `org-camponorte`. El schema admite `org_id`; no se fabrica la segunda empresa.
6. Tesorería del Hub y P&L WMS no se mezclan.
7. No se inventan SSCC, tracking, telemetría, SKU ni layout 8–37.
8. Confirmación humana en slotting y en cualquier movimiento que cambie ubicación recomendada.

---

## 2 · Carpetas objetivo (llegar por oleadas)

```
src/
  modules/                 # casos de uso + UI de un bounded context
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
    billing/

  domain/                  # tipos + reglas puras (hoy: src/lib/wms)
    inventory/
    orders/
    warehouse/
    logistics/
    workforce/

  infrastructure/
    supabase/              # ledger, RLS client, mappers
    barcode/               # SSCC, impresión (cuando exista)
    carriers/              # CarrierAdapter + MockCarrierAdapter
    devices/               # RF, voz, ZK adapter (sin fingir lecturas)

  shared/
    components/            # ui/ + CrmChrome
    hooks/                 # useWmsLive (un provider)
    utils/
    types/

  # Conservar hasta que duela menos:
  lib/data/                # CRM Data Hub
  lib/auth/
  lib/ai/
  components/MpsCrmApp.tsx # partir por secciones, no de noche
```

No es obligatorio mover todo. La primera oleada **no** crea las 20 carpetas vacías.

---

## 3 · Mapa «hoy → objetivo»

| Hoy | Destino (cuando se toque) | Notas |
|---|---|---|
| `lib/wms/types.ts` | `domain/*/types` + `shared/types` | Partir por agregado, no un types.ts de 2000 líneas |
| `lib/wms/picking.ts` + `waves.ts` + `voice.ts` + `rf.ts` | `domain/orders` + `modules/picking` | El flujo de planta se queda |
| `lib/wms/movements.ts` putaway | `modules/putaway` + `domain/inventory` | Extraer `suggestPutawaySlot` a reglas |
| `proposeReplenishments` | `modules/replenishment` | Añadir MIN/MAX sin borrar la cara vacía |
| `catalog.ts` ASN | `modules/receiving` | Líneas e incidencias nuevas |
| `cycle-count.ts` | `modules/inventory` (counts) | Sesiones + adjustments |
| `outbound.ts` pack/ship | `modules/packing` + `modules/shipping` | Packages / shipments nuevos |
| `carriers.ts` | `modules/carriers` + `infrastructure/carriers` | Adapter; catálogo actual = datos |
| `floor.ts` load units | `modules/packing` + `modules/docks` | LoadUnit es el embrión de package |
| `merma.ts` + `slot-fix.ts` | `domain/inventory` + `modules/quality` | Merma ≠ QC de inbound |
| `clock.ts` `roster.ts` `jornada.ts` | `modules/workforce` | |
| `economics.ts` | `modules/billing` + `modules/analytics` | Seguir siendo tarifario hasta datos reales |
| `stats.ts` `alerts.ts` `WmsPanels` torre | `modules/control-tower` | |
| `useWmsLive.ts` | `shared/hooks` + provider en `main.tsx` | Primera oleada, sin mover carpetas |
| `seed.ts` | `infrastructure/supabase` seed + `domain` fixtures | Seguir siendo demo explícita |
| `lib/data/*` | se queda | CRM satélite |
| `MpsCrmApp.tsx` | lazy + `modules/*/routes` | Último, no primero |

---

## 4 · Modelo mental de agregados

```
Org
 └─ Site
     ├─ Slots / Zones
     ├─ Inventory ( Pallet + Lot + Reservation + Quarantine )
     ├─ Inbound ( Supplier → ASN → Receipt → QC → Putaway )
     ├─ Outbound ( Order → Wave → Pick → Pack → Shipment → Dock/Yard )
     ├─ Workforce / Fleet
     └─ Counts / Adjustments / Audit
```

Hoy casi todo eso es un array dentro de `WmsSnapshot`. El objetivo es que **una mutación de stock** sea:

1. Validada en dominio (qty, hueco, SSCC, reserva, cuarentena).
2. Aplicada en una transacción (ledger o tablas).
3. Visible para todos los paneles (un store).
4. Auditada (`who`, `at`, `action`, `before/after` o movement id).
5. Rechazada con error tipado si choca (no «se ve bien en pantalla»).

---

## 5 · Contratos que no se rompen

- Login demo y semilla local si no hay backend.
- Iconos Lucide.
- i18n es/en en planta.
- Tracking y SSCC solo si se escriben o se generan con algoritmo documentado (GS1), nunca aleatorio «bonito».
- Guía 8–37 sigue siendo relato hasta que planta confirme el layout.
- CRM de viajes intacto.

---

## 6 · Qué no hacer en el salto

- Reescribir `AislePicking` / pistola / voz «para que quede limpio».
- Crear 20 módulos vacíos con `index.ts` placeholder.
- Meter yard/returns/QC con datos inventados «para completar el brief».
- Unificar tesorería Hub con costes WMS.
- Un monorepo o un backend Nest/Java «de verdad» antes de que el ledger Postgres funcione.

---

## 7 · Criterio de archivo grande

Cuando se abra un módulo, si el archivo supera ~500–700 líneas **y** mezcla UI + reglas + I/O, partir en ese commit:

| Candidato | Corte natural |
|---|---|
| `WmsPanels.tsx` (1240) | Torre / expedición / costes ya son secciones |
| `AislePicking.tsx` (1035) | Twin vs flujo de pick |
| `WmsFloorBoard.tsx` (748) | Tarjetas ya exportadas |
| `WmsLiveOps.tsx` (701) | Movimientos vs prioridades |
| `floor.ts` (512) | Ticket vs load unit vs etiquetas |
| `outbound.ts` (492) | pack vs stage vs ship |
| `catalog.ts` (473) | SKU vs ASN vs flota |
| `MpsCrmApp.tsx` (4446) | Router de secciones; no en oleada 1 |
| `seed.ts` (1115) | Por agregado cuando exista seed SQL |

---

## 8 · Definición de «módulo listo»

Una pantalla que «se ve» no basta. Un módulo objetivo está listo cuando:

- UI del flujo (también en viewport estrecho de pistola).
- Reglas de dominio con tests.
- Persistencia (LS como fallback; Postgres cuando el ledger exista).
- Permiso de sección **y** (en Postgres) RLS de org.
- Errores tipados, no silenciosos.
- Estados del flujo explícitos.
- Auditoría (movement o `wms_audit`).
- Doc corta en `docs/WMS-ROADMAP.md` + `ESTADO.md`.

Hasta que el ledger exista, los módulos nuevos **siguen** el contrato `WmsSnapshot` para no bifurcar dos mundos.
