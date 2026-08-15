# Campo Norte — WMS OS / Ecosistema de almacén

Demo de torre de control logística para hubs tipo hipermercado (Andalucía) y centros europeos.
Construido sobre la base Campo Norte (auth, roles, Data Hub, shell, finanzas).

**Regla de oro:** la torre orquesta huecos, gente y euros; decide la planta.

**Licencia:** ver [`LICENSE`](./LICENSE) y [`NOTICE`](./NOTICE).

Este repositorio (`campo-norte2`) publica el ecosistema SaaS WMS. La base CRM/WMS vive también en [`heindall92/campo-norte`](https://github.com/heindall92/campo-norte).

---

## Fase 2 (esta rama)

Modelo de ubicación `Pasillo-Bahía-Nivel-Posición` (ej. `A-03-02-1`), digital twin de pasillo y flujo de picado con escáner.

| Módulo | Qué controla |
|---|---|
| Torre de control | Ocupación, stock, flota, gente, costes · selector Sevilla / Huelva |
| Stock | SKU / categorías / ABC / mínimos |
| Pasillos / huecos | Digital twin de rack selectivo (2 palets/bahía, nivel 1 = picking) |
| Picar mercancía | Ticket → hueco → SSCC → cantidad → siguiente línea |
| Palets | SSCC, lote, caducidad, hueco |
| Flota eléctrica | Incluye **retráctil doble stand-up** asignada a olas de reposición |
| Recepción | ASN / muelle / putaway |
| Expedición | Olas a tienda / prioridad / cut-off |
| Operarios | Turnos, productividad, extras, €/h |
| Costes | Mano de obra, energía, flota, merma vs presupuesto |

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

---

## Identidad demo

- **Marca:** Campo Norte
- **Razón social demo:** Campo Norte Logística, S.L.
- **Hubs demo:** CN-SEV-01 Sevilla + CN-HUE-02 cámara fría Huelva
- Datos de stock/operarios/flota: inventados para la demo

Roadmap: [`docs/WMS-ROADMAP.md`](./docs/WMS-ROADMAP.md)
