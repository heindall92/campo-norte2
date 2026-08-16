# Unidades de medida

Motor: `src/lib/wms/uom.ts`. **No está cableado** a picking ni a la semilla.

## Hoy en planta

`Sku.uom` = `ud | caja | kg | palet`. `unitsPerPallet` es el único factor escrito (1 palet = N cajas/ud).

## Canónico

`UNIT | BOX | CASE | PALLET | KG | L`

Conversiones en tabla `UomFactor` (por SKU o globales). Inventario en **unidad base** vía `toBase`.

Ejemplo del brief (solo si se configura; no se aplica al aceite):

```
1 CASE = 12 UNIT
1 PALLET = 48 CASE
```

Sin factor → `no_factor`. No se adivina un inner pack.

Phase 2 del brief: persistir la tabla. Phase 0/este commit: motor + tests.
