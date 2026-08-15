# Fuera de núcleo — memoria de alcance y enlaces futuros

> **Memoria entre agentes.** Lo que no entra en el Growth OS de Campo Norte
> (núcleo = **viajes + leads**) no se borra de la cabeza: se archiva aquí
> con el *por qué*, el *sustituto actual* y el *enlace estructural* por si
> otro producto, vertical o fase posterior puede aprovecharlo.
>
> Complementa `docs/GAP-DEMO.md` y `docs/GAP-DEMO-ANATOMIA.md` (análisis
> Aurora). No copiar marca, assets ni código de terceros.
>
> Última actualización: 2026-08-08 · Cursor · tras fases Aurora 1–13b
>
> **Playbook canónico para futuros proyectos:** `docs/AURORA-CONOCIMIENTO.md`
> (checklist aplicado / diferido / nunca + anatomía + fórmulas).

---

## 0 · Núcleo (qué SÍ somos)

| Sí | No |
|---|---|
| Expediciones / reservas / prep viaje | Contabilidad de asientos / plan general |
| Leads → scoring → llamada / WhatsApp (humano) | Nómina, contratos laborales, equity |
| Cliente viajero + cobros (Stripe/SEPA/depósito) | Propiedad inmobiliaria / alquileres |
| Facturas Veri*FACTU / REAV orientadas a gestoría | OCR de facturas proveedor / digitalización masiva |
| Tesorería **derivada** del Hub (facturas + reservas + dietas) | Banco conectado, runway/burn de empresa |
| Equipo = tour leader ↔ expedición ↔ dieta×días | RRHH genérico multi-departamento |
| Una org / un Hub | Multi-tenant / multi-org SaaS |
| IA propone; humano aprueba; **nada escribe al viajero solo** | Autonomía total de envío |

Si una petición no encaja en la columna izquierda, **no implementarla** en
esta app. Documentar el patrón aquí y, si aplica, un enlace a cómo se
conectaría más adelante.

---

## 1 · Dejar fuera (explícito)

| Ámbito | Qué es (patrón de producto) | Por qué fuera del núcleo | Sustituto hoy en Campo Norte | Enlace futuro (si algún día) |
|---|---|---|---|---|
| **Laboral / RRHH** | Empleados, fichajes, coste salarial, organigrama | No operamos empleo; operamos guías y prep de viaje | `team-ops.ts` · Equipo (dieta × días × salida) | Módulo aparte o integración con software laboral; el *enlace* sería `person ↔ reservationId ↔ cost` ya modelado |
| **Equity / cap table** | Participaciones, dilución, vesting | Modalidad de startup/holding, no de turoperación | — | Producto distinto; no mezclar con CRM de viajeros |
| **Contabilidad completa** | Asientos, PGC, conciliación bancaria, libro diario | Gestoría + AEAT; nosotros estimamos, no presentamos | Fiscal estimado (`fiscal-calendar.ts`), P&G **operativo** (`pnl.ts`), export gestoría | Puente CSV/API hacia Holded/A3/gestor; mantener `basis` auditable |
| **Alquileres / inmobiliario** | Contratos de renta, vencimientos de local, fianza | Otra economía (asset-heavy); Campo Norte vende plazas de viaje | — | Si hubiera local propio: un `UpcomingMovement` de tipo `pago_fijo` reutilizando anatomía de caja |
| **OCR de facturas** | Digitalizar PDF proveedor → asiento / pago | Sin pipeline de docs proveedor ni compliance OCR | Registro manual / extracto en Knowledge; Drive como carpeta humana | Integración Drive → cola de aprobación (mismo patrón que `ApprovalsPanel`) antes de tocar caja |
| **Multi-org / multi-tenant** | Varias empresas en un login, switching de contexto | Un Hub, una marca, un equipo ops | Roles internos (`mps_profiles`) | Schema `org_id` + RLS Supabase; no diseñar hasta haber 2 orgs reales |
| **Runway / burn rate** | Meses de caja con gasto fijo de empresa | Sin banco ni gasto recurrente modelado | Cierre proyectado **operativo** (`ClosingProjection` / tesorería) | Cuando haya feed bancario o gastos fijos reales, misma gráfica con serie `out` alimentada de verdad |
| **Nóminas → modelo 111** | Retenciones IRPF desde nómina | No hay nóminas en Hub | Modelo 111 listado **sin importe** (hueco honesto) | Si llega feed laboral, rellenar `estimated` con la misma API fiscal |
| **IS / modelo 200** | Impuesto sociedades con contabilidad cerrada | Depende de resultado contable completo | Listado sin cifra | Gestoría; no inventar EBIT en el CRM |

---

## 2 · Otras modalidades económicas (referencia, no implementar)

Patrones vistos en back-offices “empresa 5→50” que **no son viajes+leads**.
Se guardan como *anatomía reutilizable*, no como backlog de Campo Norte.

| Modalidad | Anatomía aprovechable | Dónde ya vive un eco en Campo Norte | Cuándo reabrir |
|---|---|---|---|
| Categorías de gasto genéricas (oficina, SaaS, marketing) | Árbol gasto → % del total → drill-down | P&G operativo por expedición / canal de cobro | Solo si el Hub guarda gastos reales (no inventados) |
| Contactos financieros (proveedores/acreedores) | Ficha + saldo + vencimiento | Cliente viajero + factura; logística en reserva | Proveedores de ruta podrían ser entidad `supplier` enlazada a expedición |
| Conciliación bancaria | Match movimiento ↔ factura | `paymentRef` / canal en factura | Open banking o CSV banco → cola “Requiere tu atención” |
| Multi-sociedad / holdings | Switcher de org + permisos | Roles owner/admin/member | Segunda marca o franquicia real |
| Marketplace / comisiones a terceros | Split de margen | Margen por ruta en scoring / KPIs | Si Campo Norte cobra comisión a partners |
| Suscripción SaaS (MRR, churn) | Cohort + MRR chart | — | Plan B repo público / producto genérico, no núcleo moto |
| Inventario / flota (motos, 4x4) | Activo ↔ disponibilidad ↔ coste | `vehicle` en reserva (modo, no inventario) | Si se gestiona parque propio |
| Seguros / siniestros | Póliza ↔ reserva ↔ reclamación | Docs en Knowledge | Solo con datos reales de póliza |

---

## 3 · Qué SÍ tomamos de esas anatomías (sin traer la modalidad)

Para no reabrir debates: lo aprovechado ya está en la rama Aurora 1–13b.
Detalle canónico: `docs/AURORA-CONOCIMIENTO.md`.

| Anatomía | Aplicación en Campo Norte | Archivos |
|---|---|---|
| Cola “requiere atención” | Leads/cobros/ops urgentes | `attention.ts`, `AttentionPanel` |
| Aprobación humana | Content / propuestas IA | `approvals.ts`, `ApprovalsPanel` |
| Caja y previsión (sin banco) | Cobrado / pendiente / comprometido + próximos movimientos | `treasury.ts`, `upcoming-cash.ts` |
| P&G | Operativo por Hub, no contable | `pnl.ts` |
| Coste de equipo | Dietas × días, no salario | `team-ops.ts` |
| Fiscal AEAT | Estimación + huecos honestos | `fiscal-calendar.ts` |
| Integraciones catálogo | Stripe/Brevo/WA/n8n… | `integrations.ts` |
| Uso / tokens IA | Contador local + tope salida | `token-budget.ts` |
| Threads HOY / SEMANA | Historial local asistente | `threads.ts` |
| Alertas de facturas | Duplicada / rectificativa / atrasada | `invoice-alerts.ts` |
| IA contextual global + streaming | Drawer app-level + Conocimiento | `AiAssistantHost`, `askKnowledgeStream` |
| Decay en fecha | «se enfría el 14 ago» | `coldByDate` / `coldByLabel` |
| EN ESTA VISTA + detalle score | Leads / reservas / clientes | `ViewTotals`, toggle LeadsPanel |
| FAB arrastrable | Glow 2 capas + posición persistida | `DraggableAiFab` |

---

## 4 · Reglas al reabrir algo de esta lista

1. Debe existir **dato real** en Hub o integración (no inventar nómina, alquiler ni asientos).
2. Debe respetar la **regla de oro**: nada escribe al viajero solo.
3. Preferir **módulo satélite o integración** frente a hinchar el CRM de viajes.
4. Si el patrón es de otra economía (equity, inmobiliario, SaaS MRR), valorar
   **repo/producto aparte** (p. ej. Plan B genérico) en lugar de contaminar Campo Norte.
5. Actualizar esta tabla al implementar o descartar con fecha y motivo.

---

## 5 · Índice cruzado

| Doc | Rol |
|---|---|
| `docs/ESTADO.md` | Verdad operativa del día a día |
| `docs/AURORA-CONOCIMIENTO.md` | **Playbook canónico** Aurora → aplicado / diferido / futuro |
| `docs/GAP-DEMO.md` | Comparativa Aurora vs Growth OS (histórico) |
| `docs/GAP-DEMO-ANATOMIA.md` | Anatomía UI/UX de patrones |
| **este archivo** | Cementerio útil: fuera de núcleo + enlaces futuros |
