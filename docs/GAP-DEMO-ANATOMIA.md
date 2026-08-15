# Anatomía técnica de la demo Aurora

> Complemento de [`GAP-DEMO.md`](./GAP-DEMO.md). Aquí van tablas, despliegues,
> conexiones entre entidades, flujos y **cálculos**.
> **Referencia conceptual. No se copia código, marca ni assets de terceros.**
> Fecha: 2026-08-08

---

## 1 · Sistema de tablas

Base: shadcn/ui `Table` + Tailwind. Lo interesante no es la librería, es la
**disciplina**: la jerarquía se codifica en **4 ejes de estilo**, no en
componentes anidados. Todas las filas son hermanas en el mismo `<tbody>`.

| Eje | Valores | Significado |
|---|---|---|
| Sangría | `pl-4` / `pl-10` | Nivel 1 (epígrafe) / Nivel 2 (detalle) |
| Peso | `font-normal` / `font-medium` | Fila normal / subtotal |
| Color | heredado / `text-muted-foreground` | Principal / detalle secundario |
| Borde | — / `border-t` | Fila normal / **fila derivada** (subtotal, total) |

Y dos reglas de oro para columnas numéricas:

```
text-right tabular-nums
```

`tabular-nums` fuerza cifras de ancho fijo → **las comas decimales quedan
alineadas en vertical**. Es el detalle que separa una tabla financiera creíble
de una que parece un listado cualquiera. Nosotros no lo usamos en ningún sitio.

Hover: `hover:bg-[var(--surface-hover)]` — token semántico dentro de la utilidad,
no un color literal. Por eso el tema cambia sin tocar componentes.

### Ejemplo real (P&G)

```
Importe neto de la cifra de negocios      120.927,03 €   ← pl-4  font-normal
  705 · Prestaciones de servicios         120.927,03 €   ← pl-10 muted
Margen bruto                              120.927,03 €   ← pl-4  font-medium border-t
Gastos de personal                        −98.552,00 €
  640 · Sueldos y salarios                −64.638,20 €
  642 · Seguridad Social a cargo empresa  −33.913,80 €
EBITDA                                    −13.485,76 €   ← derivada
D) Resultado del ejercicio                −13.485,76 €   ← fila destacada + color negativo
```

Detalle fino: el signo menos es `−` (U+2212, menos matemático), no `-` (guion).
Ancho correcto y no se rompe de línea.

---

## 2 · El despliegue

**No es un acordeón por fila.** Es **un único interruptor global**:

> `[toggle] Ver detalle por cuenta` → 18 filas ⇄ 9 filas

Implementado como `<label>` + checkbox `peer`. Al apagarlo desaparecen todas las
filas de nivel 2 y quedan solo epígrafes y derivadas.

**Por qué es mejor que un acordeón:** en un estado financiero quieres comparar
totales entre sí. Un acordeón por fila te deja la tabla en un estado mixto e
ilegible. Un interruptor global tiene solo dos estados, ambos coherentes.

**Aplicación directa para nosotros:** en el panel de leads, un
`Ver detalle del score` que muestre/oculte las sub-filas de factores.

---

## 3 · Tabla de transacciones (Tesorería) — el mejor ejemplo

### Columnas

| Columna | Contenido | Truco |
|---|---|---|
| FECHA | `28 ago 2026` | — |
| CONCEPTO | 2 líneas: concepto + **contraparte** (+ tarjeta `**4582`) | Densidad sin ensuciar |
| CATEGORÍA | Nómina · Impuestos · Software · Suministros… | Alimenta el gráfico del dashboard |
| CUENTA | 2 líneas: nombre + banco | — |
| ESTADO | Badge `Conciliada` / `Sin conciliar` | — |
| IMPORTE | Con signo. Si es divisa: **importe EUR + (tipo) + importe original** | `-370,55 € (0,842) -312,00 GBP` |
| ACCIONES | `Revisar` **solo si hay algo que hacer** | Columna casi vacía a propósito |

### Filtros y — lo importante — los totales

```
Pestañas:  Todos · Sin conciliar (4) · Conciliados · Traspasos (4)
Además:    selector de cuenta · rango de fechas · filtros
```

Y encima de todo:

```
TOTAL DISPONIBLE   186.293,25 €
EN ESTA VISTA      Entradas +368.002,17 €   Salidas −182.193,92 €   Neto +185.808,25 €
```

**El patrón que hay que robar:** los agregados se recalculan con el filtro
aplicado, y lo dicen explícitamente con la etiqueta **"EN ESTA VISTA"**. El
usuario nunca duda de si el total corresponde a lo que está mirando.

Nuestro equivalente: al filtrar leads por modo/estado, mostrar
`EN ESTA VISTA · N leads · valor esperado X € · Y se enfrían`.

---

## 4 · Mapa de conexiones entre entidades

```
                    ┌───────────┐
                    │ CONTACTO  │ (NIF, dirección, email)
                    └─────┬─────┘
                          │ emisor/receptor
                   ┌──────▼──────┐
                   │   FACTURA   │ venta / compra
                   │  F2026/022  │ base · IVA · retención IRPF
                   └──┬───┬───┬──┘
          conciliación │   │   │ clasificación AEAT
                   ┌───▼─┐ │ ┌─▼──────────┐
                   │MOVIM│ │ │ MODELO 303 │──┐
                   │BANCA│ │ │  111 / 349 │  │
                   └──┬──┘ │ └────────────┘  │
                      │    │ "Generar asiento"│
                      │  ┌─▼──────────┐      │
                      │  │  ASIENTO   │      │
                      │  │ cuenta PGC │      │
                      │  └─────┬──────┘      │
              categoría│       │             │
                       │       ▼             ▼
                  ┌────▼───┐ ┌─────┐  ┌──────────────┐
                  │GRÁFICO │ │ P&G │  │  CALENDARIO  │
                  │ GASTOS │ │EBITDA│ │    FISCAL    │
                  └────────┘ └─────┘  └──────┬───────┘
                                             │
              NÓMINAS ──► HR / Coste equipo   │
                                             ▼
                                    "REQUIERE TU ATENCIÓN"
```

Puntos clave:

1. **La factura es el nodo central.** Todo cuelga de ella: contacto, movimiento
   bancario, asiento, modelo fiscal.
2. **Conciliación = enlace movimiento ↔ factura.** Es lo que hace que el dinero
   previsto se convierta en dinero real. De ahí sale el estado `Sin conciliar`.
3. **La categoría del movimiento** es lo que alimenta "¿A dónde se va el dinero?".
   Una sola dimensión, reutilizada en dos vistas.
4. **Todo lo vencido o sin resolver** sube a "Requiere tu atención". Esa sección
   no tiene datos propios: es una **vista derivada** que agrega excepciones de
   todos los módulos. Ese es el diseño correcto y es barato de implementar.

---

## 5 · Cálculos identificados

| Métrica | Fórmula deducida |
|---|---|
| Total disponible | Σ saldos de cuentas (bancos + caja + tarjetas) |
| Neto (vista) | Entradas − Salidas, **sobre el filtro activo** |
| Burn rate | Media mensual de (salidas − entradas) del periodo |
| **Runway** | Saldo actual ÷ burn rate → se muestra en meses **y fecha final** ("8 meses · hasta abr 2027") |
| Proyección de cierre | Saldo actual **+** por cobrar **−** por pagar |
| MRR | Ingresos de categoría *recurrente* del **último mes cerrado** |
| ARR | MRR × 12 |
| Margen bruto | Cifra de negocios − coste de ventas |
| EBITDA | Margen bruto − gastos de personal − otros gastos de explotación |
| Resultado del ejercicio | EBITDA + resultado financiero − impuestos |
| Delta % | vs. **el mismo punto** del periodo anterior (no vs. el cierre) |
| Importe en divisa | importe_original × tipo_cambio → EUR (se guardan los tres) |
| Aging de cobros | Días desde vencimiento → ordena "Requiere tu atención" |

Dos decisiones de producto que merecen copiarse:

- **Runway se expresa en meses Y en fecha.** "8 meses" es abstracto;
  "hasta abr 2027" se entiende de golpe. Aplícalo a nuestro decay de leads:
  no "se enfría", sino *"se enfría el 14 ago"*.
- **El delta compara el mismo punto del periodo**, y lo dicen al pie de la
  tarjeta. Comparar un mes a medias contra un mes cerrado es el error clásico
  que hace desconfiar de un dashboard entero.

---

## 6 · El efecto del botón de IA

Receta completa (es una técnica genérica, nada propietario):

```
Botón:  56px · círculo · fixed · cursor-grab (arrastrable) · touch-none
Sombra: 0 14px 34px -8px  <color-de-acento>      ← la sombra ES del color, no negra
Aro:    ring-1 ring-<blanco>/20
Hover:  scale-105 · sombra más amplia · transición 300ms cubic-bezier(.4,0,.2,1)
Halo:   <div> hermano en absolute inset-0, rounded-full,
        bg-<acento> opacity-40 blur-md, que baja de opacidad al hover
```

La clave del "glow": **dos capas**. Una sombra proyectada del color del acento
(no negra) + un div difuminado por debajo. Ningún filtro caro, ningún canvas.

Animaciones declaradas en su hoja de estilos, por si quieres inspiración de
nombres: `aurora-cta-breathe`, `aurora-cta-shimmer`, `chat-agent-pulse-ring`,
`chat-agent-float`, `chat-agent-spin-inner`, `chat-agent-dot-blink`.

Y el detalle de producto: **el botón es arrastrable** (`cursor-grab`,
`touch-none`) para que el usuario lo aparte si le tapa contenido. Buen gesto.

---

## 7 · Qué de todo esto integramos, y cómo

| De Aurora | Nuestro destino | Esfuerzo |
|---|---|---|
| `tabular-nums` + alineación derecha | Todas las tablas con cifras | Trivial |
| Signo `−` (U+2212) | Formateadores de `invoice-math.ts` | Trivial |
| Interruptor global de detalle | Panel de leads (`Ver detalle del score`) | Bajo |
| Agregados "EN ESTA VISTA" | Leads, reservas, clientes | Bajo |
| Badge de estado + acción contextual | Filas de leads y reservas | Bajo |
| Métrica en unidad **y** en fecha | Decay de leads ("se enfría el 14 ago") | Bajo |
| Delta vs. mismo punto + nota al pie | Tarjetas KPI del dashboard | Bajo |
| Vista derivada de excepciones | "Requiere tu atención" | Medio |
| Botón IA con halo de 2 capas | Asistente global | Bajo |
| Conciliación (enlace 2 entidades) | Reserva ↔ pago recibido | Medio |
| Runway / previsión de caja | Solo si generalizamos (plan B) | Alto |
| Asientos PGC / modelos AEAT | Fuera de alcance por ahora | Alto |
| Laboral / equity | **Fuera de alcance** | — |

### Lo que NO conviene copiar

- **Su paleta.** Azul marino corporativo frío. Nuestra identidad (Fraunces +
  Source Sans 3, tonos cálidos) encaja mejor con "caminos y confianza".
- **Su densidad.** Aurora asume usuario de escritorio con pantalla grande.
  Nuestro caso fuerte es móvil. Las tablas de 7 columnas hay que replantearlas
  como fichas apiladas en móvil (ya lo hacemos bien).
- **Su arquitectura de secciones.** 7 módulos con submenús es mucho para un
  equipo de 4 personas. Nuestra barra de módulos es más adecuada.
