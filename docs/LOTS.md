# Lotes y FEFO

Motor: `src/lib/wms/lots.ts`. Cableado a `openWaveFromOrder` (`waves.ts`).

## Hoy

El palet ya tiene `lot` + `expiry`. La torre avisa caducidad 7 días (`alerts.ts`). Reloj de planta: `WMS_DEMO_NOW` (`2026-08-15T11:00:00.000Z`), no `Date.now()`.

Al abrir una ola:

- Fuera: `classifyLotAlert` EXPIRED o BLOCKED (cuarentena / expedido), `availableQty < 1`.
- Orden: FEFO (menor `expiry`; sin fecha al final) y empate FIFO por `receivedAt`.
- **No** se llama a `reserveStock` al abrir (los holds son oleada 3).

## Políticas

`FIFO | FEFO | LIFO | MANUAL`

- FEFO: menor `expiry` entre lotes no bloqueados y no caducados. Sin fecha, al final.
- MANUAL: hay que pasar el id. Si no, no elige.
- Alertas: `EXPIRING_SOON | EXPIRED | BLOCKED` (`classifyLotAlert`).
