# Roadmap Campo Norte WMS

## Fase 1 — Fundación
- Rebrand a Campo Norte Logística
- Dominio WMS: sitios, SKU, huecos, palets, flota, operarios, ASN, olas, costes
- Torre de control + paneles operativos
- Roles: Dirección / Almacén / Office / Planta (`guide` = operario de planta)
- Semilla demo hub Sevilla + cámara Huelva

## Fase 2 — Pasillo & picking (esta entrega)
- Ubicación `Pasillo-Bahía-Nivel-Posición` (ej. `A-03-02-1`)
- Nivel 1 = cara de picking (`pickFace`); superiores = reserva
- Vista pasillo rack selectivo (montantes azules, 2 palets/bahía, film + SSCC)
- Flujo operario: ticket/ola impresa → ir a hueco → escanear ubicación → escanear palet/SSCC → confirmar cantidad → siguiente línea
- Flota **retráctil doble stand-up** asignada a olas de reposición (`WAVE-REP-A-0815`)
- Semilla operativa Sevilla + Huelva
- Tests de dominio: ubicación, picado, KPIs

## Fase 3 — Movimientos en vivo (siguiente)
- Movimientos en vivo (RF / putaway / traslado con confirmación en planta)
- Inventario cíclico por pasillo / ABC / caducidad
- Alertas de batería, caducidad y cut-off de tienda en tiempo real
- Reposición automática reserva → cara de picking cuando el pick face baja de mínimo

## Fase 4 — Economía, RRHH y SaaS
- Coste por palet movido / por línea pick
- Planificación de turnos y cobertura
- P&L del centro conectado a tesorería existente
- `org_id` + RLS, onboarding de centros, integraciones ERP / carriers / RF
