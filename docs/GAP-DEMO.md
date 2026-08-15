# GAP — Demo Aurora vs. Growth OS

> Análisis comparativo. **Referencia conceptual, no copia de código.**
> Aurora es producto de terceros; aquí solo se documentan patrones de
> producto y decisiones de UX para reimplementarlos con criterio propio.
> Fecha: 2026-08-08 · Autor: equipo demo
>
> **Estado actual aplicado:** ver `docs/AURORA-CONOCIMIENTO.md` y
> `docs/ESTADO.md` (fases 1–13b). La tabla §2 de abajo es del **arranque**
> del trabajo y ya no refleja el tip: P1–P5 y extras están implementados.

---

## 1 · Qué es la demo

**Aurora** (`joinaurora.io`) — "tu empresa de 5 personas, operando como una de 50".
No es un CRM de viajes: es un **back-office financiero y administrativo** con
una capa de IA que propone y un humano que aprueba.

Dominio distinto al nuestro. Eso es bueno: **no compite, complementa**.

### Mapa de módulos

| Sección | Sub-módulos |
|---|---|
| Inicio | Dashboard KPI + "Requiere tu atención" + caja/previsión + categorías de gasto |
| Chat | Asistente con prompts sugeridos |
| Aprobaciones | Cola unificada: facturas, contactos, "Aurora en background" |
| Finanzas | Tesorería · Facturación · Contabilidad · Fiscal · Contactos · Alquileres |
| Informes | P&G |
| Laboral y RRHH | Empleados · Coste del equipo · Gastos · Equity |
| Configuración | — |

---

## 2 · Comparativa honesta

| Capacidad | Aurora | Growth OS (nuestro) |
|---|---|---|
| Captación / leads | ❌ no tiene | ✅ **muy superior** (scoring, 4 modos, decay, ingest, cron) |
| Segmentación de clientes | ❌ | ✅ `customer-intelligence.ts` |
| RAG / conocimiento | ❌ | ✅ `knowledge-rag.ts` |
| Generación de contenido | ❌ | ✅ `ContentFactoryPanel` |
| Constructor de flujos | ❌ | ✅ `N8nFlowBuilder` |
| Reservas / expediciones | ❌ | ✅ |
| Vista móvil nativa | ⚠️ responsive | ✅ shell móvil dedicado |
| **Cola de acción por urgencia** | ✅ **"Requiere tu atención"** | ⚠️ tenemos motor, falta la vista |
| **Tarjetas KPI con delta + sparkline** | ✅ | ⚠️ parcial en `OpsPanels` |
| **Bandeja de aprobaciones IA→humano** | ✅ | ❌ **no existe** |
| **IA contextual por fila/tarjeta** | ✅ | ❌ solo chat global |
| **Tokens de diseño en 3 capas** | ✅ | ❌ tokens planos en `index.css` |
| Tesorería / runway / previsión de caja | ✅ | ❌ |
| Calendario fiscal (modelos AEAT) | ✅ | ⚠️ solo Verifactu |
| Contabilidad (asientos) | ✅ | ❌ |
| Laboral / RRHH / equity | ✅ | ❌ (fuera de alcance) |

**Conclusión:** no nos falta arquitectura. Nos faltan **cinco patrones de
producto** que Aurora ejecuta muy bien y que encajan sobre lo que ya tenemos.

---

## 3 · Los 5 patrones a adoptar

### P1 · "Requiere tu atención" — cola de acción por urgencia

Anatomía observada:

- Encabezado con **recuento agregado**: "6 temas requieren acción · 6 vencidas"
- Cada fila: **badge de estado** (`Vencida` / `Próximo`) · fecha · **motivo en
  lenguaje natural** · importe/impacto
- Orden por **urgencia**, nunca por fecha de creación
- Botón de IA **por fila** ("Preguntar a Aurora sobre X")
- Cada fila enlaza **a donde se resuelve**, no a un detalle muerto

**Encaje con nosotros:** es la vista que le falta a "Prioridad de hoy". El motor
ya existe (`lead-priority.ts` da orden + explicación por fila). Solo hay que
presentar el resultado con esta anatomía.

Traducción de conceptos:

| Aurora | Growth OS |
|---|---|
| Vencida / Próximo | `Se enfría` / `Caliente` / `Nuevo` |
| Importe (€) | Dinero esperado (ya calculado en el modo 2) |
| "Revisa a cuál corrige" | El *por qué* que ya generamos por fila |
| Preguntar a Aurora | Preguntar al asistente sobre este lead |

### P2 · Tarjetas KPI

Anatomía: etiqueta en versalitas · valor grande · **delta vs. periodo anterior
con flecha y color semántico** · sparkline · botón `+` de IA arriba a la derecha ·
**dos métricas relacionadas por tarjeta** (Saldo+Runway, Cobrado+Vendido).

Detalle que importa: la nota al pie *"Porcentajes comparados con el mismo punto
del periodo anterior"*. Explicitan la metodología. Eso genera confianza.

### P3 · Bandeja de Aprobaciones

**El patrón más valioso para nosotros.** Aurora tiene una cola única de todo lo
que espera OK humano, con filtros por origen y una categoría explícita
**"Aurora en background"**.

Esto es la **productización de nuestra regla de oro** ("nada escribe al viajero
solo"). Hoy la regla vive en la documentación; con este patrón vive en la UI y
se vuelve demostrable ante un cliente.

### P4 · IA contextual, no chat aislado

Cada tarjeta y cada fila tiene su entrada a la IA **con el contexto ya cargado**.
El chat global existe, pero es el último recurso. Además el chat arranca con
**prompts sugeridos** en vez de un cursor vacío.

### P5 · Tokens de diseño en 3 capas

```
Capa 1 · paleta      --aurora-blue-500, --aurora-green-400 …
Capa 2 · semántica   --text-primary, --positive, --negative, --surface-card
Capa 3 · componente  --kpi-hero-bg, --kpi-hero-value-fg, --kpi-hero-delta-down-fg
```

Nuestro `index.css` mezcla las tres capas en una sola (`--accent`, `--glass`,
`--ok`). Funciona, pero cada cambio de tema obliga a tocar componentes.

**Por qué esto es estratégico:** con tres capas, el rebrand del plan B
(quitar identidad Campo Norte y publicar el repo genérico) pasa de ser una cacería
por 44 componentes a **editar la capa 1**.

---

## 4 · Paleta observada (referencia, no a copiar tal cual)

Fondo `#05091a` · tarjeta `#070f27` · elevado `#0c1b46` · acento `#2c6ce2` ·
positivo `#7ece8e` · negativo `#f2918c` · aviso `#ffd76b`.
Tipografía: *Bricolage Grotesque* + *Geist*.

Nuestra identidad actual: *Fraunces* (display) + *Source Sans 3* (texto), acento
azul eléctrico `#2563eb` / `#3b82f6`. **Es una identidad más cálida y más
personal, y encaja mejor con "caminos y confianza".** No la cambiamos.

Lo que sí tomamos: la **estructura semántica** (positivo / negativo / aviso /
superficie / elevado) y la disciplina de contraste sobre fondo oscuro.

---

## 5 · Plan priorizado

| # | Qué | Valor | Esfuerzo | Depende de |
|---|---|---|---|---|
| 1 | Tokens 3 capas en `index.css` | Alto | Medio | — |
| 2 | Tarjetas KPI (P2) | Alto | Bajo | 1 |
| 3 | "Requiere tu atención" (P1) | **Muy alto** | Bajo | 1, 2 |
| 4 | IA contextual por fila/tarjeta (P4) | Alto | Medio | 3 |
| 5 | Bandeja de Aprobaciones (P3) | **Muy alto** | Medio | 4 |
| 6 | Prompts sugeridos en el chat | Medio | Muy bajo | — |
| 7 | Tesorería / previsión de caja | Medio hoy · **Alto tras el rebrand** | Alto | 1, 2 |
| 8 | Calendario fiscal AEAT | Bajo | Alto | — |
| — | Laboral / RRHH / equity | — | — | **Fuera de alcance** |

Detalle ampliado (contabilidad, alquileres, OCR, multi-org, otras modalidades
y enlaces futuros): **`docs/FUERA-DE-NUCLEO.md`**.

Orden de ejecución recomendado: **1 → 2 → 3 → 6 → 4 → 5**.

Los puntos 7 y 8 solo cobran sentido si el ecosistema se generaliza a "negocio
cualquiera" (plan B). Para una agencia de expediciones, la tesorería es
secundaria frente a la ocupación.

---

## 6 · Nota sobre el plan B

Si el 22 de agosto de 2026 no hay contacto ni entrevista, el repo se
generaliza y se publica. El trabajo de este documento **acelera ese camino**:

- El punto 1 (tokens) es exactamente lo que hace el rebrand barato.
- Los puntos 2–5 son patrones de producto **genéricos**, no específicos de viajes.
- El punto 7 (tesorería) es lo que convierte un CRM de nicho en un back-office
  vendible a cualquier negocio.

Nada de lo listado aquí depende de código, assets ni marca de terceros.
