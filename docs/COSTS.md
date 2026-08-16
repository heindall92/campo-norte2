# Costes operativos — Campo Norte WMS

Unitarios: `cost/order`, `cost/line`, `cost/pallet`, `cost/pick`, `cost/ship`.

Estructura (no se mezcla con tesorería del Hub):

| Cubo | Fuente |
|---|---|
| labor | `hoursToday × costPerHour` de operarios activos |
| carrier | línea de coste `terceros` del mes (semilla: 54 300 € Sevilla) |
| handling | tarifa 3PL × palets inbound/outbound |
| storage | tarifa × huecos ocupados × 30 días |

Las tarifas (`WMS_TARIFF`) son demo 3PL, no facturas reales de transportista.
