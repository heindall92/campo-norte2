# Pedidos y allocation

Estados: `pendiente → picking → embalaje|muelle → expedido`. No se salta a expedido.

- Líneas: `orderLines` (`qtyOrdered / allocated / picked / shipped`).
- Allocation FEFO: `allocateOrder` reserva HU reales; no puede superar `available`.
- `openWaveFromOrder` consume reservas si existen; si no, palets de pick-face (comportamiento histórico).
- Tracking: `ManualCarrierAdapter` — el número lo escribe el usuario; no se fabrica.
- SQL: `20260819120000_create_orders_fulfillment.sql`.
