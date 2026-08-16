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

**Qué:** `WmsLiveProvider` en `main.tsx`. `useWmsLive` lee contexto. `WmsSites` deja el LS a mano.

**Qué no:** Postgres, reservas, nuevas pantallas, mover carpetas.

**DoD:** dos paneles ven el mismo stock tras un pick; tests de dominio intactos; 184+ verdes.

**Riesgo si se salta:** cualquier ledger remoto se pisa entre pistola y torre.

---

### Oleada 2 — Ledger Postgres + RLS

**Qué:** `supabase/wms-schema.sql` (orgs, members, sites, ledgers, movements extract, audit). Hidratar/push con `revision`. Demo (`forceLocalHub`) sigue en LS. Torre muestra `local | Postgres · revisión N`.

**Qué no:** 30 tablas relacionales. Segunda org. Mezclar tesorería.

**DoD:** con Supabase real y usuario de equipo, el snapshot sobrevive un F5; conflicto de revisión recarga remoto; sin backend la demo no se rompe; RLS no deja leer otro `org_id` (aunque no exista fila).

---

### Oleada 3 — Reservas de stock

**Qué:** `StockReservation` hold al abrir ola, consume al picar, release al omitir/faltante. `available = qty − held`. `suggest`/nuevas olas respetan available. Merma recorta holds si el físico baja.

**Qué no:** ATP de ERP, promesas a cliente, segunda unidad de medida.

**DoD:** tests de hold/consume/release; no se puede picar por encima de available; semilla vieja se rellena al normalizar **sin inventar qty**.

---

### Oleada 4 — Inventory counts de verdad (brief 27, recorte)

**Qué:** sesiones + líneas sobre el cycle-count actual. Diferencia → movement `ajuste` + (si hay ledger) fila audit. Tipos: cíclico / ABC / hueco / SKU / lote. Full count solo si lo piden (es caro en UI).

**Qué no:** borrar `planCycleCounts`.

**DoD:** un desvío queda en movements con operatorId; tests.

---

### Oleada 5 — Receiving + QC mínimo (brief 16–17)

**Qué:** `asn_lines` en el snapshot (y tabla cuando el módulo duela). Recepción parcial, exceso, faltante, dañado, lote incorrecto → incidencia. QC `PENDING|APPROVED|REJECTED|QUARANTINED`. Palet en cuarentena **no pica**.

**Qué no:** suppliers inventados. Flujo de oficina no descrito.

**DoD:** no se puede `confirmPick` un palet `cuarentena`; incidencia tiene qty real; tests.

---

### Oleada 6 — Putaway rules + slotting (brief 18–19)

**Qué:** ranking: zona/temperatura (ya hay), capacidad del hueco, familia SKU, no mezclar incompatibles **solo con reglas escritas**, FIFO/FEFO si hay caducidad, distancia de pasillo (heurística A/B/C, no GPS). Slotting: recomendación `from → to` + % de viaje estimado + reason. **Confirmación obligatoria.**

**Qué no:** mover solo. Inventar distancias en metros si no hay layout métrico.

**DoD:** test de ranking; test de «recomendación no aplica putaway».

---

### Oleada 7 — Replenishment MIN/MAX (brief 15)

**Qué:** `replenish = max(0, maxStock − current)` si `current < minStock`. Tipos `PLANNED|URGENT|AUTO`. Seguir ofreciendo la reposición por pick face vacío (ya existe). Ola puede provocar reposición.

**Qué no:** AUTO que mueva sin operario.

**DoD:** SKU con min 30 max 100 current 22 → propuesta 78; tests.

---

### Oleada 8 — Packing + SSCC (brief 20–21)

**Qué:** estaciones (las que se escriban), packages / lines, peso y dims **escritos**. Asociar a order. SSCC: registro único; generar **solo** con prefijo configurado; si no hay prefijo, seguir escribiendo. Etiqueta logística print (como las de lado del súper).

**Qué no:** GS1 de fantasía.

**DoD:** dos packages no comparten SSCC; print no fabrica tracking.

---

### Oleada 9 — Shipping + CarrierAdapter (brief 22–23)

**Qué:** `shipments` con timestamps `PACKED→STAGED→LOADED→SHIPPED` (el stage/ship actual se mapea). `MockCarrierAdapter` (`createShipment`, `getLabel`, `trackShipment`, `cancelShipment`) **etiquetado mock**. Tracking real solo si el mock o el usuario lo escribe.

**Qué no:** SEUR/DHL de verdad en el primer commit.

**DoD:** el dominio no importa `seur`. Tests del mock. Pedido expedido sin tracking sigue siendo válido (regla actual).

---

### Oleada 10 — Dock calendar (brief 24)

**Qué:** `docks` por site (hoy `M-05` es texto). Appointments + events: llegada, check-in, asignación, carga, descarga, salida. Vista calendario (día de cut-off ya existe como itinerario).

**Qué no:** yard todavía.

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
