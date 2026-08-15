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

## Fase 6 — Tenant, onboarding y carriers
- `org_id` en el snapshot (aislamiento de dominio; RLS Postgres queda para infra)
- Alta de centro con ciudad y layout **escritos por el usuario** (sin presets inventados)
- Expedición: carrier del catálogo; tracking **manual**; ventana de muelle derivada del cut-off

## Fase 7 — Pistola RF
- Cola RF derivada del snapshot (picado abierto, palet en muelle, reposición, conteo)
- Escaneo real: hueco → SSCC → destino/cantidad; no confirma si no coincide
- Tesorería del Hub ya no mezcla el P&L WMS inventado
- Plantilla de turnos: no se inventan operarios para “cerrar huecos”

## Fase 8 — Operación diaria (esta entrega)
- Flujo del día navega a recepción / expedición / palets / flota
- Prioridades del día en escritorio (heurística express · urgente · cut-off · palets) enlazadas a olas
- Catálogo: alta/edición de SKU y categorías
- Pasillos: búsqueda de producto/SSCC; picking con omitir y faltante
- Palets y ASN: crear / editar / eliminar
- Flota: torito y montacargas; batería solo con reporte (el cargador no inventa %)
- Operarios: cupo 25/25/25 en Sevilla con plazas «Alta pendiente», CRUD, PIN y fichaje
- Huella: adaptador documentado (`docs/WMS-HUELLA.md`); el navegador no lee ZKTeco

## Fase 9 — Jornada y olas del día (esta entrega)
- Ventanas de turno (06–14 / 14–22 / 22–06) y horas desde fichajes reales
- Planta (Jorge): ficha en picking; no pica si no ha marcado entrada
- Pedido diario → itinerario de muelle → abrir ola con palets reales
- Prioridades del día saltan a la ola de picking
- Agente ZKTeco de ejemplo (`scripts/wms-zk-agent.example.py`); el SaaS no finge lecturas

## Fase 10 — Planta unificada
- Recepcionar palet de ASN en muelle (SKU y qty que escribe quien descarga)
- Asignar picker a la ola; cola RF filtrada por operario
- Pistola RF con jornada y bloqueo si no ha fichado
- Inicio móvil WMS (planta/almacén/dirección): prioridades + fichaje
- Faltante con cantidad encontrada

## Fase 11 — Ubicación y conteo con jornada (esta entrega)
- Destino de putaway por zona del SKU (seco / fresco / congelado); no el primer hueco libre
- Palet recepcionado lleva `asnId`; el ASN se cierra al ubicar el último
- Movimientos y conteo usan el snapshot compartido, el operario real y la jornada de planta
- Conteo cíclico firma el desvío con `operatorId`
- Inicio móvil: atajos a ubicar y conteo

## Siguiente
- Agente pyzk en la LAN cuando haya terminal físico
- Telemetría real de flota (ISM / I_Site / InfoLink) cuando exista contrato
- Tablas WMS en Postgres / RLS cuando haya stock real en el Hub
