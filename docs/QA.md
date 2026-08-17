# QA WMS (Phase 14)

Dual mode: DEMO = snapshot local + ledger hidratado. PRODUCTION = `VITE_WMS_MODE=production` + Supabase. Stock: `wms_commit_stock` (HU + ledger). Pedidos/ASN/olas/huecos: `wms_save_fulfillment` / `wms_load_fulfillment`. Floor (flota/operarios): `wms_save_floor`.

Checklist:

- [x] `npm test` dominio (ledger, FEFO, allocation, ASN, SSCC, dock, cuarentena, outbox, audit, copilot, ≥50 SKU)
- [x] typecheck + lint + build
- [ ] Recorrido humano: recepción → putaway → ola → pick SHORT → pack SSCC → muelle → expedir con tracking manual
- [ ] Org B no ve ledger de org A (RLS SQL; en demo `scopeSnapshotToOrg` / `auditForOrg`)
