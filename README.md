# Campo Norte — WMS OS / Ecosistema de almacén

Demo de torre de control logística para hubs tipo hipermercado (Andalucía) y centros europeos.
Construido sobre la base Campo Norte (auth, roles, Data Hub, shell, finanzas).

**Regla de oro:** la torre orquesta huecos, gente y euros; decide la planta.

**Licencia:** ver [`LICENSE`](./LICENSE) y [`NOTICE`](./NOTICE).

Este repositorio (`campo-norte2`) publica el ecosistema SaaS WMS. La base CRM/WMS vive también en [`heindall92/campo-norte`](https://github.com/heindall92/campo-norte).

---

## Fases 2–20 (esta rama)

Modelo de ubicación `Pasillo-Bahía-Nivel-Posición`, digital twin, picado, movimientos en vivo, inventario cíclico, alertas, economía unitaria, planificación de turnos, onboarding, carriers, pistola RF y **operación diaria** (CRUD, prioridades, fichaje).

**Iconos:** siempre [Lucide](https://lucide.dev) (`lucide-react`).

| Módulo | Qué controla |
|---|---|
| Torre de control | Ocupación, alertas, €/palet, €/línea pick, huecos de turno |
| Stock | SKU / categorías / ABC / mínimos · **alta y edición** |
| Pasillos / huecos | Digital twin + **búsqueda** de producto/SSCC |
| Picar mercancía | Jornada (entrada/salida + horas) · ticket → hueco → SSCC · omitir / faltante |
| Movimientos | Putaway por zona del SKU · jornada de planta · reposición retráctil doble |
| Inventario cíclico | Cola por caducidad / ABC A · jornada · desvío firmado por operario |
| Palets | SSCC, lote, caducidad, hueco · **alta / edición** |
| Flota eléctrica | Torito, montacargas, retráctil; batería **solo reporte real** |
| Recepción | ASN crear / recepcionar / **ubicar y cerrar** cuando no queda palet en muelle |
| Expedición | Pedido · ola · **embalar por línea** · **imprimir manifiesto** · **cargar muelle** · tracking manual |
| Operarios | Cupo 25/25/25 (plazas vacantes) · CRUD · PIN / fichaje |
| Centros | Alta de hub: ciudad y layout que escriba el usuario |
| Pistola RF | Cola derivada del snapshot: hueco → SSCC → confirmar |
| Costes | OPEX vs presupuesto y P&L tarifario WMS (**no** se mezcla con Tesorería del Hub) |

Se conservan módulos útiles del CRM original (facturas, tesorería, aprobaciones, conocimiento, hub).

---

## Arranque

```bash
npm install
npm run test
npm run build
npm run dev        # http://localhost:5173
```

---

## Auth demo (sin Supabase)

| Email | Rol | Pass |
|---|---|---|
| `sofia@camponorte.demo` | Dirección | `norte2026` |
| `marta@camponorte.demo` | Office | `norte2026` |
| `luis@camponorte.demo` | Almacén | `norte2026` |
| `jorge@camponorte.demo` | Planta | `norte2026` |

Cómo probar fase 2:

1. Login con Sofía (Dirección) o Jorge (Planta / guide).
2. **Pasillos / huecos** → Hub Sevilla, pasillo A. Nivel 1 es cara de picking.
3. **Picar mercancía** → ola `WAVE-A-0815-01` → Autocompletar demo → Confirmar picado.
4. Ola `WAVE-REP-A-0815` usa **Crown RR 5700 Stand-up** (retráctil doble) para reponer desde reserva.
5. Cambia a **Huelva** en la torre y en pasillos (pasillo F fresco / G congelado).
6. **Recepción** → Recepcionar un palet (SKU y lote reales) → **Ubicar** al hueco de su zona. El ASN se cierra al ubicar el último.
7. **Movimientos** → lista de muelle o «Usar sugerencia de zona». Jorge debe fichar. Luego **Bajar** una reposición de pick face.
8. **Inventario cíclico** → rellenar hueco y SSCC reales → Confirmar conteo (firma el operario).
9. Torre de control: lista de alertas (batería Still EXU-S, cut-off Alcalá, caducidad).
10. **Operarios** → cobertura mañana/tarde/noche. **Cubrir huecos** mueve excedente (picker noche + carretillero tarde). Lo que queda es contratar.
11. **Costes** o **Tesorería** → P&L 3PL del hub (€/palet y contribución).
12. **Centros** → escribe ciudad y pasillos reales (sin presets). Luego **Pasillos / huecos**.
13. **Expedición** → elige carrier; el tracking se escribe a mano. Tras picar: **Embalar línea** (SSCC opcional), **Imprimir** manifiesto, **Cargar** palets enteros y **Expedir**.
14. **Pistola RF** → escanea el hueco y el SSCC de la cola; si no coinciden, no confirma.
15. **Torre** → cierre de jornada: solo horas de fichaje. **Movimientos / Palets** → traslado Sevilla ↔ Huelva a un hueco libre.
16. **Expedición / Operarios** → el patrón o un técnico asigna el súper con el código `OP-1903`. **Pistola** → entrar con ese código; el ticket dice súper, pasillo, hueco y cantidad. El rastro del pasillo solo avanza al marcar. Palet / caja / carro → flejar → pegar etiqueta → dejar en el muelle que indica la pantalla.
17. **Picar / Pistola / Movimientos / Torre** → **Declarar merma** si se cae o se rompe. Luego se puede coger otra caja; el hueco ya no miente. Carta de porte no está modelada.
18. **Pistola / Picar** → auriculares: pasillo, hueco, cajas o unidades del contenedor. **Pasillos** → guía 8–37 (droguería, leche 28, cerveza 29, agua 31–32…). El twin sigue en A/B/C.
19. Al **confirmar picado** el aparato dicta el siguiente ticket. Si no queda línea: fleja, escribe la etiqueta y deja en el pasillo de muelle. **Repetir** o quitar auriculares. El resto en el hueco es el stock del palet.
20. Si el hueco **no coincide**, **No coincide** avisa al jefe. En **Torre / Expedición** el jefe escribe la cuenta (merma, de más, roto, picó mal). El aparato dice «En el hueco hay N» y el operario responde **«N ok»**. Mandos: sube, baja, acelera, atrás, artículo.
21. Al asignar el súper se elige **box / palet / carro**. Al terminar, di **2** (o 3, 4…): 2 palets = **4 etiquetas** (una por lado). **Imprimir**, pegar, dejar en el **muelle** de la pantalla. Luego te asignan el siguiente súper.

---

## Identidad demo

- **Marca:** Campo Norte
- **Razón social demo:** Campo Norte Logística, S.L.
- **Hubs demo:** CN-SEV-01 Sevilla + CN-HUE-02 cámara fría Huelva
- Datos de stock/operarios/flota: inventados para la demo

Roadmap: [`docs/WMS-ROADMAP.md`](./docs/WMS-ROADMAP.md)
