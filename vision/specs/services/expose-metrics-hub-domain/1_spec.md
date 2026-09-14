# Especificación Técnica: Exponer dominio autenticado para metrics-hub

## Metadata

```yaml
status: done
version: 5
last_updated: 2026-08-28
category: services
```

## Historial de Cambios

- [ADDED] 2026-08-26: Versión inicial de la especificación.
- [MODIFIED] 2026-08-26 (cambio mayor): esta instalación de Coolify (v4.0.0) no tiene pestaña de "Labels" en la UI para recursos tipo Docker Compose — confirmado revisando "Advanced" y "Environment Variables" del recurso `metrics-hub`, ninguna expone labels de Traefik (esa UI solo existe para recursos tipo "Application"/Dockerfile/Nixpacks). Se invalida el supuesto original de INV-1 e INV-5 (config 100% fuera del repo). Nuevo diseño: las labels de Traefik (incluido el hash bcrypt de las credenciales) se agregan directamente a `metrics-hub/docker-compose.yml` y se commitean a git — la contraseña en texto plano nunca se guarda en ningún archivo. Se reemplaza el enfoque de "leer el router-name autogenerado en la consola" por el label especial `coolify.traefik.middlewares`, que engancha el middleware al router de Coolify sin necesitar conocer su nombre. Afecta: Invariantes, Modelo de Datos, Algoritmo (Pasos 3, 4, 7), Manejo de Errores, Resumen Ejecutivo.
- [MODIFIED] 2026-08-27 (ejecución real, dos hallazgos): (1) **Bloqueador resuelto** — `omnia-portblock.sh` en el VPS bloqueaba `80`/`443` además de los puertos de apps, dejando *cualquier* dominio público inalcanzable desde el fix del 24-jul-2026 (confirmado con `tcpdump`: el SYN externo llegaba a `ens3` pero nunca había respuesta — descartado firewall de OVH/Edge Firewall, que estaba desactivado). Corregido y versionado en `infra/vps/`. (2) **Bloqueador abierto en ese momento** — con 80/443 ya libres, Traefik respondía pero el router que Coolify generaba para este recurso traía `Host(\`\`) && PathPrefix(\`metrics.omniaos.ai\`)` (Host vacío) en vez de `Host(\`metrics.omniaos.ai\`)`, causando `503 no available server`. Persistía tras desactivar "Strip Prefixes" y tras agregar labels de override manual en el compose. Hipótesis planteada aquí (el parser de Coolify no maneja el prefijo `127.0.0.1:` de `ports:`) — **resultó incorrecta**, ver el siguiente entry para la causa real. Se decidió explícitamente no probar quitar ese prefijo como atajo (habría reducido la defensa en profundidad sin necesidad).
- [MODIFIED] 2026-08-28 (resuelto — causa real distinta a la hipótesis anterior): el bug del `Host()` vacío no era por el `ports:` del compose. Eran dos problemas de configuración en la propia consola de Coolify, ninguno relacionado con `docker-compose.yml`: **(a)** el campo "Domains for metrics-hub" necesitaba el esquema completo (`https://metrics.omniaos.ai`), no el dominio a secas — sin el esquema, Coolify regenera y pisa el `rule` del router en cada redeploy con la construcción rota, sin importar qué label manual haya en el compose; **(b)** el toggle "Escape special characters in labels?" debía quedar desactivado porque el compose ya escapaba `$` a mano (`$$`) — con el toggle activo además, Coolify aplicaba un segundo escape y el hash bcrypt quedaba corrupto en silencio. Corregidos ambos desde la consola de Coolify (sin cambios de código); verificado en producción: `https://metrics.omniaos.ai` responde `401` sin credenciales y `200` con ellas. Feature cerrada vía `/onspecomplete` (ver `vision-status.json`, `0_contract.md`). Afecta: Manejo de Errores, Resumen Ejecutivo.

Futuras ediciones deben registrarse aquí con la etiqueta `[CHANGED]`, `[ADDED]` o `[REMOVED]` correspondiente, siguiendo la convención de `/modifyspec`.

## Naturaleza de Este Documento

Esta spec describe una **acción operativa de infraestructura**, con un componente de código acotado y deliberado (el bloque `labels:` en `metrics-hub/docker-compose.yml`). No hay clases, funciones ni módulos de aplicación nuevos — `metrics-hub/scripts/`, `metrics-hub/dashboard/` y `metrics-hub/Dockerfile` no cambian. El "algoritmo" de esta spec mezcla un paso de terminal (generar un hash), una edición de archivo versionado (las labels), y pasos ejecutados a mano en la consola de Coolify (dominio, redeploy). Se mantiene la estructura estándar de `1_spec.md` (invariantes, modelo, algoritmo, manejo de errores) porque describe con la misma precisión que exigiría código, pero el lector debe leer "Algoritmo" como un runbook, no como pseudocódigo de una función.

Esta distinción importa para quien retome esta spec vía `/executespec`: sí hay un cambio de archivo de código real esta vez (`metrics-hub/docker-compose.yml`, Paso 3), además de la actualización de `DEPLOY_COOLIFY.md` (Paso 6). El resto (dominio, redeploy, verificación) sigue viviendo en la consola real de Coolify y el VPS real. Si `/executespec` se ejecuta sin acceso a Coolify, no puede completar el Paso 2 ni el Paso 4 — debe reportarlo como bloqueado en vez de simular la ejecución de esos pasos, aunque sí puede escribir el cambio de `docker-compose.yml` (Paso 3) de forma aislada si se le pide explícitamente.

## Invariantes

- **INV-1**: El único cambio a `metrics-hub/docker-compose.yml` es la adición de un bloque `labels:` al servicio `metrics-hub`, con exactamente las dos labels descritas en "Modelo de Datos". Ninguna otra sección del archivo (`ports`, `environment`, `image`, `volumes`, `build`, `restart`) cambia como parte de esta feature. El binding `127.0.0.1:4320:4320` sigue idéntico.
- **INV-2**: El dominio configurado en Coolify enruta a `metrics-hub` vía la red interna de Docker (Traefik container-to-container), nunca a través del puerto publicado al host. Esto es lo que permite que la feature funcione *a pesar de* que el puerto siga en loopback, no en contra de esa política.
- **INV-3**: Toda request al dominio sin credenciales BasicAuth válidas recibe `401` del middleware `basicauth` de Traefik antes de que la request llegue al proceso Node dentro del contenedor `metrics-hub`. El servidor de aplicación (`scripts/serve.mjs`) nunca ve una request sin autenticar exitosa.
- **INV-4**: El acceso directo a `<IP-del-VPS>:4320` desde fuera del VPS sigue sin funcionar tras esta feature. Esta feature no toca el binding a loopback ni el servicio `omnia-portblock` — son invariantes heredados de la política post-incidente (`82cba23`), no de esta spec, pero esta spec no debe romperlos.
- **INV-5**: El hash bcrypt de las credenciales BasicAuth **sí se commitea** a `metrics-hub/docker-compose.yml` — es un hash unidireccional, diseñado para almacenarse (igual que cualquier hash de password en una base de datos de auth). Lo que **nunca** se guarda en ningún archivo, commit, mensaje de commit, ni historial de git de este repositorio es la **contraseña en texto plano**: existe solo momentáneamente en la terminal de quien la genera (Paso 1) y en el gestor de contraseñas del equipo donde se archiva después.
- **INV-6**: El middleware Traefik (`metrics-auth`) es específico del recurso `metrics-hub` — el label `coolify.traefik.middlewares` solo se aplica al contenedor donde está declarado (el propio `metrics-hub`), nunca globalmente ni a otros recursos del mismo stack de Coolify (`gateway`, `memory`).
- **INV-7**: La emisión del certificado TLS para el dominio elegido queda a cargo de Coolify (Let's Encrypt gestionado) — esta spec no introduce gestión manual de certificados.
- **INV-8**: El middleware BasicAuth queda atado al router HTTP que Coolify autogenera para `metrics-hub` mediante el mecanismo `coolify.traefik.middlewares` — no se edita ni se referencia manualmente un nombre de router. Este mecanismo es, por diseño de Coolify, específico al contenedor donde se declara la label.
- **INV-9 (nueva)**: Existe un riesgo documentado — no eliminado por esta spec — de que Coolify ignore o sobreescriba labels personalizadas en deploys tipo Docker Compose (ver issues públicos del proyecto). La sola presencia de la label en `docker-compose.yml` **no es prueba** de que el middleware esté activo; la única confirmación confiable es la verificación empírica post-deploy (`curl` con y sin credenciales, Paso 5 / `3_test-plan.md`).

Estas nueve invariantes son la referencia contra la que se valida cada AC de `2_acceptance-criteria.md`: cada AC existe para probar, con un comando concreto, que una de estas invariantes se sostiene en producción y no solo en la intención de esta spec.

## Stack Técnico

- **Proxy**: Traefik v2, embebido en Coolify como el contenedor `coolify-proxy` (confirmado corriendo en `server-omniaplatform` — ver `DEPLOY_COOLIFY.md`). Es el mismo proxy que ya enruta (o enrutaría) los dominios de `gateway` y `memory`; esta feature no introduce un proxy ni una instancia de Traefik nueva, reutiliza la existente.
- **Middleware de auth**: `traefik.http.middlewares.<nombre>.basicauth` — nativo de Traefik, no requiere ningún paquete ni dependencia adicional en `metrics-hub`. Se configura escribiendo las labels directamente en `metrics-hub/docker-compose.yml` — no existe una pestaña de labels separada en la UI de Coolify para recursos tipo Docker Compose en esta instalación (v4.0.0), a diferencia de recursos tipo "Application" donde sí existe. El enganche al router usa el label especial `coolify.traefik.middlewares` (mecanismo documentado de Coolify para este escenario exacto).
- **Generación de hash**: `htpasswd` (paquete `apache2-utils` en Debian/Ubuntu, `httpd-tools` en RHEL/Fedora). En Windows sin `htpasswd` instalado, la alternativa es Docker: `docker run --rm httpd:alpine htpasswd -nbB <usuario> '<password>'`. El algoritmo de hash debe ser bcrypt (flag `-B`) — Traefik también soporta MD5 y SHA1 vía `htpasswd`, pero bcrypt es el estándar recomendado actual y el que asume el bloque de "Modelo de Datos" de esta spec.
- **DNS/TLS**: gestionado por Coolify — registro A del dominio apuntando a `148.113.203.22`, certificado Let's Encrypt automático al agregar el dominio. No se gestiona TLS manualmente ni se sube ningún certificado a mano.
- Sin cambios al stack de aplicación de `metrics-hub` (Node ≥18, `scripts/serve.mjs`, sin dependencias nuevas en `package.json`). Esto sigue siendo deliberado: la única superficie nueva de esta feature en el código versionado es un bloque de labels declarativas, no lógica de aplicación — la separación de responsabilidades entre "qué corre en el contenedor" y "cómo se enruta desde afuera" se mantiene, solo que ahora ese "cómo se enruta" vive parcialmente en el repo (labels) y parcialmente en Coolify (dominio).

## Modelo de Datos

No aplica un modelo de datos de aplicación (no hay entidades ni interfaces TypeScript nuevas). El "modelo" relevante es el bloque `labels:` que se agrega al servicio `metrics-hub` en `metrics-hub/docker-compose.yml`:

```yaml
# Agregar bajo services.metrics-hub en metrics-hub/docker-compose.yml.
#
# <user>                    : usuario elegido para BasicAuth (ej. "team").
# <htpasswd-bcrypt-hash>    : hash generado con htpasswd -B (ver Algoritmo, Paso 1),
#                              con cada '$' duplicado a '$$'. Docker Compose
#                              interpola '$' como inicio de referencia a variable;
#                              '$$' es el escape literal para un '$' real.
labels:
  - "traefik.http.middlewares.metrics-auth.basicauth.users=<user>:<htpasswd-bcrypt-hash-con-$$-escapado>"
  - "coolify.traefik.middlewares=metrics-auth"
```

Notas sobre este bloque:

- **`coolify.traefik.middlewares`** es un label especial que Coolify lee durante el deploy: toma la lista de nombres de middleware (separados por coma si hay más de uno) y los agrega a la cadena de middlewares del router que Coolify autogenera para el recurso — sin que quien escribe el compose necesite conocer o adivinar el nombre real de ese router (a diferencia del enfoque descartado en la versión anterior de esta spec, que asumía una consola donde leerlo). Es el mecanismo oficialmente documentado por Coolify para este escenario.
- El nombre `metrics-auth` para el middleware es una sugerencia (cumple INV-6: es específico de `metrics-hub`). Puede renombrarse siempre que las dos labels usen el mismo nombre de forma consistente.
- **Riesgo conocido (INV-9)**: hay issues públicos de Coolify documentando que, para deploys tipo Docker Compose específicamente, labels personalizadas a veces quedan ignoradas o sobreescritas por las que Coolify genera después. Esta spec no puede garantizar por adelantado que el mecanismo funcione en esta instalación exacta — el Paso 5 (verificación) es obligatorio, no opcional, precisamente por esto.
- El escapado de `$` a `$$` es obligatorio porque estas labels se escriben en el YAML del compose file (parseado por Docker Compose), no pegadas en un campo de texto de una UI que podría o no re-interpolar. Si al pegar el hash real aparecen menos de los `$` esperados tras el deploy (visible en "Show Deployable Compose" de Coolify, o inspeccionando el contenedor), es señal de que falta escapar.

## Alternativas Consideradas

Documentado brevemente para que quien retome esta spec entienda por qué se eligió BasicAuth vía Traefik y no otra opción:

1. **Auth a nivel de aplicación dentro de `metrics-hub`** (agregar un login HTML/JS al dashboard, o un middleware Express con sesión). Descartado: agrega una dependencia nueva y superficie de código a un servicio que hoy es deliberadamente simple (HTML estático servido por `serve.mjs`, sin framework web). También movería la responsabilidad de seguridad al código de la app en vez de al proxy, que es justo el patrón que causó el incidente del 20-jul-2026 en `openmemory-ui` (se confió en que "algo" auth-icaría la app en vez de controlarlo en la capa de red/proxy).
2. **`forwardAuth` de Traefik contra un proveedor OAuth/SSO** (ej. Google, GitHub). Más robusto a largo plazo (permite revocar acceso por persona, no por credencial compartida), pero requiere registrar una app OAuth, definir a quién se le da acceso, y mantener esa integración — sobredimensionado para un dashboard interno de bajo riesgo relativo (no maneja secrets ni permite RCE, a diferencia de `openmemory-ui`). Queda como mejora futura si el equipo crece o si se decide unificar auth de todos los dashboards internos.
3. **IP allowlist en Traefik** (`ipwhitelist`/`ipallowlist` middleware) en vez de credenciales. Descartado como única medida: la mayoría del equipo no tiene IP fija (trabaja desde redes distintas), así que degradaría a "todos necesitan VPN o volver al túnel SSH" — no resuelve el problema de UX que motiva esta feature. Podría combinarse con BasicAuth en el futuro como capa adicional, pero no es parte de esta spec.
4. **BasicAuth vía Traefik (elegida).** Sin dependencias nuevas, sin cambios de código de aplicación (el único cambio de código es declarativo: dos labels), y suficiente para el nivel de riesgo real de este dashboard (lectura de métricas de commits/tokens del equipo, no datos sensibles ni capacidad de ejecución). Requiere una edición puntual y acotada de `metrics-hub/docker-compose.yml` — no es "enteramente consola" como se asumió en la v1 de esta spec, pero sigue siendo mínimo: dos líneas, sin dependencias, reversible con un `git revert`. Es exactamente el patrón que `DEPLOY_COOLIFY.md` ya sugiere para `openmemory-ui` si se llegara a reactivar ("Activarla solo detrás de Traefik BasicAuth o vía túnel, nunca expuesta directo") — esta spec aplica el mismo patrón ya validado conceptualmente en el propio repo.

## Algoritmo

Pasos a ejecutar en orden, por el humano con acceso a Coolify y al repo (Daniel):

### Paso 0 — Prerrequisitos

Antes de empezar, confirmar:

- Acceso de administrador/editor al recurso `metrics-hub` en la consola de Coolify.
- Capacidad de generar un hash bcrypt (`htpasswd` instalado localmente, o `docker run --rm httpd:alpine htpasswd -nbB ...` si no — ver "Manejo de Errores").
- Acceso de escritura al repo `vision-infra` (para el Paso 3) y a su remoto (para el Paso 3.3).
- Control sobre el DNS del dominio que se vaya a usar (poder crear/editar un registro A), salvo que se reutilice un wildcard ya configurado para `gateway`/`memory`. Si el dominio se registra en un proveedor distinto al que gestiona `omniaos.ai` hoy, resolver el acceso a ese registrador antes de continuar — no es parte del alcance de esta spec gestionar altas de dominio nuevas.
- Un canal para guardar las credenciales generadas (Paso 1) fuera de este repo — un gestor de contraseñas del equipo, no un archivo local ni un mensaje de chat sin cifrar.

### Paso 1 — Generar el hash de credenciales

```bash
# Linux/Mac con apache2-utils instalado:
htpasswd -nbB <usuario-elegido> '<password-elegido>'

# Windows sin htpasswd, vía Docker:
docker run --rm httpd:alpine htpasswd -nbB <usuario-elegido> '<password-elegido>'

# Salida esperada, formato usuario:hash bcrypt:
# <usuario-elegido>:$2y$05$abcdefghijklmnopqrstuv...
```

Guardar el `<usuario-elegido>` y el hash resultante — se usan en el Paso 3. La contraseña en texto plano no se guarda en ningún archivo (INV-5) — solo en el gestor de contraseñas del equipo.

### Paso 2 — Agregar el dominio en Coolify

1. Abrir la consola de Coolify → recurso `metrics-hub`.
2. Ir a la sección "Domains" del recurso (pestaña "General") y agregar `<dominio a confirmar>` (ej. `metrics.omniaos.ai` — la elección final es del humano, no se fija en esta spec).
3. Guardar. Coolify gestiona HTTPS (Let's Encrypt) automáticamente para dominios agregados así.
4. Confirmar que el registro DNS tipo A del dominio elegido apunta a `148.113.203.22` (puede ya existir si se reutiliza un wildcard `*.omniaos.ai` ya configurado para `gateway`/`memory`).

### Paso 3 — Agregar las labels de Traefik BasicAuth a `docker-compose.yml`

1. Editar `metrics-hub/docker-compose.yml`: agregar un bloque `labels:` al servicio `metrics-hub` con las dos labels descritas en "Modelo de Datos".
2. Sustituir `<user>` y `<htpasswd-bcrypt-hash>` por los valores reales del Paso 1, duplicando cada `$` del hash a `$$`.
3. Commit del cambio (ej. `feat(metrics-hub): agregar BasicAuth vía Traefik`) y push a `main` (convención de este repo — no usa ramas de feature para cambios de infra pequeños, ver historial reciente).
4. Si el recurso `metrics-hub` en Coolify tiene "Auto Deploy" habilitado (Advanced → Deployment), el push dispara el redeploy automáticamente — continuar al Paso 5 tras confirmar que terminó. Si no, continuar al Paso 4.

### Paso 4 — Redeploy manual (si no hubo auto-deploy)

1. Disparar un redeploy del recurso `metrics-hub` desde Coolify.
2. No es necesario un rebuild de la imagen (`omnia/metrics-hub:latest` no cambia por esta feature) — el redeploy solo necesita recrear el contenedor con las nuevas labels. Si Coolify dispara un build completo de todos modos, no es necesariamente un error — puede ser el comportamiento estándar de esa instalación para cualquier cambio de compose. Confirmarlo comparando contra el tiempo/log de un redeploy anterior sin cambios, si existe alguno como referencia.
3. Esperar a que el contenedor reporte estado `healthy`/`running` antes de pasar a la verificación (Paso 5).

### Paso 5 — Verificación

Ejecutar las validaciones manuales descritas en `3_test-plan.md` (curl sin credenciales → 401, curl con credenciales → 200 + contenido del dashboard, puerto directo → sigue sin responder, labels efectivas del contenedor → confirmar que el middleware realmente quedó aplicado, no asumirlo por la sola presencia en el archivo — INV-9).

### Paso 6 — Documentar el dominio final

Una vez el dominio elegido en el Paso 2 esté confirmado funcionando (Paso 5 exitoso), actualizar `DEPLOY_COOLIFY.md`:

```diff
- Puerto `4320`, loopback-only, **sin dominio configurado** — a diferencia
- de gateway/memory, no hay ninguna referencia a un dominio `*.omniaos.ai`
- en su config. Acceso hoy: túnel SSH manual
- (`ssh -L 4320:127.0.0.1:4320 <user>@148.113.203.22`). Ponerle Traefik +
- BasicAuth vía la consola de Coolify (dominio + middleware, sin tocar el
- `docker-compose.yml`) es el punto 6 de la lista de pendientes del repo.
+ Puerto `4320`, loopback-only. Dominio: `<dominio a confirmar>`, servido
+ por Traefik (Coolify) con middleware BasicAuth (`metrics-auth`), definido
+ como labels en `metrics-hub/docker-compose.yml` (el hash bcrypt vive en
+ el repo; la contraseña en texto plano nunca). El puerto `4320` directo
+ sigue en loopback-only; el dominio es la única vía de acceso remoto
+ además del túnel SSH, que sigue funcionando como fallback.
```

(El bloque `diff` de arriba ilustra la intención del cambio; el texto final debe reemplazar el placeholder `<dominio a confirmar>` con el dominio real una vez elegido en el Paso 2 — no antes.)

### Paso 7 — Rollback (si algo falla)

Si algún paso anterior no puede completarse o produce un resultado inesperado (ver "Manejo de Errores" abajo):

1. `git revert` el commit del Paso 3 (o editar `metrics-hub/docker-compose.yml` a mano quitando el bloque `labels:`), push.
2. Esto dispara un nuevo redeploy (auto o manual) que recrea el contenedor sin las labels de BasicAuth.
3. Si el problema era solo del dominio (Paso 2) y no de las labels, desactivar/quitar el dominio agregado en Coolify en vez de tocar el repo.
4. Mientras tanto, el acceso por túnel SSH (`ssh -L 4320:127.0.0.1:4320 ...`) nunca dejó de funcionar — no hay ventana de indisponibilidad del dashboard para quien ya usaba el túnel, sea cual sea el resultado de esta feature.
5. Si el rollback se ejecuta, no hace falta revertir nada en `DEPLOY_COOLIFY.md` siempre que el Paso 6 (documentar el dominio) no se haya ejecutado todavía — por eso el Paso 6 está deliberadamente al final, después de la verificación del Paso 5, y no antes.

## Manejo de Errores

Al ser una acción operativa, esta tabla cubre tanto respuestas HTTP esperadas como fallas de configuración observables durante la ejecución del Algoritmo:

| Código / Señal | Escenario | Comportamiento esperado / Mensaje | Acción |
|---|---|---|---|
| `401` | Request sin header `Authorization`, o credenciales inválidas | Traefik responde `401 Unauthorized` con `WWW-Authenticate: Basic realm="..."`. El navegador muestra el prompt nativo de usuario/contraseña. | Comportamiento esperado — no es un error a corregir. Confirma INV-3. |
| `200` | Request con credenciales correctas | Se sirve el HTML de `dashboard/index.html` normalmente. | Comportamiento esperado. |
| Conexión rechazada / timeout | `curl` directo a `<IP-VPS>:4320` desde fuera del VPS | La conexión no se establece (loopback binding + `omnia-portblock`). | Comportamiento esperado — confirma INV-4. Si en cambio la conexión SÍ se establece, es una regresión de seguridad: detener el rollout y revisar si algo modificó el binding del puerto. |
| Dashboard se sirve SIN pedir credenciales tras el deploy | El label `coolify.traefik.middlewares` fue ignorado o sobreescrito por Coolify — riesgo documentado en INV-9 para deploys tipo Docker Compose | El dashboard es alcanzable sin autenticación — viola INV-3. | Inspeccionar las labels efectivas del contenedor corriendo en el VPS (`docker inspect metrics-hub-... \| grep traefik`, vía OCC `script_run` o SSH directo) para confirmar si el middleware realmente se aplicó. Si el label no aparece en el contenedor real, es un límite de esta versión/instalación de Coolify — no reintentar ciegamente; documentar el hallazgo y evaluar una alternativa (ej. definir el router completo a mano en las labels en vez de depender del atajo `coolify.traefik.middlewares`). |
| `404` / `502` / `503` en el dominio | El dominio no está correctamente enrutado, o hay un problema no relacionado con las labels de auth | Traefik no encuentra el servicio detrás del dominio. | Confirmar primero que el dominio funciona SIN las labels de BasicAuth (comentarlas temporalmente, redeploy, probar) para aislar si el problema es el dominio en sí o el middleware. |
| `503 no available server` (resuelto 2026-08-28) | El campo "Domains for `<recurso>`" en Coolify sin el esquema `https://` — Coolify regenera el router en cada redeploy a partir de ese campo, ignorando cualquier label `.rule` manual en el compose | El dominio nunca enruta al servicio real, con o sin BasicAuth | Poner el dominio completo con esquema (`https://metrics.omniaos.ai`) en el campo de Coolify, no solo el hostname. Ya se habían descartado, correctamente, "Strip Prefixes" y overrides manuales de `.rule`/`.middlewares` en el compose como causa — el problema nunca estuvo en el repo. |
| Dashboard responde `200` sin pedir credenciales, o Traefik rechaza el hash bcrypt como inválido | El toggle "Escape special characters in labels?" activo además del escape manual `$$` ya presente en el compose — doble escape corrompe el hash en silencio | BasicAuth no protege nada, o rechaza incluso las credenciales correctas, sin ningún error visible en el deploy | Desactivar "Escape special characters in labels?" en Configuration → General → Docker Compose para este recurso — el compose ya trae el escape manual correcto, no necesita el de Coolify encima. |
| `htpasswd: command not found` | El comando no está instalado en la máquina donde se genera el hash | El Paso 1 no puede ejecutarse localmente. | Instalar `apache2-utils` (Debian/Ubuntu) o `httpd-tools` (RHEL/Fedora), o usar `docker run --rm httpd:alpine htpasswd -nbB ...` (funciona en cualquier máquina con Docker, incluyendo Windows). |
| Certificado TLS pendiente | El dominio se agregó pero Let's Encrypt aún no emitió el certificado | El navegador muestra advertencia de certificado inválido o la conexión HTTPS falla. | Esperar la emisión automática (unos minutos típicamente); confirmar que el DNS ya propagó antes de reportarlo como falla. |
| Conexión SÍ se establece por el puerto directo tras esta feature | Algo distinto a esta feature modificó el binding de `docker-compose.yml` o el estado de `omnia-portblock` | Regresión de seguridad — viola INV-4 | Detener el rollout de esta feature inmediatamente, revisar `git diff` sobre `metrics-hub/docker-compose.yml` (debe tocar únicamente el bloque `labels:`, ver INV-1) y el estado de `omnia-portblock` en el VPS vía OCC (`nodes_get`/`services_list`) antes de continuar. |
| BasicAuth aparece en el dominio de `gateway` o `memory` | El label `coolify.traefik.middlewares` se agregó por error al recurso equivocado (copy-paste entre compose files) | Otro servicio empieza a pedir credenciales que no pedía antes — viola INV-6 | Revisar que las labels solo estén presentes en el servicio `metrics-hub` de `metrics-hub/docker-compose.yml`, no en `gateway/docker-compose.yml` ni `memory/docker-compose.yml`. Quitar cualquier label mal aplicada al archivo equivocado. |

## Resumen Ejecutivo

Checklist de implementación (a ejecutar por el humano con acceso a Coolify y al repo):

- [x] Elegir usuario y contraseña para BasicAuth; generar el hash bcrypt con `htpasswd -nbB` o su equivalente Docker (Paso 1). — `daniel@omniaos.ai`, 2026-08-27.
- [x] Elegir el dominio final (`metrics.omniaos.ai`) y agregarlo al recurso `metrics-hub` en Coolify, con HTTPS gestionado (Paso 2).
- [x] Confirmar que el DNS del dominio elegido apunta a `148.113.203.22`. — resuelve correctamente desde el 2026-08-27.
- [x] Editar `metrics-hub/docker-compose.yml`: agregar el bloque `labels:` con las labels de Traefik (Paso 3), escapando `$` a `$$` en el hash. — commits `8a7136f`, `84f7a54`.
- [x] Commit + push del cambio.
- [x] Confirmar redeploy (automático o manual) del recurso `metrics-hub` (Paso 4). — Auto Deploy está desactivado; cada cambio necesitó redeploy manual.
- [x] Ejecutar la validación manual completa de `3_test-plan.md` (Paso 5) — `https://metrics.omniaos.ai` responde `401` sin credenciales y `200` con ellas (verificado 2026-08-28, tras corregir el esquema del dominio y el toggle de doble escape en Coolify).
- [x] Confirmar que `docker-compose.yml` de `metrics-hub` solo cambió en el bloque `labels:` (INV-1) y que el puerto directo `4320` sigue sin responder desde fuera (INV-4).
- [x] Actualizar `DEPLOY_COOLIFY.md` con el dominio final y los dos gotchas de configuración de Coolify (esquema del dominio, toggle de escape).
- [x] Correr `/onspecomplete expose-metrics-hub-domain` — feature cerrada 2026-08-28.

**Hallazgo colateral, ya resuelto, fuera del alcance original de esta spec pero descubierto ejecutándola:** `omnia-portblock.sh` en el VPS bloqueaba también los puertos `80`/`443` (los de Traefik), dejando *cualquier* dominio de este repo inalcanzable desde el fix del 24-jul-2026 — no un problema del proveedor, como se sospechó dos veces antes de encontrar esto. Corregido y versionado en `infra/vps/`. Este hallazgo es prerequisito para `gateway`/`memory` también, no solo para esta feature.

Nota final para quien ejecute esta checklist: cada casilla debe cerrarse con evidencia verificable (el output real de un comando, o una captura de la consola de Coolify), no de memoria — ver la sección "Definición de 'Hecho'" en `2_acceptance-criteria.md` para el criterio exacto de cierre de la feature.
