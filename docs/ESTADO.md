# ESTADO — fuente única de verdad entre agentes

> **Lee este archivo antes de tocar nada y actualízalo antes de terminar.**
> Aquí trabajan varios agentes (Claude Code, Cursor) en hilos que no comparten
> memoria. El chat no es memoria: este archivo sí. Si el chat y el repo se
> contradicen, **manda el repo**.

**Última actualización:** 2026-08-10 · por Cursor · rebrand **Campo Norte** (anonimización legal)

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

**Verificación automática:** lint, `npm test` (**107**), `npm run build` — limpios.

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
| **Aurora playbook futuros** | `docs/AURORA-CONOCIMIENTO.md` |

---

## 6 · Siguiente tarea (UNA)

> **Endurecer Auth Supabase:** desactivar alta pública y promover el primer
> admin en `mps_profiles`. Aurora ya está en `main`.

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
