# Flujo de pedido — Campo Norte WMS

```
OutboundOrder (pendiente)
  → openWaveFromOrder          palets reales en pick face
  → PickWave (abierta / en_curso)
  → confirmPick | skip | shortage
  → packPickLine / LoadUnit    fleje + etiqueta escrita
  → stageOrderToDock
  → shipOutboundOrder          tracking null si no se escribe
```

Estados del pedido: `pendiente | picking | embalaje | muelle | expedido`.

No hay entidad `Shipment` aparte. No hay allocation ATP: la ola coge palets libres que no estén en otra ola abierta.

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
| 4 | Pedidos + holds (aún no) |
| 6 | Olas + picking (hecho en memoria) + replenishment MIN/MAX (no) |
| 7 | Packing/SSCC/shipping (parcial: load unit + ship) |
