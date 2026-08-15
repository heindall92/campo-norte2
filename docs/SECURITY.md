# Auditoría de seguridad — Campo Norte Growth OS

> Revisión interna del entorno de demostración antes de exponerlo.
> Alcance: autenticación, autorización (RLS), endpoints `/api`, tratamiento de
> datos personales y cabeceras de la aplicación desplegada.

**Estado:** 6 hallazgos. 6 corregidos en código. 3 acciones pendientes en los
paneles de Supabase y Vercel (no se pueden hacer desde el repositorio).

---

## Resumen de hallazgos

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | RLS permisiva: cualquier usuario autenticado leía y escribía toda la base | **Crítica** | Corregido |
| 2 | Escalada de privilegios: el rol se tomaba del `user_metadata` del propio registro | **Crítica** | Corregido |
| 3 | `/api/ai/chat` y `/api/ollama/chat` abiertos con `CORS: *` y sin autenticación | **Alta** | Corregido |
| 4 | El login de demo seguía activo aunque hubiera Supabase con datos reales | **Media** | Corregido |
| 5 | Contraseñas de demo fijadas en el código, sin forma de rotarlas | **Baja** | Corregido |
| 6 | Sin cabeceras de seguridad ni CSP; demo de marca indexable por buscadores | **Media** | Corregido |

Verificado además, sin hallazgos:

- **Sin superficie de inyección en el cliente.** Búsqueda sistemática de los
  sinks habituales de XSS y de evaluación dinámica de código en todo `src/`:
  cero coincidencias. El renderizado va siempre por JSX escapado.
- **Minimización de datos real en el scoring.** Al modelo de IA se le envían
  origen, campaña, ruta, nº de viajes, LTV y aperturas de email — nunca nombre,
  email, teléfono ni DNI (`src/lib/ai/lead-scoring.ts`).

---

## 1 · RLS permisiva sobre todos los datos operativos

**Riesgo.** Las políticas eran `for all to authenticated using (true)`. Cualquier
cuenta autenticada del proyecto Supabase podía leer y modificar leads, clientes,
reservas y facturas completos. Con el alta pública activada por defecto en
Supabase, un tercero podía registrarse y descargar la base de clientes íntegra,
incluidos datos identificativos. Brecha de confidencialidad con implicaciones
RGPD (arts. 5.1.f y 32).

**Corrección.** Políticas segregadas por rol, mediante funciones
`SECURITY DEFINER` (`mps_role`, `mps_is_team`, `mps_can_write`, `mps_is_admin`,
`mps_can_bill`):

| Rol | Lee operativo | Escribe | Borra | Facturación |
|---|---|---|---|---|
| `admin` | sí | sí | sí | sí |
| `booking` | sí | sí | no | sí |
| `ops` | sí | sí | no | no |
| `guide` | sí | no | no | no |
| `pending` | **no** | no | no | no |

## 2 · Escalada de privilegios en el alta de usuarios

**Riesgo.** El trigger `mps_handle_new_user` asignaba
`coalesce(new.raw_user_meta_data->>'role', 'ops')`. `raw_user_meta_data` lo
controla el cliente en la propia llamada de registro, de modo que bastaba con
registrarse enviando `{ role: 'admin' }` para nacer con permisos de
administrador. Además, el valor por defecto `'ops'` convertía cualquier alta en
miembro del equipo con acceso a todo.

**Corrección.** El rol de alta es siempre `pending`, que no concede ningún
acceso. La promoción es manual y solo la puede hacer un administrador. Se añade
además un `check` que restringe los valores válidos de la columna.

## 3 · Proxies de IA abiertos

**Riesgo.** Ambos endpoints respondían con `Access-Control-Allow-Origin: *`, sin
autenticación, sin límite de frecuencia y sin tope de tamaño. Con las claves
configuradas en el servidor (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …), cualquiera
que conociese la URL podía usarlos como pasarela gratuita contra esas cuentas.
Impacto económico directo y sin traza.

**Corrección** (`api/_lib/guard.ts`, aplicado a los dos endpoints):

- CORS restringido al origen del despliegue y a los dominios declarados en
  `ALLOWED_ORIGINS`. Nunca `*`.
- Se rechazan las peticiones sin `Origin` ni `Referer` — es decir, todo cliente
  que no sea un navegador en la propia app (`curl`, scripts).
- Límite de 20 peticiones por minuto y por IP (configurable con `AI_RATE_LIMIT`).
- Tope de 40 mensajes y 24.000 caracteres por petición.

> Limitación conocida: el contador de frecuencia vive en la memoria de la
> instancia serverless, así que el techo real es (límite × instancias calientes).
> Frena el abuso casual; para producción con volumen, moverlo a Redis/Upstash.

## 4 · Coexistencia del login de demo con datos reales

**Riesgo.** `allowLocalDemoAuth()` devolvía `true` por defecto en todos los
escenarios, también con Supabase configurado. La puerta con credenciales
incrustadas en el bundle seguía abierta sobre datos de producción.

**Corrección.** El atajo de demo y el backend real ya no pueden coexistir: si
hay `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, el login de demo se desactiva
solo, sin depender de que nadie recuerde poner un flag. `VITE_STRICT_AUTH=true`
se mantiene como interruptor duro.

## 5 · Credenciales de demo fijadas en el código

**Riesgo.** Bajo. Estas credenciales viajan en el bundle del cliente por
definición y solo abren datos semilla ficticios. El problema real era la
imposibilidad de rotarlas sin recompilar.

**Corrección.** `VITE_DEMO_PASSWORD` permite rotarlas por entorno, manteniendo el
valor actual como defecto para no romper el acceso ya compartido.

## 6 · Cabeceras de seguridad y exposición pública

**Riesgo.** El despliegue no enviaba ninguna cabecera de seguridad, y una demo
que reproduce la identidad de marca era indexable por buscadores.

**Corrección** (`vercel.json`): `X-Robots-Tag: noindex, nofollow, noarchive`,
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy`, `Strict-Transport-Security`, `Cache-Control: no-store` en
`/api/*`, y una **CSP estricta** (`script-src 'self'`, `object-src 'none'`,
`frame-ancestors 'none'`, `connect-src` limitado a la propia app y Supabase).

**Verificación de la CSP.** La aplicación se sirvió con esas cabeceras exactas y
se recorrieron el login, el cuadro de mando (con gráficas Recharts), facturación
y el ecosistema: **cero violaciones de CSP y cero errores de consola**.

---

## Pendiente — acciones fuera del repositorio

Estas tres no se pueden hacer desde el código y son imprescindibles antes de
conectar datos reales:

1. **Supabase → Authentication → Providers → Email:** desactivar
   *"Allow new users to sign up"*. El equipo se da de alta por invitación.
2. **Ejecutar el `schema.sql` actualizado** y promover al primer administrador:
   ```sql
   update public.mps_profiles set role = 'admin' where email = 'sofia@camponorte.demo';
   ```
   Sin este paso nadie ve nada — es el comportamiento correcto.
3. **Vercel → Environment Variables:** definir `ALLOWED_ORIGINS` con el dominio
   definitivo y mover las claves de IA a variables de servidor.

## Fuera de alcance de esta revisión

- Registro de actividad y trazas de auditoría sobre los datos (art. 30 RGPD).
- Cifrado en reposo a nivel de columna para los identificativos (DNI).
- Rotación automatizada de credenciales.
- Pruebas automatizadas de las políticas RLS.
