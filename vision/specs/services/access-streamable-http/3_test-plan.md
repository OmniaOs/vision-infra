# Plan de Testing: MCP por Streamable HTTP en access

## Metadata

```yaml
test_framework: node --test memory/access
version: 1
last_updated: 2026-10-16
```

## Estrategia

La implementación debe ampliar las pruebas Node existentes de `memory/access`
con un backend HTTP de fixture. La fixture registra cada GET SSE y POST de
mensajes, anuncia un endpoint SSE y emite respuestas JSON-RPC correlacionadas.
Así se verifica el puente completo sin acceder a Mem0 ni KB reales.

Las pruebas del adaptador deben usar tokens hash válidos y usuarios de prueba
con roles/espacios distintos. Deben contar las conexiones upstream para probar
que los rechazos ocurren antes del backend.

## Casos automáticos

1. Mem0 autorizado: POST a `/mcp/<espacio>` produce `200`, una respuesta con
   el mismo `id`, exactamente un GET SSE y un POST upstream; el SSE se cierra
   al terminar.
2. KB autorizado: POST a `/mcp` con `project` autorizado produce `200` y el
   request que llega al backend conserva el JSON-RPC, no el Bearer del dev.
3. Sin token y token inválido: ambos destinos dan `401` y contador upstream 0.
4. Mem0 de otro espacio y KB de otro `project`: dan `403`, razón de policy y
   contador upstream 0. Repetir para token de solo lectura que intenta escribir.
5. Origin permitido pasa; Origin ajeno o ausente da `403` y contador upstream
   0.
6. Una notificación permitida sin `id` devuelve `202`, provoca un solo POST
   upstream y no espera evento de respuesta. Una notificación denegada da 403.
7. JSON inválido, JSON-RPC inválido y cuerpo que excede el límite dan 400/413
   sin tocar upstream.
8. Fixture que no emite `endpoint` o respuesta antes del timeout: devuelve el
   error JSON 502/504 esperado sin filtrar URL, Bearer ni credenciales.
9. Ejecutar las pruebas SSE existentes de Mem0 y KB sin modificación para
   demostrar compatibilidad del transporte legado.

## Ejecución

Durante implementación, ejecutar en modo silencioso solo la ruta de pruebas
añadida y las pruebas SSE/regresión relacionadas, por ejemplo:

```powershell
node --test memory/access/<streamable-http-test>.test.mjs memory/access/<sse-test>.test.mjs
```

La suite completa `node --test memory/access` queda para el orquestador. No se
requieren servicios externos, Docker ni secretos. Además, revisar el diff para
confirmar que las rutas SSE y sus pruebas existentes no se modificaron salvo
por cobertura de regresión justificada.

## Matriz de trazabilidad

| AC | Casos |
|---|---|
| AC-001 | 1 |
| AC-002 | 2 |
| AC-003 | 3 |
| AC-004, AC-005 | 4 |
| AC-006 | 5 |
| AC-007 | 6 |
| AC-008 | 7, 8 |
| AC-009 | 9 |
