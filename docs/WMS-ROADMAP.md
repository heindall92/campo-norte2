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

## Fase 11 — Ubicación y conteo con jornada
- Destino de putaway por zona del SKU (seco / fresco / congelado); no el primer hueco libre
- Palet recepcionado lleva `asnId`; el ASN se cierra al ubicar el último
- Movimientos y conteo usan el snapshot compartido, el operario real y la jornada de planta
- Conteo cíclico firma el desvío con `operatorId`
- Inicio móvil: atajos a ubicar y conteo

## Fase 12 — Expedir lo picado
- Palet entero vaciado en picking libera el hueco
- Cargar a muelle solo palets con qty 0 ya picados
- Expedir exige ola cerrada y al menos una línea picada; no inventa tracking
- Cajas sueltas (pick parcial) salen en el movimiento de picking; no se fabrica un palet nuevo

## Fase 13 — Embalaje y manifiesto (esta entrega)
- Embala solo cajas sueltas; no se puede superar lo picado
- El palet entero no se vuelve a embalar: ya es unidad de carga
- Manifiesto de muelle: palets cargados + cajas embaladas; tracking vacío si no lo escribes
- CSP de Vercel permite las fuentes de Google (la web deja de verse sin tipografía)

## Fase 14 — Cierre de muelle y jornada (esta entrega)
- Embalaje por línea: cantidad escrita y SSCC de caja solo si lo teclea el operario
- Manifiesto imprimible (`window.print`); no fabrica tracking ni SSCC
- Cierre de jornada: horas y movimientos del día a partir de fichajes reales
- Traslado inter-centro de un palet existente a un hueco libre del otro hub
- Separar ola mezclada (p. ej. `WAVE-A-0815-01`) en una ola por pedido

## Fase 15 — Asignación de súper y rastro de pasillo (esta entrega)
- El patrón o un técnico asigna el súper (pedido) al **código de operario**, no al número del aparato
- El ticket de planta manda: súper · pasillo · hueco · cantidad a tomar
- El rastro del operario avanza solo cuando marca el artículo; no hay GPS
- Unidad de carga: palet / caja / carro → fleje → etiqueta escrita → dejar en el pasillo de muelle del pedido
- No se modelan carta de porte ni la oficina de recepción: no están descritas

## Fase 16 — Merma declarada (esta entrega)
- Si se cae o se rompe una caja, hay que declararlo: baja el stock del palet
- Coger otra para el súper sin declarar deja un faltante invisible; el sistema ya no lo permite tapar
- El área de merma solo se apunta si el hueco existe; no se inventa un pasillo
- Carta de porte: los jefes la mencionan; no está modelada porque no sabemos en qué consiste

## Fase 17 — Auriculares y guía de pasillos (esta entrega)
- El aparato dicta: súper, pasillo, hueco y cantidad
- Cajas enteras o unidades de un contenedor (cuando el artículo trae cajas pequeñas dentro)
- Guía de planta 8–37 (droguería, leche 28, cerveza 29, agua 31–32…) tal como la relató el operario
- El twin digital sigue en letras A/B/C; no se inventan SKU de vino, cerveza ni especias

## Fase 18 — Ciclo de voz de planta (esta entrega)
- Al marcar, los auriculares dictan solos el siguiente ticket (pasillo, hueco, cajas o unidades del contenedor)
- Si no queda línea, dicen: fleja, escribe la etiqueta y deja en el pasillo de muelle del súper
- El resto en el hueco sale del palet real; no se inventa el desglose de cajas pequeñas
- Preferencia de auriculares on/off en el aparato (local); no es telemetría

## Fase 20 — Súper en box/palet/carro y etiquetas por lado (esta entrega)
- Al identificar al operario, se le asigna el súper y si lo toma en box, palet o carro (lo dice quien asigna)
- Al picar el último producto, la voz pregunta cuántos palets (o box/carros) ha hecho
- 2 palets → 4 etiquetas (una por cada lado). Se imprimen con súper, muelle y lado; sin SSCC inventado
- En pantalla deja el súper en el muelle. Luego le asignan el siguiente súper y oye pasillo y hueco

## Fase 19 — Faltante de hueco y mandos de voz (esta entrega)
- Si el hueco no coincide (merma, cogió de más, roto, picó mal), el operario avisa desde el aparato; el jefe cuadra la cuenta en el sistema
- El aparato dice cuántas hay en el hueco para que el operario compruebe
- Mandos: sube / baja / acelera / atrás / artículo / «N ok»
- «N ok» pica y pasa al siguiente hueco; no se inventa stock

## Phase 0 — Auditoría (esta entrega, solo docs)
- Mapa del sistema actual, deuda, huecos y plan incremental
- `docs/ARCHITECTURE_AUDIT.md`, `TARGET_ARCHITECTURE.md`, `DATABASE_PLAN.md`, `MIGRATION_PLAN.md`
- El motor de planta (fases 1–20) no se ha reescrito

## Siguiente (tras revisión humana)
- Oleadas 0–4 hechas en cliente (14 oleadas en total: 0–13)
- Oleada 5: ASN lines + QC
- Briefs 15–27 (replenishment, receiving, QC, putaway, slotting, packing, SSCC, shipping, carriers, dock, yard, returns, cycle sessions) — un módulo por oleada
- Layout numérico 8–37 / SKU cerveza-vino / ZKTeco / telemetría flota: solo con dato real
