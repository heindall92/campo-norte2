# Arquitectura — Campo Norte WMS

Decisiones. El inventario crudo está en [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md).
El destino de carpetas está en [`TARGET_ARCHITECTURE.md`](./TARGET_ARCHITECTURE.md).

**Estado:** Phase 0 (documentado). Motor de planta en fases 1–20. Sin ledger WMS en Postgres.

---

## Decisiones (ADR cortos)

### ADR-001 · Dos silos, no un mega-hub

WMS y CRM no comparten snapshot. Tesorería del Hub no alimenta el P&L 3PL.
**Por qué:** mezclar cobros de viaje con stock inventa dinero.
**Consecuencia:** dos persistencias hasta que el WMS tenga ledger propio.

### ADR-002 · Dominio puro `snap → { ok, snap }`

Las reglas viven en `src/lib/wms/*.ts`. La UI no calcula stock.
**Por qué:** tests sin DOM; la pistola y el pasillo reutilizan la misma función.
**Consecuencia:** el ledger futuro envuelve este contrato; no se tira el motor.

### ADR-003 · Un tenant real

`org-camponorte`. El schema llevará `org_id`. No se fabrica una segunda empresa.
**Por qué:** no hay dato de un segundo cliente.
**Consecuencia:** multi-tenant es aislamiento + RLS, no un switcher de marcas.

### ADR-004 · Semilla explícita

`seededFromDemo: true`. Reloj de demo `2026-08-15T11:00:00Z` en alertas.
**Por qué:** no fingir producción.
**Consecuencia:** login demo fuerza Hub local (`forceLocalHub`).

### ADR-005 · No inventar identificadores logísticos

SSCC, tracking, telemetría de flota, lecturas ZKTeco, carta de porte: solo si se escriben o hay contrato/prefijo real.
**Por qué:** un SSCC bonito es un dato falso.
**Consecuencia:** el generador GS1 espera GCP; hasta entonces se escribe.

### ADR-006 · Twin en A/B/C

La guía verbal 8–37 es relato de planta. El layout digital no se renumera hasta confirmación.
**Por qué:** cambiar el código de hueco rompe tickets y tests.

### ADR-007 · Ledger antes que 50 tablas

Primero `wms_ledgers.payload` + `revision`. Luego extraer tablas por módulo.
**Por qué:** un big-bang relacional obliga a reescribir `confirmPick` el mismo día.

### ADR-008 · Confirmación humana en slotting

Una recomendación no mueve palets.
**Por qué:** integridad > automatismo.

### ADR-009 · Prioridad de calidad

Correctness > integridad > seguridad > operabilidad > mantenibilidad > rendimiento > UX > polish.

---

## Vista actual

```
UI (MpsCrmApp + components/wms)
  → useWmsLive() por panel   ← deuda: copias distintas
  → funciones de dominio
  → localStorage cn-wms-hub-v8

UI CRM
  → DataHubProvider único
  → LocalDataStore | Supabase mps_*
```

No hay `src/modules/` todavía. No se crean carpetas vacías en Phase 0.

---

## Índice de docs de producto

| Doc | Tema |
|---|---|
| [DATABASE.md](./DATABASE.md) | Persistencia y migraciones |
| [INVENTORY.md](./INVENTORY.md) | Stock, lotes, balances |
| [ORDER_FLOW.md](./ORDER_FLOW.md) | Pedido → ola → pick → pack → ship |
| [RECEIVING.md](./RECEIVING.md) | ASN → muelle → putaway |
| [PICKING.md](./PICKING.md) | Pasillo, voz, RF |
| [SHIPPING.md](./SHIPPING.md) | Muelle, manifiesto, carriers |
| [SECURITY.md](./SECURITY.md) | Auth, RLS, CSP (CRM hecho; WMS pendiente de ledger) |
| [API.md](./API.md) | Endpoints actuales (ninguno WMS) |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel + Supabase |
| [TESTING.md](./TESTING.md) | Vitest, gates por fase |
| [ROADMAP.md](./ROADMAP.md) | Phases 0–14 del brief vs oleadas |
| [UOM.md](./UOM.md) | Conversiones y unidad base |
| [LOTS.md](./LOTS.md) | FIFO / FEFO / LIFO / MANUAL |
| [BARCODE.md](./BARCODE.md) | Parser GS1 desacoplado |
| [AUDIT.md](./AUDIT.md) | `audit_logs` append-only |
