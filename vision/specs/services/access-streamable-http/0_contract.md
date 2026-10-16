# Feature: MCP por Streamable HTTP en access

## Metadata

```yaml
status: pending
created: 2026-10-16
last_updated: 2026-10-16  # ronda 2 de revisión
dependencies: memory/access/server.mjs, policy.mjs y mcp-client.mjs existentes
```

## Propósito

Como cliente MCP moderno quiero enviar JSON-RPC por Streamable HTTP al gateway
`access`, para usar Mem0 y Basic Memory sin depender del transporte SSE legado.
El gateway conservará la misma identidad, aislamiento de espacios, política y
modo de enforcement que ya aplica al acceso SSE.

## Alcance

Esta carpeta es solo especificación: entregarla no modifica código. Este es el
único alcance de la feature; `1_spec.md` lo detalla sin ampliarlo.

Cuando se implemente, la implementación:

- **Agrega** `memory/access/streamable.mjs` (adaptador HTTP y puente upstream) y
  `memory/access/streamable.test.mjs`.
- **Modifica** `memory/access/server.mjs` solo para: (a) enganchar el adaptador
  en dos puntos del handler (antes de validar el Bearer, para `OPTIONS` y
  `Origin`; y después del rate limit y antes de la rama de admin, para el POST),
  y (b) recibir el allowlist de orígenes (`ACCESS_ALLOWED_ORIGINS` →
  opción `allowedOrigins` de `createGateway`). Las ramas SSE existentes, la rama
  de admin y `proxy()` no cambian.
- **Reutiliza sin modificar** `policy.mjs` (`parseRpc`, `checkMem0Connect`,
  `checkMem0Rpc`, `checkKbRpc`, `spaceFromMem0`, `canonicalMem0Namespace`) y la
  función `decide()`/`isEnforcing()` del gateway.
- **Toma como patrón, sin modificarlo**, `mcp-client.mjs` (abrir SSE, esperar
  `endpoint`, saludo `initialize` + `notifications/initialized`, POST y espera
  correlacionada). No se importa: su `mcpRequest` es interno, usa ids fijos
  (`1`, `2`) y devuelve solo `result`, y el puente necesita reenviar el mensaje
  y la respuesta JSON-RPC completos.

No incluye: cambios a `policy.mjs`, `mcp-client.mjs`, `memory-service.mjs` ni
al backend Mem0/KB; WebSocket; sesiones (`Mcp-Session-Id`); streams SSE hacia
el cliente (GET); batch; ni reemplazar o migrar el SSE existente.

## Rutas por host

El gateway enruta por `Host` (`routesFromEnv`): `memory.<dominio>`
(`MEM0_HOSTS`, ruta `mem0`) y `kb.<dominio>` (`KB_HOSTS`, ruta `knowledge`).

| Host | Ruta del adaptador | Métodos | Upstream por request |
|---|---|---|---|
| `memory.*` | `/mcp/<espacio>` (un segmento, distinto de `messages`) | `POST`, `OPTIONS`; otros → `405` | `GET /mcp/streamable/sse/<namespace canónico>` |
| `kb.*` | `/mcp` | `POST`, `OPTIONS`; `GET` sigue siendo el SSE legado | `GET /mcp` (SSE de Basic Memory) |
| `kb.*` | `/mcp/<lo que sea>` | `POST`, `OPTIONS` → `404` | ninguno |
| `memory.*` | `/mcp` (sin espacio) | no es del adaptador | ninguno (`401`, luego `403`/`404`) |

## Escenarios

**A — Mem0 autorizado.** Un token con acceso hace
`POST https://memory.<dominio>/mcp/proy-vision-infra` con un request JSON-RPC
permitido. El gateway resuelve el alias al espacio, aplica
`checkMem0Connect` y `checkMem0Rpc`, abre una sesión upstream efímera con su
propio saludo y entrega la respuesta JSON-RPC con el mismo `id` del cliente.

**B — KB autorizado.** Un token válido hace `POST https://kb.<dominio>/mcp`
con `tools/call` cuyo `project` pertenece a un espacio autorizado. `checkKbRpc`
se evalúa por request, incluido el bloqueo de `project_id`, `workspace`,
`search_all_projects` y URLs `memory://` de otro proyecto.

**C — Sin token.** Si falta o no valida `Authorization: Bearer`, responde
`401` con `WWW-Authenticate: Bearer` y nunca abre SSE upstream.

**D — Espacio ajeno (enforcement).** Con `ACCESS_ENFORCE=1`, si el namespace
Mem0 o el proyecto KB no pertenece al token, responde `403` con la razón de la
política y no contacta el backend.

**E — Modo auditoría.** Con `ACCESS_ENFORCE` distinto de `1`, la misma
denegación se registra como `would_deny:<razón>` (log y contador del panel)
antes de abrir upstream, y la request sigue como si estuviera permitida, igual
que en SSE. La respuesta la decide siempre el modo vigente al evaluar.

**F — Batch.** Un cuerpo JSON que es un arreglo (de cualquier longitud) da
`400 {"error":"invalid_rpc","reason":"batch_no_soportado"}` en cualquier modo y
rol, sin upstream; aunque `parseRpc` acepte hasta 50 mensajes.

**G — Navegador.** Un `Origin` del allowlist (`ACCESS_ALLOWED_ORIGINS`) recibe
preflight `OPTIONS` sin Bearer y cabeceras CORS con ese origen exacto y
`Vary: Origin`; uno ajeno da `403` sin cabeceras CORS. Sin `Origin` (Claude
Code, curl) se atiende con el token. En `POST`, un `Origin` ajeno sin token
válido da `401` (no `403`): la pertenencia al allowlist no se revela a no
autenticados.

**H — Admin.** Un admin pasa por el mismo flujo y las mismas funciones de
`policy.mjs` (sin la rama de bypass del SSE); solo aplican las excepciones de
admin que esas funciones ya codifican y el allowlist de rutas del adaptador.

**I — Notificación.** Un mensaje válido sin `id` pasa auth, `Origin`,
estructura y política y recibe `202` sin cuerpo; no abre upstream.

**J — Host cruzado.** `POST /mcp` en `memory.*` y `POST /mcp/<espacio>` en
`kb.*` nunca llegan a un backend (ver tabla).

**K — Compatibilidad.** Las rutas SSE existentes (`GET /mcp/<cliente>/sse/<ns>`,
`POST /mcp/messages`, `POST /mcp/<cliente>/sse/<ns>/messages` en `memory.*`;
`GET /mcp` y `POST /messages/` en `kb.*`) mantienen su semántica.

## Invariantes

- Cada POST es independiente: sin `session_id`, `Mcp-Session-Id`, estado ni
  SSE expuesto al cliente; nada queda registrado en el mapa `sessions`.
- Cada request con `id` abre su propia sesión upstream, hace su propio saludo y
  la cierra al terminar (éxito, error, timeout o desconexión del cliente).
- El `id` del cliente viaja sin cambios y la respuesta se correlaciona por
  igualdad estricta de `id`; el saludo usa un `id` reservado del gateway que un
  cliente no puede usar.
- El Bearer del dev no se reenvía; el upstream recibe solo `route.upstreamAuth`
  y `x-omnia-dev`.
- Autenticación, estructura y política se evalúan completas antes de abrir
  cualquier conexión upstream.
- `Origin`, `401`, `400`, `413`, `415`, `404`, `405` y `429` (rate limit /
  intentos) no son política: se aplican en cualquier modo de enforcement y
  para cualquier rol.
- Un `Origin` presente debe estar en el allowlist; nunca se refleja un origen
  arbitrario, nunca `*`, nunca credenciales CORS. `Origin` no sustituye al
  Bearer.
- Los errores son JSON estables, sin Bearer, URL interna ni credenciales.

## Fuera de alcance

- Modificar `policy.mjs`, `mcp-client.mjs`, `memory-service.mjs`, las ramas SSE
  o la rama de admin de `server.mjs`, o el backend.
- Cambiar el protocolo SSE actual, sus URLs, o migrar clientes ya instalados.
- Batch, respuestas SSE al cliente, GET de stream del servidor y sesiones.
- Validar `Origin` en las rutas SSE legadas.

## Hecho

La feature estará lista para implementar cuando los cuatro documentos de esta
carpeta describan de forma consistente rutas por host, orden de validación,
CORS, modo auditoría, reglas de admin, puente upstream (saludo y correlación),
errores, notificaciones y compatibilidad SSE, con el alcance de esta sección.
