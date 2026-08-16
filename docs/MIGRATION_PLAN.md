# Plan de migración incremental — Campo Norte WMS

> Phase 0. **Parar aquí.** No implementar hasta revisión humana.
> Commits pequeños. No borrar historial. No force-push destructivo.

---

## 0 · Estado de partida

- Tip: fase 20 (`c706aa6`). Motor de planta usable en demo local.
- `main` de producción (al auditar) iba por fase 13; esta rama acumula 14–20.
- Un intento de persistencia/reservas se revirtió al abrir Phase 0.
- Prioridad: **correctness / integridad / seguridad**, no volumen de código.

---

## 1 · Reglas de git

Mensajes:

```
feat(wms): …
feat(inventory): …
feat(picking): …
feat(shipping): …
fix(inventory): …
refactor(architecture): …
docs(wms): …
```

- Una oleada = una rama o una serie de commits **separables** en la misma rama.
- No un commit «enterprise WMS completo».
- No reescribir historia de fases 1–20.
- Tests + lint + build en cada oleada que toque código.
- Actualizar `docs/ESTADO.md` y `docs/WMS-ROADMAP.md` en el mismo commit de la oleada.

---

## 2 · Oleadas

### Oleada 0 — Auditoría (esta)

**Hecho.** Entregables:

- `docs/ARCHITECTURE_AUDIT.md`
- `docs/TARGET_ARCHITECTURE.md`
- `docs/DATABASE_PLAN.md`
- `docs/MIGRATION_PLAN.md` (este archivo)

**DoD docs (ampliado 2026-08-16):** índice de producto en `docs/ARCHITECTURE.md` y satélites (`DATABASE`, `INVENTORY`, `ORDER_FLOW`, `RECEIVING`, `PICKING`, `SHIPPING`, `API`, `DEPLOYMENT`, `TESTING`, `ROADMAP`). Brief 39–44 (semilla coherente, observabilidad, migrations `YYYYMMDDHHMMSS_`, phases 0–14, gate typecheck/lint/test/build) queda **documentado**, no implementado.

**DoD código:** el dueño ha leído y ha dicho qué oleada / phase brief abrir. Sin eso, no se pica dominio nuevo.

---

### Oleada 1 — Una sola verdad en el cliente

**Hecho (2026-08-16).** `WmsLiveProvider` en `main.tsx` (dentro de `AuthProvider`). `useWmsLive` lee contexto. `WmsSites` y el flush RF usan el snap vivo.

**Qué no:** Postgres (eso es oleada 2), reservas, nuevas pantallas, mover carpetas.

**DoD:** dos paneles ven el mismo stock tras un pick; tests de dominio intactos; 243 verdes.

**Riesgo si se salta:** cualquier ledger remoto se pisa entre pistola y torre.

---

### Oleada 2 — Ledger Postgres + RLS

**Código cableado (2026-08-16).** `persist.ts`: hidratar/push con `revision`. Demo (`forceLocalHub`) sigue en LS. Badge `local | Postgres · rev N`. SQL tenant/ledger **no aplicado** en prod: sin F5 real contra Postgres hasta la migration.

**Qué no:** 30 tablas relacionales. Segunda org. Mezclar tesorería. Subir la semilla demo automáticamente.

**DoD parcial:** sin backend la demo no se rompe; conflicto de revisión recarga remoto (cliente). RLS y supervivencia F5 exigen aplicar `20260816060000_create_wms_tenant_rbac.sql`.

---

### Oleada 3 — Reservas de stock

**Hecho (2026-08-16).** Hold al abrir ola, consume al picar, release al omitir/faltante. `available = qty − held`. Nuevas olas exigen available ≥ qty del palet. Merma recorta holds si el físico baja (antes del ADJUSTMENT).

**Qué no:** ATP de ERP, promesas a cliente, segunda unidad de medida. No se fabrican holds sobre las olas de semilla.

**DoD:** tests de hold/consume/release/merma; 246 verdes.

---

### Oleada 4 — Inventory counts de verdad (brief 27, recorte)

**Hecho (2026-08-16).** Sesiones + líneas sobre `planCycleCounts`. Tipos: cyclic / abc / slot / sku / lot. Diferencia → movement `ajuste` + audit. Full count solo si `full: true`.

**Qué no:** borrar `planCycleCounts`. Inventar un inventario completo de huecos vacíos.

**DoD:** desvío con `operatorId` en movements; 248 verdes.

---

### Oleada 5 — Receiving + QC mínimo (brief 16–17)

**Hecho (2026-08-16).** `asnLines` / `asnIncidents` en el snapshot. Recepción parcial, exceso, faltante, dañado, lote incorrecto → incidencia con qty real. QC `PENDING|APPROVED|REJECTED|QUARANTINED`. Palet en cuarentena **no pica**. Semilla sin líneas inventadas. La pistola (`receiveAsnPallet`) sigue.

**Qué no:** suppliers inventados. Flujo de oficina no descrito. SQL de `wms_asn_lines` no aplicado.

**DoD:** `confirmPick` rechaza palet `cuarentena`; incidencia tiene qty real; 253 verdes.

---

### Oleada 6 — Putaway rules + slotting (brief 18–19)

**Hecho (2026-08-16).** Ranking: zona, capacidad del hueco, familia SKU, incompatibles solo con `slottingRules` escritas, FEFO si hay caducidad, % de viaje por pasillos A/B/C (no metros). `openSlottingRecommendation` no mueve. Confirmar = `acceptSlottingRecommendation` o Ubicar.

**Qué no:** mover solo. Inventar distancias en metros. Inventar reglas aceite/droguería en semilla.

**DoD:** test de ranking; test de «recomendación no aplica putaway»; 257 verdes.

---

### Oleada 7 — Replenishment MIN/MAX (brief 15)

**Hecho (2026-08-16).** `replenish = max(0, maxStock − current)` si `current < minStock`. Tipos `PLANNED|URGENT|AUTO`. Pick face vacío se mantiene. Abrir ola encola AUTO si el proyectado baja del mínimo. **AUTO no mueve sin operario.**

**Qué no:** AUTO que mueva sin operario. Inventar palets de reserva.

**DoD:** SKU min 30 max 100 current 22 → 78; 261 verdes.

---

### Oleada 8 — Packing + SSCC (brief 20–21)

**Hecho (2026-08-16).** `packStations` / `packPackages` en el snapshot (semilla `[]`). Peso y dims escritos o null. SSCC único frente a palets, cajas de línea y bultos. `generatePackSscc` solo si `org.ssccPrefix` está escrito; si no, hay que teclear. Etiqueta de packing (`packPackageLabelHtml`) no copia tracking del pedido.

**Qué no:** GS1 de fantasía (no dígito de control, no 18 dígitos). No se borra `LoadUnit` ni `packPickLine`. SQL de tablas packing **no** aplicado.

**DoD:** dos packages no comparten SSCC; print no fabrica tracking.

---

### Oleada 9 — Shipping + CarrierAdapter (brief 22–23)

**Hecho (2026-08-16).** `shipments` con timestamps `PACKED→STAGED→LOADED→SHIPPED` (stage/ship actuales mapean). `LOADED` solo si se llama `markShipmentLoaded` — no se inventa. `MockCarrierAdapter` (`createShipment`, `getLabel`, `trackShipment`, `cancelShipment`) etiquetado MOCK. Tracking solo si el mock o el usuario lo escriben.

**Qué no:** SEUR/DHL de verdad. El dominio no importa `seur`.

**DoD:** tests del mock. Pedido expedido sin tracking sigue siendo válido.

---

### Oleada 10 — Dock calendar (brief 24)

**Hecho (2026-08-16).** `docks` por site (semilla `[]`; `order.dock` sigue siendo texto). Citas + eventos: llegada, check-in, asignación, carga, descarga, salida. Calendario del día de demo. Stage/ship anotan load/departure **solo si** ya hay cita; no inventan una.

**Qué no:** yard.

**DoD:** dos pedidos no se asignan al mismo muelle en la misma ventana **si** se configura capacidad 1; si no hay capacidad escrita, no inventarla.

---

### Oleada 11 — Yard (brief 25)

**Qué:** locations, visits, vehicles, drivers. Flujo `ARRIVAL→CHECK_IN→WAITING→DOCK_ASSIGNED→LOADING|UNLOADING→DEPARTED`.

**Qué no:** telemetría de camión. No reutilizar `fleet[]` (carretillas).

**DoD:** visita no avanza de estado sin evento; semilla **sin** camiones inventados (alta vacía o la que planta escriba).

---

### Oleada 12 — Returns (brief 26)

**Qué:** returns / lines / inspections. `REQUESTED→RECEIVED→INSPECTING→RESTOCK|QUARANTINE|SCRAP`.

**DoD:** RESTOCK crea movimiento de entrada; QUARANTINE bloquea pick; SCRAP es merma tipada. Sin pedido de devolución inventado en la semilla.

---

### Oleada 13 — Mover carpetas (`refactor(architecture)`)

**Qué:** extraer módulos ya estables a `src/modules/*` y `src/domain/*`. Partir `WmsPanels` / `AislePicking` si aún superan 700 líneas.

**Qué no:** mezclar con un cambio de reglas.

**DoD:** mismos tests, mismos flujos de planta, imports actualizados.

---

## 3 · Fuera de oleada (sigue bloqueado)

- Layout numérico 8–37 en el twin (hasta confirmación).
- SKU cerveza / vino / papel / especias (hasta que los escriban).
- ZKTeco real (hasta LAN + agente).
- Telemetría flota ISM / I_Site.
- Carta de porte (no descrita).
- Segunda empresa / switcher.
- Contabilidad, nómina, OCR (ver `FUERA-DE-NUCLEO.md`).

---

## 4 · Definition of Done (producto)

Una funcionalidad **no** está terminada porque «la pantalla funciona».

Está terminada cuando:

| Criterio | En este repo significa |
|---|---|
| UI | Flujo usable en escritorio y pistola/móvil donde aplique |
| Backend | Dominio puro + (oleada 2+) ledger o tabla |
| Persistencia | LS fallback; Postgres si no es demo |
| Permisos | Sección + RLS org cuando haya tabla |
| Errores | Unión tipada, mensaje en UI, sin tragar excepciones |
| Estados | Máquina explícita; no se salta |
| Auditoría | Movement y/o `wms_audit` |
| Tests | Vitest del dominio; no solo click visual |
| Responsive | Planta cabe en viewport estrecho |
| Docs | `ESTADO.md` + roadmap de la oleada |

---

## 5 · Orden si hay que recortar

Si solo se puede hacer una cosa después de revisar:

1. Oleada 1 (estado compartido) — bug real, bajo riesgo.
2. Oleada 2 + 3 (ledger + holds) — integridad.
3. Oleada 5 (cuarentena no picable) — correctness de stock.
4. El resto del brief, un módulo por PR.

---

## 6 · Espera

Phase 0 termina en este documento.

**No continuar automáticamente** con oleadas 1–13 hasta que el usuario elija cuáles abrir y en qué orden.
