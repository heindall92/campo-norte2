# Mobile CRM Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activar un shell móvil (&lt;768px) tipo app con hub, bottom nav, sheets, overlay premium de cambio de vista (metáfora transferencia Smartphone↔Monitor + barra de progreso), iconos Lucide sin emoji, paneles existentes reutilizados, login intacto; pulir ligeramente el Dashboard soft-UI.

**Architecture:** `useIsMobile()` decide shell vs layout desktop en `MpsCrmApp`. `MobileCrmShell` envuelve header/hub/sheets/bottom-nav; `MobileViewSwitchOverlay` educa el cambio de vista con animación de progreso. Secciones CRM siguen siendo los paneles actuales como `children`.

**Tech Stack:** React + TypeScript + Vite, Tailwind, Lucide, Recharts (dashboard), CSS variables del tema (`--accent`, etc.), `sessionStorage`.

**Spec:** `docs/superpowers/specs/2026-07-31-mobile-crm-shell-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/use-is-mobile.ts` | Ya existe — mantener `MOBILE_MQ` / hook |
| `src/components/MobileViewSwitchOverlay.tsx` | **Crear** — overlay transferencia + progreso + success |
| `src/components/MobileCrmShell.tsx` | **Reescribir/alinear** a spec (grid, home vs panel, Más sheet, Lucide) |
| `src/components/MpsCrmApp.tsx` | Cablear `isMobile`, ocultar sidebar/header desktop, pasar props |
| `src/components/MpsCrmApp.tsx` (`DashboardPanel`) | Pulido soft-UI charts/KPI cards (sin cambiar datos) |
| `.gitignore` | Ya incluye `.superpowers/` |

---

### Task 1: Overlay transferencia móvil ↔ escritorio

**Files:**
- Create: `src/components/MobileViewSwitchOverlay.tsx`
- Modify: (ninguno aún; se usa en Task 3)

- [ ] **Step 1: Crear componente con props**

```tsx
// MobileViewSwitchOverlay.tsx
import { Check, Laptop, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const MOBILE_VIEW_NOTICE_KEY = "mps-mobile-view-notice-v1";

export function MobileViewSwitchOverlay({
  lang,
  open,
  onDone,
}: {
  lang: Lang;
  open: boolean;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  // animate 0→100 with rAF or interval ~1.4s; if prefers-reduced-motion → jump to done
  // UI: card centered, Smartphone — dotted line — Laptop, progress bar, then success + CTA
  if (!open) return null;
  return (/* ... */);
}
```

- [ ] **Step 2: Implementar animación de progreso**
  - Usar `requestAnimationFrame` o `setInterval` 16–32ms.
  - `matchMedia("(prefers-reduced-motion: reduce)")` → `setProgress(100); setDone(true)`.
  - Al llegar a 100 → estado success (icono `Check` en círculo accent/success).

- [ ] **Step 3: UI premium (calco transferencia)**
  - Fondo overlay blur `backdrop-blur-md` + tint oscuro suave.
  - Card `rounded-[1.75rem]` blanco/glass, padding generoso.
  - Fila: `Smartphone` + línea punteada + `Laptop` (Lucide), labels “Móvil” / “Escritorio”.
  - Barra: track gray, fill `linear-gradient` accent, height ~6–8px, rounded-full; texto “{n}%”.
  - Copy ES/EN: título “Activando vista móvil” / subtítulo explicando menú distinto.
  - Botón “Entendido” solo en success (o “Saltar” discreto desde el inicio).
  - `onDone` escribe `sessionStorage.setItem(MOBILE_VIEW_NOTICE_KEY, "1")`.

- [ ] **Step 4: Verificar manualmente**
  - Montar temporalmente en un story/dev o tras Task 3: progreso anima, reduced-motion ok, CTA cierra.

- [ ] **Step 5: Commit**

```bash
git add src/components/MobileViewSwitchOverlay.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "$(cat <<'EOF'
Add mobile view-switch overlay with progress animation.

Premium transfer metaphor (phone↔laptop) educates users that mobile nav differs from desktop.
EOF
)"
```

---

### Task 2: Alinear `MobileCrmShell` a la spec

**Files:**
- Modify: `src/components/MobileCrmShell.tsx`

- [ ] **Step 1: Estado home vs panel**
  - Introducir `homeMode` o derivar: tab Inicio muestra hub; otras secciones muestran `children` sin hub (o hub colapsado).
  - Tab Inicio: `onNavigate` no debe forzar panel denso; usar flag interno `showHome` al pulsar Inicio.
  - Props: mantener `section`, `onNavigate`, `onOpenProfile`, `lang`, `children`.

- [ ] **Step 2: Grid accesos rápidos (orden fijo + Más)**

```tsx
const QUICK: { id: AppSection | "more"; labelEs: string; labelEn: string; icon: LucideIcon }[] = [
  { id: "dashboard", labelEs: "Dashboard", labelEn: "Dashboard", icon: LayoutDashboard },
  { id: "leads", labelEs: "Leads", labelEn: "Leads", icon: Gauge },
  { id: "reservas", labelEs: "Reservas", labelEn: "Bookings", icon: CalendarDays },
  { id: "clientes", labelEs: "Clientes", labelEn: "Clients", icon: Users },
  { id: "hub", labelEs: "Hub", labelEn: "Hub", icon: Database },
  { id: "more", labelEs: "Más", labelEn: "More", icon: Plus },
];
// filter by canAccessSection(user.role, id) except "more"
// grid-cols-3
```

- [ ] **Step 3: Sheet “Más”**
  - Estado `moreOpen`.
  - Lista secciones restantes del nav (facturas, contenido, conocimiento, automatizaciones, propuesta, slides, ajustes) filtradas por rol.
  - Mismo patrón visual que Cuenta sheet (handle, radios, Lucide).

- [ ] **Step 4: Header + banner CTA**
  - Header: avatar/saludo + Bell (sin emoji).
  - Banner: CTA primario “Ver reservas” + `ArrowRight`.
  - Quitar cualquier carácter emoji si existiera.

- [ ] **Step 5: Bottom nav**
  - Inicio / Clientes / Reservas / Cuenta — comportamiento spec.
  - Inicio pone `showHome=true` y cierra sheets.

- [ ] **Step 6: Integrar overlay**
  - Import `MobileViewSwitchOverlay` + key; `showNotice` inicial desde sessionStorage; `onDone` dismiss.

- [ ] **Step 7: Commit**

```bash
git add src/components/MobileCrmShell.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "$(cat <<'EOF'
Align mobile CRM shell with approved hybrid hub and sheets.

Quick access order, More sheet, home vs panel, and transfer overlay entry.
EOF
)"
```

---

### Task 3: Cablear en `MpsCrmApp` (sin tocar Login)

**Files:**
- Modify: `src/components/MpsCrmApp.tsx` (zona layout autenticado ~3100–3370)

- [ ] **Step 1: Importar hook y shell**

```tsx
import { useIsMobile } from "@/lib/use-is-mobile";
import { MobileCrmShell } from "@/components/MobileCrmShell";
```

- [ ] **Step 2: En el return autenticado**
  - `const isMobile = useIsMobile();`
  - Si `isMobile`: render `MobileCrmShell` con `lang`, `section`, `onNavigate={setSection}`, `onOpenProfile`, y dentro el switch de paneles (mismo que desktop).
  - Ocultar `<aside>` sidebar y `AppHeader` desktop cuando `isMobile`.
  - **No** cambiar el árbol del Login.

- [ ] **Step 3: Evitar doble chrome**
  - En móvil, el título desktop / header superior no debe aparecer encima del shell.

- [ ] **Step 4: Probar resize**
  - DevTools &lt;768 y ≥768: shell ↔ desktop; sesión intacta.

- [ ] **Step 5: Commit + push** (preferencia repo)

```bash
git add src/components/MpsCrmApp.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "$(cat <<'EOF'
Wire mobile CRM shell into authenticated app layout.

Desktop sidebar and header stay on wide viewports; login unchanged.
EOF
)"
git push origin HEAD
```

---

### Task 4: Pulido soft-UI del Dashboard

**Files:**
- Modify: `src/components/MpsCrmApp.tsx` — `DashboardPanel` + `Kpi` helper (~206, ~1217)

- [ ] **Step 1: KPI cards**
  - Aumentar radius (`rounded-[1.25rem]`), sombra suave, padding; tipografía valor más bold.

- [ ] **Step 2: Charts**
  - Area: gradient fill más suave; stroke `var(--accent)` / accent-2 en light.
  - Tooltip: `contentStyle` border-radius 12, sin borde duro.
  - En móvil (`max-md`): altura chart un poco menor si hace falta; grid dashed sutil.

- [ ] **Step 3: Progress bar meta**
  - Ya existe; asegurar look pill premium (altura 8px, gradient accent).

- [ ] **Step 4: Commit + push**

```bash
git add src/components/MpsCrmApp.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "$(cat <<'EOF'
Polish dashboard cards and charts toward soft-UI reference.

Visual only; KPI data and calculations unchanged.
EOF
)"
git push origin HEAD
```

---

### Task 5: QA manual + cierre

- [ ] **Step 1: Checklist aceptación (spec)**
  1. ≤767px sin sidebar  
  2. Overlay transferencia anima y persiste  
  3. Grid orden Dashboard→Leads→Reservas→Clientes→Hub→Más  
  4. Más sheet + Cuenta sheet  
  5. Tabs Inicio/Clientes/Reservas/Cuenta  
  6. Paneles usables  
  7. Login intacto  
  8. Cero emoji en shell  
  9. Desktop sin regresión  
  10. reduced-motion  

- [ ] **Step 2: Roles**
  - Admin ve Usuarios en Cuenta; ops no.

- [ ] **Step 3: Si todo OK, confirmar deploy Vercel**
  - Revisar https://example.com en móvil real o DevTools.

---

## Notes for implementer

- Preferencia usuario: **cada cambio → commit + push a `main`** (Tasks 3–4 ya incluyen push; Task 1–2 pueden push tras cada commit o batch al cablear).
- Responder en español en mensajes al usuario.
- No tocar `package.json` / playwright salvo necesidad.
- No inventar emojis en copy.
- Self-check UI UX Pro Max: touch ≥44px, SVG icons, contrast, reduced-motion.

---

### Task 2b: Pantalla Perfil móvil (calco After)

**Files:**
- Create: `src/components/MobileProfileScreen.tsx` (o integrar en shell como vista Cuenta)
- Modify: `src/components/MobileCrmShell.tsx` — tab Cuenta muestra esta pantalla full-bleed en lugar de solo bottom sheet
- Reuse: `ProfileModal` para “Gestionar perfil”

- [ ] **Step 1: Layout After**
  - Fondo `--bg0`, título “Perfil”, card avatar+nombre+email.
  - Secciones Cuenta / Preferencias / Soporte con cards y filas icon+label+valor+chevron.
  - Cero emoji; Lucide: User, Shield, Bell, Globe, Palette, Settings, CircleHelp, UsersRound, LogOut, ChevronRight.

- [ ] **Step 2: Wiring**
  - Gestionar perfil → `onOpenProfile()`.
  - Idioma → callback o toggle lang existente del app.
  - Tema → preferencias usuario (`user-prefs`) o navegar a Apariencia en ajustes.
  - Ajustes / Usuarios / Soporte / Sign out según spec.
  - Contraseña: disabled + “Próximamente”.

- [ ] **Step 3: Tab Cuenta**
  - `cuentaOpen` pasa a ser `showProfileScreen` a pantalla completa (scroll), no sheet mínimo.
  - Bottom nav sigue visible; Cuenta active.

- [ ] **Step 4: Commit**

```bash
git add src/components/MobileProfileScreen.tsx src/components/MobileCrmShell.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "$(cat <<'EOF'
Add mobile Profile screen matching After settings reference.

Grouped account cards for the logged-in user; reuse ProfileModal for edits.
EOF
)"
```

---

### Task 2b (actualizado): Perfil personalizable A/B

**Files:**
- Modify: `src/lib/user-prefs.ts` — añadir `profileLayout: "settings" | "hub"`
- Create: `src/components/MobileProfileScreen.tsx` — render A o B + selector
- Modify: `src/components/MobileCrmShell.tsx` — tab Cuenta → pantalla perfil
- Reuse: `ProfileModal` para editar datos

- [ ] **Step 1:** Extender `UserPrefs` + load/save default `"hub"`.
- [ ] **Step 2:** Implementar layout **A** (settings list) y **B** (hub centrado) con mismas acciones.
- [ ] **Step 3:** UI selector “Estilo de mi perfil” con 2 previews; `saveUserPrefs` al elegir.
- [ ] **Step 4:** Cablear tab Cuenta; verificar aislamiento por userId.
- [ ] **Step 5:** Commit

```bash
git add src/lib/user-prefs.ts src/components/MobileProfileScreen.tsx src/components/MobileCrmShell.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "$(cat <<'EOF'
Add per-user mobile profile layouts (settings vs hub).

Users pick their profile view style; preference stored with user prefs.
EOF
)"
```

---

### Task 2c: `MobileSuccessDialog` (confirmaciones operaciones)

**Files:**
- Create: `src/components/MobileSuccessDialog.tsx`
- Wire: al menos guardar perfil en móvil; API lista para reservas/leads después

- [ ] **Step 1:** Card blur + badge scalloped SVG check + título + subtítulo + botón Hecho.
- [ ] **Step 2:** Props `open/title/description/onDone`; cero emoji.
- [ ] **Step 3:** Tras `ProfileModal` save exitoso en viewport móvil → abrir dialog.
- [ ] **Step 4:** Commit

```bash
git add src/components/MobileSuccessDialog.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "$(cat <<'EOF'
Add mobile success confirmation dialog for key operations.

Premium blurred modal with SVG success badge matching approved reference.
EOF
)"
```

---

### Task 2d: `MobileTicketConfirm` (clientes / users / reservas)

**Files:**
- Create: `src/components/MobileTicketConfirm.tsx`
- Wire: saves en ClientsPanel / UsersDirectory / Reservations cuando `useIsMobile()`

- [ ] **Step 1:** UI calco ticket (glow + badge + card + grid 2×2 + dashed + CTA).
- [ ] **Step 2:** API de props genérica (fields/chips); sin QR/Wallet inventados.
- [ ] **Step 3:** En hooks de éxito de create/update cliente, usuario CRM y reserva → abrir L2 en móvil; L1 para lo menor.
- [ ] **Step 4:** Commit

```bash
git add src/components/MobileTicketConfirm.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "$(cat <<'EOF'
Add mobile ticket-style confirmations for entity operations.

Clients, CRM users, and reservations get a rich success card on mobile.
EOF
)"
```
