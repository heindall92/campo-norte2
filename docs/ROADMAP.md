# Roadmap — brief enterprise (phases 0–14)

Las fases **de planta ya hechas** (pasillo, voz, merma, súper…) viven en [`WMS-ROADMAP.md`](./WMS-ROADMAP.md).
Este archivo alinea el brief ChatGPT con el repo real. **No son el mismo numerado.**

Phase 0 del brief = auditoría. **Hecha.** El código de planta no se ha parado: sigue en producción de demo (fases 1–20 internas).

---

## Mapa brief → trabajo real

| Brief | Nombre | En este repo | Abrir cuando |
|---|---|---|---|
| **0** | Audit + architecture | Hecho: `ARCHITECTURE*.md`, `DATABASE*.md`, `MIGRATION_PLAN.md`, este índice | — |
| **1** | Multi-tenant + Auth + RBAC | Auth CRM + roles WMS (`rbac.ts`) + SQL tenant/RLS no aplicado | Un tenant. No inventar org 2 |
| **2** | Warehouse + Locations + Products + UOM | Sites/slots + proyección tenant + UOM puro | Extraer locations a Postgres + factores |
| **3** | Inventory ledger + balances + lots | Motor + FEFO + holds al abrir ola. SQL no aplicado | Aplicar SQL |
| **4** | Orders + allocation + reservations | Pedidos + holds de palet. `order-state.ts` no sustituye status ES | Cablear transiciones |
| **5** | Receiving + ASN + putaway | ASN + QC + **ranking putaway/slotting** (oleadas 5–6) | — |
| **6** | Waves + picking + replenishment | Olas + pick + **MIN/MAX** (oleada 7). Pick face vacío se mantiene | — |
| **7** | Packing + SSCC + shipping | Packing/SSCC oleada 8. **Shipments + mock (oleada 9)** | — |
| **8** | Dock + yard + carriers | **Calendario muelle (oleada 10)**. Yard no | Yard vacío de semilla |
| **9** | Returns + quality + cycle counting | Cycle-count con sesiones. QC ASN + cuarentena bloquea pick | Returns |
| **10** | RF mobile + offline sync | RF + cola `cn-wms-offline-q-v1`. Sync al volver; conflicto si el apply rechaza | No inventar un segundo snapshot |
| **11** | Audit + observability + hardening | `audit_logs` en snapshot + SQL no aplicado | Ledger + `operationId` servidor |
| **12** | Control tower | ¿Qué pasa? / ¿Qué hago? sobre el snapshot | No inventar «38 líneas» si la ola tiene 8 |
| **13** | AI operational copilot | `askWmsCopilot` sobre snapshot. Confirmación obligatoria | Nunca escribe al hueco sola |
| **14** | Performance + QA + prod ready | Demo/prod en `runtime.ts`. Tests críticos | Ledger + `VITE_RUNTIME_MODE=production` |

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
