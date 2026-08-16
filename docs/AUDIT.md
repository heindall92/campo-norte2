# Auditoría — Campo Norte WMS

Bitácora append-only. **Nunca se borran logs desde la UI.**

## Hoy (cliente)

Tabla lógica `audit_logs` en el snapshot (`WmsSnapshot.auditLogs`).

| Campo | Tipo |
|---|---|
| `actor_id` | operario o null |
| `organization_id` | `org-camponorte` |
| `warehouse_id` | site o null |
| `action` | p.ej. `rf_confirm`, `wave.assign_picker` |
| `entity` / `entity_id` | qué se tocó |
| `before_data` / `after_data` | JSON o null |
| `timestamp` | ISO |
| `reason` | texto |
| `device_id` | id local del aparato (`cn-wms-device-id`) |
| `correlation_id` | une RF / sync / torre |

Motor: `src/lib/wms/audit.ts` — `appendAuditLog`, `listAuditLogs`. **No existe `deleteAuditLog`.**

La torre muestra los últimos en solo lectura. La pistola RF escribe al confirmar (online) o al sincronizar (offline).

## Postgres (no aplicado)

`supabase/migrations/20260816033000_create_wms_audit_logs.sql`

RLS: select/insert si `mps_is_team()`. Sin policy de update/delete.

Hasta Phase 1 de ledger, la fuente sigue siendo `localStorage`. Esta migration no se ejecuta sola.

## Qué no es

- No es el access-log del CRM (`/api/auth/access-log`).
- No se inventan filas de semilla: la semilla nace `[]`.
