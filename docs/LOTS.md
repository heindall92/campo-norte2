# Lotes y FEFO

Motor: `src/lib/wms/lots.ts`. **No cambia** `openWaveFromOrder` todavía.

## Hoy

El palet ya tiene `lot` + `expiry`. La torre avisa caducidad 7 días (`alerts.ts`). No hay `manufacture_date` ni política al abrir ola.

## Políticas

`FIFO | FEFO | LIFO | MANUAL`

- FEFO: menor `expiry` entre lotes no bloqueados y no caducados. Sin fecha, al final.
- MANUAL: hay que pasar el id. Si no, no elige.
- Alertas: `EXPIRING_SOON | EXPIRED | BLOCKED` (`classifyLotAlert`).

Phase 3: usarlo al asignar stock. Este commit: motor + tests.
