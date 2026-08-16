# Flujo de pedido — Campo Norte WMS

```
OutboundOrder (pendiente)
  → openWaveFromOrder          palets reales, FEFO, hold ALLOCATE
  → PickWave (abierta / en_curso)
  → confirmPick | skip | shortage
  → packPickLine / LoadUnit    fleje + etiqueta escrita
  → openPackPackage            SSCC único; generar solo con prefijo
  → stageOrderToDock           shipment STAGED
  → shipOutboundOrder          shipment SHIPPED; tracking null si no se escribe
```

Estados del pedido en planta: `pendiente | picking | embalaje | muelle | expedido`.

Máquina del brief (`CREATED → … → SHIPPED | CANCELLED`): `src/lib/wms/order-state.ts`.
Transición inválida → error. Cada éxito devuelve un registro `{ from, to, event, at }`.
**No sustituye** el status español en la UI. Mapa: `pendiente=CREATED`, `picking=PICKING`, `embalaje=PACKING`, `muelle=STAGED`, `expedido=SHIPPED`. No se inventa `ALLOCATED` en la semilla.

No hay entidad `Shipment` aparte. La ola coge palets libres de cara de picking, no caducados ni en cuarentena, ordenados FEFO, con hold de palet al abrir. Sin ATP de ERP. `mps_reservations` son viajes.

El súper lo asigna el patrón al **código de operario** (`OP-1903` = Jorge Peña), no al número del aparato. Ticket: súper + pasillo + hueco + cantidad.

---

## Decisiones

1. Un pedido no se expede si la ola sigue abierta o no hay nada picado (`outbound.ts`).
2. El tracking lo escribe alguien o un adapter **etiquetado mock**. Nunca un UUID «de transportista».
3. Phase 4 del brief (Orders + Allocation + Reservations) se apoya en este flujo; no se sustituye por otro modelo de pedido de e-commerce.
4. `createOutboundOrder` exige cliente, cut-off y muelle **escritos**.

---

## Mapa al brief

| Phase brief | Pieza |
|---|---|
| 4 | Pedidos + holds al abrir ola (hecho). Status ES no sustituido. |
| 6 | Olas + picking (hecho) + replenishment MIN/MAX (**oleada 7**) |
| 7 | Packing/SSCC (oleada 8) + shipping/mock (oleada 9) |
