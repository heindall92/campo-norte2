# Runbook operativo

1. Demo: `sofia@camponorte.demo` / `norte2026`. Reset WMS = `resetWmsSnapshot()`.
2. Cerrar demo en prod: `VITE_STRICT_AUTH=true` o `VITE_ALLOW_DEMO_AUTH=false`.
3. Migraciones: `supabase db push` (o CLI local) en orden `20260816*` → `20260820*`.
4. Incidente stock: no UPDATE del ledger. Ajuste = `ADJUSTMENT` firmado + conteo.
5. RF offline: al recuperar red, `flushRfOutbox`. Conflictos = rehacer tarea desde cola viva.
6. Copiloto: recomienda; **nunca** confirma pick/ship.
