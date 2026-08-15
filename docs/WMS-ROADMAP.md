# Roadmap Campo Norte WMS

## Fase 1 — Fundación
- Rebrand a Campo Norte Logística
- Dominio WMS: sitios, SKU, huecos, palets, flota, operarios, ASN, olas, costes
- Torre de control + paneles operativos
- Roles: Dirección / Almacén / Office / Planta (`guide` = operario de planta)
- Semilla demo hub Sevilla + cámara Huelva

## Fase 2 — Pasillo & picking
- Ubicación `Pasillo-Bahía-Nivel-Posición` (ej. `A-03-02-1`)
- Nivel 1 = cara de picking (`pickFace`); superiores = reserva
- Vista pasillo rack selectivo (montantes azules, 2 palets/bahía, film + SSCC)
- Flujo operario: ticket/ola impresa → ir a hueco → escanear ubicación → escanear palet/SSCC → confirmar cantidad → siguiente línea
- Flota **retráctil doble stand-up** asignada a olas de reposición (`WAVE-REP-A-0815`)
- Semilla operativa Sevilla + Huelva
- Tests de dominio: ubicación, picado, KPIs

## Fase 3 — Movimientos en vivo
- Movimientos RF: putaway muelle → hueco y traslado hueco → hueco
- Reposición automática reserva → cara de picking con retráctil doble stand-up
- Inventario cíclico priorizado por caducidad / ABC A / conteo viejo
- Alertas en torre: batería < 25 %, caducidad 7 días, cut-off de tienda, pick face vacío

## Fase 4 — Economía & turnos
- Coste por palet movido y por línea de picking (mano de obra + flota del día)
- P&L 3PL del centro (almacenaje + handling + pick − OPEX) conectado a Tesorería
- Cobertura de turnos vs dotación mínima (mañana / tarde / noche)
- Org multi-hub Campo Norte (2 centros); RLS/`org_id` queda para infra

## Fase 5 — Planificación de turnos
- Asignación manual de operario → turno
- Cubrir huecos con excedente (noche primero; no deja al donante bajo mínimo)
- Huecos que no se cubren = contratar
- Iconos siempre Lucide (`lucide-react`, https://lucide.dev)

## Fase 6 — Tenant, onboarding y carriers (esta entrega)
- `org_id` en el snapshot (aislamiento de dominio; RLS Postgres queda para infra)
- Alta de centro: layout de pasillos + muelle M, huecos libres
- Presets Basel / München / Valencia
- Expedición: carrier (SEUR, DHL Freight, Carreras, XPO), tracking y ventana de muelle

## Siguiente
- RLS Postgres real, integraciones ERP / RF de pistola, EDI carriers
