# El lazo cerrado de leads — qué es real y cómo encenderlo

Este documento describe el camino por el que un lead entra, se puntúa y se
ordena **sin que nadie toque nada**. Todo corre en Vercel dentro de este mismo
repositorio: no hay n8n, no hay servidor aparte y no cambia la URL de la app.

## Qué hace hoy, exactamente

```
formulario  →  POST /api/leads/ingest  →  Supabase  →  la app lo muestra
                       │
                       ├─ valida (email, ruta, vehículo, longitudes)
                       ├─ deduplica por email (segundo envío = fusión, no ficha nueva)
                       ├─ cruza con la cartera de clientes
                       ├─ puntúa con el MISMO motor que la interfaz
                       ├─ asigna responsable (referido o ≥85 → Sofía; resto → Marta)
                       └─ deja constancia en mps_run_log

todas las mañanas  →  GET /api/cron/rescore
                       ├─ repuntúa toda la cola con los datos de hoy
                       ├─ enfría por tiempo el orden de llamada
                       ├─ marca quién ha entrado en zona caliente (≥70 efectivo)
                       └─ avisa si la ingesta lleva más de 26 h muda
```

El scoring vive en `src/lib/ai/lead-scoring-core.ts` y lo importan **tanto la app
como las funciones de servidor**. Es deliberado: si el número de la pantalla y el
del servidor pudieran discrepar, el CRM no serviría para decidir nada.

### El decaimiento temporal

El orden de la cola no es el score guardado, sino el score **enfriado**:

```
efectivo = score × e^(−ln2 · días / 14)
```

A los 14 días sin tocarse, un lead vale la mitad; a los 28, la cuarta parte. El
score guardado **no se reescribe**: sigue siendo el número auditable con sus
razones. Lo que cambia es a quién llamas primero — que es la decisión real.

Esto se ve en la app: en «Prioridad de hoy» (móvil), en la cola de Leads y en el
cuadro de mando de escritorio, con una etiqueta «enfriado a N» cuando la
diferencia es apreciable.

---

## Encenderlo en 15 minutos

### 1 · Supabase (plan gratuito, sin tarjeta)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. SQL Editor → pega y ejecuta [`supabase/schema.sql`](../supabase/schema.sql)
   entero. Crea las tablas del Hub, las de resultados y bitácora, y la RLS.
3. Settings → API, copia:
   - **Project URL** → `SUPABASE_URL` y `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ solo servidor

> La `service_role` se salta la RLS. Nunca en una variable `VITE_`, nunca en el
> navegador, nunca en el repositorio.

### 2 · Variables en Vercel

Project → Settings → Environment Variables:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon public |
| `VITE_DATA_MODE` | `supabase` |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role |
| `LEADS_INGEST_SECRET` | `openssl rand -hex 32` |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | tu dominio de Vercel |

Vuelve a desplegar para que las tome.

### 3 · El reloj

Ya está declarado en `vercel.json`:

```json
"crons": [{ "path": "/api/cron/rescore", "schedule": "0 6 * * *" }]
```

El plan Hobby permite tareas diarias, que es justo lo que necesita un
re-scoring. Si algún día quieres más frecuencia sin pagar, el endpoint es
**agnóstico del reloj**: acepta `x-mps-key: <CRON_SECRET>` y lo puede disparar
GitHub Actions, `pg_cron` o un curl. No hay que tocar código.

---

## Comprobar que funciona

> En local, `npm run dev` sirve la app pero **no ejecuta las funciones de
> `api/`**: para probarlas en tu máquina usa `npx vercel dev`. En el despliegue
> de Vercel funcionan sin más.

**Formulario propio** (el que controlas): abre `https://<tu-app>/captura`,
envía, y verás el score que ha calculado el servidor con sus razones. El lead
aparece en el CRM.

**Integración externa** (lo que haría el formulario de example.com):

```bash
curl -X POST https://<tu-app>/api/leads/ingest \
  -H "Content-Type: application/json" \
  -H "x-mps-key: $LEADS_INGEST_SECRET" \
  -d '{"name":"Elena Ruiz","email":"elena@example.com",
       "interestRoute":"ARGENTINA_PUNA","vehicle":"4x4",
       "utmSource":"instagram","utmCampaign":"stories-puna"}'
```

Respuesta: la ficha creada con `score`, `priority`, `reasons` y `owner`.
Repite el mismo comando: la segunda vez responde `"merged": true` y **no** crea
ficha nueva.

**El reloj, a mano:**

```bash
curl -H "x-mps-key: $CRON_SECRET" https://<tu-app>/api/cron/rescore
```

Devuelve cuántos leads repuntuó, cuáles están calientes y la salud de la
ingesta.

---

## Lo que este lazo NO hace

Dicho explícitamente, para que nadie se lleve una sorpresa:

- **No escribe al viajero.** Ni email, ni WhatsApp, ni SMS. Crea la ficha y
  ordena la cola; el mensaje lo escribe una persona.
- **El límite de tasa es best-effort.** Vive en la memoria de cada instancia de
  Vercel, así que frena un script pesado pero no un ataque distribuido. Para eso
  haría falta almacenamiento compartido.
- **Si Supabase está caído, el lead no se guarda.** La función reintenta tres
  veces y responde `503` con `Retry-After` para que quien envía pueda reintentar.
  Una cola durable exigiría un almacén que no sea la propia base que ha fallado.
- **Brevo y Stripe todavía no entran.** El campo `brevoOpens` que usa el scoring
  viene de los datos de prueba hasta que se conecte la lectura de Brevo.
- **La tabla `mps_lead_outcomes` está creada pero vacía.** Es donde se anota si
  el lead acabó reservando. Hasta que se rellene no se puede medir si el scoring
  acierta — ni mejorarlo con datos en vez de con opiniones.

---

## Para la demostración

Si lo enseñas en una reunión, esta es la frontera honesta:

> «Los datos de la pantalla son de prueba y la app lo dice en la cabecera. Lo que
> es real es el motor: envío este formulario desde el móvil… y aquí está el lead,
> puntuado, con sus razones y con responsable asignado. El formulario de
> example.com solo tiene que apuntar a este mismo endpoint: es configuración, no
> desarrollo.»
