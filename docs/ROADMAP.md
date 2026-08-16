# Roadmap — brief enterprise (phases 0–14)

Las fases **de planta ya hechas** (pasillo, voz, merma, súper…) viven en [`WMS-ROADMAP.md`](./WMS-ROADMAP.md).
Este archivo alinea el brief ChatGPT con el repo real. **No son el mismo numerado.**

Phase 0 del brief = auditoría. **Hecha.** El código de planta no se ha parado: sigue en producción de demo (fases 1–20 internas).

---

## Mapa brief → trabajo real

| Brief | Nombre | En este repo | Abrir cuando |
|---|---|---|---|
| **0** | Audit + architecture | Hecho: `ARCHITECTURE*.md`, `DATABASE*.md`, `MIGRATION_PLAN.md`, este índice | — |
| **1** | Multi-tenant + Auth + RBAC | Auth/RBAC CRM **existe**. WMS: `org_id` en snapshot, sin RLS de stock | Tras Phase 0 revisada. Un tenant. No inventar org 2 |
| **2** | Warehouse + Locations + Products + UOM | Sites/slots/SKU hechos. Motor UOM puro (`uom.ts`), no persistido | Ledger + tabla de factores |
| **3** | Inventory ledger + balances + lots | Palets + `lots.ts` FEFO (sin cablear a la ola) | Extract movements + usar FEFO al asignar |
| **4** | Orders + allocation + reservations | Pedidos + `order-state.ts` (sin sustituir status ES) | Holds + cablear transiciones |
| **5** | Receiving + ASN + putaway | ASN plano + putaway zona | Líneas, incidencias, reglas |
| **6** | Waves + picking + replenishment | Olas + pick **hechos**. Reposición = cara vacía | MIN/MAX encima |
| **7** | Packing + SSCC + shipping | Load unit + ship. Sin SSCC gen / shipments | Adapter mock + registro SSCC |
| **8** | Dock + yard + carriers | Dock texto + catálogo carriers | Calendar; yard vacío de semilla |
| **9** | Returns + quality + cycle counting | Cycle-count básico. Sin returns/QC | Cuarentena bloquea pick |
| **10** | RF mobile + offline sync | RF **online** en LS | No fingir offline |
| **11** | Audit + observability + hardening | Audit CRM parcial. WMS sin traza servidor | `operationId` + `wms_audit` |
| **12** | Control tower | Torre **existe** (KPIs demo) | Misma torre, datos reales |
| **13** | AI operational copilot | IA = CRM/knowledge. No opera stock | Nunca escribe al hueco sola |
| **14** | Performance + QA + prod ready | Build/test locales | Tras ledger + demo OFF |

Plan interno por oleadas (más granular, commits pequeños): [`MIGRATION_PLAN.md`](./MIGRATION_PLAN.md).

---

## Orden de ejecución (brief 42)

No implementar todo de golpe. **No saltar a Phase 1 de código** hasta que se confirme.

Tras cada phase: typecheck, lint, tests, docs, build (`TESTING.md`). Si está rota, no se sigue.

---

## Semilla (brief 39) y observabilidad (brief 40)

Documentados en `INVENTORY.md` y `API.md`. No se generan 50 SKU ni un logger en este commit: primero coherencia de la semilla de 8 SKU + dos hubs.

---

## Migraciones (brief 44)

`supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Ver `DATABASE.md`. Vacío hasta la primera phase de datos.
