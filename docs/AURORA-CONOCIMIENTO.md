# Aurora → conocimiento reutilizable

> **Memoria canónica** del análisis Join Aurora / joinaurora.io aplicado a Campo Norte
> y guardado para **futuros proyectos** (Plan B genérico, otro vertical, otro CRM).
>
> - **No** se copia código, marca, assets ni textos de terceros.
> - Solo patrones de producto, anatomía UX, fórmulas y decisiones de alcance.
> - Si este archivo y el chat se contradicen, **manda este archivo + `ESTADO.md`**.
>
> Última actualización: 2026-08-08 · Cursor · tip fases Aurora 1–13b

---

## 0 · Índice de documentos

| Doc | Rol |
|---|---|
| **este archivo** | Checklist aplicado / diferido / nunca + playbook para reutilizar |
| `docs/GAP-DEMO.md` | Comparativa inicial (histórico; tabla §2 quedó desfasada) |
| `docs/GAP-DEMO-ANATOMIA.md` | Tablas, conexiones, fórmulas, FAB glow |
| `docs/FUERA-DE-NUCLEO.md` | Modalidades económicas ajenas al núcleo viajes+leads |
| `docs/ESTADO.md` | Verdad operativa del repo día a día |

---

## 1 · Qué es Aurora (en una frase)

Back-office financiero/administrativo “empresa de 5 como de 50”: IA propone,
humano aprueba. **No** es CRM de viajes. Domino distinto → no compite; se
extraen **patrones**, no el producto.

Demo de referencia (acceso de prueba histórico): `joinaurora.io` / hosts
compartidos de trial. Credenciales de terceros **no** se versionan aquí.

---

## 2 · Los 5 patrones núcleo (P1–P5) — estado en Campo Norte

| ID | Patrón | Estado Campo Norte | Dónde vive |
|---|---|---|---|
| P1 | Cola «Requiere tu atención» (vista derivada) | ✅ | `attention.ts`, `AttentionPanel` |
| P2 | KPI + delta + sparkline + IA | ✅ (adaptado) | `StatCard`, `Sparkline`, dashboard |
| P3 | Bandeja Aprobaciones IA→humano | ✅ | `approvals.ts`, `ApprovalsPanel` |
| P4 | IA contextual por fila (no chat aislado) | ✅ | `ask-bus`, `AiAssistantHost`, streaming |
| P5 | Tokens diseño 3 capas | ✅ | `index.css` capas paleta→semántica→componente |

Extras adoptados después del plan inicial de 5:

| Extra | Estado | Dónde |
|---|---|---|
| Prompts sugeridos | ✅ | Knowledge + drawer |
| Tesorería sin banco (derivada Hub) | ✅ | `treasury`, `UpcomingCash`, `ClosingProjection` |
| Fiscal AEAT estimado | ✅ | `fiscal-calendar` (111/200 sin cifra = honesto) |
| P&G operativo + HierarchyTable | ✅ | `pnl`, `HierarchyTable` |
| Equipo = guía↔viaje↔dieta (no RRHH) | ✅ | `team-ops` |
| Integraciones catálogo | ✅ | `integrations` (flags; no OAuth) |
| Uso / tope tokens | ✅ | `token-budget` |
| Threads HOY / SEMANA | ✅ | `threads` |
| Alertas facturas | ✅ | `invoice-alerts` |
| EN ESTA VISTA | ✅ | leads, reservas, clientes, facturas, tesorería |
| Decay en fecha («se enfría el 14 ago») | ✅ | `coldByDate` / `coldByLabel` |
| Detalle score (interruptor global) | ✅ | LeadsPanel toggle |
| FAB glow + arrastrable | ✅ | `mps-ai-fab`, `DraggableAiFab` |
| Streaming respuesta | ✅ | drawer + Conocimiento (`askKnowledgeStream`) |
| Timeline fiscal T1–T4 | ✅ | `FiscalCalendarPanel` |

---

## 3 · Anatomía que hay que recordar (playbook)

### 3.1 Tablas financieras creíbles
- 4 ejes: sangría · peso · color · borde de fila derivada
- `text-right tabular-nums`
- Signo menos **U+2212** (`−`), no guion
- Un **solo** interruptor global de detalle (no acordeón por fila)

### 3.2 EN ESTA VISTA
Los agregados se recalculan con el filtro activo y se etiquetan explícitamente.
Sin esa etiqueta el usuario deja de fiarse de los totales.

### 3.3 Cola de atención
No tiene datos propios: agrega excepciones de leads / reservas / facturas.
Orden por urgencia. Motivo en lenguaje natural. Enlace a donde se resuelve.
Botón IA por fila con contexto precargado.

### 3.4 Factura como nodo (cuando haya economía real)
```
Contacto → Factura → Movimiento bancario (conciliación)
                  → Asiento PGC
                  → Modelo fiscal
                  → P&G / gráfico gastos
Todo lo vencido → Requiere atención
```
En Campo Norte el eco es: cliente ↔ factura Veri*FACTU ↔ reserva/pago (`paymentRef`).

### 3.5 Fórmulas útiles (copiar con dato real)

| Métrica | Fórmula |
|---|---|
| Neto vista | Entradas − Salidas (filtro activo) |
| Proyección cierre | Saldo + por cobrar − por pagar |
| Runway | Saldo ÷ burn → **meses y fecha** («hasta abr 2027») |
| Delta % | vs **mismo punto** del periodo anterior (decirlo al pie) |
| Aging cobros | Días desde vencimiento → orden atención |
| Decay lead | `score × e^(−ln2/halfLife × días)`; fecha frío = cruza suelo |

### 3.6 FAB IA
56px · círculo · `cursor-grab` · sombra del **color de acento** (no negra) +
halo blur debajo · breathe animation · touch-none.

### 3.7 Regla de producto
IA propone; humano aprueba; **nada escribe al cliente/viajero solo**.
La bandeja de aprobaciones productiza esa regla.

---

## 4 · Qué NO se tomó a propósito (y por qué)

Ver detalle en `docs/FUERA-DE-NUCLEO.md`. Resumen:

| No | Motivo |
|---|---|
| RRHH / equity / nóminas | No es núcleo viajes+leads |
| Contabilidad asientos / PGC | Gestoría; nosotros estimamos |
| Alquileres | Otra economía |
| OCR facturas proveedor | Sin pipeline ni compliance |
| Multi-org | Una org hoy |
| Runway/burn con banco | Sin feed bancario |
| OAuth Stripe/Brevo real | Catálogo sí; cableado APIs = otro proyecto |
| Paleta / tipografía Aurora | Identidad Campo Norte superior para el vertical |
| Densidad escritorio 7 columnas | Nuestro caso fuerte es móvil |
| Arquitectura 7 módulos con submenús | Equipo pequeño; barra propia |

---

## 5 · Checklist para un **proyecto futuro** (copiar/pegar)

Al abrir un CRM / back-office nuevo:

1. [ ] Tokens 3 capas antes de componentes
2. [ ] Cola «requiere atención» como vista derivada
3. [ ] KPI con delta + metodología al pie («mismo punto del periodo»)
4. [ ] Bandeja de aprobaciones si hay IA o automatismos
5. [ ] IA contextual por fila + prompts sugeridos + FAB
6. [ ] EN ESTA VISTA en toda tabla filtrable
7. [ ] `tabular-nums` + `−` U+2212
8. [ ] Interruptor global de detalle en tablas jerárquicas
9. [ ] Magnitudes temporales en unidad **y** fecha
10. [ ] Separar núcleo del dominio vs modalidades ajenas (archivo tipo FUERA-DE-NUCLEO)
11. [ ] No copiar marca/assets de demos de terceros

Si el dominio **sí** es financiero-completo (no viajes): reabrir §4 de
`FUERA-DE-NUCLEO` (conciliación, asientos, runway, contactos proveedores).

Si el dominio es **SaaS genérico** (Plan B): priorizar P1–P5 + tesorería
derivada; quitar marca vertical en capa 1 de tokens.

---

## 6 · Estado de la documentación histórica

| Archivo | Nota |
|---|---|
| `GAP-DEMO.md` §2 | Tabla «nosotros no tenemos X» es del **inicio** del trabajo; hoy P1–P5 + extras están hechos. Conservar como narrativa; **este archivo** manda para estado actual. |
| `GAP-DEMO-ANATOMIA.md` | Sigue válido como anatomía/fórmulas. |
| `FUERA-DE-NUCLEO.md` | Válido; actualizar fecha al tocar alcance. |

---

## 7 · Qué queda opcional en Campo Norte (no bloquea pitch)

- Streaming nativo Claude/Gemini (hoy fallback bloque)
- Conciliación explícita movimiento↔factura con dato bancario real
- Nota al pie «mismo punto del periodo» en **todas** las KPI del dashboard
- `tabular-nums` audit completo de tablas legacy
- Auth endurecido / ML leads (cola de producto propia, no Aurora)

**Veredicto:** de Aurora se tomó **todo lo aplicable al núcleo viajes+leads**.
Lo no aplicable está archivado con enlaces estructurales para reutilizar fuera.
