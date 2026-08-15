/**
 * Genera la versión desplegable de la demo móvil a partir del archivo fuente.
 *
 *   node docs/mobile-demo/build-public.mjs
 *
 * `docs/mobile-demo/index.html` lleva el JS en línea (así funciona con doble clic
 * y como artefacto de una sola pieza). La CSP de producción usa `script-src 'self'`,
 * así que para servirlo desde el dominio hay que sacar el script a su propio archivo:
 *
 *   public/mobile-demo/index.html  → documento completo con <head> y <script src>
 *   public/mobile-demo/app.js      → el mismo script, ya externo
 *
 * El CSS se queda en línea: la CSP permite `style-src 'unsafe-inline'`.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const SOURCE = resolve(here, "index.html");
const OUT_DIR = resolve(root, "public/mobile-demo");

const source = await readFile(SOURCE, "utf8");

const scriptMatch = source.match(/<script>\n([\s\S]*?)\n<\/script>/);
if (!scriptMatch) throw new Error("No se encontró el <script> en línea de la demo.");

const titleMatch = source.match(/<title>([\s\S]*?)<\/title>/);
const title = titleMatch ? titleMatch[1] : "Campo Norte · demo móvil";

const body = source
  .replace(scriptMatch[0], '<script src="./app.js" defer></script>')
  .replace(/<title>[\s\S]*?<\/title>\n?/, "")
  .replace(/<meta name="viewport"[^>]*>\n?/, "")
  .trim();

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<link rel="icon" href="/favicon.svg">
</head>
<body>
${body}
</body>
</html>
`;

await mkdir(OUT_DIR, { recursive: true });
await writeFile(resolve(OUT_DIR, "index.html"), html, "utf8");
await writeFile(
  resolve(OUT_DIR, "app.js"),
  `/* Generado desde docs/mobile-demo/index.html — no editar a mano.\n   Cambia el fuente y ejecuta: node docs/mobile-demo/build-public.mjs */\n${scriptMatch[1]}\n`,
  "utf8",
);

console.log(`public/mobile-demo/index.html  ${(html.length / 1024).toFixed(1)} kB`);
console.log(`public/mobile-demo/app.js      ${(scriptMatch[1].length / 1024).toFixed(1)} kB`);
