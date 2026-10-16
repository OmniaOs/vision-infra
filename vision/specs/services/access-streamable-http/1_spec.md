# Especificación Técnica: MCP por Streamable HTTP en access

## Metadata

```yaml
status: pending
version: 2
last_updated: 2026-10-16
category: services
```

## Alcance

El alcance es exactamente el de `0_contract.md` § Alcance: nuevo
`memory/access/streamable.mjs` y su prueba, y en `server.mjs` solo los dos
puntos de enganche y la opción `allowedOrigins`. `policy.mjs`,
`mcp-client.mjs`, las ramas SSE, la rama de admin (líneas 275-281) y `proxy()`
no se modifican. Esta entrega solo escribe los cuatro documentos.

## Diseño

Adaptador stateless, separado de las rutas SSE: recibe un objeto JSON-RPC 2.0
por POST, lo valida y autoriza, y para requests con `id` abre una sesión SSE
upstream efímera siguiendo el patrón de `mcp-client.mjs`. Nunca entrega el
stream upstream al cliente ni conserva la sesión.

## 1. Enrutado por host

El host se resuelve como hoy (`routes.find((r) => r.hosts.includes(host))`).
"Ruta del adaptador" es exactamente:

| Ruta (`route.name`) | Path (exacto) | Método | Resultado |
|---|---|---|---|
| `mem0` (`memory.*`) | `^/mcp/([a-z0-9][a-z0-9_-]{0,31})$`, segmento ≠ `messages` | `POST` | Adaptador Mem0 |
| `mem0` | ídem | `OPTIONS` | Preflight (§3) |
| `mem0` | ídem | otro (`GET`, `DELETE`, …) | `405 {"error":"method_not_allowed"}`, `Allow: POST, OPTIONS` |
| `knowledge` (`kb.*`) | `/mcp` | `POST` | Adaptador KB |
| `knowledge` | `/mcp` | `OPTIONS` | Preflight (§3) |
| `knowledge` | `/mcp` | `GET` | **No es del adaptador**: SSE legado, sin cambios |
| `knowledge` | `/mcp` | otro | `405`, `Allow: POST, OPTIONS` |
| `knowledge` | `^/mcp/.+` | `POST`, `OPTIONS` | `404 {"error":"not_found"}`, sin upstream |
| `knowledge` | `^/mcp/.+` | `GET` | `404 {"error":"not_found"}`, sin upstream (no hay stream legado bajo `/mcp/...`) |
| `knowledge` | `^/mcp/.+` | otro | `405`, `Allow: POST, OPTIONS` |

Decisiones sobre hosts cruzados:

- **`POST /mcp` en `memory.*`** no es ruta del adaptador (no hay espacio). Cae
  en la rama existente "cualquier otra ruta" y nunca llega a upstream: sin
  token `401`; con token no admin y enforcement `403
  {"error":"forbidden","reason":"ruta_no_permitida"}`; en auditoría se registra
  `would_deny:ruta_no_permitida` y responde `404` porque `/mcp` no empieza por
  `/mcp/` (`route.allow`); admin `404` (líneas 277-278).
- **`POST /mcp/<espacio>` en `kb.*`** lo responde el adaptador con `404` tras
  autenticar, en cualquier modo y rol, sin upstream. Es un cambio deliberado:
  hoy, en auditoría o como admin, se reenviaría al backend KB; ningún cliente
  legítimo usa esa ruta (el SSE de KB es `GET /mcp` + `POST /messages/`).
- `/mcp/messages` en `memory.*` sigue siendo la ruta legada de mensajes; un
  alias de namespace llamado `messages` no puede usarse por Streamable HTTP (se
  usa el nombre canónico del espacio). Paths que no coinciden exactamente (p.
  ej. con barra final o más segmentos) no son del adaptador y conservan su
  comportamiento actual.
- El host del panel y hosts desconocidos no cambian.

## 2. Orden de procesamiento

**Enganche A** — en `server.mjs`, después de resolver `route` (línea 194) y del
bloque del panel, antes de validar el Bearer (línea 234), solo para rutas del
adaptador:

1. `OPTIONS` → preflight (§3) y fin. No exige Bearer, no cuenta para rate limit
   ni para el límite de intentos fallidos, nunca abre upstream.
2. `POST` sin `Authorization: Bearer` válido → `401` del código común, antes de
   evaluar `Origin`: un POST anónimo con `Origin` ajeno recibe `401`, no `403`,
   para no revelar el allowlist a no autenticados.
3. `POST` con token válido + `Origin` fuera del allowlist (o `"null"`) → `403
   {"error":"forbidden","reason":"origin_no_permitido"}` sin cabeceras CORS.
4. Si `Origin` está permitido, se fijan con `res.setHeader` las cabeceras CORS
   de respuesta (§3) para que también acompañen a `401`/`429` emitidos por el
   código común. `Vary: Origin` se fija siempre.

**Código común sin cambios**: Bearer (`401` + `WWW-Authenticate: Bearer`,
`429` por intentos fallidos), `users.touch`, rate limit (`429`).

**Enganche B** — después del rate limit (línea 249) y de la comprobación
`%2f|%5c` (línea 261), **antes de la rama de admin** (línea 277):

4. Path/método: `404` para `kb.*` `/mcp/...` (`POST`, `OPTIONS` y `GET`); `405` para el resto de métodos no permitidos (tabla de §1).
5. `Content-Type` debe ser `application/json` (parámetros como `charset`
   permitidos, comparación sin mayúsculas) → si no, `415
   {"error":"unsupported_media_type"}`. `Accept` no se valida: la respuesta
   siempre es `application/json`.
6. `readBody` con `BODY_LIMIT` (256 KiB): `413
   {"error":"cuerpo_demasiado_grande"}` o `400 {"error":"cuerpo_ilegible"}`.
7. Estructura (§4): `400`.
8. Política (§5): `403` en enforcement, `would_deny` en auditoría.
9. Notificación → `202`; request → puente (§6).

Todos los pasos 1-8 terminan sin ninguna conexión upstream.

## 3. Origin y CORS

**Allowlist.** Variable de entorno `ACCESS_ALLOWED_ORIGINS`: lista separada
por comas de orígenes exactos `esquema://host[:puerto]` (sin ruta, sin barra
final, sin comodines). El arranque la parsea entrada por entrada con `try/catch`:
una entrada malformada se descarta con `AVISO` en stderr y nunca tumba el
gateway. Pasa a minúsculas y descarta con `AVISO` las entradas cuya
`new URL(o).origin !== o` o que sean `*` o `null`. Se entrega a `createGateway({ allowedOrigins })` (por defecto vacío).
Vacía o ausente = ningún navegador permitido; los clientes sin `Origin`
siguen funcionando. Comparación: igualdad exacta del header `Origin` en
minúsculas contra la lista.

**Preflight** (`OPTIONS` en ruta del adaptador; en `kb.*` `/mcp/...` → `404`):

| `Origin` | Respuesta |
|---|---|
| En allowlist | `204` con `Access-Control-Allow-Origin: <origin>`, `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Allow-Headers: authorization, content-type, accept, mcp-protocol-version`, `Access-Control-Max-Age: 600`, `Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers` |
| Ajeno o `null` | `403 {"error":"forbidden","reason":"origin_no_permitido"}`, sin `Access-Control-*`, `Vary: Origin` |
| Ausente | `204` con `Allow: POST, OPTIONS` y `Vary: Origin`, sin `Access-Control-*` |

**Respuestas a POST** (cualquier estado, incluidos `401`, `403`, `4xx`, `5xx`
emitidos tras el paso 2): con `Origin` permitido llevan
`Access-Control-Allow-Origin: <origin>`, `Access-Control-Expose-Headers:
WWW-Authenticate, Retry-After` y `Vary: Origin`; sin `Origin`, solo `Vary:
Origin`. Nunca `Access-Control-Allow-Origin: *` ni
`Access-Control-Allow-Credentials` (el Bearer es un header explícito, no una
cookie).

## 4. Validación del cuerpo

Aplica en cualquier modo de enforcement y para cualquier rol (incluido admin):
sin un único mensaje bien formado no hay `id` que correlacionar.

| Condición | Respuesta |
|---|---|
| No es JSON | `400 {"error":"invalid_json"}` |
| Arreglo en la raíz (vacío, 1 o más elementos) | `400 {"error":"invalid_rpc","reason":"batch_no_soportado"}` |
| No es objeto, o `jsonrpc !== "2.0"` | `400 {"error":"invalid_rpc","reason":"mensaje_invalido"}` |
| Sin `method` (respuesta del cliente con `result`/`error`) | `400 {"error":"invalid_rpc","reason":"respuesta_no_soportada"}` (no hay solicitud del servidor pendiente) |
| `method` no es string no vacío, o `params` presente y no es objeto/arreglo (`params` ausente es válido: `initialize`, `ping`, `tools/list` lo omiten) | `400 {"error":"invalid_rpc","reason":"mensaje_invalido"}` |
| `id` presente y no es string ni número (incluido `null`) | `400 {"error":"invalid_rpc","reason":"id_invalido"}` |
| `id` string que empieza por `omnia-init-` | `400 {"error":"invalid_rpc","reason":"id_reservado"}` |

El arreglo se detecta sobre el JSON crudo, antes de `parseRpc` (que envolvería
un objeto y aceptaría arreglos de hasta 50). Después se llama a
`parseRpc(raw)` para obtener `msgs` de longitud 1 y reutilizar exactamente la
entrada que esperan las funciones de política.

## 5. Autorización y política

**Mem0** (`seg` = segmento del path):

1. `decide(checkMem0Connect(user, seg))`.
2. `space = spaceFromMem0(seg)`; `decide(checkMem0Rpc(user, space, msgs))`.
3. Namespace upstream: `canonicalMem0Namespace(seg)` (alias e `omnia-global` ↔
   `global` llegan a los mismos datos que por SSE).

**KB**: `decide(checkKbRpc(user, msgs))`; cada `tools/call` exige `project`
permitido y conserva todas las restricciones de herramientas y argumentos.

Las comprobaciones se evalúan en orden y la primera denegación fija la razón;
por request se registra como máximo una entrada (`pol` y `noteWouldDeny`): tras
la primera denegación en auditoría se salta directo al paso 9 sin más
comprobaciones (así `checkMem0Connect` + `checkMem0Rpc` no generan dos
entradas).

**Modo de enforcement.** Se consulta `isEnforcing()` (`aliasStore.enforce`,
inicializado con `ACCESS_ENFORCE === '1'`) en el momento de decidir, con el
mismo `decide()` del gateway. La decisión se toma completa antes de abrir
cualquier conexión upstream:

| Modo | Política deniega | Efecto |
|---|---|---|
| Enforcement | sí | `403 {"error":"forbidden","reason":"<razón>"}`, `pol=deny:<razón>`, cero conexiones upstream |
| Auditoría | sí | `pol=would_deny:<razón>`, `noteWouldDeny({t, dev, route, reason})`; la request continúa al paso 9 sin más comprobaciones, como si estuviera permitida, y la respuesta es la del upstream (la razón no se expone al cliente) |
| Cualquiera | no | continúa al paso 9 |

Así, para el mismo mensaje, Streamable HTTP y SSE dan el mismo resultado en
ambos modos y el contador `would_deny` del panel mide los dos transportes. En
auditoría con un namespace Mem0 desconocido se usa el segmento tal cual
(`canonicalMem0Namespace` lo deja pasar), igual que el SSE.

**Admin.** No hay rama de bypass: el adaptador se engancha antes de la rama de
admin de `server.mjs` y el admin recorre los pasos 1-9 completos. Las únicas
diferencias son las que ya codifica `policy.mjs`:

- `checkMem0Connect`: cualquier namespace válido para el regex del path.
- `checkMem0Rpc`: cualquier método; `tools/call` sigue limitado a las
  herramientas conocidas de Mem0 (incluida `delete_all_memories`).
- `checkKbRpc`: cualquier método, herramienta y argumento.

Allowlist de rutas para admin (y para todos) = las rutas del adaptador de §1,
subconjunto de `route.allow` (`['/mcp/']` en Mem0, `['/']` en KB). El admin no
obtiene en este transporte ningún otro path del backend.

**Siempre:** `users.touch`, rate limit y log de `server.mjs` (`pol` en la línea
de log) se mantienen; el token del dev nunca sale hacia upstream.

## 6. Puente upstream (un saludo por request)

Conexión, por cada request con `id` que superó los pasos 1-8:

- Base `route.upstream`. Headers construidos desde cero: `accept:
  text/event-stream` (GET) o `content-type: application/json` (POST),
  `authorization: route.upstreamAuth` si existe y `x-omnia-dev: <user.id>`. No
  se copian headers del cliente (`Authorization`, `Cookie`, `Origin`,
  `Mcp-*`).
- GET SSE: Mem0 `/mcp/streamable/sse/<namespace canónico>` (cliente fijo
  `streamable`, válido para `[a-z0-9_-]{1,32}`); KB `/mcp`. Estado distinto de
  `200` → `502`.
- Esperar el evento `endpoint`; resolverlo con `new URL(data.trim(),
  route.upstream)`. Si su origen difiere del de `route.upstream` → `502` sin
  hacer ningún POST.
- Un único `AbortController` y un plazo total `ACCESS_STREAMABLE_TIMEOUT_MS`
  (por defecto 20000, como `mcp-client.mjs`) cubren GET, POSTs y esperas.

Saludo y reenvío según el método del cliente:

| Mensaje del cliente | Secuencia upstream |
|---|---|
| `initialize` (con `id`) | POST del mensaje del cliente tal cual (su `id`, `protocolVersion`, `capabilities`, `clientInfo`) → esperar respuesta con ese `id` → responder. Sin saludo interno ni `notifications/initialized`. |
| Otro request (con `id`) | POST `{"jsonrpc":"2.0","id":"omnia-init-<16 hex aleatorios>","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"omnia-access-streamable","version":"1"}}}` → esperar respuesta con ese `id` (si trae `error` → `502 {"error":"upstream_handshake_failed"}`) → POST `{"jsonrpc":"2.0","method":"notifications/initialized"}` → POST del mensaje del cliente sin cambios → esperar respuesta con el `id` del cliente. |
| Notificación (sin `id`) | Ninguna: `202` sin cuerpo tras el paso 8. La sesión upstream que podría afectar no existe (cada request tiene la suya y el puente ya envía `notifications/initialized` en su saludo). |

Correlación de `id`:

- El `id` del cliente se reenvía sin alterar valor ni tipo; el `id` del saludo
  lleva el prefijo reservado `omnia-init-` (que el paso 7 prohíbe al cliente),
  así que nunca colisionan.
- Un evento SSE `message` es la respuesta esperada solo si su `data` es un
  objeto JSON sin `method`, con `result` o `error`, y con `id` estrictamente
  igual (mismo tipo y valor: `1` ≠ `"1"`) al esperado.
- Notificaciones del servidor, requests del servidor (no hay canal para
  contestarlas), respuestas a otros `id` y eventos ilegibles se descartan y no
  extienden el plazo.
- La respuesta al cliente es `200 application/json` con ese objeto JSON-RPC
  serializado sin cambios, aunque contenga `error` JSON-RPC (error de
  aplicación, no de transporte). Nunca se envía `Mcp-Session-Id`.

Cierre: en éxito, error, timeout o `close` del cliente se aborta el
`AbortController` (GET SSE y POSTs pendientes). No se registra nada en
`sessions`; revocar un token surte efecto en el siguiente POST porque la
autenticación es por request.

Fallos: error de red, GET no `200`, SSE cerrado antes de la respuesta, POST
upstream con estado fuera de `2xx` o `endpoint` de otro origen → `502
{"error":"upstream_unreachable"}`; plazo vencido → `504
{"error":"upstream_timeout"}`.

## 7. Errores

| Condición | Estado | Cuerpo | Antes de upstream |
|---|---:|---|---|
| Sin token o token inválido (se evalúa antes que `Origin` en `POST`) | 401 | `{"error":"unauthorized"}` + `WWW-Authenticate: Bearer` | sí |
| `Origin` ajeno o `null` | 403 | `{"error":"forbidden","reason":"origin_no_permitido"}` | sí |
| Intentos fallidos / rate limit | 429 | `{"error":"too_many_requests"}` + `Retry-After: 60` | sí |
| `kb.*` `/mcp/...` | 404 | `{"error":"not_found"}` | sí |
| Método no soportado | 405 | `{"error":"method_not_allowed"}` + `Allow: POST, OPTIONS` | sí |
| `Content-Type` no JSON | 415 | `{"error":"unsupported_media_type"}` | sí |
| Cuerpo > 256 KiB | 413 | `{"error":"cuerpo_demasiado_grande"}` | sí |
| JSON / JSON-RPC inválido, batch, id inválido o reservado | 400 | §4 | sí |
| Política (enforcement) | 403 | `{"error":"forbidden","reason":"<razón>"}` | sí |
| Saludo upstream con error | 502 | `{"error":"upstream_handshake_failed"}` | — |
| Upstream caído, SSE sin respuesta, endpoint de otro origen | 502 | `{"error":"upstream_unreachable"}` | — |
| Plazo vencido | 504 | `{"error":"upstream_timeout"}` | — |

Ningún cuerpo de error incluye Bearer, URL interna, `session_id` upstream ni
credenciales.

## 8. Compatibilidad

Las rutas SSE no se modifican ni comparten estado con el adaptador: en
`memory.*` `GET /mcp/<cliente>/sse/<ns>`, `POST /mcp/messages` y `POST
/mcp/<cliente>/sse/<ns>/messages`; en `kb.*` `GET /mcp` y `POST /messages/`.
Cambian solo paths que hoy no prestan servicio: en `memory.*` cualquier método
sobre `/mcp/<espacio>` (hoy `403` o reenvío ciego) y en `kb.*` los métodos no
`GET` sobre `/mcp` y `POST|OPTIONS /mcp/...`.

Mem0 se trata como no autenticado por sí mismo: su aislamiento depende del
gateway. KB conserva la lista blanca estricta porque sus argumentos y URLs
pueden referir otros proyectos. El backend SSE responde `initialize` con la
versión de protocolo que soporta (p. ej. `2024-11-05`); el adaptador la
transmite tal cual al cliente solo cuando el cliente envió `initialize`
(único caso con saludo real). En el resto de requests el saludo interno se
descarta tras correlacionar y la versión del backend no se expone.

## 9. Configuración nueva

| Variable | Defecto | Uso |
|---|---|---|
| `ACCESS_ALLOWED_ORIGINS` | vacío | Allowlist de `Origin` (§3) |
| `ACCESS_STREAMABLE_TIMEOUT_MS` | `20000` | Plazo total del puente por request (§6) |
