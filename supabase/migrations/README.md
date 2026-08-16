# Migrations

Convención (brief 44). **Esta carpeta no altera producción.**

```
YYYYMMDDHHMMSS_description.sql
```

Ejemplo: `20260816120000_create_wms_ledger.sql`

- Idempotentes cuando sea razonable (`if not exists`, `create or replace`).
- No editar a mano el proyecto Supabase de prod.
- El CRM histórico sigue documentado en `../schema.sql`.
- Primera pieza WMS: `20260816033000_create_wms_audit_logs.sql` (no aplicada).
- El resto del ledger sigue sin escribirse hasta Phase 1.
