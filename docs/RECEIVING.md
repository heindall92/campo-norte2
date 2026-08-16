# Recepción — Campo Norte WMS

## Qué hay

`InboundAsn`: código, proveedor (texto), ETA, muelle, status `previsto|en_muelle|descargando|ubicando|cerrado`, `lines` (número declarado) y `palletsExpected` / `palletsDone`.

`asnLines` / `asnIncidents` en el snapshot (oleada 5). Semilla **vacía**: no se inventan SKU ni qty a partir del número. Se añaden líneas escritas (`skuId`, `expectedQty`, `expectedLot`).

`receiveAsnPallet` (pistola) crea un palet en muelle con SKU/qty/lote **escritos**, QC `APPROVED`. `receiveAgainstLine` recibe contra una línea: el palet queda `PENDING` hasta QC. `putawayReceivedPallet` lo ubica **solo** si QC está `APPROVED`. El ASN se cierra cuando no queda palet suyo en muelle.

`suggestPutawaySlot` es el primer hueco del **ranking** (oleada 6): zona/temperatura, capacidad (`capacityPallets` ≥ 1), familia (misma categoría en el pasillo), incompatibles **solo con reglas escritas**, FEFO si hay caducidad, viaje entre pasillos A/B/C (**% heurístico, no metros**). `openSlottingRecommendation` escribe `from → to` y no mueve. Hay que confirmar (`acceptSlottingRecommendation` / Ubicar). Semilla de reglas vacía.

Parcial, exceso, faltante, dañado, lote incorrecto → `AsnIncident` con **qty real**. QC `PENDING|APPROVED|REJECTED|QUARANTINED`. Palet en cuarentena / QC no aprobado **no pica** (`confirmPick` → `pallet_quarantined`).

---

## Decisiones

1. Un ASN sin líneas reales no es recepción enterprise. Phase 5 del brief añade líneas e incidencias **sin** borrar el flujo de pistola.
2. Diferencia (parcial, exceso, faltante, dañado, lote incorrecto) → incidencia. No se «ajusta en silencio».
3. Putaway recomendado ≠ putaway ejecutado. QC pendiente ≠ putaway.
4. Proveedores: los que ya figuran en la semilla / los que se escriban. No un master de 50 suppliers inventados.

---

## Flujo

`ASN → ARRIVAL → DOCK → RECEIVING → QC → PUTAWAY → AVAILABLE`

Cuarentena: el palet **no** entra en la cola RF de pick ni en `confirmPick`.
