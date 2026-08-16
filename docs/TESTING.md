# Testing — Campo Norte WMS

## Hoy

```bash
npm test          # vitest run   — planta + inventory ledger + productividad/costes/alertas
npm run lint      # oxlint
npm run build     # tsc -b && vite build   (= typecheck + bundle)
```

No hay script `typecheck` aparte: el typecheck **es** `tsc -b` dentro de `build`.
Dominio WMS: `src/lib/wms/*.test.ts`. Cero tests de componentes WMS.
CRM/leads/IA: `src/lib/**/*.test.ts`.

---

## Gate obligatorio después de cada phase (brief 43)

No se abre la siguiente phase si alguna casilla falla.

1. Typecheck — `npx tsc -b --pretty false`
2. Lint — `npm run lint` (cero **error**; warnings previos del CRM no bloquean una phase WMS salvo que la phase los cree)
3. Tests — `npm test`
4. Corregir fallos de esa phase (no «lo vemos luego»)
5. Regresión: picking, merma, ship, jornada siguen verdes
6. Documentar en `ESTADO.md` + el doc del módulo
7. Build — `npm run build`
8. Resume en el commit / PR: qué cambió, qué no

---

## Qué testear en semilla (brief 39)

Cuando se toque `seed.ts`:

- Un org, dos sites.
- Cada palet apunta a un slot del mismo `siteId` (o `slotId` null si está en tránsito).
- SSCC únicos en la semilla.
- `sum(pallets.qty)` por SKU es finito y ≥ 0.
- Movements de semilla no contradicen ese stock **o** se regeneran desde el stock (una política, testificada).
- Prohibido SKU de cerveza/vino/especias/papel.

---

## Observabilidad en tests

Las funciones críticas ya exponen `error` tipado. Un test de observabilidad no hace falta hasta que exista logger: entonces se aserta que un `confirmPick` fallido no traga el error.
