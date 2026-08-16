# Base de datos — Campo Norte WMS

Detalle de tablas futuras: [`DATABASE_PLAN.md`](./DATABASE_PLAN.md).

---

## Hoy

| Almacén | Dónde | Forma |
|---|---|---|
| WMS | `localStorage` `cn-wms-hub-v8` | Un JSON `WmsSnapshot` |
| CRM | `mps_*` en Supabase **o** `mps-growth-os-hub-v1` | JSONB por fila |
| Auth | `auth.users` + `mps_profiles` | Rol `pending\|admin\|ops\|booking\|guide` |

`mps_reservations` = reservas de **viaje**. No usarla para holds de stock.

Migrations WMS (no aplicadas):

- `20260816033000_create_wms_audit_logs.sql` — `wms_audit_logs` append-only
- `20260816040000_wms_rls_tenant_warehouse.sql` — `wms_site_members`
- `20260816053000_create_wms_inventory_core.sql` — products, uoms, lots, serials, balances, reservations, transactions, adjustments, counts + `apply_wms_inventory_tx` (lock de `revision`)
- `20260816060000_create_wms_tenant_rbac.sql` — organizations, warehouses, zones, locations, users, roles, permissions, user_roles, ledgers + `save_wms_ledger`. UUID, FK, RLS. **No aplicado.**

Convención:

```
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

Ejemplo: `20260816120000_create_wms_ledger.sql`

Reglas:

- Nunca alterar producción a mano.
- Idempotente cuando sea razonable (`create table if not exists`, `create or replace function`, `drop policy if exists` + `create policy`).
- Un cambio de esquema = un archivo = un commit `feat(wms):` o `feat(inventory):`.
- El SQL de CRM vigente sigue en `supabase/schema.sql` (histórico + reproducible). Las **nuevas** piezas WMS nacen como migration, no editando producción.

---

## Decisión: ledger primero

```
wms_organizations
wms_warehouses / wms_warehouse_zones / wms_warehouse_locations
wms_users / wms_roles / wms_permissions / wms_user_roles
wms_ledgers     -- organization_id, revision, payload jsonb
wms_audit_logs / inventory_*   -- escritos, no aplicados
```

Un tenant sembrado: `org-camponorte` (código estable; PK UUID). RLS: `wms_has_permission` + `wms_is_org_member`. Transición: `mps_is_team()` / `mps_is_admin()`.

Lock: `save_wms_ledger(org_code, expected, payload)` → `UPDATE … WHERE revision = $esperada`.

Demo (`forceLocalHub` / `VITE_RUNTIME_MODE=demo`) **no** escribe Postgres. Sin service role en `VITE_*`. Sin passwords en SQL.

---

## Después (por módulo, no de golpe)

Inventory core (briefs 6–7) ya tiene SQL escrito, **no aplicado**. El dominio en cliente es la fuente hasta hidratar Postgres. ASN lines, QC, packages, shipments, docks, yard: ver `DATABASE_PLAN.md` oleada B.
