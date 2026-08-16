# Productividad — Campo Norte WMS

Métricas de ritmo, no de vigilancia.

| Métrica | Fuente |
|---|---|
| lines/hour | líneas `picada` / `hoursToday` |
| units/hour | `qtyPicked` / horas |
| orders/hour | pedidos distintos picados / horas |
| pick accuracy | picada / (picada + omitida + faltante) |
| travel distance | estimada pasillo×20 m + bahía×3 m + nivel×1,4 m |
| task time | horas / líneas × 60 |

Cortes: picker, packer (`expedicion`), carretillero, turno, zona, almacén.

El rollup usa **código de operario**. Nombre, PIN y huella están en `listOperatorPii` y no se pintan en esta tabla.

Si no hay horas, la tasa es `null` (no se inventa).
