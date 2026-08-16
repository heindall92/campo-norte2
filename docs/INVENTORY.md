# Inventario — Campo Norte WMS

## Qué hay (fase 20)

Unidad de stock = **palet** con `sscc`, `skuId`, `qty`, `lot`, `expiry`, `slotId`, `status`.

`Sku` ya trae `uom` (`ud|caja|kg|palet`), `unitsPerPallet`, `minStock`, `maxStock`, `abc`. **min/max no disparan reposición.**

No hay libro mayor. El «balance» es la suma de `pallets.qty` del SKU. Los `movements[]` son una bitácora en el mismo JSON; **no hay test que exija** `stock = entradas − salidas − ajustes`.

`SlotStatus` incluye `reservado` y `PalletStatus` incluye `cuarentena` **sin motor**. Dos olas evitan el mismo palet con un `Set` de ids en olas abiertas, no con ATP.

Merma (`declareMerma`) baja `qty`. Cycle-count (`confirmCycleCount`) pisa `qty` y firma `lastCountedAt`. Slot-fix bloquea el hueco hasta que el jefe escribe la cuenta.

---

## Decisiones

1. El ledger de inventario (Phase 3 del brief) **no se finge** con más arrays en LS. O hay transacción (movement + balance) o se documenta como demo.
2. `available = on_hand − held − quarantined`. Hoy `available` no existe.
3. Un lote es el `lot` del palet. No se inventan lotes extra en la semilla para «llenar» el brief.
4. Ajuste solo con motivo (conteo, merma, slot-fix). Sin qty negativa.

---

## Semilla coherente (brief 39) — reglas, no implementación

Hoy: **8 SKU** (aceite, arroz, leche, jamón, helado, agua, detergente, yogur), 2 hubs, palets generados por ocupación de huecos.

Antes de subir a 50+ SKU:

- Test de coherencia: para cada `skuId`, `sum(pallet.qty)` cuadra con la semilla de movimientos **o** se declara `seededFromDemo` y se regeneran movements desde el stock (una de las dos; no las dos incoherentes).
- Familias ya existentes (`alimentacion_seca`, `frescos`, `congelados`, `bebidas`, `no_food`). Variantes de lo que ya hay (formatos de aceite/arroz/leche/agua).
- **Prohibido** inventar cerveza, vino, especias, papel (regla de planta).
- Un org, dos warehouses (Sevilla + Huelva). Sin tercer hub.
- Suppliers / customers: los nombres que ya están en ASN y outbound (Aceites del Sur, tiendas CN…). No fabricar 40 razones sociales.
- Incidencias: solo las que el dominio ya modela (merma, slot-fix, faltante de línea). No un catálogo de tickets inventados.

---

## Hueco vs brief Phase 3

| Brief | Hoy | Siguiente oleada de datos |
|---|---|---|
| Inventory ledger | `movements[]` en JSON | extract `wms_movements` + balances |
| Balances | suma de palets | tabla o proyección versionada |
| Lots | campo en palet | igual, con unicidad (org, sku, lot) cuando haya tabla |
| Reservations | no | hold/consume/release (oleada 3 del plan interno) |
