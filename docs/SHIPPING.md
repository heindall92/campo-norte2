# Expedición — Campo Norte WMS

## Qué hay

- Pedido con `dock`, `cutOff`, `carrierId`, `tracking` (manual).
- Ventana de muelle = cut-off − 90 min (`dockWindowFor`).
- Embalaje: `qtyPacked` ≤ `qtyPicked`; SSCC de caja solo si se teclea y no está tomado.
- `LoadUnit`: palet / caja / carro → flejada → etiquetada → `en_muelle`.
- Packing (oleada 8): estaciones y bultos escritos. SSCC único. Generar solo con `org.ssccPrefix`.
- Manifiesto y etiqueta de packing HTML imprimibles. No fabrican tracking.
- `stageOrderToDock` / `shipOutboundOrder`.
- Carriers en catálogo (SEUR, DHL Freight, Carreras, XPO) como **datos**, no como API.

No hay `CarrierAdapter` real (SEUR/DHL). Hay `MockCarrierAdapter` etiquetado MOCK. Dock calendar y yard aún no.

---

## Decisiones

1. `CarrierAdapter` (createShipment, getLabel, trackShipment, cancelShipment) con **MockCarrierAdapter** primero. El dominio no importa un transportista concreto.
2. El mock debe etiquetarse como mock en UI y en eventos. Un evento `SHIPPED` del mock no es tracking de SEUR.
3. Dock calendar y yard (Phase 8 del brief) no reutilizan `fleet[]` (carretillas).
4. Dos palets → 4 etiquetas de lado (fase 20). Eso no es SSCC GS1.
5. El generador de packing (`generatePackSscc`) usa el prefijo escrito + serial interno. Sin GCP no se fabrica un SSCC de 18 dígitos.

---

## Flujo objetivo de shipment

`PACKED → STAGED → LOADED → SHIPPED` con timestamps. El `stage`/`ship` actual es el embrión.
