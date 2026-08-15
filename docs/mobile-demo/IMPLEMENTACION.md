# De la demo al CRM — guía de implementación

Este documento traduce la demo (`docs/mobile-demo/index.html`) a cambios concretos sobre el código
real de `src/`. Está escrito para dárselo a un agente (Cursor, Claude Code) y que trabaje tarea a
tarea sin inventarse nada.

**Regla base:** la demo es la referencia **visual y de interacción**. No es código a copiar: no usa
React, ni Tailwind, ni el Data Hub. Todo lo que se implemente en `src/` sale de los datos y las APIs
que ya existen en el repo.

---

## 0 · Cómo dárselo a Cursor

La demo y esta guía viven en el repo, así que se referencian con `@`. Trabaja **una tarea por
conversación**: si le pides las diez de golpe, el agente pierde el hilo y rompe cosas.

### Prompt de arranque (una vez)

```
Lee @docs/mobile-demo/IMPLEMENTACION.md y @docs/mobile-demo/index.html.

La segunda es una demo estática de cómo debe quedar la vista móvil del CRM.
La primera es el plan de implementación sobre el código real.

No escribas código todavía. Dime:
1. Qué archivos de src/ vas a tocar en la Tarea 1 y qué vas a crear.
2. Qué datos del Data Hub necesitas y de dónde los sacas.
3. Qué dudas tienes antes de empezar.
```

### Prompt por tarea

```
Implementa la Tarea N de @docs/mobile-demo/IMPLEMENTACION.md.

Referencia visual: en @docs/mobile-demo/index.html mira <bloque indicado en la tarea>.
Respeta los invariantes de la sección 2 del plan.
Al terminar: npm run lint && npm test && npm run build, y enséñame el diff.
```

### Cómo revisar

Abre la app en Chrome, DevTools → modo dispositivo, **iPhone 14 Pro (393×852)** y **Pixel 7
(412×915)**. Compara pantalla a pantalla contra la demo abierta en otra pestaña. Si algo no coincide,
describe la diferencia en palabras («el título grande no colapsa al desplazar»), no en CSS: el agente
tiene la referencia delante.

---

## 1 · Qué se traslada y qué no

| De la demo | Al CRM |
|---|---|
| Marco de teléfono, carril de herramientas, notas de diseño, cabecera editorial | **No.** Son el escaparate de la demo |
| Selector iOS / Android | **No** en producción. Ver nota abajo |
| Datos (María Gálvez, R-4821, 4.800 €…) | **No.** Todo sale del Data Hub |
| Colores, radios, sombras, tipografía | Ya existen en `src/index.css`. No añadir paleta nueva |
| Título grande que colapsa, bento de KPI, chips de estado, anillo de score, hojas arrastrables, pull-to-refresh, toast isla, filas agrupadas de ajustes, barra flotante | **Sí.** Es el objeto de este plan |

**Sobre iOS/Android:** en la demo el conmutador existe para enseñar los dos ecosistemas. En el
producto elige **un** patrón —la barra flotante— y adáptalo con `env(safe-area-inset-*)`, que ya
cubre las dos plataformas. Si más adelante quieres la barra anclada Material en Android, se detecta
una vez (`navigator.userAgentData?.platform` o `/Android/.test(navigator.userAgent)`) y se pone un
`data-platform` en `<html>`; no lo metas en v1.

---

## 2 · Invariantes (romper esto es un bug, aunque se vea bien)

1. **Permisos.** Toda sección pasa por `canAccessSection(user.role, section)` y los usuarios por
   `canManageCrmUsers`. Ninguna pantalla nueva se salta el filtro.
2. **Datos.** Leads, clientes, reservas y facturas salen de `useDataHub()`
   (`leads`, `clients`, `reservations`, `invoices`, `refresh()`). Cero literales de negocio en los
   componentes.
3. **Idioma.** Cada cadena nueva va a `src/lib/i18n.ts` en `es` **y** `en`, y se usa con
   `t(lang, "clave")`. Nada de texto suelto en JSX.
4. **Avisos.** Notificaciones vía `useNotifications()`; confirmaciones vía `showMobileSuccess()`
   (`src/lib/mobile-confirm.ts`). No crear un sistema de toasts paralelo.
5. **Iconos.** Solo Lucide. **Prohibido emoji en UI** (regla del spec anterior).
6. **Regla de oro.** Ninguna pantalla envía nada al viajero. WhatsApp y llamada abren el canal con un
   mensaje que escribe la persona (`WhatsAppSecureLink`).
7. **Escritorio intacto.** Nada de esto toca la vista ≥768 px ni el login.
8. **Accesibilidad.** Objetivo táctil ≥44 px, `aria-pressed`/`aria-selected` en conmutadores y
   pestañas, foco visible, y `prefers-reduced-motion` respetado en toda animación nueva.

---

## 3 · Mapa de archivos

| Archivo | Qué pasa |
|---|---|
| `src/components/mobile/ui.tsx` | **Crear** — primitivas: `Chip`, `ScoreRing`, `Meter`, `Sparkline`, `SectionHead`, `Row` |
| `src/components/mobile/MobileSheet.tsx` | **Crear** — hoja inferior con tirador y arrastre para cerrar |
| `src/components/mobile/MobileHeader.tsx` | **Crear** — barra superior con título que colapsa al desplazar |
| `src/components/mobile/HomeScreen.tsx` | **Crear** — héroe, bento, prioridad de hoy, accesos, carrusel |
| `src/components/mobile/BookingsScreen.tsx` | **Crear** — lista nativa de reservas + hoja de detalle |
| `src/components/mobile/ClientsScreen.tsx` | **Crear** — buscador, cola del mes, segmentos, ficha 360º |
| `src/components/mobile/LeadsScreen.tsx` | **Crear** — cola por scoring |
| `src/lib/use-pull-to-refresh.ts` | **Crear** — gesto de recarga sobre `hub.refresh()` |
| `src/components/MobileCrmShell.tsx` | **Editar** — enruta a las pantallas nuevas; el `children` de escritorio queda solo para módulos sin pantalla propia |
| `src/components/MobileProfileScreen.tsx` | **Editar** — alinear con las filas agrupadas de la demo |
| `src/components/MobileLeadScoreSheet.tsx` | **Editar** — reusar como hoja de detalle de lead con el anillo nuevo |
| `src/index.css` | **Editar** — solo clases utilitarias móviles (`.mps-mobile-*`); **no** tokens nuevos |
| `src/lib/i18n.ts` | **Editar** — claves nuevas en `es` y `en` |

---

## 4 · Tareas

### Tarea 1 — Primitivas de UI

**Archivos:** `src/components/mobile/ui.tsx`, `src/index.css`
**Referencia:** en la demo, CSS `.chip`, `.ring`, `.meter`, `.spark`, `.row`, `.section-head`; JS
`ring()` y `sparkline()`.

`Chip` con tonos `neutral | accent | ok | warn | danger` mapeados a los tokens existentes
(`--accent`, `--ok`, `--warn`, `--danger`) con `color-mix`. `ScoreRing` en SVG, color por tramo
(≥85 ok, ≥65 accent, ≥45 warn, resto danger) y animación de `stroke-dashoffset`.

**Hecho cuando:** las primitivas se ven igual en claro y oscuro y con los cinco acentos del CRM, y no
se ha añadido ninguna variable de color nueva.

---

### Tarea 2 — Cabecera que colapsa

**Archivos:** `src/components/mobile/MobileHeader.tsx`, `MobileCrmShell.tsx`
**Referencia:** CSS `.appbar`, `.appbar-title`, `.screen-title`; JS `renderAppbar()`.

El título grande vive en el contenido; el compacto de la barra aparece solo al desplazar (>6 px) con
transición de opacidad. La barra lleva `backdrop-filter` y `padding-top: max(…, env(safe-area-inset-top))`.

**Hecho cuando:** al desplazar aparece el título compacto y una hairline inferior, y al volver arriba
desaparecen. Nunca se ven los dos títulos a la vez.

---

### Tarea 3 — Hoja inferior reutilizable

**Archivos:** `src/components/mobile/MobileSheet.tsx`
**Referencia:** CSS `.sheet-host`, `.sheet`, `.sheet-grab`; JS `openSheet()` y el bloque de arrastre.

Props: `open`, `title`, `onClose`, `children`. Cierre por tirador (arrastrar >90 px), por scrim, por
`Escape` y por botón. `role="dialog"`, `aria-modal`, foco atrapado dentro y devuelto al disparador.

**Hecho cuando:** `MobileNotificationsSheet`, el sheet «Más módulos» y las fichas nuevas usan **este**
componente; no queda ningún overlay ad-hoc con su propio markup.

---

### Tarea 4 — Inicio

**Archivos:** `src/components/mobile/HomeScreen.tsx`
**Referencia:** JS `screenHome()`; CSS `.hero`, `.bento`, `.kpi`, `.quick-grid`, `.eco`.

Todo derivado del Hub, nada fijo:

- **Héroe:** la reserva con `departureAt` futuro más cercana (`hub.reservations`); cuenta atrás en
  días y ocupación de esa expedición.
- **Bento (4):** leads de la semana (`computeLeadStats`, `src/lib/data/stats.ts`), ocupación de
  próximas salidas, saldo pendiente (`Σ totalAmount − depositPaid` de reservas abiertas) y margen
  medio (`computeBusinessKpis`, `src/lib/business-kpis.ts`).
- **Prioridad de hoy (3):** lead sin dueño con score más alto · cliente con mayor
  `reactivationPriority` y `contactThisMonth` · reserva en `docs_pendientes` con salida más próxima.
- **Accesos rápidos:** los actuales `QUICK` del shell, filtrados por rol.
- **Carrusel:** el `MobileEcosystemCarousel` que ya existe.

Si una lista viene vacía, la tarjeta muestra su estado vacío; **no** se oculta ni se rellena con
ejemplos.

**Hecho cuando:** cambiando datos en el Data Hub cambian los cuatro números y las tres prioridades.

---

### Tarea 5 — Reservas

**Archivos:** `src/components/mobile/BookingsScreen.tsx`, `MobileCrmShell.tsx`
**Referencia:** JS `screenBookings()` y `sheetRes()`; CSS `.res`, `.res-date`, `.timeline`.

Sustituye el panel de escritorio embebido en el `children` del shell. Tarjeta: fecha en bloque,
ruta, cliente, `pax`, tour leader, chips de estado y `D-n`, y barra de cobro (`depositPaid/totalAmount`).
Filtros: todas / activas / docs pendientes / cerradas. Al tocar, hoja con itinerario en línea de
tiempo, contactos de logística (llamar y WhatsApp por `WhatsAppSecureLink`) y acciones existentes.

**Hecho cuando:** no hay scroll horizontal en 390 px y el cambio de estado sigue disparando la
notificación que ya emitía el panel de escritorio.

---

### Tarea 6 — Clientes

**Archivos:** `src/components/mobile/ClientsScreen.tsx`
**Referencia:** JS `screenClients()` y `sheetClient()`.

Buscador (nombre, ciudad, ruta de interés), cola **«contactar este mes»** arriba ordenada por
`reactivationPriority`, chips de segmento y lista con LTV y saldo. Ficha 360º en hoja: LTV, viajes,
NPS, próximo interés, aviso interno e historial.

**Hecho cuando:** el buscador no pierde el foco al teclear y los segmentos usan
`SEGMENT_LABEL` de `src/lib/demo-data.ts`, no etiquetas nuevas.

---

### Tarea 7 — Leads

**Archivos:** `src/components/mobile/LeadsScreen.tsx`, `MobileLeadScoreSheet.tsx`
**Referencia:** JS `screenLeads()` y `sheetLead()`.

Cola ordenada por score con anillo, chips de estado y origen, filtros por estado. La hoja reusa
`MobileLeadScoreSheet` (ya calcula prioridad y motivos) y añade el botón «Clasificar con IA» que
llama al scoring real de `src/lib/ai`, con estado de carga y resultado por `showMobileSuccess`.

**Hecho cuando:** el botón usa el scoring del repo y el aviso deja claro que no se ha escrito a nadie.

---

### Tarea 8 — Pull-to-refresh y toast

**Archivos:** `src/lib/use-pull-to-refresh.ts`, `MobileCrmShell.tsx`
**Referencia:** CSS `.ptr`, `.toast`; JS bloque «pull to refresh» y `toast()`.

Gesto solo con `scrollTop === 0`, umbral 70 px, indicador que gira y `hub.refresh()`. El resultado
sale por `showMobileSuccess` con el estilo de píldora superior de la demo.

**Hecho cuando:** el gesto no interfiere con el scroll normal ni con el arrastre de las hojas, y con
`prefers-reduced-motion` no hay giro.

---

### Tarea 9 — Cuenta

**Archivos:** `MobileProfileScreen.tsx`
**Referencia:** JS `screenAccount()`; CSS `.group`, `.setting`, `.switch`, `.profile`.

Alinear lo que ya existe: tarjeta de perfil con tres cifras, grupos con etiqueta en versalitas, filas
de 44 px, y los controles de tema / acento / idioma **apilados** (el control ocupa su propia línea:
en 390 px no cabe al lado de la etiqueta). Mantener `saveUserPrefs` y `ViewModePicker`.

**Hecho cuando:** ningún control se sale de la tarjeta en 390 px y las preferencias siguen
persistiendo.

---

### Tarea 10 — Módulos sin pantalla propia

**Archivos:** `MobileCrmShell.tsx`
**Referencia:** JS `screenModule()`.

Contenido, Conocimiento, Propuesta, Presentación, Usuarios y Ajustes no necesitan pantalla nativa en
v1: cabecera + cuatro cifras reales del Hub + aviso honesto de que la vista completa está en
escritorio. Facturas y Ecosistema sí merecen pantalla propia (ver `screenInvoices()` y
`screenAutomations()` en la demo) si queda tiempo.

**Hecho cuando:** ningún módulo embebe una tabla de escritorio con scroll horizontal.

---

## 5 · Definición de hecho (global)

```bash
npm run lint && npm test && npm run build
```

Y a mano, en 390×844 y 412×915:

- [ ] Ninguna pantalla desplaza en horizontal.
- [ ] Los cuatro tabs y el gesto de volver atrás funcionan sin recargar.
- [ ] Claro y oscuro revisados en las cinco pantallas; los cinco acentos no rompen contraste.
- [ ] ES e EN completos: ninguna cadena en el idioma equivocado.
- [ ] Un rol no admin no ve secciones que no le tocan.
- [ ] Con el Hub vacío la app se sostiene con estados vacíos.

---

## 6 · Orden recomendado

Tareas 1 → 2 → 3 primero: son la base y sin ellas las pantallas se llenan de CSS duplicado. Después
4 (Inicio) para ver el conjunto, y luego 5, 6 y 7 en el orden en que más las use el equipo. Las
tareas 8, 9 y 10 son de acabado y pueden ir en otro momento.
