# Feature: MCP por Streamable HTTP en access

## Metadata

```yaml
status: pending
created: 2026-10-16
dependencies: memory/access server, policy.mjs y mcp-client.mjs existentes
```

## Propósito

Como cliente MCP moderno quiero enviar JSON-RPC por Streamable HTTP al gateway
`access`, para usar Mem0 y Basic Memory sin depender del transporte SSE legado.
El gateway conservará la misma identidad, aislamiento de espacios y política
que ya aplica al acceso SSE.

## Alcance

Incluye un endpoint stateless por cada request:

- Mem0: `POST /mcp/<espacio>`.
- Basic Memory (KB): `POST /mcp`.
- Autenticación Bearer con el mismo validador de token de desarrollador ya
  usado por `access` y aplicación de `policy.mjs` antes de contactar el backend.
- Validación de `Origin` para la solicitud HTTP de entrada.
- Un puente que reutiliza el patrón de `memory/access/mcp-client.mjs`: abre SSE
  con el backend, hace POST JSON-RPC, espera la respuesta correlacionada y
  devuelve una única respuesta JSON al cliente HTTP.
- `202 Accepted` sin cuerpo de resultado para notificaciones JSON-RPC.

No incluye cambios a `memory/access/*.mjs`, cambios al backend Mem0/KB,
WebSocket, sesiones persistentes ni reemplazar el SSE existente.

## Escenarios

**A — Mem0 autorizado.** Un token válido con acceso al espacio hace
`POST /mcp/proy-vision-infra` con un request JSON-RPC permitido. El gateway
valida el espacio y la herramienta con las mismas reglas de Mem0, ejecuta una
sesión upstream efímera y entrega el resultado JSON-RPC.

**B — KB autorizado.** Un token válido hace `POST /mcp` con `tools/call` cuyo
argumento `project` pertenece a un espacio autorizado. La política de KB se
evalúa por request, incluido el bloqueo de `project_id`, `workspace`,
`search_all_projects` y referencias `memory://` ajenas.

**C — Sin token.** Si falta o no valida `Authorization: Bearer`, ambos
endpoints responden `401` (con desafío Bearer) y nunca abren SSE upstream.

**D — Espacio ajeno.** Si el namespace Mem0 o el proyecto KB no pertenece al
token, responden `403`; tampoco se contacta el backend.

**E — Notificación.** Un mensaje JSON-RPC válido sin `id` se valida y se
reenvía; el cliente recibe `202` y no espera un resultado JSON-RPC.

**F — Compatibilidad.** Las rutas SSE existentes y su semántica de sesiones
(`GET .../sse/...` más POST de mensajes) permanecen sin cambios.

## Invariantes

- Cada POST es independiente: no hay `session_id`, estado ni SSE expuesto al
  cliente Streamable HTTP entre solicitudes.
- El Bearer del dev no se reenvía al backend; el puente usa exclusivamente las
  credenciales upstream ya administradas por `access`.
- La autorización y `policy.mjs` se ejecutan en cada POST, antes de crear la
  sesión upstream, incluso para administradores donde corresponda la política
  de rutas.
- Un `Origin` ausente o fuera del allowlist configurado se rechaza; no se usa
  `Origin` como sustituto del Bearer.
- Los errores de autenticación, origen, cuerpo/JSON-RPC inválido, política y
  backend se expresan como respuestas JSON sin filtrar secretos internos.

## Fuera de alcance

- Modificar `memory/access/mcp-client.mjs`, `policy.mjs` o cualquier otro
  código en esta feature de especificación.
- Cambiar el protocolo SSE actual, sus URLs, o migrar clientes ya instalados.
- Permitir batch con respuestas múltiples; la primera versión define una
  solicitud JSON-RPC por POST y una sola respuesta JSON.

## Hecho

La feature estará lista para implementar cuando los cuatro documentos de esta
carpeta describan de forma consistente endpoint, autorización, errores,
notificaciones y compatibilidad SSE.
