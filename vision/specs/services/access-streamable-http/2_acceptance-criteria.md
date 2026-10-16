# Criterios de Aceptación: MCP por Streamable HTTP en access

## Metadata

```yaml
version: 2
last_updated: 2026-10-16
```

### AC-001 — Mem0 responde por POST en su host

**Given** un token de dev con acceso a `proy-vision-infra`, **When** envía un
JSON-RPC permitido con `id` a `POST /mcp/proy-vision-infra` con
`Host: memory.<dominio>`, **Then** recibe `200 application/json` con una única
respuesta JSON-RPC con el mismo `id` (mismo tipo), y el backend Mem0 recibió
`GET /mcp/streamable/sse/<namespace canónico>` más sus POST al endpoint
anunciado, sin `Mcp-Session-Id` hacia el cliente.

### AC-002 — KB responde por POST en su host

**Given** un token autorizado y un `tools/call` con `project` permitido,
**When** hace `POST /mcp` con `Host: kb.<dominio>`, **Then** recibe `200` con
una única respuesta JSON-RPC; `checkKbRpc` se evaluó antes de abrir upstream y
el backend recibió `GET /mcp` sin el Bearer del dev.

### AC-003 — Host cruzado nunca llega al backend

**Given** un token válido, **When** hace `POST /mcp` en `memory.*`, **Then**
recibe `403 ruta_no_permitida` (no admin, enforcement) o `404` (auditoría o
admin). **When** hace `POST /mcp/proy-vision-infra` en `kb.*`, **Then** recibe
`404` en cualquier modo y rol. En ambos casos hay cero conexiones upstream.

### AC-004 — Sin token no hay upstream

**Given** cualquier ruta del adaptador, **When** falta el Bearer o es inválido,
**Then** responde `401` con `WWW-Authenticate: Bearer` y no se abre SSE ni POST
hacia el backend.

### AC-005 — Espacio ajeno cerrado en enforcement

**Given** `ACCESS_ENFORCE=1` y un token sin acceso al namespace Mem0 o al
proyecto KB, **When** hace el POST correspondiente, **Then** recibe `403
{"error":"forbidden","reason":...}` y ninguna conexión upstream es creada.

### AC-006 — Política por request

**Given** enforcement y un token de solo lectura que llama `add_memories`, o
una llamada KB con `project_id`, `workspace`, `search_all_projects` o una URL
`memory://` de otro proyecto, **When** llama por Streamable HTTP, **Then**
recibe `403` con la misma razón que daría `policy.mjs` en SSE.

### AC-007 — Modo auditoría

**Given** `ACCESS_ENFORCE` distinto de `1` y una request que la política
denegaría, **When** llega al adaptador, **Then** la línea de log lleva
`pol=would_deny:<razón>`, el contador `would_deny` del panel sube exactamente
una vez, la decisión se registra antes de abrir upstream y la respuesta es la
del backend (como en SSE). Con enforcement activado en caliente la misma
request da `403` sin upstream.

### AC-008 — Batch rechazado

**Given** un cuerpo que es un arreglo JSON (vacío, de 1 o de 2 a 50
elementos), **When** se envía a cualquier ruta del adaptador, **Then** responde
`400 {"error":"invalid_rpc","reason":"batch_no_soportado"}` en ambos modos y
para admin, sin upstream.

### AC-009 — Cuerpo inválido

**Given** JSON inválido, `jsonrpc` distinto de `"2.0"`, una respuesta del
cliente sin `method`, `id: null`, un `id` que empieza por `omnia-init-`, un
`Content-Type` no JSON o un cuerpo mayor a 256 KiB, **When** se procesa,
**Then** responde respectivamente `400`/`400`/`400`/`400`/`400`/`415`/`413` con
el cuerpo definido en la spec, en ambos modos y sin upstream.

### AC-010 — Origin en POST

**Given** `ACCESS_ALLOWED_ORIGINS=https://app.example`, **When** llega un POST
con `Origin: https://evil.example` y token válido, **Then** responde `403
origin_no_permitido` sin cabeceras `Access-Control-*` y sin upstream. Sin token
(aunque el `Origin` sea ajeno) responde `401` primero: no revela el allowlist.
Con `Origin: https://app.example` la respuesta (también si es `401`) lleva
`Access-Control-Allow-Origin: https://app.example`, `Vary: Origin` y
`Access-Control-Expose-Headers: WWW-Authenticate, Retry-After`. Sin `Origin`
se atiende con el token y lleva `Vary: Origin`. Nunca aparece `*` ni
`Access-Control-Allow-Credentials`.

### AC-011 — Preflight OPTIONS

**Given** un navegador, **When** envía `OPTIONS` sin Bearer a una ruta del
adaptador con `Origin` permitido, **Then** recibe `204` con los
`Access-Control-Allow-*`, `Max-Age: 600` y `Vary` definidos; con `Origin`
ajeno, `403` sin `Access-Control-*`; sin `Origin`, `204` con `Allow: POST,
OPTIONS`. Ningún caso abre upstream ni consume rate limit.

### AC-012 — Admin sin bypass

**Given** un token admin, **When** envía por Streamable HTTP un `tools/call`
a una herramienta Mem0 desconocida, **Then** recibe `403
herramienta_no_permitida:<nombre>` en enforcement (lo que `checkMem0Rpc` exige
también al admin), y `delete_all_memories` o un KB `tools/call` con cualquier
`project` pasan. Un batch o JSON inválido de admin da `400`, y un admin no
alcanza otros paths del backend por este transporte.

### AC-013 — Saludo upstream y correlación de id

**Given** un `tools/call` con `id: 1`, **When** pasa por el puente, **Then** el
backend recibe, en una sesión nueva, `initialize` con `id` `omnia-init-<hex>`,
luego `notifications/initialized`, luego el mensaje del cliente con `id: 1`
sin cambios. Notificaciones del servidor y respuestas con `id` `"1"` u otro se
ignoran; el cliente recibe solo la respuesta con `id: 1`. Si el cliente envía
`initialize`, el backend recibe ese mismo mensaje como único saludo. Dos POST
seguidos abren dos sesiones upstream independientes y ambas se cierran.

### AC-014 — Notificaciones devuelven 202

**Given** una notificación JSON-RPC válida sin `id`, **When** pasa `Origin`,
auth, estructura y política, **Then** responde `202` sin cuerpo y sin abrir
upstream; si la política la deniega en enforcement, responde `403`.

### AC-015 — Errores upstream sin secretos

**Given** un backend que no responde al GET, no emite `endpoint`, anuncia un
`endpoint` de otro origen, responde error al saludo o no responde antes del
plazo, **When** se procesa el POST, **Then** se devuelve
`502 upstream_unreachable`, `502 upstream_handshake_failed` o
`504 upstream_timeout` según corresponda, sin POST a otro origen, con el SSE
upstream cerrado y un cuerpo sin Bearer, URL interna ni credenciales.

### AC-016 — SSE legado no cambia

**Given** un cliente SSE existente de Mem0 o KB, **When** usa sus rutas SSE
(`GET /mcp/<cliente>/sse/<ns>`, `POST /mcp/messages`,
`POST /mcp/<cliente>/sse/<ns>/messages` en `memory.*`; `GET /mcp` y
`POST /messages/` en `kb.*`), **Then** conserva su comportamiento. Las pruebas
existentes de `server.test.mjs` pasan sin modificación. `POST /mcp/<espacio>`
en `kb.*` no es ruta SSE de ningún cliente: su `404` es un cambio deliberado
(ver §1 y AC-003), no una regresión.

### AC-017 — Alcance respetado

**Given** el diff de la implementación, **Then** solo agrega
`streamable.mjs`/`streamable.test.mjs` y en `server.mjs` toca únicamente los
dos enganches y `allowedOrigins`; `policy.mjs` y `mcp-client.mjs` quedan sin
cambios.

## Cobertura

| Contrato | AC |
|---|---|
| Escenario A | AC-001, AC-013 |
| Escenario B | AC-002 |
| Escenario C | AC-004 |
| Escenario D | AC-005, AC-006 |
| Escenario E | AC-007 |
| Escenario F | AC-008, AC-009 |
| Escenario G | AC-010, AC-011 |
| Escenario H | AC-012 |
| Escenario I | AC-014 |
| Escenario J y tabla de rutas por host | AC-003 |
| Escenario K | AC-016 |
| Invariantes | AC-009, AC-013, AC-015 |
| Alcance | AC-017 |
