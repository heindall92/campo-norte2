# Despliegue — Campo Norte

## Stack

- Front: Vite → `dist/` en **Vercel** (`vercel.json`).
- API: funciones en `api/` (mismo proyecto).
- Auth + CRM: **Supabase**.
- WMS: **localStorage del navegador** (no hay deploy de stock).

## Variables

Ver `.env.example`.

| Clave | Dónde |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Cliente |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor |
| `VITE_STRICT_AUTH` / `VITE_ALLOW_DEMO_AUTH` | Cerrar demo |
| `VITE_DEMO_PASSWORD` | Rotar demo |
| `ALLOWED_ORIGINS`, `AI_RATE_LIMIT`, `CRON_SECRET` | API |
| Claves IA | Servidor, no `VITE_*` en prod |

Login demo: `sofia@camponorte.demo` / `norte2026` (marta@, luis@, jorge@).

## Cabeceras

CSP, HSTS, noindex, frame deny: `vercel.json`. Cron leads: `0 6 * * *` → `/api/cron/rescore`.

## Producción WMS

No está lista. Falta ledger, RLS de stock, una sola copia de estado y no pisar demo con datos reales (`forceLocalHub`).

Checklist (Phase 14 del brief), no ejecutado:

1. Schema WMS aplicado por **migration**, no a mano.
2. Primer admin promovido en `mps_profiles`.
3. Alta pública de Supabase OFF.
4. Demo auth OFF.
5. `npm run build` + `npm test` verdes en CI.

## Nunca

- Editar el SQL de producción sin archivo `supabase/migrations/YYYYMMDDHHMMSS_*.sql`.
- Poner service role en el bundle.
