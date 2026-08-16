# Inventario — Campo Norte WMS

## Qué hay (briefs 6–7)

Unidad física de planta = **palet** (`sscc`, `skuId`, `qty`, `lot`, `expiry`, `slotId`, `status`).

Unidad de ATP / ledger = **balance** por `(org, sku, lote, ubicación)` + **transacción** append-only.

`applyInventoryTx` es la **única** API que cambia un número de stock. `projectBalances(txs)` reconstruye el estado. Si un flujo de planta muta `pallet.qty`, también escribe el tipo de transacción (PICK, ADJUSTMENT, COUNT, …).

### Entidades

| Entidad | Dónde | Nota |
|---|---|---|
| `products` / `product_uoms` | snapshot + SQL no aplicado | Proyección de los 8 SKU. Sin EAN inventado. |
| `lots` | snapshot | Un lote = `lot` del palet. Unicidad (org, sku, lot). |
| `serial_numbers` | vacío | No hay seriales reales en semilla. |
| `inventory_balances` | estado actual | `on_hand`, `allocated`, `available`, `picked`, `packed`, `staged`, `blocked`, `quarantined` |
| `inventory_transactions` | ledger | 16 tipos: RECEIPT … RELEASE |
| `inventory_reservations` | holds de ATP | Distinto de `reservations` (hold de palet) y de `mps_reservations` (viajes). |
| `inventory_adjustments` / `inventory_counts` | auditoría de merma/conteo | Apuntan al `txId` |
| `countSessions` / `countLines` | oleada 4 | Encima de `planCycleCounts`. Semilla vacía |
| `asnLines` / `asnIncidents` | oleada 5 | Líneas escritas. Semilla vacía. QC en el palet |
| `slottingRules` / `slottingRecommendations` | oleada 6 | Reglas escritas. Semilla vacía. Recomendación ≠ movimiento |

### Regla de available

```
available = on_hand - allocated - blocked - quarantined
```

Stock negativo **prohibido** salvo `org.allowNegativeInventory === true` (Campo Norte: `false`).

Race: `expectedRevision` en dominio; en SQL `UPDATE … WHERE revision = $esperada` dentro de `apply_wms_inventory_tx`. El SQL **no se aplica** solo.

Apertura de semilla: un RECEIPT por palet con qty > 0. Expedido = RECEIPT + SHIP. Cuarentena = QUARANTINE. Caducado a `WMS_DEMO_NOW` = ADJUSTMENT `blocked`. Snapshot viejo sin ledger: `hydrateInventoryIfMissing` abre desde los palets actuales.

`movements[]` sigue siendo la bitácora de planta (RF/UI). No sustituye al ledger.

`Sku` ya trae `uom`, `unitsPerPallet`, `minStock`, `maxStock`, `abc`. **min/max no disparan reposición.** FEFO sí filtra y ordena al abrir ola. UOM **no** convierte qty de línea.

---

## Decisiones

1. El ledger existe de verdad: transacción + balance + test de reconstrucción. No es un array decorativo.
2. `available = on_hand − allocated − blocked − quarantined`.
3. Un lote es el `lot` del palet. No se inventan lotes extra.
4. Ajuste solo con motivo (conteo, merma, slot-fix, edición de palet). Sin qty negativa salvo flag.
5. UOM sigue puro (`uom.ts`). FEFO ordena candidatos al abrir ola; hold de palet al abrir.
6. `serial_numbers` vacío: no fabricar series.

---

## Semilla coherente (brief 39) — reglas, no implementación

Hoy: **8 SKU** (aceite, arroz, leche, jamón, helado, agua, detergente, yogur), 2 hubs, palets generados por ocupación de huecos.

Antes de subir a 50+ SKU:

- Test de coherencia: `projectBalances(inventoryTransactions)` = `inventoryBalances`, y `on_hand` del grano cuadra con `pallet.qty` del palet vivo.
- Familias ya existentes (`alimentacion_seca`, `frescos`, `congelados`, `bebidas`, `no_food`). Variantes de lo que ya hay (formatos de aceite/arroz/leche/agua).
- **Prohibido** inventar cerveza, vino, especias, papel (regla de planta).
- Un org, dos warehouses (Sevilla + Huelva). Sin tercer hub.
- Suppliers / customers: los nombres que ya están en ASN y outbound (Aceites del Sur, tiendas CN…). No fabricar 40 razones sociales.
- Incidencias: solo las que el dominio ya modela (merma, slot-fix, faltante de línea). No un catálogo de tickets inventados.

---

## Hueco vs brief Phase 3

| Brief | Hoy | Siguiente |
|---|---|---|
| Inventory ledger | `inventory_transactions` + motor | Aplicar SQL + extraer de LS |
| Balances | `inventory_balances` (proyección + lock de revisión) | Tabla viva en Postgres |
| Lots | `lots[]` + campo en palet | Igual |
| Reservations | hold al abrir ola + ALLOCATE/DEALLOCATE/consume | Semilla histórica sin hold (no inventar qty) |
