# Picking — Campo Norte WMS

## Flujo de planta (hecho)

1. Fichar (PIN / adapter / manual). Sin entrada no pica.
2. Identificarse con código de operario.
3. Ticket: súper, pasillo, hueco, cantidad, box/palet/carro si lo dijeron al asignar.
4. Escanear hueco → SSCC → qty. Si no coincide, no confirma.
5. Auriculares: pasillo, hueco, cajas o unidades de contenedor. Mandos: sube / baja / acelera / atrás / artículo / «N ok».
6. Si el hueco miente: **No coincide** → jefe cuadra (`slot-fix`).
7. Si se cae una caja: **declarar merma** antes de coger otra.
8. Al terminar: fleja, escribe etiqueta (en palet: 2 por unidad, una por lado), deja en el muelle de la pantalla.

UI: `AislePicking.tsx`, `WmsRfGun.tsx`, `WmsVoiceHeadset.tsx`, `WmsFloorBoard.tsx`.
Dominio: `picking.ts`, `waves.ts`, `floor.ts`, `voice.ts`, `rf.ts`, `merma.ts`, `slot-fix.ts`, `jornada.ts`.

---

## Decisiones

1. No se reescribe esta UI en las oleadas de persistencia.
2. El aparato no asigna por número de terminal.
3. Reposición actual = pick face vacío + reserva encima + retráctil doble. MIN/MAX es Phase 6 del brief, encima de esto.
4. Offline sync (Phase 10 del brief) no se finge con otro `localStorage`. Requiere cola de operaciones con id y conflicto; no está.

---

## Tests

`picking.test.ts`, `voice.test.ts`, `floor.test.ts`, `rf.test.ts`, `merma.test.ts`, `slot-fix.test.ts`, `jornada.test.ts`. Sin tests de componente.
