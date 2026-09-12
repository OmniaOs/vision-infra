# Especificación Técnica: Exponer dominio del gateway LiteLLM y agregar modelo de embeddings

## Metadata

```yaml
status: in-progress
version: 1
last_updated: 2026-09-12
category: services
```

## Historial de Cambios

- [ADDED] 2026-09-12: Versión inicial. Código (Paso 3 del Algoritmo) ya aplicado en esta misma sesión; pasos de consola de Coolify (Pasos 1, 2, 4-6) pendientes de ejecución por Daniel.

## Naturaleza de Este Documento

Como en `expose-metrics-hub-domain`, esta spec mezcla un componente de código real y acotado (dos archivos de config, `litellm-config.yaml` y `docker-compose.yml`, más documentación) con pasos operativos en la consola de Coolify que no puede ejecutar quien no tenga acceso a ella. La diferencia principal con `expose-metrics-hub-domain`: **este cambio de código sí requiere rebuild de imagen** — `litellm-config.yaml` se hornea en la imagen vía `COPY` en `gateway/Dockerfile` (a diferencia del cambio de solo-labels de `metrics-hub`, que no tocaba la imagen). El "Algoritmo" de abajo debe leerse como runbook, no como pseudocódigo de una función.

## Invariantes

- **INV-1**: Los cambios a `gateway/docker-compose.yml` se limitan a: (a) agregar `OPENAI_API_KEY: ${OPENAI_API_KEY}` al bloque `environment` del servicio `litellm`, y (b) comentarios. `ports`, `build`, `image`, `restart`, `depends_on`, y el servicio `db` completo no cambian. El binding `127.0.0.1:4000:4000` sigue idéntico.
- **INV-2**: El dominio configurado en Coolify enruta a `gateway` vía la red interna de Docker (Traefik container-to-container), nunca a través del puerto publicado al host — igual que INV-2 de `expose-metrics-hub-domain`.
- **INV-3**: Ninguna request a `gateway.omniaos.ai` recibe una respuesta `401`/`403` de **Traefik** (BasicAuth) — solo LiteLLM puede rechazar una request, y solo por credenciales Bearer inválidas o ausentes. Esta es la invariante que distingue esta spec de `expose-metrics-hub-domain`: ahí Traefik era la única línea de auth; acá Traefik no agrega ninguna.
- **INV-4**: El acceso directo a `<IP-del-VPS>:4000` desde fuera del VPS sigue sin funcionar tras esta feature — heredada de la política post-incidente (`82cba23`), no de esta spec.
- **INV-5**: El modelo `text-embedding-3-small` en `litellm-config.yaml` usa `os.environ/OPENAI_API_KEY` — la key en sí nunca se commitea a ningún archivo del repo, solo su nombre de variable (igual que `ZAI_API_KEY`, `LITELLM_MASTER_KEY`, etc. ya en el archivo).
- **INV-6**: Los tres modelos de chat existentes (`glm`, `glm-5.2`, `glm-4.7`) no cambian su configuración como efecto de esta feature — el diff de `litellm-config.yaml` es estrictamente aditivo (un bloque `model_list` nuevo).
- **INV-7**: La emisión del certificado TLS para `gateway.omniaos.ai` queda a cargo de Coolify (Let's Encrypt gestionado), igual que INV-7 de `expose-metrics-hub-domain`.
- **INV-8 (heredada, riesgo conocido)**: Igual que INV-9 de `expose-metrics-hub-domain` — existe el riesgo de que el campo "Domains" de Coolify, si se guarda sin esquema (`gateway.omniaos.ai` en vez de `https://gateway.omniaos.ai`), genere un router con `Host('')` roto. La única confirmación confiable es la verificación empírica post-deploy (Paso 5 / `3_test-plan.md`), no la sola presencia del dominio en la consola.

## Stack Técnico

- **Proxy**: Traefik v2 embebido en Coolify (`coolify-proxy`), el mismo que ya enrutaría (o enrutaría) `memory` y ya enruta `metrics-hub`. Esta feature no introduce un proxy nuevo.
- **Gateway**: LiteLLM (`ghcr.io/berriai/litellm:main-latest`), config horneada en la imagen vía `gateway/Dockerfile` — ver "Naturaleza de Este Documento" arriba sobre la implicación de rebuild.
- **Proveedor de embeddings**: OpenAI, vía el prefijo `openai/` de LiteLLM (`model: openai/text-embedding-3-small`) — mismo mecanismo que ya usan los tres modelos GLM existentes con el prefijo `openai/` apuntando a `api.z.ai` (LiteLLM trata cualquier API compatible con el formato OpenAI de la misma forma; para OpenAI mismo no hace falta `api_base` custom, usa el default `https://api.openai.com`).
- **DNS/TLS**: gestionado por Coolify, igual que en `expose-metrics-hub-domain`.

## Modelo de Datos

No aplica un modelo de datos de aplicación. Los dos bloques relevantes, ya aplicados en el repo:

```yaml
# gateway/litellm-config.yaml — bloque nuevo bajo model_list, aditivo.
  - model_name: text-embedding-3-small
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY
```

```yaml
# gateway/docker-compose.yml — bajo services.litellm.environment, aditivo.
      OPENAI_API_KEY: ${OPENAI_API_KEY}
```

El nombre del modelo (`text-embedding-3-small`) se eligió a propósito **igual al `model` real de OpenAI y al default ya hardcodeado** en `chatbot/src/knowledge/knowledge-config.ts` (`KB_EMBEDDING_MODEL`) — así el chatbot no necesita ninguna variable de entorno adicional para apuntar al modelo correcto, más allá de `LITELLM_BASE_URL`/`LITELLM_API_KEY` ya previstos en su propio `.env.example`.

## Alternativas Consideradas

Documentado para quien retome esta spec, siguiendo la misma convención que `expose-metrics-hub-domain`:

### Proveedor de embeddings

1. **Zhipu `embedding-2`/`embedding-3` vía `bigmodel.cn` (descartada).** Mantendría todo en el ecosistema GLM y reutilizaría el proveedor ya usado para chat, pero es una plataforma y cuenta completamente separadas de `api.z.ai` (la internacional, que ya usa este gateway) — requiere alta propia, con fricción de acceso/facturación desde fuera de China. Se confirmó además que **`api.z.ai` no expone embeddings bajo ningún endpoint** (ni coding plan ni general) — no es solo una cuestión de qué modelo usar, la capacidad no existe en la cuenta actual.
2. **Autohospedado (ej. `bge-small`/`e5-small` vía Ollama o TEI) (descartada por ahora).** Costo marginal cero, pero suma un contenedor más al VPS (RAM/CPU) y trabajo de mantenimiento sin fecha definida; se prefirió no bloquear la exposición del gateway (que sí es urgente para el chatbot) por una decisión de infraestructura más compleja. Queda como mejora futura si el volumen de embeddings crece lo suficiente para que el costo por token de OpenAI deje de ser marginal.
3. **OpenAI `text-embedding-3-small` (elegida).** ~$0.02 USD por 1M tokens — para el volumen esperado (FAQs destiladas de tickets de soporte, no un producto de alto tráfico) es un gasto de centavos al mes. Cero fricción de cuenta (alta inmediata, sin plataforma separada). Coincide con el default ya hardcodeado en el código del chatbot.

### Auth adicional sobre el dominio

1. **BasicAuth vía Traefik, mismo patrón que `metrics-hub` (descartada).** Se consideró inicialmente por consistencia con el precedente del repo, pero se descubrió durante esta misma sesión que es incompatible con el diseño real: LiteLLM ya exige `Authorization: Bearer <virtual-key>` en cada request de API, y el header `Authorization` no admite dos esquemas (`Basic` + `Bearer`) simultáneamente. Aplicar BasicAuth sobre todo el dominio (que es como funciona el mecanismo `coolify.traefik.middlewares` usado en `metrics-hub` — ata el middleware al único router autogenerado del recurso, sin distinguir rutas) habría roto la autenticación de cualquier cliente Bearer existente, incluido el chatbot — exactamente el caso de uso que motiva esta spec.
2. **BasicAuth acotado solo a `/ui` (considerada, descartada por riesgo/beneficio).** Técnicamente posible definiendo dos routers de Traefik a mano (uno con `PathPrefix(\`/ui\`)` + BasicAuth, otro para el resto sin ella), pero requiere conocer de antemano el nombre exacto del entrypoint HTTPS y el certresolver de esta instalación de Coolify — datos no disponibles sin acceso directo a su consola, y que de adivinarse mal podrían romper el ruteo que sí funciona hoy. Descartada además porque `/ui` ya exige login con la master key por defecto (no está desnuda como estaba `openmemory-ui`, el servicio que sí motivó el incidente original) — el beneficio marginal de una segunda capa no justifica el riesgo de una config manual sobre Traefik en producción sin poder verla primero.
3. **Sin auth adicional (elegida).** El dominio expone exactamente la misma superficie que ya expone el puerto local: la API de LiteLLM, gateada por Bearer token, y `/ui`, gateado por login con la master key. Es aditivo en el sentido correcto — agrega una vía de acceso, no una vía de acceso *menos protegida*.

## Algoritmo

Pasos a ejecutar en orden. Los Pasos 1-3 (código) ya se ejecutaron en esta sesión; el resto queda para Daniel con acceso a Coolify.

### Paso 0 — Prerrequisitos

- Acceso de administrador/editor al recurso `gateway` en la consola de Coolify (ya usado para `expose-metrics-hub-domain`).
- Una API key de OpenAI de pago (`OPENAI_API_KEY`) — decisión ya tomada (ver `0_contract.md` → Notas de Implementación). Si no existe todavía, darla de alta en `platform.openai.com` antes de continuar al Paso 2.
- Acceso de escritura al repo `vision-infra` y a su remoto.

### Paso 1 — Cambios de código (ya aplicado)

1. `gateway/litellm-config.yaml`: modelo `text-embedding-3-small` agregado (ver "Modelo de Datos").
2. `gateway/docker-compose.yml`: `OPENAI_API_KEY` propagada al servicio `litellm`.
3. `gateway/.env.example`, `gateway/README.md`, `DEPLOY_COOLIFY.md`: documentación actualizada.
4. Commit + push a `main` (convención de este repo para cambios de infra pequeños — ver historial de `expose-metrics-hub-domain`).

### Paso 2 — Dar de alta el secret en Coolify

1. Abrir la consola de Coolify → recurso `gateway` → Environment Variables (o el secret manager del recurso).
2. Agregar `OPENAI_API_KEY` con el valor real.
3. Confirmar que `ZAI_API_KEY`, `LITELLM_MASTER_KEY`, `POSTGRES_PASSWORD` (los secrets ya existentes) siguen intactos — este paso no debe tocarlos.

### Paso 3 — Agregar el dominio en Coolify

1. Ir a la sección "Domains" del recurso `gateway` (pestaña "General").
2. Agregar `https://gateway.omniaos.ai` — **con el esquema `https://` incluido desde el inicio** (INV-8 / gotcha ya conocido de `expose-metrics-hub-domain`: sin esquema, Coolify genera `Host('')` roto y Traefik responde `503`, incluso si el resto de la config es correcta).
3. Guardar. Coolify gestiona HTTPS (Let's Encrypt) automáticamente.
4. Confirmar que el DNS de `gateway.omniaos.ai` apunta a `148.113.203.22` (probablemente ya existe, dado que es el default ya referenciado en `memory/.env.example`).

### Paso 4 — Redeploy (con rebuild)

1. Disparar un redeploy del recurso `gateway` desde Coolify.
2. A diferencia de `metrics-hub`, este redeploy **sí necesita reconstruir la imagen** — `litellm-config.yaml` está horneado vía `COPY` en `gateway/Dockerfile` (ver "Naturaleza de Este Documento"). Si Coolify no dispara el rebuild automáticamente al detectar el push, forzarlo manualmente.
3. Esperar a que el contenedor `litellm` (y su dependencia `db`) reporten estado `healthy`/`running`.

### Paso 5 — Verificación

Ejecutar la validación manual de `3_test-plan.md`: acceso vía dominio con Bearer válido, sin Bearer, puerto directo bloqueado, llamada real de embeddings, y confirmación de que `Host()` no quedó vacío (contingencia de INV-8).

### Paso 6 — Emitir la virtual key para el chatbot y coordinar con Gibrán

1. Generar una virtual key dedicada para el chatbot (ver `gateway/README.md` → "Virtual keys por dev"), con `models` restringido a los que el chatbot realmente necesita (ej. `["glm", "text-embedding-3-small"]` si el chatbot también usa GLM para generación, o solo el modelo de embeddings si la generación grounded sigue por Claude — confirmar con el propio `chatbot/.env.example`, `KB_GENERATION_MODEL`).
2. Compartir la key y `LITELLM_BASE_URL=https://gateway.omniaos.ai` con Gibrán por el gestor de credenciales del equipo, no por chat sin cifrar.
3. Este paso no modifica el repo `chatbot` — su código ya sabe leer `LITELLM_BASE_URL`/`LITELLM_API_KEY` (ver `chatbot/src/knowledge/knowledge-config.ts`).

### Paso 7 — Documentar el resultado final

Confirmar que `DEPLOY_COOLIFY.md` ya no marca `gateway` como `[VERIFICAR]` (este cambio ya está aplicado en el código de esta spec, pendiente solo de que el Paso 5 confirme que es verdad en producción).

### Paso 8 — Rollback (si algo falla)

1. Si el problema es el modelo de embeddings (ej. `OPENAI_API_KEY` inválida): corregir el secret en Coolify y volver a redeploy — no requiere revertir código.
2. Si el problema es el dominio (Host roto, TLS pendiente): ajustar el campo "Domains" en Coolify — no requiere revertir código.
3. Si el problema es el código en sí (ej. YAML mal formado rompe el arranque de LiteLLM): `git revert` el commit del Paso 1, push, redeploy — el gateway vuelve a los tres modelos de chat originales, sin embeddings, mientras se corrige.
4. En ningún escenario se pierde el acceso ya existente por túnel SSH (`ssh -L 4000:127.0.0.1:4000 <user>@148.113.203.22`).

## Manejo de Errores

| Código / Señal | Escenario | Comportamiento esperado / Mensaje | Acción |
|---|---|---|---|
| `401`/`403` (de LiteLLM) | Request sin Bearer o con virtual key inválida/revocada | LiteLLM rechaza la request — mismo comportamiento que ya existe hoy vía el puerto directo. | Esperado — confirma INV-3. No es un síntoma de que Traefik esté agregando su propia auth. |
| `401`/`403` con header `WWW-Authenticate: Basic` | Aparecería solo si por error se agregó BasicAuth al dominio | Violaría INV-3 — significa que se implementó la alternativa descartada. | Revisar `docker-compose.yml`: no debe haber ningún label `traefik.http.middlewares.*.basicauth`. |
| Error de LiteLLM al llamar `/v1/embeddings` (ej. `AuthenticationError` de OpenAI) | `OPENAI_API_KEY` ausente o inválida en Coolify | LiteLLM devuelve un error explícito identificando el proveedor (OpenAI) y la causa. | Confirmar el secret en la consola de Coolify (Paso 2); no debería requerir cambios de código. |
| El contenedor `litellm` no arranca tras el redeploy | YAML mal formado en `litellm-config.yaml`, o falta rebuild | Logs del contenedor muestran un error de parseo de config al arrancar. | Revisar el log del deploy en Coolify; confirmar que el redeploy sí reconstruyó la imagen (Paso 4) y no solo recreó el contenedor con la imagen vieja. |
| `503` en el dominio | Mismo bug de `Host('')` visto en `metrics-hub` | El campo "Domains" se guardó sin esquema. | Editar el campo a `https://gateway.omniaos.ai` (con esquema) y volver a guardar/redeploy — ver Paso 3. |
| Conexión SÍ se establece por el puerto `4000` directo desde fuera del VPS | Algo modificó el binding de `docker-compose.yml` o el estado de `omnia-portblock` | Regresión de seguridad — viola INV-4. | Detener el rollout, revisar `git diff` sobre `gateway/docker-compose.yml` (debe limitarse a lo descrito en INV-1) y el estado de `omnia-portblock` vía OCC antes de continuar. |
| Los modelos de chat (`glm`, `glm-5.2`, `glm-4.7`) dejan de responder tras esta feature | El diff de `litellm-config.yaml` tocó algo más que el bloque nuevo | Viola INV-6. | Revisar `git diff` sobre `litellm-config.yaml`; debe ser estrictamente aditivo. |
