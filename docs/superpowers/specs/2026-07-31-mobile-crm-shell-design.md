# Vista móvil CRM — Shell Growth OS

**Fecha:** 2026-07-31  
**Estado:** Aprobado (+ referencias premium transfer/gráficas/confirmaciones)  
**Producto:** Campo Norte / Growth OS  
**Alcance:** Shell de navegación móvil; no rediseña paneles internos ni el login.

---

## Problema

El CRM desktop tiene sidebar denso. En móvil (&lt;768px) esa navegación no cabe bien: hace falta un shell tipo app (Android/iOS) con hub, bottom nav y acceso al resto de módulos, avisando que la experiencia no es idéntica al escritorio.

## Objetivos

1. Detectar viewport móvil y activar shell dedicado.
2. Calcar estructura de la app de referencia (header + banner CTA + grid + bottom nav), con tokens del tema actual (azul eléctrico).
3. Mantener login intacto.
4. Reutilizar paneles existentes dentro del shell.
5. Iconografía solo SVG (Lucide); **prohibido emoji** en UI.
6. Commit + push a `main` tras implementar (preferencia de flujo del repo).

## No objetivos (fuera de v1)

- Rediseño móvil por módulo (listas nativas, etc.).
- PWA / install prompt.
- Layout tablet landscape especial (se decide solo por ancho: &lt;768 shell, ≥768 desktop).
- Cambios en autenticación / pantalla de login.

---

## Lenguaje visual (referencias aprobadas)

Referencias aportadas por el usuario (confirmaciones, transferencia Smart WiFi, dashboards soft-UI, status chips). Principios:

1. **Sin emoji** — solo SVG Lucide / badges geométricos.
2. **Soft UI:** radios altos (22–32px), sombras difusas, mucho aire, fondos claros + accent azul eléctrico del tema.
3. **Hojas / modales:** overlay blur, card blanca/glass, icono de estado grande centrado, CTA pill full-width.
4. **Status chips** (futuro/listas): pastel bg + icono stroke + label (Pending / In progress / Success / Failed…).

### Aviso cambio de vista = “transferencia” móvil ↔ escritorio (prioridad v1)

Sustituye el banner plano. Modal/card estilo *Smart WiFi Transfer*:

- Título: “Cambiando a vista móvil” (o similar ES/EN).
- Visual: icono Lucide `Smartphone` ←···→ `Monitor` (o `Laptop`), con línea punteada / WiFi-style SVG.
- Barra de progreso animada (0→100%, ~1.2–1.8s), fill accent/success; % en texto.
- Detalle: “La navegación en móvil no es igual que en el ordenador.”
- Al completar: estado success (badge check SVG scalloped o `CircleCheck`) + botón “Entendido” / “Continuar”.
- `sessionStorage` `mps-mobile-view-notice-v1` tras completar o dismiss.
- Respetar `prefers-reduced-motion`: saltar a 100% o mostrar estado final sin animación.
- Palette: tokens del CRM (`--accent`, `--ink`, `--field-*`), no verde genérico de la ref salvo success state.

### Confirmaciones (patrón para sheets / futuros toasts)

- Success: badge check + título + subtítulo + CTA primario oscuro/accent “Done”.
- Error: triángulo warning SVG + “Reintentar” / “Cerrar”.
- Aplicar en sheets Más/Cuenta y en el cierre del overlay de transferencia (estado success).

### Dashboard (pulido visual v1, sin cambiar datos)

Referencias soft dashboard (cards 2×2, area charts con gradient fill, rings, tooltips pill):

- En `DashboardPanel`: KPIs como cards más “squircle”, charts Recharts ya existentes con stroke accent + area gradient más suave, tooltips redondeados, menos grid agresivo en móvil.
- No rediseñar lógica KPI; solo presentación CSS/props Recharts.
- En home móvil opcional: no duplicar dashboard completo; el tile Dashboard abre el panel.


## Decisiones cerradas

| Tema | Decisión |
|------|----------|
| Alcance home | Híbrido: accesos rápidos + “Más” |
| Orden grid | 1 Dashboard → 2 Leads → 3 Reservas → 4 Clientes → 5 Hub → 6 Más |
| “Más” | Bottom sheet con el resto de módulos permitidos por rol |
| Paneles | Reutilizar componentes actuales (ClientsPanel, etc.) |
| Bottom nav | Inicio · Clientes · Reservas · Cuenta |
| Enfoque | Shell dedicado (`MobileCrmShell` + `useIsMobile`) |
| Iconos | Lucide SVG stroke; sin emoji |
| Breakpoint | `max-width: 767px` (`MOBILE_MQ`) |

---

## Arquitectura

```
Login (sin cambios)
  └─ autenticado
       ├─ useIsMobile() === true  → MobileCrmShell
       │     ├─ Home hub (header, notice, banner, grid)
       │     ├─ children = panel de sección actual
       │     ├─ bottom nav
       │     └─ sheets: Más, Cuenta
       └─ useIsMobile() === false → layout desktop actual
             (sidebar + AppHeader)
```

- Un solo árbol de estado de `section` en `MpsCrmApp`.
- En móvil se ocultan sidebar y `AppHeader` desktop.
- `canAccessSection` / roles: iguales que desktop; el grid y “Más” filtran por rol.

### Archivos previstos

| Archivo | Rol |
|---------|-----|
| `src/lib/use-is-mobile.ts` | Hook + `MOBILE_MQ` (ya existe; mantener) |
| `src/components/MobileCrmShell.tsx` | Shell UI (alinear 100% a esta spec) |
| `src/components/MobileViewSwitchOverlay.tsx` | Overlay transferencia móvil↔desktop + progreso |
| `src/components/MpsCrmApp.tsx` | Cablear `useIsMobile`, render condicional shell vs desktop |

---

## UI — Home hub

Visible cuando la pestaña lógica es **Inicio** (sección “home”: mostrar hub aunque `section` pueda ser `hub`/`dashboard` según navegación; ver estados abajo).

### 1. Overlay cambio de vista (transferencia)

Ver sección **Lenguaje visual → Aviso cambio de vista**. Componente dedicado `MobileViewSwitchOverlay` (o integrado en shell):

- Primera visita móvil de la sesión → overlay fullscreen/card.
- Animación progreso → success → CTA cierra y marca `sessionStorage`.

### 2. Header

- Avatar (foto perfil o inicial) + saludo (“Buenos días/Hola, {nombre}”) — tocar abre perfil.
- Campana notificaciones (Lucide `Bell`), badge unread; tap marca leídas (comportamiento actual).
- Targets táctiles ≥44×44px.
- Safe area: `env(safe-area-inset-*)`.

### 3. Banner CTA

- Gradiente `var(--accent)` → acento secundario.
- Copy corto operativo + CTA primario **Ver reservas** → `onNavigate("reservas")`.
- Icono flecha Lucide `ArrowRight` en el botón; sin emoji.

### 4. Accesos rápidos (grid 3×2)

Orden fijo (filtrar por rol si no hay acceso):

1. Dashboard — `LayoutDashboard`
2. Leads — `Gauge`
3. Reservas — `CalendarDays`
4. Clientes — `Users`
5. Hub — `Database`
6. Más — `Plus` (abre sheet; no navega sección)

Tiles: fondo field, icono en chip accent suave, label 10–11px, radio ~18px.

---

## Bottom navigation

| Tab | Acción |
|-----|--------|
| Inicio | Cierra sheets; muestra home hub (navegación a vista home; no requiere quedar en panel denso) |
| Clientes | `onNavigate("clientes")` |
| Reservas | `onNavigate("reservas")` |
| Cuenta | Toggle sheet Cuenta (no es sección CRM) |

- Iconos Lucide: `Home`, `Users`, `CalendarDays`, `UserRound`.
- Tab activo: color `--accent`; inactivo: muted.
- Barra sticky bottom + safe-area; blur/fondo theme.

### Home vs panel

- En **Inicio**: se muestra hub (notice opcional + banner + grid). Los `children` del panel pueden ocultarse o no montarse en home.
- Al ir a Clientes/Reservas/cualquier módulo (grid o Más): se oculta el hub y se muestran `children` (panel desktop reutilizado) con header móvil reducido opcional (avatar/campana) + bottom nav.

---

## Sheet “Más”

- Bottom sheet modal (overlay + panel redondeado superior).
- Lista/grid de secciones **no** en el quick grid, filtradas por rol:  
  `facturas`, `contenido`, `conocimiento`, `automatizaciones`, `propuesta`, `slides`, `ajustes` (y cualquier otra del nav desktop no cubierta).
- Tap → `onNavigate(id)` y cierra sheet.
- Handle visual + botón cerrar; escape/overlay cierra.
- Solo iconos Lucide.

## Sheet “Cuenta”

- Perfil (abre ProfileModal vía callback).
- Ajustes → `ajustes`.
- Usuarios y roles → `usuarios` (solo si `canManageCrmUsers`).
- Cerrar sesión.
- Sin emoji.

---

## Integración en MpsCrmApp

```tsx
const isMobile = useIsMobile();
// tras login:
if (isMobile) {
  return (
    <MobileCrmShell ...>
      {/* paneles por section, igual que desktop */}
    </MobileCrmShell>
  );
}
// desktop actual
```

- No modificar componente Login.
- Preferencias de tema/acento del usuario siguen aplicando vía CSS variables.

---

## Criterios de aceptación

1. En viewport ≤767px, tras login, no se ve sidebar desktop.
2. Primera sesión móvil: overlay transferencia Smartphone↔Monitor con barra animada → success → Entendido en el orden acordado (menos los bloqueados por rol).
3. Bottom nav navega Inicio / Clientes / Reservas y abre Cuenta.
4. “Más” sheet lista el resto y navega correctamente.
5. Abrir Clientes/Reservas/Leads/etc. muestra el panel existente usable (scroll vertical).
6. Login idéntico en móvil y desktop.
7. Cero emojis en strings/UI del shell móvil.
8. Desktop ≥768px sin regresión visual/funcional del layout actual.
9. Resize cruzando 767px cambia shell ↔ desktop sin romper sesión.
10. Overlay respeta reduced-motion.
11. Dashboard KPIs/charts con look soft-UI (radios, gradients) sin cambiar datos.

## Testing manual

- Chrome DevTools iPhone SE / Pixel 5.
- Usuario admin (ve Usuarios en Cuenta + módulos en Más).
- Usuario ops/booking (sin usuarios; secciones filtradas).
- Dismiss notice → refresh misma pestaña → no reaparece; nueva sesión de pestaña → sí.

---

## Notas de implementación

- Ya existen stubs `use-is-mobile.ts` y `MobileCrmShell.tsx`; **no están cableados** en `MpsCrmApp`. La implementación alinea el shell a esta spec y lo integra.
- Estilo: corners muy redondeados, tokens `--accent`, `--field-*`, `--bg0`, `--ink`; coherente con Ajustes light mode.
- Motion: sheet slide-up 150–300ms; respetar `prefers-reduced-motion`.

---

## Self-review

- [x] Placeholders / TODOs: ninguno abierto en decisiones.
- [x] Consistencia: grid order, tabs y sheets alineados con brainstorming.
- [x] Alcance: v1 explícitamente sin rediseño de paneles.
- [x] Ambigüedad home/section: resuelta en “Home vs panel”.


---

## Perfil móvil — vista personalizable (A o B)

El usuario **elige** cómo quiere ver su perfil. No imponemos un único layout: ambas referencias viven en el producto y la preferencia se guarda **por userId**.

### Dónde se elige

Dentro del panel de usuario / Perfil (móvil y, si aplica, al abrir “Mi perfil”):

- Control **“Estilo de mi perfil”** con preview o selector de 2 opciones (tarjetas radio):
  - **A — Lista Settings:** título Perfil, card horizontal avatar+nombre+email, secciones agrupadas (Cuenta / Preferencias / Soporte) con chevrons.
  - **B — Hub centrado:** avatar centrado, nombre, email, CTA outline “Editar perfil”, cards con título interno (p. ej. Ajustes con idioma/tema/notif + valores a la derecha).
- Cambio **inmediato** (sin recargar app): al tocar A o B se re-renderiza la pantalla Perfil.
- Persistencia: campo en `UserPrefs` → `profileLayout: "settings" | "hub"` (default recomendado: `"hub"`).
- Aislado por `userId` igual que tema/acento (`mps-user-prefs-v1:{userId}`).

### Contenido común (mismo en A y B, distinto layout)

| Acción | Destino |
|--------|---------|
| Editar / Gestionar perfil | `ProfileModal` (foto, nombre, redes…) |
| Contraseña y seguridad | Deshabilitado “Próximamente” |
| Idioma | Valor ES/EN + cambio |
| Tema | Valor Claro/Oscuro (+ acento vía Apariencia) |
| Notificaciones | Estado / marcar leídas |
| Soporte | Ajustes soporte / contacto |
| Ajustes negocio | → `ajustes` |
| Usuarios y roles | Solo admin → `usuarios` |
| Cerrar sesión | `signOut` |

### Reglas UI

- Solo iconos Lucide SVG; **cero emoji**.
- Accent del usuario (azul eléctrico por defecto) en estados activos y CTA outline (estilo B).
- Tab Cuenta / Profile activo en bottom nav.
- Selector de estilo visible dentro de la propia pantalla Perfil (sección Preferencias o card “Personalización”) para que sea “superpersonalizado” y descubrible.

### Criterios extra

12. El usuario puede cambiar A↔B y al reabrir sesión/móvil conserva su elección.
13. Cada `userId` tiene su propio `profileLayout` independiente.


---

## Confirmaciones de operaciones (móvil) — patrón Success

**Referencia:** `docs/superpowers/specs/assets/ref-mobile-confirm-success.png`  
Patrón **oficial** para confirmaciones de operaciones en vista móvil (guardar perfil, crear/editar reserva, lead guardado, etc.).

### Anatomía

1. Overlay: fondo app con `backdrop-blur` fuerte + tint oscuro suave.
2. Card blanca centrada (o centro-bajo), radio ~32px, padding generoso, sombra suave.
3. Badge éxito arriba: sello/estrella scalloped en verde suave + check SVG oscuro (Lucide `Check` / path geométrico; **sin emoji**).
4. Título bold centrado (ej. “Listo”, “Guardado”, “Successful” según lang).
5. Subtítulo muted centrado (1–2 líneas: qué se hizo).
6. CTA full-width: botón charcoal/ink o accent, radio alto, label “Hecho” / “Done”.

### Uso

- Componente reutilizable: `MobileSuccessDialog` (`open`, `title`, `description`, `onDone`).
- Disparar tras operaciones exitosas en móvil (no spamear cada tap menor: sí en save perfil, create/update relevantes).
- Variante error futura: mismo card, badge warning (`AlertTriangle`) + “Reintentar” / “Cerrar” (refs previas).
- Colores success: verde suave del badge; CTA puede usar `--ink` oscuro (como la ref) o `--accent` si el tema lo pide — preferir charcoal de la ref para “Done” premium.

### Criterio

14. En móvil, al completar una operación clave aparece este dialog (no un toast plano genérico).

---

## Confirmación detalle tipo “ticket” (usuarios / clientes / operaciones)

**Referencia:** `docs/superpowers/specs/assets/ref-mobile-confirm-ticket.png`  
Pantalla/modal **rica** (no solo “Hecho”) cuando la operación implica una entidad: cliente, usuario CRM, reserva u operación similar.

### Dos niveles de confirmación móvil

| Nivel | Cuándo | UI |
|-------|--------|-----|
| **L1 — Success dialog** | Acciones ligeras (prefs, estilo perfil, marca leídas…) | Badge + título + subtítulo + “Hecho” (`MobileSuccessDialog`) |
| **L2 — Ticket confirm** | Crear/editar/guardar **cliente**, **usuario**, **reserva** u operación con datos | Pantalla tipo booking confirmed (`MobileTicketConfirm`) |

### Anatomía L2 (calco)

1. Fondo soft (mint/tint accent muy suave o glow radial success arriba).
2. Badge check scalloped + título (“Cliente guardado”, “Usuario actualizado”, “Reserva confirmada”) + subtítulo corto.
3. **Card ticket** blanca:
   - Cabecera: nombre entidad + meta (email / rol / ruta).
   - Grid 2×2 de campos clave (labels muted / values bold).
   - Separador perforado (dashed).
   - Bloque inferior: resumen / chips (VIP, rol, estado) — **sin QR real** salvo que la reserva ya lo tenga; placeholder opcional o icono entidad SVG.
4. CTA charcoal full-width: “Hecho” / “Ver ficha” (secundario opcional).

### Mapping Growth OS

| Operación | Título ej. | Campos ticket |
|-----------|------------|---------------|
| Cliente guardado | Cliente actualizado | Nombre, segmento, teléfono, email |
| Usuario CRM | Usuario guardado | Nombre, rol, email, estado |
| Reserva | Reserva confirmada | Cliente, fecha, ruta/plaza, estado/pago |

### Reglas

- Solo SVG Lucide / badge geométrico; cero emoji.
- Reutilizar datos ya en memoria tras el save (no inventar QR/Wallet).
- Componente: `MobileTicketConfirm` props `{ open, title, subtitle, headline, meta, fields: {label,value}[], chips?, primaryLabel, onPrimary, secondaryLabel?, onSecondary? }`.

### Criterio

15. Tras save de cliente/usuario/reserva en móvil → L2 ticket confirm (no solo toast).
16. Acciones menores → L1 dialog.

---

## Bottom nav — lenguaje (cheat sheet Atheros)

**Referencia:** `docs/superpowers/specs/assets/ref-tabbar-cheat-sheet.png`

Patrones aprendidos (para v1 y personalización futura):

| Estilo | Idea | Uso en Growth OS |
|--------|------|------------------|
| **Classic** | Icono + label; activo = accent fill | **Default v1** — Inicio / Clientes / Reservas / Cuenta |
| **Floating** | Cápsula flotante, solo iconos, activo en círculo soft | Opción premium si el usuario personaliza nav |
| **Bubble** | Activo en burbuja + label bold | Alternativa cercana a Classic |
| **Active text** | Pill que revela label al activar | Compacto; candidato a preferencia |
| **CTA circle/diamond** | Botón central destacado | Reservado (ej. “Nueva reserva”); fuera de v1 salvo petición |

### Specs táctiles (iOS-aligned)

- Icono ~24×24; hit area ≥44×44; label ~11–12px medium.
- Safe area bottom (`env(safe-area-inset-bottom)`); home indicator clearance.
- Activo: color `--accent`; inactivo: `--ink-muted`; SVG Lucide stroke (activo puede subir strokeWidth).
- Sin emoji.

### Preferencia futura (opcional post-v1)

`navStyle: "classic" | "floating" | "bubble"` en `UserPrefs`, selector junto a “Estilo de mi perfil”. **v1 shippea Classic** calzado a la app de referencia.
