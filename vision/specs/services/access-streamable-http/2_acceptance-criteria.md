# Criterios de Aceptación: MCP por Streamable HTTP en access

## Metadata

```yaml
version: 1
last_updated: 2026-10-16
```

### AC-001 — Mem0 responde por POST

**Given** un token de dev con acceso a `proy-vision-infra`, **When** envía un
JSON-RPC permitido con `id` a `POST /mcp/proy-vision-infra`, **Then** recibe
`200` y una única respuesta JSON-RPC correlacionada; el backend fue alcanzado
por GET SSE más POST interno, no por una sesión expuesta al cliente.

### AC-002 — KB responde por POST

**Given** un token autorizado y un `tools/call` con `project` permitido,
**When** se hace `POST /mcp`, **Then** recibe `200` con una única respuesta
JSON-RPC y la política KB se evaluó antes del upstream.

### AC-003 — No hay token, no hay upstream

**Given** cualquiera de los endpoints, **When** falta el Bearer o es inválido,
**Then** responde `401`, incluye `WWW-Authenticate: Bearer` y no se abre SSE ni
POST hacia el backend.

### AC-004 — Un espacio ajeno queda cerrado

**Given** un token válido sin acceso a un namespace Mem0 o proyecto KB,
**When** realiza el POST correspondiente, **Then** recibe `403` y ninguna
conexión upstream es creada.

### AC-005 — La política por request no se omite

**Given** un token de solo lectura o una llamada KB con parámetro prohibido,
**When** llama por Streamable HTTP, **Then** recibe `403` con razón de policy;
no basta haber validado la ruta o el token.

### AC-006 — Origin se valida

**Given** una solicitud con `Origin` ajeno al allowlist, **When** llega a
cualquiera de los POST, **Then** responde `403` antes de contactar upstream.
Un origen permitido conserva únicamente los headers CORS configurados.

### AC-007 — Notificaciones devuelven 202

**Given** una notificación JSON-RPC válida sin `id`, **When** pasa auth,
Origin y policy, **Then** se reenvía una vez y responde `202` sin resultado
JSON-RPC ni espera indefinida de SSE.

### AC-008 — Errores no filtran secretos

**Given** JSON inválido, cuerpo excesivo o upstream caído/timeout, **When** se
procesa el POST, **Then** se devuelve el estado 400/413/502 o 504 definido y
un cuerpo JSON que no contiene Bearer, URL interna ni credenciales upstream.

### AC-009 — SSE legado no cambia

**Given** un cliente SSE existente de Mem0 o KB, **When** abre y usa su ruta
actual, **Then** conserva su comportamiento previo. La suite de regresión SSE
pasa sin actualizar URLs ni formato de mensajes.

## Cobertura

| Contrato | AC |
|---|---|
| Escenarios A y B | AC-001, AC-002 |
| Escenario C | AC-003 |
| Escenario D | AC-004, AC-005 |
| Escenario E | AC-007 |
| Escenario F e invariantes | AC-006, AC-008, AC-009 |
