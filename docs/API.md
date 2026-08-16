# API — Campo Norte

No hay API WMS. El almacén corre en el navegador.

## Endpoints actuales (Vercel `api/`)

| Ruta | Rol |
|---|---|
| `POST /api/leads/ingest` | Ingesta de leads CRM |
| `GET\|POST /api/cron/rescore` | Decay / rescore (cron 06:00) |
| `POST /api/ai/chat` | Proxy IA (guard CORS + rate limit) |
| `POST /api/ollama/chat` | Proxy Ollama |
| `GET\|POST /api/auth/access-log` | Bitácora de accesos |

Guard: `api/_lib/guard.ts`. Service role **nunca** en `VITE_*`.

## WMS futuro

Cuando el ledger salga del cliente, las mutaciones críticas (pick, receive, ship, adjust) deberán:

- Ir autenticadas (sesión Supabase).
- Llevar `operationId` (uuid) idempotente.
- Escribir `wms_audit` + movement.
- Respetar RLS `org_id`.

Hasta Phase 2 de datos, **no** se inventa un `/api/wms/*` vacío.

## Observabilidad (brief 40) — contrato, no código

Hoy: `console` de navegador y errores de Data Hub en UI. Sin correlation id.

Objetivo, al abrir Phase 11 / endurecer API:

| Campo | Uso |
|---|---|
| `operationId` | Una mutación de stock (pick, putaway, adjust) |
| `correlationId` | Request HTTP (`x-correlation-id` o generado en `guard.ts`) |
| `orgId` / `actor` | Tenant + usuario |
| `level` | `info\|warn\|error` estructurado (JSON line) |

No se añade un SaaS de APM en Phase 0. Las funciones de dominio ya devuelven `{ ok: false, error }`: ese código es la traza de negocio; el log solo la envuelve.
