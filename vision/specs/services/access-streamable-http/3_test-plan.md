# Plan de Testing: MCP por Streamable HTTP en access

## Metadata

```yaml
test_framework: node --test memory/access
version: 2
last_updated: 2026-10-16
```

## Estrategia

La implementación agrega `memory/access/streamable.test.mjs`, que levanta
`createGateway` con rutas de prueba (`memory.test` → `mem0`, `kb.test` →
`knowledge`) y un backend HTTP de fixture por ruta. La fixture registra cada
GET SSE (path y headers) y cada POST (cuerpo y headers), anuncia un `endpoint`
configurable y responde por SSE a cada request con su `id`; puede además emitir
notificaciones, requests del servidor y respuestas con `id` distractores.

Usuarios de prueba con tokens hash: `miembro` con `proy-vision-infra`,
`lectura`, `cliente` y `admin`. Cada caso de rechazo comprueba contador
upstream `0`. Los modos se prueban con `enforce: true` y `enforce: false`, y
se verifica `pol` capturando `log` y el contador `would_deny` con
`auditSnapshot` del panel o el log. Se envía siempre el header `Host`
correspondiente.

## Casos automáticos

1. **Mem0 OK**: `POST /mcp/proy-vision-infra` en `memory.test` → `200`, mismo
   `id`; la fixture vio `GET /mcp/streamable/sse/<ns canónico>` (también con
   alias), `authorization` del upstream, `x-omnia-dev` y nunca el Bearer del
   dev; el SSE queda cerrado al terminar.
2. **KB OK**: `POST /mcp` en `kb.test` con `project` permitido → `200`; la
   fixture vio `GET /mcp` y el JSON-RPC sin cambios.
3. **Host cruzado**: `POST /mcp` en `memory.test` → `403 ruta_no_permitida`
   (miembro, enforcement), `404` (auditoría) y `404` (admin);
   `POST /mcp/proy-vision-infra` en `kb.test` → `404` en ambos modos y para
   admin. Contador upstream `0` en todos.
4. **Sin token / token inválido**: `401` con `WWW-Authenticate: Bearer` en ambos
   hosts; contador `0`.
5. **Espacio ajeno (enforcement)**: Mem0 de otro namespace y KB de otro
   `project` → `403` con razón; contador `0`.
6. **Política por request**: `lectura` con `add_memories`; KB con
   `project_id`, `workspace`, `search_all_projects` y `memory://otro/...` →
   `403` con la razón de `policy.mjs`; contador `0`.
7. **Auditoría**: los casos 5 y 6 con `enforce: false` → respuesta del
   backend, `pol=would_deny:<razón>` y contador `would_deny` +1 exacto por
   request. Cambiar el modo en caliente (store de alias) y repetir → `403`
   sin upstream.
8. **Batch**: `[]`, `[{...}]` y arreglo de 2 y de 50 mensajes → `400
   batch_no_soportado` en ambos modos, también para admin; contador `0`.
9. **Cuerpo inválido**: JSON roto, `jsonrpc` ≠ `"2.0"`, respuesta sin `method`,
   `id: null`, `id: "omnia-init-x"`, `Content-Type: text/plain` y cuerpo de
   256 KiB + 1 → `400`/`400`/`400`/`400`/`400`/`415`/`413`; contador `0`.
10. **Origin en POST**: allowlist `https://app.example`. `Origin` ajeno sin y
    con Bearer → `403 origin_no_permitido` sin `Access-Control-*`; `Origin`
    permitido → `200` (y `401` sin token) con `Access-Control-Allow-Origin`
    exacto, `Expose-Headers` y `Vary: Origin`; sin `Origin` → `200` con
    `Vary: Origin`; `Origin: null` → `403`. Nunca `*` ni `Allow-Credentials`.
    Con allowlist vacía, cualquier `Origin` → `403`.
11. **Preflight**: `OPTIONS` sin Bearer con `Origin` permitido → `204` y
    cabeceras definidas; ajeno → `403`; sin `Origin` → `204` con `Allow`;
    `OPTIONS /mcp/x` en `kb.test` → `404`. No consume rate limit; contador `0`.
12. **Métodos**: `GET` y `DELETE /mcp/proy-vision-infra` en `memory.test` y
    `DELETE /mcp` en `kb.test` → `405` con `Allow: POST, OPTIONS`.
13. **Admin**: `tools/call` Mem0 desconocido → `403 herramienta_no_permitida`
    (enforcement); `delete_all_memories` y KB con cualquier `project` → `200`.
14. **Saludo y correlación**: la fixture registra la secuencia `initialize`
    (`id` con prefijo `omnia-init-`) → `notifications/initialized` → mensaje
    del cliente con `id: 1`. Antes de la respuesta real emite una notificación,
    un request del servidor y respuestas con `id` `"1"` y `2`; el cliente
    recibe solo la de `id: 1`. Con `id: "abc"` se conserva el string. Un
    `initialize` del cliente llega como único saludo. Dos POST seguidos → dos
    GET SSE y ambos cerrados.
15. **Notificación**: notificación permitida → `202` sin cuerpo y contador `0`;
    denegada en enforcement → `403`.
16. **Fallos upstream**: GET con `500`, conexión rechazada, SSE cerrado sin
    respuesta, `endpoint` en otro origen (sin POST a él), saludo con `error` y
    fixture muda con plazo corto → `502 upstream_unreachable`,
    `502 upstream_handshake_failed` o `504 upstream_timeout`; los cuerpos no
    contienen el Bearer, la URL de la fixture ni la credencial upstream; el
    SSE upstream queda cerrado.
17. **Regresión SSE**: correr `server.test.mjs` sin modificación, incluido
    `GET /mcp` en `kb.*` y los POST de mensajes de Mem0 y KB.

## Ejecución

Durante implementación, ejecutar en modo silencioso solo la prueba nueva y la
regresión SSE:

```powershell
node --test memory/access/streamable.test.mjs memory/access/server.test.mjs
```

La suite completa `node --test memory/access` queda para el orquestador. No se
requieren servicios externos, Docker ni secretos. Revisar el diff para
confirmar el alcance (AC-017): `policy.mjs`, `mcp-client.mjs` y
`server.test.mjs` sin cambios.

## Matriz de trazabilidad

| AC | Casos |
|---|---|
| AC-001 | 1 |
| AC-002 | 2 |
| AC-003 | 3 |
| AC-004 | 4 |
| AC-005 | 5 |
| AC-006 | 6 |
| AC-007 | 7 |
| AC-008 | 8 |
| AC-009 | 9 |
| AC-010 | 10 |
| AC-011 | 11 |
| AC-012 | 12, 13 |
| AC-013 | 14 |
| AC-014 | 15 |
| AC-015 | 16 |
| AC-016 | 17 |
| AC-017 | revisión del diff |
