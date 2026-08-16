# Inventario — ledger y balances

Fuente de verdad **física** en DEMO: palets del snapshot. El ledger (`InventoryTx`) es el registro canónico; `available = on_hand − allocated − blocked − quarantined`.

- Tipos: `RECEIPT PUTAWAY MOVE ALLOCATE DEALLOCATE PICK REPLENISH PACK STAGE LOAD SHIP RETURN ADJUSTMENT COUNT QUARANTINE RELEASE`.
- FEFO: `selectFefo` (caducidad ASC, luego `receivedAt`). Cuarentena y hueco bloqueado no son available.
- Negativos: prohibidos salvo flag de warehouse en SQL (`allow_negative_stock`). DEMO nunca permite.
- Conteo: `COUNT` (qty absoluta) + `ADJUSTMENT` (delta). La reconstrucción `onHandFromLedger` ignora el ADJUSTMENT inmediato tras COUNT.
- Postgres: `supabase/migrations/20260818120000_create_inventory_core.sql`. Ledger append-only (sin policy UPDATE/DELETE).
