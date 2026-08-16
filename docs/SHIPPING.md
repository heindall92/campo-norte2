# Expedición — Campo Norte WMS

## Qué hay

- Pedido con `dock`, `cutOff`, `carrierId`, `tracking` (manual).
- Ventana de muelle = cut-off − 90 min (`dockWindowFor`).
- Embalaje: `qtyPacked` ≤ `qtyPicked`; SSCC de caja solo si se teclea.
- `LoadUnit`: palet / caja / carro → flejada → etiquetada → `en_muelle`.
- Manifiesto HTML imprimible. No fabrica tracking.
- `stageOrderToDock` / `shipOutboundOrder`.
- Carriers en catálogo (SEUR, DHL Freight, Carreras, XPO) como **datos**, no como API.

No hay `shipments`, `tracking_events`, `CarrierAdapter`, calendario de muelle ni yard.

---

## Decisiones

1. `CarrierAdapter` (createShipment, getLabel, trackShipment, cancelShipment) con **MockCarrierAdapter** primero. El dominio no importa un transportista concreto.
2. El mock debe etiquetarse como mock en UI y en eventos. Un evento `SHIPPED` del mock no es tracking de SEUR.
3. Dock calendar y yard (Phase 8 del brief) no reutilizan `fleet[]` (carretillas).
4. Dos palets → 4 etiquetas de lado (fase 20). Eso no es SSCC GS1.

---

## Flujo objetivo de shipment

`PACKED → STAGED → LOADED → SHIPPED` con timestamps. El `stage`/`ship` actual es el embrión.
