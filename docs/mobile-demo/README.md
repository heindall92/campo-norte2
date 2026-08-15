# Demo de la vista móvil — Campo Norte Growth OS

`index.html` es una maqueta **interactiva y autocontenida** (sin build, sin dependencias) de la app móvil
del CRM. Sirve para enseñar la experiencia de campo en una reunión sin levantar el proyecto Vite.

Para llevar esto al CRM real: [`IMPLEMENTACION.md`](./IMPLEMENTACION.md) — plan por tareas sobre
`src/`, pensado para dárselo a Cursor o a Claude Code.

## Abrir

```bash
open docs/mobile-demo/index.html      # macOS
xdg-open docs/mobile-demo/index.html  # Linux
```

En escritorio se ve dentro de un marco de teléfono con un carril de herramientas
(plataforma · tema · acento · idioma) y notas de diseño. Por debajo de 900 px el marco desaparece
y la app ocupa toda la pantalla, con `env(safe-area-inset-*)` aplicado.

## Qué demuestra

| Bloque | Contenido |
|---|---|
| Inicio | Próxima salida con cuenta atrás, bento de 4 KPI, cola «prioridad de hoy», accesos rápidos, carrusel del ecosistema |
| Leads | Cola ordenada por scoring, filtros por estado, ficha con motivos y «reclasificar con IA» simulada |
| Clientes | Buscador, cola «contactar este mes», segmentos, ficha 360º con historial |
| Reservas | Tarjetas con progreso de cobro, itinerario en línea de tiempo y contactos de logística |
| Cuenta | Perfil, ajustes agrupados, tema/acento/idioma/plataforma en vivo |
| Apilados | Facturas (REAV 05 · Veri*FACTU), Ecosistema CRM con traza de A-01 y resumen del resto de módulos |

Patrones nativos: **iOS** (título grande que colapsa, barra flotante de cristal, hoja con tirador,
isla dinámica para los avisos) y **Android** (barra Material 3 anclada con pastilla, FAB, snackbar
inferior). Gestos: arrastrar para recargar el Hub y arrastrar el tirador para cerrar hojas.

## Datos

Semilla del repo (`src/lib/demo-data.ts`, `src/lib/ops-data.ts`): mismos leads, clientes, reservas y
facturas que el CRM en modo local. Son datos ficticios y ninguna acción sale hacia el viajero.

## Publicar en el dominio

`docs/mobile-demo/index.html` lleva el JS en línea, y la CSP de producción (`vercel.json`) usa
`script-src 'self'`. El generador saca el script a su propio archivo y escribe la versión desplegable:

```bash
npm run demo:mobile
```

Salida (versionada, **no editar a mano**):

```
public/mobile-demo/index.html   documento completo, script externo
public/mobile-demo/app.js       el mismo script, servido como archivo
```

Vite copia `public/` a `dist/`, así que tras `npm run build` la demo queda en
`https://example.com/mobile-demo/`. Edita siempre el fuente de `docs/` y vuelve a ejecutar el
comando; verificado sirviéndolo con la cabecera CSP real: sin violaciones ni errores de consola.
