# Huella dactilar y fichaje — honestidad técnica

El SaaS corre en el **navegador**. Un navegador no habla el protocolo ZKTeco
(TCP/UDP **4370**) ni lee el sensor de un terminal de pared. No se fabrica
una “lectura de huella” en JavaScript.

## Qué hay hoy en Campo Norte

- Enrolamiento de **PIN de 4–6 dígitos** por operario (hash local). Sirve para
  picking y para marcar entrada/salida. **No es plantilla biométrica.**
- `ingestAdapterPunch`: el backend/agente local puede empujar un punch ya
  ocurrido (`operatorId`, `entrada|salida`, `at`, `deviceId`).
- Las plazas «Alta pendiente» no fichan: no tienen identidad.

## Qué existe en GitHub (open source real)

| Repo | Uso |
|---|---|
| [fananimi/pyzk](https://github.com/fananimi/pyzk) | Librería Python no oficial ZKTeco: usuarios, plantillas, `get_attendance()`, captura en vivo |
| [adrobinoga/zk-protocol](https://github.com/adrobinoga/zk-protocol) | Especificación del protocolo standalone |
| [adrobinoga/pyzatt](https://github.com/adrobinoga/pyzatt) | Cliente Python alineado al protocolo |
| [sowrensen/zkconnect](https://github.com/sowrensen/zkconnect) | Microservicio que reenvía asistencia ZKTeco a una API |

Patrón correcto: **agente en la LAN del almacén** (Python/`pyzk`) → HTTP al
SaaS → `ingestAdapterPunch`. El rol del operario (picker, recepción, etc.)
decide qué secciones ve el SaaS; el terminal solo identifica a la persona.

## Flota / cargador de pared

Misma regla: el dashboard **no inventa** el % de batería desde el enchufe.
Jungheinrich ISM, Toyota I_Site o Crown InfoLink son APIs de fabricante que
aún no están conectadas. Hoy: asignación de cargador + reporte manual.
