# QA WMS (Phase 14)

Dual mode: DEMO = snapshot `cn-wms-hub-v8` + ledger hidratado. PRODUCTION = `VITE_WMS_MODE=production` + Supabase (tablas `wms_*`; RPCs de stock aún pendientes de cablear al adapter).

Checklist:

- [x] `npm test` dominio (ledger, FEFO, allocation, ASN, SSCC, dock, cuarentena, outbox, audit, copilot, ≥50 SKU)
- [x] typecheck + lint + build
- [ ] Recorrido humano: recepción → putaway → ola → pick SHORT → pack SSCC → muelle → expedir con tracking manual
- [ ] Org B no ve ledger de org A (RLS SQL; en demo `scopeSnapshotToOrg` / `auditForOrg`)
