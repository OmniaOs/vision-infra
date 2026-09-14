# Feature: Exponer dominio del gateway LiteLLM y agregar modelo de embeddings

## Metadata

```yaml
status: in-progress
created: 2026-09-12
updated: 2026-09-12
dependencies: none
position: 5
plane_workitem_id: "VINF-7"
```

> Sin work item de Plane asociado todavía — puede vincularse después con la skill `plane-sync` de este repo, como se hizo retroactivamente con `expose-metrics-hub-domain` (VINF-1). No es bloqueante para ejecutar esta spec.

## User Stories

**Como** Gibrán (responsable/dev del proyecto `chatbot`) **Quiero** que el gateway LiteLLM sea alcanzable por una URL fija desde donde sea que corra el stack del chatbot **Para** completar las pruebas finales sin depender de un túnel SSH manual al VPS de `vision-infra`.

**Como** responsable de seguridad de `vision-infra` (Daniel) **Quiero** que exponer el dominio no reintroduzca el patrón del incidente del 20-jul-2026 (puerto sin auth expuesto a internet) ni rompa la auth Bearer que ya usan los clientes existentes del gateway **Para** no cambiar un problema conocido (falta de URL fija) por uno peor (servicio desprotegido o roto).

**Como** servicio consumidor del gateway (el chatbot vía `LITELLM_BASE_URL`/`LITELLM_API_KEY`, y potencialmente `memory`/Hermes vía `HERMES_LLM_BASE_URL`) **Quiero** poder pedir embeddings de texto al mismo gateway **Para** resolver conocimiento por similitud semántica (`core/resolucion-automatica-conocimiento`) y destilar FAQs desde tickets resueltos (`core/destilacion-automatica-faq`), features que en el repo `chatbot` ya dependen de esto y lo listan como bloqueante de coordinación pendiente.

## Naturaleza del Artefacto

Como `expose-metrics-hub-domain` (spec hermana, ver Dependencias), esta feature **no es código de aplicación** en su mayoría, pero sí incluye cambios de código acotados y deliberados: un modelo nuevo en `gateway/litellm-config.yaml`, una variable de entorno nueva (`OPENAI_API_KEY`) propagada en `gateway/docker-compose.yml` y documentada en `gateway/.env.example`, y actualizaciones de `gateway/README.md` y `DEPLOY_COOLIFY.md`. No hay cambios a `gateway/Dockerfile` ni a lógica de aplicación — LiteLLM es la imagen tal cual, solo cambia su configuración declarativa.

El resto — agregar el dominio en la consola de Coolify, dar de alta el secret `OPENAI_API_KEY`, y el redeploy — es una acción operativa que ejecuta el humano con acceso a Coolify (Daniel), igual que en `expose-metrics-hub-domain`. `1_spec.md` describe esos pasos como runbook, y `3_test-plan.md` es validación manual (curl), no una suite automatizada.

## Propósito

Desde el fix de seguridad post-incidente (commit `82cba23`, 24-jul-2026), el gateway publica su puerto `4000` solo en `127.0.0.1` del VPS. `DEPLOY_COOLIFY.md` ya documentaba `gateway.omniaos.ai` como el dominio *esperado* (es el default de `HERMES_LLM_BASE_URL` en `memory/.env.example`), pero marcado **[VERIFICAR]** — nunca se confirmó contra la consola real de Coolify si ese dominio sigue activo. Mientras tanto, el repo `chatbot` (consumidor de este gateway) ya llegó a pruebas finales y su dev (Gibrán) necesita una URL de verdad para terminar de integrar, en vez de depender de que alguien con acceso SSH al VPS le abra un túnel cada vez.

Por separado, `gateway/litellm-config.yaml` solo tiene modelos de chat (`glm`, `glm-5.2`, `glm-4.7`, todos vía z.ai). El repo `chatbot` ya tiene código listo para consumir un modelo de embeddings del mismo gateway (`src/knowledge/knowledge-config.ts`, default `text-embedding-3-small`) para dos features de Fase 2 (`core/resolucion-automatica-conocimiento`, `core/destilacion-automatica-faq`), y ambas specs listan explícitamente "coordinar con quien administra `vision-infra`: virtual key + modelo de embeddings en el gateway" como bloqueante. Investigar reveló que **z.ai/GLM no expone ningún endpoint de embeddings** bajo la cuenta ya configurada (ni el endpoint de coding plan ni el general) — `embedding-2`/`embedding-3` de Zhipu solo viven en su plataforma doméstica china (`bigmodel.cn`), cuenta separada. Se resuelve agregando OpenAI como segundo proveedor, solo para embeddings (`text-embedding-3-small`, ~$0.02 USD/1M tokens).

## Escenarios

**A — Happy path (API).** Un cliente con una virtual key válida hace `curl -H "Authorization: Bearer <virtual-key>" https://gateway.omniaos.ai/v1/chat/completions ...`. La respuesta es la misma que se obtendría hoy contra el puerto local — el dominio es transparente para la auth de LiteLLM.

**B — Bearer inválido o ausente.** Un cliente llama al dominio sin header `Authorization` o con una key inválida. LiteLLM (no Traefik) responde `401`/`403` — el mismo comportamiento que ya tiene hoy vía el puerto directo. Esta feature no le agrega ni le quita nada a esa respuesta.

**C — Regresión de la política post-incidente.** Alguien intenta `curl http://148.113.203.22:4000` (puerto directo) desde fuera del VPS. Debe seguir sin establecerse — el binding a `127.0.0.1` y `omnia-portblock` siguen vigentes; esta feature no los toca.

**D — Embeddings end-to-end.** Un cliente llama `POST https://gateway.omniaos.ai/v1/embeddings` con `model: "text-embedding-3-small"` y una virtual key válida. LiteLLM enruta a OpenAI con el `OPENAI_API_KEY` del gateway y devuelve el vector — sin que el cliente (chatbot) necesite su propia cuenta de OpenAI.

**E — Embeddings sin `OPENAI_API_KEY` configurado.** Si el secret no se dio de alta en Coolify antes del redeploy, la llamada del Escenario D falla con un error claro de LiteLLM (credencial faltante), no con un timeout silencioso ni una respuesta vacía.

**F — Dominio mal propagado (edge case operativo).** El DNS todavía no resuelve o el certificado Let's Encrypt no se emitió — igual que el Escenario E de `expose-metrics-hub-domain`. El túnel SSH manual sigue funcionando como fallback.

**G — Coolify genera un `Host()` vacío (edge case de configuración, ya visto antes).** Mismo bug documentado en `expose-metrics-hub-domain` (commit `84f7a54`): si el campo "Domains" del recurso `gateway` en Coolify se guarda sin el esquema (`gateway.omniaos.ai` en vez de `https://gateway.omniaos.ai`), el router autogenerado queda roto y Traefik responde `503` — aunque el `docker-compose.yml` esté correcto. Se documenta preventivamente para no repetir el día de debugging que costó la primera vez.

## Alcance

### Incluye:

- Agregar el dominio `gateway.omniaos.ai` al recurso `gateway` en la consola de Coolify, con el esquema completo (`https://...`) desde el inicio (gotcha ya conocido).
- Dar de alta el secret `OPENAI_API_KEY` en Coolify para el recurso `gateway`.
- Agregar `text-embedding-3-small` (OpenAI) como modelo de embeddings en `gateway/litellm-config.yaml`, propagar `OPENAI_API_KEY` en `gateway/docker-compose.yml`, y documentarlo en `gateway/.env.example` y `gateway/README.md` — commit + push (ya ejecutado en el repo local, pendiente de redeploy real).
- Redeploy del recurso `gateway` en Coolify.
- Verificación manual de los escenarios A-E (ver `3_test-plan.md`).
- Documentar el resultado final en `DEPLOY_COOLIFY.md`, cerrando el `[VERIFICAR]` que traía desde su redacción original.

### No incluye:

- **BasicAuth ni ninguna capa de auth adicional sobre el dominio.** Se consideró (mismo patrón que `metrics-hub`) y se descartó deliberadamente: LiteLLM ya exige Bearer token en la API y login con la master key en `/ui`; BasicAuth sobre todo el dominio rompería a cualquier cliente que ya manda `Authorization: Bearer <virtual-key>` (el chatbot incluido — un header `Authorization` no admite dos esquemas a la vez). Ver `1_spec.md` → Alternativas Consideradas.
- Cambiar la política de binding a `127.0.0.1` de ningún puerto — sigue vigente para los tres servicios del repo. Esta feature es aditiva.
- Dar de alta la cuenta doméstica de Zhipu (`bigmodel.cn`) o un runtime de embeddings autohospedado — se evaluaron como alternativas (ver `1_spec.md`) y se descartaron a favor de OpenAI por menor fricción operativa, dado el volumen de uso esperado (FAQs de soporte, no un producto de alto tráfico).
- Escribir código de aplicación nuevo en `chatbot` para consumir embeddings — ya existe (`src/knowledge/knowledge-config.ts`, `src/knowledge/litellm-knowledge-llm.ts`, `src/knowledge/litellm-client.ts`); esta spec solo hace que el gateway del que depende ese código exista de verdad con el modelo configurado.
- Emitir o rotar la virtual key específica que use el chatbot contra el gateway — eso es un paso operativo separado (`/key/generate`, ver `gateway/README.md`), fuera del alcance de código de esta spec, aunque forma parte del checklist de "Resumen Ejecutivo" de `1_spec.md` porque es necesario para validar el Escenario A/D end-to-end.

## Dependencias

### Esta feature depende de:

- El fix de seguridad post-incidente (commit `82cba23`, 24-jul-2026) — ya aplicado, es el estado actual del repo.
- Que Daniel tenga acceso a la consola de Coolify del recurso `gateway` (mismo acceso ya usado para `expose-metrics-hub-domain`).
- Una API key de OpenAI de pago — decisión tomada en la conversación que originó esta spec (2026-09-12): se eligió OpenAI `text-embedding-3-small` sobre Zhipu/`bigmodel.cn` (cuenta separada, fricción de acceso desde fuera de China) y sobre un modelo autohospedado (cero costo recurrente, pero un contenedor más que mantener y sin fecha definida).
- El patrón y las lecciones ya documentadas en `expose-metrics-hub-domain` (mecanismo `coolify.traefik.middlewares`, gotcha del esquema en el campo "Domains", riesgo de que Coolify rompa el `Host()` autogenerado con bindings loopback-only) — esta spec los reutiliza en vez de redescubrirlos.

### Esta feature es requerida por:

- `core/resolucion-automatica-conocimiento` y `core/destilacion-automatica-faq`, ambas en el repo **`chatbot`** (no en este repo) — sus propias specs listan explícitamente "coordinar con quien administra `vision-infra`: virtual key + modelo de embeddings en el gateway" como bloqueante de coordinación. Esta feature resuelve esa coordinación desde el lado de `vision-infra`; la emisión de la virtual key específica para el chatbot y su configuración en `chatbot/.env` (`LITELLM_BASE_URL=https://gateway.omniaos.ai`, `LITELLM_API_KEY=...`) es un paso posterior, coordinado directamente entre Daniel y Gibrán, fuera de este repo.
- Relacionada por dominio (ambas en `services/`, ambas sobre exposición de puertos vía Coolify/Traefik) con `port-exposure-alerts` (mismo backlog), sin dependencia dura entre ambas.

## Impacto

**Archivos del repo modificados (ya aplicado en este commit):**

- `gateway/litellm-config.yaml` — agrega el modelo `text-embedding-3-small` (OpenAI). Los tres modelos de chat existentes no cambian.
- `gateway/docker-compose.yml` — propaga `OPENAI_API_KEY` al contenedor `litellm`; agrega comentarios sobre la exposición por dominio y el contingente del bug de Coolify. Sin labels de Traefik (se descartó BasicAuth — ver Alcance).
- `gateway/.env.example` — documenta `OPENAI_API_KEY`.
- `gateway/README.md` — documenta el dominio, la ausencia deliberada de BasicAuth, y el modelo de embeddings nuevo.
- `DEPLOY_COOLIFY.md` — sección `### \`gateway/\`` actualizada: dominio confirmado (ya no `[VERIFICAR]`), secret nuevo, gotcha del esquema.

**Archivos del repo NO modificados:** `gateway/Dockerfile` — sin rebuild de imagen necesario para el cambio de config (`litellm-config.yaml` sí se hornea en la imagen vía `COPY`, según convención del constitution, así que **este cambio específico sí requiere rebuild**, a diferencia del cambio de solo-labels de `metrics-hub` — ver INV-1 en `1_spec.md`).

**Config fuera del repo (no versionada en git):** el dominio y el secret `OPENAI_API_KEY` se agregan en la consola de Coolify — pendiente de ejecución por Daniel.

**Impacto en otros recursos de Coolify:** ninguno esperado. `memory` y `metrics-hub` no cambian de comportamiento.

**Impacto en el chatbot:** una vez completada esta spec y coordinada la virtual key con Gibrán, el chatbot puede terminar sus pruebas finales usando `LITELLM_BASE_URL=https://gateway.omniaos.ai` en vez de depender de acceso directo al VPS.

## Notas de Implementación

Esta spec se creó y se implementó (lado de código) en la misma sesión, a partir de un pedido directo de Gibrán vía Daniel, no de un `/newspec` interactivo. Dos decisiones se tomaron explícitamente con Daniel durante esa sesión (2026-09-12), documentadas aquí porque no son obvias por el código:

1. **Embeddings: OpenAI, no Zhipu ni autohospedado.** Se investigó primero si z.ai/GLM (proveedor único ya configurado) exponía embeddings — no los expone bajo ninguna cuenta ni endpoint accesible desde la integración actual. Se presentaron tres opciones (OpenAI, Zhipu vía `bigmodel.cn`, autohospedado tipo `bge-small`) con costos y fricción reales; se eligió OpenAI por ser la de menor fricción operativa para el volumen esperado.
2. **Sin BasicAuth sobre el dominio.** Se consideró replicar el patrón de `metrics-hub` pero se descartó al notar que rompería la auth Bearer que ya usan (y usarán) los clientes reales del gateway — ver Escenarios y Alcance arriba.
