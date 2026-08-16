# Recepción — Campo Norte WMS

## Qué hay

`InboundAsn`: código, proveedor (texto), ETA, muelle, status `previsto|en_muelle|descargando|ubicando|cerrado`, `lines` y `palletsExpected` como **números**, `palletsDone`.

`receiveAsnPallet` crea un palet en muelle con SKU/qty/lote **escritos**. `putawayReceivedPallet` lo ubica. El ASN se cierra cuando no queda palet suyo en muelle.

`suggestPutawaySlot`: zona de la categoría del SKU, hueco libre, reserva antes que pick face, luego orden de código. Sin capacidad, familia, distancia ni incompatibles.

No hay `asn_lines`, receipts, incidencias de exceso/faltante/dañado, ni QC.

---

## Decisiones

1. Un ASN sin líneas reales no es recepción enterprise. Phase 5 del brief añade líneas e incidencias **sin** borrar el flujo de pistola.
2. Diferencia (parcial, exceso, faltante, dañado, lote incorrecto) → incidencia. No se «ajusta en silencio».
3. Putaway recomendado ≠ putaway ejecutado.
4. Proveedores: los que ya figuran en la semilla / los que se escriban. No un master de 50 suppliers inventados.

---

## Flujo objetivo (no implementado)

`ASN → ARRIVAL → DOCK → RECEIVING → QC → PUTAWAY → AVAILABLE`

Cuarentena: el palet **no** entra en `nextOpenLine` / `confirmPick`.
