# Motor de alertas — Campo Norte WMS

`buildOpsAlerts` deriva del snapshot. No hay telemetría de flota ni tracking inventado.

Tipos: LOW_STOCK, STOCKOUT, EXPIRING, EXPIRED, PICKING_DELAY, SHIPMENT_DELAY, DOCK_DELAY, WAVE_AT_RISK, REPLENISHMENT_REQUIRED, QUALITY_INCIDENT, CARRIER_DELAY.

Cada fila: `severity`, `status`, `created_at`, `resolved_at`, `entity`, `recommended_action`.

`resolved_at` solo si el hueco ya está cuadrado (`slotFixes.fixedAt`). El resto nace `open`.

El motor legado `computeWmsAlerts` (batería, pick face…) se conserva para tests y semántica de planta.
