# RF y offline

Cola derivada del snapshot (`buildRfQueue`). Confirmación: hueco + SSCC + qty/destino reales.

- Offline: `enqueueRfCommand` + `idempotency_key`. Duplicado = no-op.
- Flush: si el servidor responde `task_stale`, **gana el servidor**; el item queda `conflict`.
- SQL: `wms_rf_commands` en `20260820120000_create_dock_returns_audit.sql`.
