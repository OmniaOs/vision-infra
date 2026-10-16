# Especificación Técnica: MCP por Streamable HTTP en access

## Metadata

```yaml
status: pending
version: 1
last_updated: 2026-10-16
category: services
```

## Diseño

Se agregará al gateway `access` un adaptador Streamable HTTP, separado de las
rutas SSE legadas. Atiende JSON-RPC 2.0 sobre HTTP y crea una conexión upstream
efímera por request usando el mismo ciclo ya probado en `mcp-client.mjs`:

1. Abrir GET SSE autenticado hacia el backend interno.
2. Esperar el evento `endpoint`.
3. Hacer el saludo MCP upstream (`initialize` + `notifications/initialized`)
   como ya hace `mcp-client.mjs`.
4. Enviar el JSON-RPC del cliente por POST al endpoint anunciado.
5. Para requests con `id`, esperar el evento de respuesta con el mismo `id`.
6. Cerrar/abortar SSE y devolver esa única respuesta JSON.

Nunca se entrega el stream upstream al cliente ni se conserva la sesión.

## Contrato HTTP

| Destino | Método | Uso |
|---|---|---|
| `/mcp/<espacio>` | POST | Mem0; `<espacio>` es namespace/alias válido. |
| `/mcp` | POST | Basic Memory; el proyecto se toma solo del JSON-RPC validado. |

Headers requeridos: `Authorization: Bearer <token-dev>` y
`Content-Type: application/json`. Si el request trae `Origin` (cliente de
navegador), debe pertenecer al allowlist explícito configurado para access; un
origen ajeno se rechaza con `403`. Un `Origin` ausente se admite porque los
clientes MCP de terminal no lo envían y el Bearer ya autentica. No se refleja
un origen arbitrario ni se conceden credenciales CORS a orígenes no permitidos.

El cuerpo es un objeto JSON-RPC 2.0 único; se conserva el límite de cuerpo del
gateway. Las solicitudes con `id` devuelven `200 application/json` con la
respuesta JSON-RPC upstream. Una notificación (sin `id`) válida devuelve `202`
sin resultado; si la política la rechaza, devuelve el error HTTP aplicable.

## Autorización y política

Antes de abrir SSE upstream, el handler debe:

1. Validar Bearer con el mismo lookup/hash de token de desarrollador de
   `access`; ausencia o token inválido devuelve `401` y `WWW-Authenticate:
   Bearer`.
2. Validar método, ruta, `Origin`, tamaño y JSON-RPC.
3. Para Mem0, resolver alias a espacio canónico y ejecutar los equivalentes de
   `checkMem0Connect` y `checkMem0Rpc` sobre ese espacio.
4. Para KB, ejecutar `checkKbRpc`; cada `tools/call` requiere un `project`
   permitido y conserva todas sus restricciones de argumentos y herramientas.
5. Si la política deniega, devolver `403 {"error":"forbidden","reason":...}`
   y no abrir la conexión upstream.

El adaptador conserva la auditoría, rate limit, touch de token y modo de
enforcement de `access`. El token del desarrollador se elimina de los headers
upstream; solo se inyecta la autenticación de backend configurada por la ruta.

## Errores

| Condición | Estado | Respuesta mínima |
|---|---:|---|
| Bearer ausente/inválido | 401 | `{"error":"unauthorized"}` |
| Origin no permitido | 403 | `{"error":"forbidden","reason":"origin_no_permitido"}` |
| Espacio/proyecto/herramienta no autorizado | 403 | `{"error":"forbidden","reason":...}` |
| Ruta o método no soportado | 404/405 | `{"error":"not_found"}` / JSON equivalente |
| Cuerpo excesivo | 413 | `{"error":"cuerpo_demasiado_grande"}` |
| JSON o JSON-RPC inválido | 400 | error JSON sin detalles sensibles |
| Upstream no disponible, timeout o SSE sin respuesta | 502/504 | error JSON estable, sin URL ni credencial upstream |

## Compatibilidad y decisiones

Las rutas SSE actuales no se modifican: Mem0 sigue usando sus GET/POST de
sesión y KB su transporte SSE legado. El nuevo handler no comparte su estado de
sesiones y no cambia sus URLs. Esto evita romper clientes configurados con
`/mcp/claude/sse/<espacio>` o con el endpoint SSE de KB.

Mem0 es tratado como no autenticado por sí mismo: su aislamiento se mantiene en
el gateway y nunca se presupone que una API key upstream proteja al usuario.
Para KB se conserva la lista blanca estricta porque sus parámetros y URLs pueden
referir otros proyectos.

## Archivos previstos al ejecutar la spec

La implementación posterior podrá tocar código de `memory/access/` y sus
pruebas correspondientes, pero esta entrega solo crea estos cuatro documentos.
