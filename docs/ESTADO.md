# ESTADO — fuente única de verdad entre agentes

> **Lee este archivo antes de tocar nada y actualízalo antes de terminar.**
> Aquí trabajan varios agentes (Claude Code, Cursor) en hilos que no comparten
> memoria. El chat no es memoria: este archivo sí. Si el chat y el repo se
> contradicen, **manda el repo**.

**Última actualización:** 2026-08-16 · Cloud Agent · oleada 3 holds + recuento 14 oleadas (0–13)

---

## 0 · Rebrand (2026-08-10)

Marca y datos de la empresa real **retirados** del repo público:
- Nombre comercial, legal, web, email, teléfono, CEO y equipo → **Campo Norte** (ficticio).
- Login demo: `sofia@camponorte.demo` / `norte2026` (marta@ · luis@ · jorge@).
- Eliminados PDF/PPTX/capturas del business case ajeno en `public/deck/`.

Si el chat y el repo se contradicen sobre marca o personas, **manda este archivo**.

---

## 1 · Dónde está cada cosa

| Rama | Commit | Qué contiene |
|---|---|---|
| `main` | tip | Producción (tras fusionar rebrand). |
| `cursor/rebrand-camponorte-2ebf` | tip | Anonimización marca/PII → Campo Norte. |
| `feat/aurora-patterns` | tip | Espejo histórico Aurora. |
| Producción | — | Despliegue Vercel desde main (revisar que el tip incluya rebrand). |
| Supabase | proyecto vinculado | Hub / Auth (credenciales en `.env`, no en docs). |
| **Fuera de núcleo** | `docs/FUERA-DE-NUCLEO.md` | RRHH/equity, contabilidad, alquileres, OCR, multi-org. |
| **Aurora playbook** | `docs/AURORA-CONOCIMIENTO.md` | Checklist canónico. |

### Acceso demo

- App login: `sofia@camponorte.demo` / `norte2026` (también marta@ · luis@ · jorge@, misma pass).
- Fallback demo activo aunque haya `VITE_SUPABASE_*` (Hub semilla local).
- Cerrar demo en prod real: `VITE_STRICT_AUTH=true` o `VITE_ALLOW_DEMO_AUTH=false`.

---

## 2 · Qué está IMPLEMENTADO y verificado

### Vista móvil
- Inicio, Clientes / Reservas / Leads, fichas in-place, módulos en barra.
- Tesorería, **Aprobaciones** y **Equipo** en «Más módulos» (`MobileCrmShell`).

### Lazo de leads
- Ingesta + cron + `/captura` + decay. **Verde en prod** con Supabase.

### Selector de 4 modos (lint/test/build OK)
- Motor: `src/lib/ai/lead-priority.ts` — solo reordena; **nunca** reescribe score.
- Preferencia por usuario en `user-prefs.leadPriorityMode` (localStorage).
- UI: desplegable en Leads (móvil + escritorio); Prioridad de hoy respeta el modo.
- Cada fila muestra **por qué** está en esa posición.
- Decaimiento temporal se aplica en todos los modos (corrección, no opción).

| Modo | Pregunta | Qué hace |
|---|---|---|
| Urgencia (default) | ¿Quién se enfría? | `score × e^(−λ·días)` |
| Dinero esperado | ¿Más margen? | `p × ticket(ruta) × margen − coste` × decay |
| Encaje e intención | ¿Ideal y con prisa? | cuadrante fit×intent × decay |
| Se parece a quien reservó | ¿Como mis buenos? | coseno k=5 convertidores × decay |

### Patrones Aurora (**fusionados en `main`** 2026-08-08)

Análisis en `docs/GAP-DEMO.md`, `docs/GAP-DEMO-ANATOMIA.md` y playbook
canónico **`docs/AURORA-CONOCIMIENTO.md`**.
Referencia conceptual: no hay código, marca ni assets de terceros.

| Fase | Qué | Archivos |
|---|---|---|
| 1 | Tokens 3 capas (paleta → semántica → componente) + formateadores | `src/index.css`, `src/lib/format.ts` |
| 2 | Primitivas: KPI, sparkline, badge, "EN ESTA VISTA", tabla jerárquica | `src/components/ui/**` |
| 3 | Cola "Requiere tu atención" (vista derivada) | `src/lib/attention.ts`, `AttentionPanel.tsx` |
| 4 | Tesorería adaptada (cobrado/pendiente/comprometido + gráficas) | `src/lib/treasury.ts`, `TreasuryPanel.tsx` |
| 5 | Integración: sección `tesoreria` + atención en el cuadro de mando | `MpsCrmApp.tsx`, `roles.ts`, `i18n.ts` |
| 6 | IA contextual cableada + prompts sugeridos (3→6) | `src/lib/ai/ask-bus.ts`, `MpsCrmApp.tsx` |
| 7 | **Bandeja de Aprobaciones** (regla de oro hecha interfaz) | `src/lib/approvals.ts`, `ApprovalsPanel.tsx` |
| 8 | Calendario fiscal AEAT (303/111/390/200) con importe estimado | `src/lib/fiscal-calendar.ts`, `FiscalCalendarPanel.tsx` |
| 9 | Heurística: ruta genérica (sin Mongolia hardcode), cap relación + cola estricta, umbral lead 2 días | `lead-scoring-core.ts`, `attention.ts` |
| 10 | Dashboard/tesorería económicos + conexiones equipo | `ClosingProjection`, `CashFlowChart`, `team-ops.ts` |
| 11 | Tablas facturas + P&G operativo + IA con tope de tokens/FAB | `OpsPanels`, `pnl.ts`, `token-budget.ts`, `KnowledgePanel` |
| 12 | Integraciones + Uso + próximos movimientos + alertas facturas + historial IA + fiscal timeline | `integrations.ts`, `upcoming-cash.ts`, `invoice-alerts.ts`, `threads.ts`, `AiContextDrawer` |
| 13 | IA contextual global + streaming + decay con fecha + detalle score + EN ESTA VISTA + FAB arrastrable | `AiAssistantHost`, `chat-stream.ts`, `coldBy*`, `ViewTotals` leads/reservas/clientes, `DraggableAiFab` |
| 13b | Streaming también en pestaña Conocimiento | `KnowledgePanel` → `askKnowledgeStream` |

**Verificación automática:** lint (warnings previos), `npm test` (**246**), `npm run build` — limpios.

**Decisiones de alcance (no son olvidos):**
- **Núcleo = viajes + leads.** Todo lo demás deliberado → `docs/FUERA-DE-NUCLEO.md`.
- Runway/burn rate de empresa fuera: sin gasto bancario real. El “por pagar” operativo sí existe: coste de equipo estimado.
- Modelos 111 y 200 sin importe: dependen de nóminas/contabilidad que no hay.
- Laboral RRHH genérico / equity / alquileres / OCR facturas / multi-org / contabilidad de asientos: **fuera**. En su lugar, **Equipo** = tour leader ↔ expedición ↔ dieta×días.
- Aprobar en la bandeja cambia estado (localStorage); no publica al viajero (regla de oro).
- Marca/assets de la demo Aurora: no se copian. Solo estructura, colores semánticos de gráficas y conexiones.
- Integraciones: catálogo con estado local/env; no OAuth real de terceros en esta fase.
- Historial IA: localStorage (HOY / ESTA SEMANA); sin backend de threads.

**Bugs corregidos en esta rama:**
- Fase 8: vencimientos fiscales en UTC (evita −1 día al serializar ISO en ES).
- Tesorería y Aprobaciones en `MORE_SECTIONS` móvil.
- ask-bus: consumir `pending` también al recibir el evento (evita relanzar al remontar).

**Validación visual (local, demo auth, 2026-08-08):**
- Escritorio — cola de atención / Tesorería: **PASS**.
- Móvil — Prioridad de hoy: **PARCIAL** (condensada; intencional).
- Móvil — Tesorería: **PASS**. Aprobaciones: entrada añadida tras revisión fases 6–9.

**Pendiente humano:** recorrer producción tras el deploy de Vercel (demo:
`sofia@camponorte.demo` / `norte2026` si el fallback sigue activo).

---

## 3 · Qué está DECIDIDO pero NO implementado

- Modelos entrenados (regresión / Naive Bayes) — fuera hasta `mps_lead_outcomes`
  con filas reales.
- Auth endurecido: desactivar alta pública; promover primer admin.

---

## 4 · Qué NO se toca

1. Deploy / cambios mayores sin pedirlo el dueño (fusión Aurora a main: **hecha** a petición).
2. Regla de oro — nada escribe al viajero solo.
3. `SUPABASE_SERVICE_ROLE_KEY` jamás en `VITE_` / navegador / repo.
4. Un solo motor de scoring: `lead-scoring-core.ts`.
5. Ampliar el CRM hacia RRHH, equity, contabilidad completa, alquileres, OCR o multi-org — ver `docs/FUERA-DE-NUCLEO.md`.

---

## 5 · Reparto por archivos

| Zona | Archivos |
|---|---|
| **Motor modos** | `src/lib/ai/lead-priority.ts`, `src/lib/data/stats.ts`, `src/lib/user-prefs.ts`, `src/lib/use-lead-priority-mode.ts` |
| **UI selector** | `LeadPriorityModeSelect.tsx`, `MobileLeadsScreen.tsx`, `MobileHomeSummary.tsx`, `MpsCrmApp.tsx` (LeadsPanel) |
| **Lazo / API** | `api/**`, `src/lib/leads/**`, `supabase/schema.sql` |
| **Aurora — tokens/UI** | `src/index.css`, `src/lib/format.ts`, `src/components/ui/**` |
| **Aurora — atención** | `src/lib/attention.ts`, `AttentionPanel.tsx` |
| **Aurora — tesorería** | `src/lib/treasury.ts`, `TreasuryPanel.tsx` |
| **Aurora — móvil nav** | `MobileCrmShell.tsx` (Más módulos: tesorería, aprobaciones) |
| **Aurora — integración** | `MpsCrmApp.tsx`, `roles.ts`, `i18n.ts` |
| **Aurora — IA contextual** | `src/lib/ai/ask-bus.ts` |
| **Aurora — aprobaciones** | `src/lib/approvals.ts`, `ApprovalsPanel.tsx` |
| **Aurora — fiscal** | `src/lib/fiscal-calendar.ts`, `FiscalCalendarPanel.tsx` |
| **Aurora — scoring** | `src/lib/ai/lead-scoring-core.ts` |
| **Aurora — gráficas/econ** | `ClosingProjection.tsx`, `CashFlowChart.tsx`, tokens `--chart-in/out/forecast` |
| **Aurora — equipo** | `src/lib/team-ops.ts`, `TeamOpsPanel.tsx` |
| **Aurora — integraciones/uso** | `src/lib/integrations.ts`, `IntegrationsPanel.tsx`, pestaña Uso en Ajustes |
| **Aurora — caja/alertas** | `upcoming-cash.ts`, `UpcomingCashPanel.tsx`, `invoice-alerts.ts` |
| **Aurora — IA threads** | `src/lib/ai/threads.ts`, `AiContextDrawer.tsx`, KnowledgePanel |
| **Aurora — IA global/stream** | `AiAssistantHost.tsx`, `chat-stream.ts`, `askKnowledgeStream`, FAB `DraggableAiFab` |
| **Aurora — decay fecha / vistas** | `coldByDate/Label`, ViewTotals leads·reservas·clientes, toggle detalle score |
| **Fuera de núcleo (memoria)** | `docs/FUERA-DE-NUCLEO.md` |
| **Phase 0 — auditoría** | `docs/ARCHITECTURE_AUDIT.md` |
| **Phase 0 — arquitectura objetivo** | `docs/TARGET_ARCHITECTURE.md` |
| **Phase 0 — plan SQL** | `docs/DATABASE_PLAN.md` |
| **Phase 0 — plan de migración** | `docs/MIGRATION_PLAN.md` |
| **Phase 0 — índice arquitectura** | `docs/ARCHITECTURE.md` |
| **Phase 0 — roadmap brief 0–14** | `docs/ROADMAP.md` |
| **Brief 28 — auditoría** | `docs/AUDIT.md`, `src/lib/wms/audit.ts` |
| **Brief 29 — RF offline** | `src/lib/wms/offline-queue.ts`, `offline-apply.ts`, `WmsRfGun.tsx` |
| **Brief 30 — torre** | `src/lib/wms/tower.ts`, `WmsTowerOps.tsx` |
| **Brief 34 — copilot** | `src/lib/wms/copilot.ts`, `WmsCopilot.tsx` |
| **Brief 35 — seguridad** | `permissions.ts`, `runtime.ts`, SQL RLS no aplicado |
| **Brief 36 — tests** | `ops-critical.test.ts`, `copilot.test.ts` |
| **Brief 38 — demo/prod** | `resolveRuntimeMode` · semilla vs Supabase |
| **Brief 31 — productividad** | `src/lib/wms/productivity.ts` |
| **Brief 32 — costes** | `src/lib/wms/costs.ts` |
| **Brief 33 — alertas** | `src/lib/wms/alert-engine.ts` |
| **Briefs 6–7 — inventory** | `src/lib/wms/inventory-core.ts`, SQL `20260816053000_create_wms_inventory_core.sql` (no aplicado) |
| **Briefs 4–5 — tenant/RBAC** | `rbac.ts`, `tenant.ts`, `persist.ts`, SQL `20260816060000_create_wms_tenant_rbac.sql` (no aplicado) |
| **Oleadas 1–2 — estado + ledger** | `WmsLiveProvider` en `main.tsx`. Push remoto cableado; demo en LS. SQL no aplicado. |
| **FEFO al abrir ola** | `openWaveFromOrder` filtra caducado/cuarentena y ordena por expiry (`WMS_DEMO_NOW`) |
| **Oleada 3 — holds** | Hold ALLOCATE al abrir ola; consume al picar; release al omitir; merma recorta |
| **Aurora playbook futuros** | `docs/AURORA-CONOCIMIENTO.md` |

---

## 6 · Siguiente tarea (UNA)

> **No inventar datos.** Tesorería / P&G / tracking / plantilla salen del Hub o de lo que el usuario escribe. El snapshot WMS es semilla local (`seededFromDemo`), no se mezcla con cobros reales. Batería de flota y huella: sin telemetría inventada.

Fases 8–20 + Phase 0 + briefs 28–38 + 31–33 + 6–7 + 4–5 + oleadas 1–3 + FEFO en esta rama.

**Plan de oleadas:** **14** (0–13) en `docs/MIGRATION_PLAN.md`. Hechas: 0 auditoría, 1 estado compartido, 2 ledger cableado (SQL no aplicado), **3 holds**. Siguientes: 4 counts, 5 receiving/QC, 6 putaway/slotting, 7 replenishment MIN/MAX, 8 packing/SSCC, 9 shipping/mock carrier, 10 dock calendar, 11 yard, 12 returns, 13 mover carpetas.

**Oleada 3 hecha:** `openWaveFromOrder` llama `reserveStock`. `available = qty − held`. Picar consume; omitir/faltante libera; merma recorta el hold antes del ADJUSTMENT. Semilla histórica (wave-01) **sin** hold: no se inventa qty. No es ATP de ERP. No mezclar con `mps_reservations`.

**Siguiente (UNA):** oleada 4 (sesiones de cycle-count) **o** oleada 5 (ASN lines + QC). No inventar 50 SKU ni segunda empresa. No aplicar SQL en prod desde este agente.

**4–5 Multi-tenant + Postgres:** `organization → warehouses → zones/locations`. 11 roles WMS. `authorizeWms` / `actorFromAppUser`. SQL no aplicado. Un org.

**6–7 Inventory core / balance:** `applyInventoryTx` es la única mutación de stock. `available = on_hand − allocated − blocked − quarantined`. Semilla = RECEIPT de palets reales (sin seriales). SQL no aplicado. UOM **sigue sin cablear** a la ola.

**31 Productividad:** l/h, u/h, ped/h, accuracy, distancia estimada, min/tarea. Por picker/packer/carretilla/turno/zona/almacén. Código, no nombre.

**32 Costes:** cost/order|line|pallet|pick|ship. Estructura labor/carrier/handling/storage. No es tesorería del Hub.

**33 Alertas:** motor tipado (LOW_STOCK… CARRIER_DELAY) con severity/status/entity/acción. `resolved_at` solo si el hueco ya está cuadrado.

**34 Copilot:** cinco preguntas sobre el snapshot. `finding/evidence/confidence/recommendation/optional_action`. Confirmación obligatoria. No LLM.

**35 Seguridad:** `authorizeWms` (org + almacén + RBAC). SQL `wms_site_members` no aplicado. Demo ≠ prod. Sin secretos en git.

**36 Tests:** holds, escasez, doble reserva, revisión, lote caducado, escaneo duplicado, transición inválida, permisos, putaway, FEFO, conteo, devolución.

**37 UX:** identidad igual. Badge DEMO/PROD, footnotes de decisión, a11y RF, empty del copilot. Sin gráfico decorativo. Quitado delta 2.1% inventado.

**38 Demo/prod:** `VITE_RUNTIME_MODE`. Demo = semilla sin infra. Prod = Supabase + auth estricta.

UOM **sigue sin cablear** a la ola. Ledger Postgres no se aplica solo (código sí; migration no). Holds al abrir ola: **sí** (olas nuevas; semilla histórica sin hold).

### Plan B — repo público (fecha límite 2026-08-22)

Si no hay contacto ni entrevista de Campo Norte, se generaliza y se publica:
quitar marca, temática moto/4x4 y los PDF del business case ajeno; dejar un
CRM genérico con motor de leads reutilizable. Los tokens de la fase 1 son
justo lo que abarata ese rebrand: se edita la capa 1, no 44 componentes.

---

## 7 · Cómo pasar el testigo

```
Lee @docs/ESTADO.md.
Tarea única: [sección 6].
Si tocas código: npm run lint && npm test && npm run build.
Al terminar: actualiza docs/ESTADO.md.
```
