# Criterios de Aceptación: Exponer dominio del gateway LiteLLM y agregar modelo de embeddings

## Metadata

```yaml
feature: expose-litellm-gateway-domain
version: 1
last_updated: 2026-09-12
```

## Resumen Ejecutivo

Total de criterios: **11**, agrupados en 4 categorías:

1. Acceso vía dominio (AC-001 a AC-003)
2. Regresión de seguridad post-incidente (AC-004 a AC-005)
3. Embeddings (AC-006 a AC-008)
4. Config Coolify / documentación (AC-009 a AC-011)

Todos se verifican manualmente (curl + consola de Coolify) — ver `3_test-plan.md`.

---

## 1. Acceso vía dominio

### AC-001: El dominio sirve la API con una virtual key válida

**Given** `gateway.omniaos.ai` está configurado en Coolify y el certificado TLS emitido,
**When** se hace `curl -H "Authorization: Bearer <virtual-key-válida>" https://gateway.omniaos.ai/v1/chat/completions -d '{"model":"glm","messages":[{"role":"user","content":"hola"}]}'`,
**Then** la respuesta es `200` con una respuesta de chat completion válida — idéntico a lo que devolvería hoy `http://127.0.0.1:4000` desde dentro del VPS.

### AC-002: Request sin Bearer recibe el rechazo propio de LiteLLM, no un challenge de Traefik

**Given** el dominio está configurado,
**When** se hace `curl -i https://gateway.omniaos.ai/v1/chat/completions -d '...'` sin header `Authorization`,
**Then** la respuesta es un `401`/`403` generado por **LiteLLM** (cuerpo JSON de error de LiteLLM) — el header de respuesta **no** incluye `WWW-Authenticate: Basic` (eso confirmaría que se implementó por error la alternativa de BasicAuth descartada en `1_spec.md`).

### AC-003: `/ui` sigue pidiendo login con la master key, sin capa adicional

**Given** el dominio está configurado,
**When** se visita `https://gateway.omniaos.ai/ui` desde un navegador,
**Then** aparece la pantalla de login propia de LiteLLM (no un prompt nativo de BasicAuth del navegador) — confirma que no se agregó ninguna auth de Traefik encima.

---

## 2. Regresión de seguridad post-incidente

### AC-004: El puerto directo 4000 sigue sin ser alcanzable desde fuera del VPS

**Given** la política post-incidente (`127.0.0.1:4000:4000`, `omnia-portblock`) sigue vigente,
**When** se intenta `curl http://148.113.203.22:4000` desde fuera del VPS,
**Then** la conexión se rechaza o hace timeout. Si se establece, es una regresión de seguridad y esta feature se considera fallida.

### AC-005: `gateway/docker-compose.yml` solo cambió según INV-1

**Given** el repo antes de implementar esta feature,
**When** se corre `git diff` sobre `gateway/docker-compose.yml`,
**Then** el diff se limita a la variable `OPENAI_API_KEY` agregada al bloque `environment` del servicio `litellm` y comentarios — `ports`, `build`, `image`, `restart`, `depends_on` y el servicio `db` no cambian.

---

## 3. Embeddings

### AC-006: Una llamada a `/v1/embeddings` con `text-embedding-3-small` devuelve un vector válido

**Given** `OPENAI_API_KEY` está dado de alta en Coolify y el gateway fue redeployado con rebuild,
**When** se hace `curl -H "Authorization: Bearer <virtual-key-válida>" https://gateway.omniaos.ai/v1/embeddings -d '{"model":"text-embedding-3-small","input":"hola"}'`,
**Then** la respuesta es `200` con un array `data[0].embedding` de 1536 floats (dimensión estándar de `text-embedding-3-small`).

### AC-007: Sin `OPENAI_API_KEY` configurada, la llamada falla con un error identificable

**Given** (escenario de regresión, no el estado final esperado) `OPENAI_API_KEY` no está configurada o es inválida,
**When** se repite la llamada de AC-006,
**Then** LiteLLM devuelve un error explícito atribuible al proveedor OpenAI (ej. `AuthenticationError`), no un timeout silencioso ni una respuesta `200` vacía.

### AC-008: Los tres modelos de chat existentes no cambiaron

**Given** el diff de `gateway/litellm-config.yaml` de esta feature,
**When** se inspecciona `model_list`,
**Then** las entradas `glm`, `glm-5.2` y `glm-4.7` son idénticas a como estaban antes de esta feature — el único bloque nuevo es `text-embedding-3-small` (confirma INV-6 de `1_spec.md`).

---

## 4. Config Coolify / documentación

### AC-009: El redeploy reconstruyó la imagen (no solo recreó el contenedor)

**Given** `litellm-config.yaml` cambió y está horneado vía `COPY` en `gateway/Dockerfile`,
**When** se revisa el log del deploy en Coolify,
**Then** el log muestra un build de imagen nuevo (no una simple recreación de contenedor con la imagen previa) — a diferencia de lo esperado para cambios de solo-labels como en `metrics-hub`.

### AC-010: El DNS y el TLS del dominio son válidos

**Given** el dominio fue agregado con el esquema completo (`https://gateway.omniaos.ai`),
**When** se resuelve el DNS (`dig +short gateway.omniaos.ai`) y se visita el dominio con un cliente que valida certificados,
**Then** el registro apunta a `148.113.203.22` y la conexión TLS se establece sin advertencias.

### AC-011: `DEPLOY_COOLIFY.md` ya no marca `gateway` como pendiente de verificar

**Given** AC-001 a AC-010 pasan,
**When** se lee la sección `### \`gateway/\`` de `DEPLOY_COOLIFY.md`,
**Then** ya no aparece `[VERIFICAR]` para el dominio — indica el estado confirmado y menciona explícitamente la ausencia deliberada de BasicAuth y el secret `OPENAI_API_KEY`.

---

## Cobertura del Contrato

| Sección del contrato (`0_contract.md`) | ACs que la cubren |
|---|---|
| Escenario A (happy path API) | AC-001 |
| Escenario B (Bearer inválido/ausente) | AC-002 |
| Escenario C (regresión post-incidente) | AC-004, AC-005 |
| Escenario D (embeddings end-to-end) | AC-006 |
| Escenario E (embeddings sin key) | AC-007 |
| Escenario G (Host vacío / gotcha de Coolify) | AC-010 (si falla, ver Manejo de Errores de `1_spec.md`) |
| Alcance → No incluye: BasicAuth | AC-002, AC-003 |
| Alcance → No incluye: cambiar binding loopback | AC-004 |
| Invariante INV-1 (diff acotado de docker-compose.yml) | AC-005 |
| Invariante INV-3 (Traefik no agrega su propia auth) | AC-002, AC-003 |
| Invariante INV-6 (modelos de chat sin cambios) | AC-008 |

## Notas

- AC-004 es el criterio más crítico, igual que en `expose-metrics-hub-domain`: valida que no se reintroduce el patrón del incidente del 20-jul-2026.
- AC-002 y AC-003 son los que distinguen esta spec de su precedente: confirman que la decisión de "sin BasicAuth" quedó realmente implementada, no solo documentada.
- No hay AC de "carga/performance" — el volumen esperado (chat + embeddings de un chatbot de soporte y del pipeline de destilación de FAQ) es bajo.

## Definición de "Hecho" para esta feature

Completa (lista para actualizar `vision/backlog.md` y el constitution) únicamente cuando:

1. Los 11 criterios pasan en una ejecución real contra el recurso `gateway` en `server-omniaplatform`, no en un entorno local.
2. `DEPLOY_COOLIFY.md` refleja el estado final (AC-011).
3. Ningún otro recurso de Coolify (`memory`, `metrics-hub`) cambió de comportamiento.
4. Se coordinó (Paso 6 de `1_spec.md`) la virtual key y el dominio con Gibrán para que el chatbot pueda efectivamente terminar sus pruebas — sin este paso, la feature está técnicamente lista pero no cumplió su propósito real.

Si alguna condición no se cumple, la feature permanece `in-progress`.
