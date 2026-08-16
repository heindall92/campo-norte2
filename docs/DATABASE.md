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

No hay carpeta de migrations WMS aplicada. Convención (cuando se abra Phase 1/2 de datos):

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
wms_orgs
wms_org_members
wms_sites
wms_ledgers     -- org_id, revision, payload jsonb
wms_movements   -- extract append-only
wms_reservations
wms_audit
```

Un tenant sembrado: `org-camponorte`. RLS: miembro de org **o** `mps_is_team()` en la transición.

Lock: `update wms_ledgers set revision = revision+1 … where revision = $esperada`.

---

## Después (por módulo, no de golpe)

Inventory balances, ASN lines, QC, packages, shipments, docks, yard, returns: ver `DATABASE_PLAN.md` oleada B. No crear tablas vacías en Phase 0.
