# Plan de Testing: Exponer dominio del gateway LiteLLM y agregar modelo de embeddings

## Metadata

```yaml
test_framework: ninguno (validación manual)
version: 1
last_updated: 2026-09-12
```

## Estrategia de Testing

Misma situación que `expose-metrics-hub-domain`: sin harness automatizado para config de infraestructura de Coolify (el constitution declara `Testing: ninguno configurado todavía`). Validación enteramente manual vía `curl`, ejecutada por Daniel inmediatamente después del Paso 4 (redeploy) de `1_spec.md`.

## Validación Manual

Ejecutar en orden. Sustituir `<virtual-key>` por una key real generada vía `/key/generate` (ver `gateway/README.md`).

### Paso 1 — Acceso a la API con Bearer válido (cubre AC-001)

```bash
curl -i -H "Authorization: Bearer <virtual-key>" \
  -H "Content-Type: application/json" \
  https://gateway.omniaos.ai/v1/chat/completions \
  -d '{"model":"glm","messages":[{"role":"user","content":"hola"}]}'
```

**Esperado:** `200`, cuerpo JSON con una respuesta de chat completion (`choices[0].message.content`).

### Paso 2 — Sin Bearer: rechazo de LiteLLM, no de Traefik (cubre AC-002)

```bash
curl -i https://gateway.omniaos.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"glm","messages":[{"role":"user","content":"hola"}]}'
```

**Esperado:** `401`/`403` con cuerpo JSON de error de LiteLLM. **El header `WWW-Authenticate: Basic` NO debe aparecer** — si aparece, se implementó por error la alternativa de BasicAuth descartada; detener y revisar `docker-compose.yml`.

### Paso 3 — `/ui` pide login propio, no BasicAuth de navegador (cubre AC-003)

Visitar `https://gateway.omniaos.ai/ui` en un navegador.

**Esperado:** aparece la pantalla de login HTML de LiteLLM (usuario/master key). **No** debe aparecer el prompt nativo de BasicAuth del navegador.

### Paso 4 — Regresión: puerto directo sigue bloqueado (cubre AC-004 — el más crítico)

Ejecutar **desde fuera del VPS**:

```bash
curl -v --connect-timeout 5 http://148.113.203.22:4000/
```

**Esperado:** timeout o conexión rechazada. Si devuelve cualquier respuesta, **detener inmediatamente** — regresión de seguridad.

### Paso 5 — `docker-compose.yml` solo cambió según INV-1 (cubre AC-005)

```bash
git diff <commit-antes-de-esta-feature>..HEAD -- gateway/docker-compose.yml
```

**Esperado:** el diff se limita a `OPENAI_API_KEY: ${OPENAI_API_KEY}` y comentarios. `ports`, `build`, `image`, `restart`, `depends_on`, servicio `db` sin cambios.

### Paso 6 — Embeddings end-to-end (cubre AC-006)

```bash
curl -i -H "Authorization: Bearer <virtual-key>" \
  -H "Content-Type: application/json" \
  https://gateway.omniaos.ai/v1/embeddings \
  -d '{"model":"text-embedding-3-small","input":"hola"}'
```

**Esperado:** `200`, `data[0].embedding` es un array de 1536 floats.

### Paso 7 — Embeddings sin `OPENAI_API_KEY` (cubre AC-007 — solo si se quiere probar el camino de error deliberadamente)

Quitar temporalmente `OPENAI_API_KEY` en Coolify, redeploy, repetir el Paso 6, confirmar el error explícito de OpenAI/LiteLLM, y **restaurar la key + redeploy antes de continuar** (no dejar el gateway en este estado).

**Esperado:** error claro (`AuthenticationError` o similar), no timeout ni `200` vacío.

### Paso 8 — Modelos de chat sin cambios (cubre AC-008)

```bash
curl -H "Authorization: Bearer <virtual-key>" https://gateway.omniaos.ai/v1/models
```

**Esperado:** la lista incluye `glm`, `glm-5.2`, `glm-4.7` y `text-embedding-3-small` — los tres primeros con la misma config que antes (verificable comparando contra `git diff` del Paso 5 aplicado a `litellm-config.yaml`, no a `docker-compose.yml`).

### Paso 9 — Redeploy con rebuild real (cubre AC-009)

Inspección manual en la consola de Coolify: confirmar en el log del deploy que se ejecutó un build de imagen (no solo recreación de contenedor).

### Paso 10 — DNS y TLS válidos (cubre AC-010)

```bash
dig +short gateway.omniaos.ai
curl -v https://gateway.omniaos.ai/ 2>&1 | grep -i "SSL certificate verify ok\|subject:"
```

**Esperado:** el DNS resuelve a `148.113.203.22`; sin advertencias de certificado.

### Paso 11 — Documentación actualizada (cubre AC-011)

Inspección manual: `DEPLOY_COOLIFY.md`, sección `### \`gateway/\``, ya no dice `[VERIFICAR]`.

## Helpers y Fixtures

- Una virtual key de prueba, generada vía `/key/generate` con `models` sin restricción (para poder probar tanto chat como embeddings en esta validación) — no confundir con la virtual key final que se le entregue a Gibrán (Paso 6 de `1_spec.md`), que sí debería restringirse a los modelos que el chatbot realmente usa.
- Alternativa sin acceso externo para el Paso 4: MCP `occ` (`nodes_get`/`processes_list` sobre `server-omniaplatform`), igual que en `expose-metrics-hub-domain`.

## Resumen de Tests

| Paso | Cubre | Tipo |
|---|---|---|
| 1 | AC-001 | curl |
| 2 | AC-002 | curl |
| 3 | AC-003 | navegador |
| 4 | AC-004 (crítico) | curl desde fuera del VPS |
| 5 | AC-005 | git diff |
| 6 | AC-006 | curl |
| 7 | AC-007 | curl (camino de error, opcional/deliberado) |
| 8 | AC-008 | curl |
| 9 | AC-009 | inspección manual (log de Coolify) |
| 10 | AC-010 | dig + curl |
| 11 | AC-011 | inspección manual |

Total: 11 pasos (10 obligatorios + 1 opcional de camino de error). La feature se considera completa solo cuando los pasos obligatorios pasan, con el Paso 4 como bloqueante absoluto.
