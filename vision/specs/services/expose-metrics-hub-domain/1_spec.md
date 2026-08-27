# Especificación Técnica: Exponer dominio autenticado para metrics-hub

## Metadata

```yaml
status: pending
version: 1
last_updated: 2026-08-26
category: services
```

## Historial de Cambios

- [ADDED] 2026-08-26: Versión inicial de la especificación.

Esta es la versión 1 de esta spec — sin cambios posteriores todavía. Futuras ediciones (ej. si se agrega `forwardAuth`/OAuth como se discute en "Alternativas Consideradas") deben registrarse aquí con la etiqueta `[CHANGED]` o `[ADDED]` correspondiente, siguiendo la convención de `/modifyspec`.

## Naturaleza de Este Documento

Esta spec describe una **acción operativa de infraestructura**, no una implementación de código. No hay clases, funciones ni módulos nuevos en `metrics-hub/`. El "algoritmo" de esta spec son pasos ejecutados a mano en la consola de Coolify y en una terminal para generar un hash; el "modelo de datos" son las labels de Traefik que Coolify aplica al contenedor. Se mantiene la estructura estándar de `1_spec.md` (invariantes, modelo, algoritmo, manejo de errores) porque describe con la misma precisión que exigiría código, pero el lector debe leer "Algoritmo" como un runbook, no como pseudocódigo de una función.

Esta distinción importa para quien retome esta spec vía `/executespec`: no hay un directorio de código para escribir ni un PR de `metrics-hub/` que abrir. "Implementar" esta spec significa ejecutar el runbook de la sección "Algoritmo" contra la consola real de Coolify y el VPS real, y luego escribir el único cambio de archivo que sí es de código: la actualización de `DEPLOY_COOLIFY.md` (Paso 6). Si `/executespec` se ejecuta sin acceso a Coolify, no puede completar esta feature — debe reportarlo como bloqueado en vez de simular la ejecución de los pasos.

## Invariantes

- **INV-1**: `metrics-hub/docker-compose.yml` no cambia como parte de esta feature. El puerto sigue publicado como `127.0.0.1:4320:4320` antes, durante y después de implementar esta spec.
- **INV-2**: El dominio configurado en Coolify enruta a `metrics-hub` vía la red interna de Docker (Traefik container-to-container), nunca a través del puerto publicado al host. Esto es lo que permite que la feature funcione *a pesar de* INV-1, no en contra de él.
- **INV-3**: Toda request al dominio sin credenciales BasicAuth válidas recibe `401` del middleware `basicauth` de Traefik antes de que la request llegue al proceso Node dentro del contenedor `metrics-hub`. El servidor de aplicación (`scripts/serve.mjs`) nunca ve una request sin autenticar exitosa.
- **INV-4**: El acceso directo a `<IP-del-VPS>:4320` desde fuera del VPS sigue sin funcionar tras esta feature. Esta feature no toca el binding a loopback ni el servicio `omnia-portblock` — son invariantes heredados de la política post-incidente (`82cba23`), no de esta spec, pero esta spec no debe romperlos.
- **INV-5**: Las credenciales BasicAuth (usuario + hash bcrypt) existen únicamente en la configuración del recurso `metrics-hub` dentro de Coolify (labels). Nunca se committean en texto plano ni en hash a `metrics-hub/docker-compose.yml`, a ningún `.env.example`, ni a ningún archivo de este repositorio.
- **INV-6**: El nombre del middleware Traefik (`metrics-auth` u otro elegido) y el nombre del router referenciado en `traefik.http.routers.<router-name>.middlewares` son específicos del recurso `metrics-hub` — no colisionan con middlewares o routers de los recursos `gateway` o `memory` en el mismo stack de Coolify.
- **INV-7**: La emisión del certificado TLS para el dominio elegido queda a cargo de Coolify (Let's Encrypt gestionado) — esta spec no introduce gestión manual de certificados.
- **INV-8**: El middleware BasicAuth se aplica al **router HTTP** del recurso, no a nivel global de Traefik — otros recursos de Coolify en el mismo VPS (`gateway`, `memory`) no ven ningún cambio de comportamiento como efecto secundario de esta feature.

Estas ocho invariantes son la referencia contra la que se valida cada AC de `2_acceptance-criteria.md`: cada AC existe para probar, con un comando concreto, que una de estas invariantes se sostiene en producción y no solo en la intención de esta spec.

## Stack Técnico

- **Proxy**: Traefik v2, embebido en Coolify como el contenedor `coolify-proxy` (confirmado corriendo en `server-omniaplatform` — ver `DEPLOY_COOLIFY.md`). Es el mismo proxy que ya enruta (o enrutaría) los dominios de `gateway` y `memory`; esta feature no introduce un proxy ni una instancia de Traefik nueva, reutiliza la existente.
- **Middleware de auth**: `traefik.http.middlewares.<nombre>.basicauth` — nativo de Traefik, no requiere ningún paquete ni dependencia adicional en `metrics-hub`. Se configura enteramente vía labels de Docker, que es el mecanismo que Coolify expone en su UI de "labels avanzadas" por recurso.
- **Generación de hash**: `htpasswd` (paquete `apache2-utils` en Debian/Ubuntu, o el generador de hash bcrypt embebido en la propia UI de Coolify si está disponible en la versión instalada). El algoritmo de hash debe ser bcrypt (flag `-B` de `htpasswd`) — Traefik también soporta MD5 y SHA1 vía `htpasswd`, pero bcrypt es el estándar recomendado actual y el que asume el bloque de "Modelo de Datos" de esta spec.
- **DNS/TLS**: gestionado por Coolify — registro A del dominio apuntando a `148.113.203.22`, certificado Let's Encrypt automático al agregar el dominio. No se gestiona TLS manualmente ni se sube ningún certificado a mano.
- Sin cambios al stack de aplicación de `metrics-hub` (Node ≥18, `scripts/serve.mjs`, sin dependencias nuevas en `package.json`). Esto es deliberado: toda la superficie nueva de esta feature vive en la capa de proxy, no en el código versionado del repo, lo cual mantiene la separación de responsabilidades ya establecida en `DEPLOY_COOLIFY.md` entre "qué corre en el contenedor" y "cómo se enruta desde afuera".

## Modelo de Datos

No aplica un modelo de datos de aplicación (no hay entidades ni interfaces TypeScript nuevas). El "modelo" relevante es el bloque de configuración de labels de Traefik que se agrega al recurso `metrics-hub` en Coolify:

```yaml
# Labels a agregar en Coolify → recurso "metrics-hub" → pestaña
# "Labels" / "Advanced → Proxy config" (el nombre exacto de la pestaña
# depende de la versión de Coolify instalada).
#
# <user>                    : usuario elegido para BasicAuth (ej. "team")
# <htpasswd-bcrypt-hash>    : hash generado con htpasswd -B (ver Algoritmo, paso 1)
# <router-name>             : nombre del router que Coolify autogenera para
#                              este recurso — visible en la pestaña de labels
#                              ya existentes del recurso, NO se inventa.
traefik.http.middlewares.metrics-auth.basicauth.users=<user>:<htpasswd-bcrypt-hash>
traefik.http.routers.<router-name>.middlewares=metrics-auth
```

Notas sobre este bloque:

- El nombre `metrics-auth` para el middleware es una sugerencia (cumple INV-6: es específico de `metrics-hub`, no colisiona con otros recursos). Puede renombrarse siempre que las dos labels usen el mismo nombre de forma consistente.
- `<router-name>` **no se inventa**: Coolify genera automáticamente uno o más routers Traefik por recurso (visibles como labels ya presentes en la config del recurso, con un patrón habitual del estilo `http-0-<uuid o slug>`). Hay que leer el nombre real desde la consola antes de escribir la segunda label.
- Ejemplo ilustrativo de lo que Coolify suele autogenerar para un recurso (los valores reales de `metrics-hub` se leen en la consola, no se copian de aquí):
  ```yaml
  traefik.enable=true
  traefik.http.routers.http-0-abc123.rule=Host(`<dominio>`)
  traefik.http.routers.http-0-abc123.entrypoints=http
  traefik.http.routers.https-0-abc123.rule=Host(`<dominio>`)
  traefik.http.routers.https-0-abc123.entrypoints=https
  traefik.http.routers.https-0-abc123.tls.certresolver=letsencrypt
  ```
  En este ejemplo, `<router-name>` sería `https-0-abc123` (el router HTTPS — el que importa proteger; el router `http-0-abc123` normalmente solo redirige a HTTPS y no sirve contenido directamente, pero conviene confirmarlo en la consola en vez de asumirlo).
- Si Coolify o Docker requieren escapar el carácter `$` dentro del hash bcrypt (comportamiento típico de labels de Docker Compose, donde `$` se interpreta como inicio de variable), cada `$` del hash se duplica a `$$` en el valor de la label. Verificar el comportamiento real al pegar el valor en la consola de Coolify — si el campo es un textarea de labels crudo (no pasa por interpolación de Compose), puede no ser necesario.

## Alternativas Consideradas

Documentado brevemente para que quien retome esta spec entienda por qué se eligió BasicAuth vía Traefik y no otra opción:

1. **Auth a nivel de aplicación dentro de `metrics-hub`** (agregar un login HTML/JS al dashboard, o un middleware Express con sesión). Descartado: agrega una dependencia nueva y superficie de código a un servicio que hoy es deliberadamente simple (HTML estático servido por `serve.mjs`, sin framework web). También movería la responsabilidad de seguridad al código de la app en vez de al proxy, que es justo el patrón que causó el incidente del 20-jul-2026 en `openmemory-ui` (se confió en que "algo" auth-icaría la app en vez de controlarlo en la capa de red/proxy).
2. **`forwardAuth` de Traefik contra un proveedor OAuth/SSO** (ej. Google, GitHub). Más robusto a largo plazo (permite revocar acceso por persona, no por credencial compartida), pero requiere registrar una app OAuth, definir a quién se le da acceso, y mantener esa integración — sobredimensionado para un dashboard interno de bajo riesgo relativo (no maneja secrets ni permite RCE, a diferencia de `openmemory-ui`). Queda como mejora futura si el equipo crece o si se decide unificar auth de todos los dashboards internos.
3. **IP allowlist en Traefik** (`ipwhitelist`/`ipallowlist` middleware) en vez de credenciales. Descartado como única medida: la mayoría del equipo no tiene IP fija (trabaja desde redes distintas), así que degradaría a "todos necesitan VPN o volver al túnel SSH" — no resuelve el problema de UX que motiva esta feature. Podría combinarse con BasicAuth en el futuro como capa adicional, pero no es parte de esta spec.
4. **BasicAuth vía Traefik (elegida).** Sin dependencias nuevas, sin cambios de código, configurable enteramente desde la consola de Coolify por alguien sin acceso de desarrollo, y suficiente para el nivel de riesgo real de este dashboard (lectura de métricas de commits/tokens del equipo, no datos sensibles ni capacidad de ejecución). Es exactamente el patrón que `DEPLOY_COOLIFY.md` ya sugiere para `openmemory-ui` si se llegara a reactivar ("Activarla solo detrás de Traefik BasicAuth o vía túnel, nunca expuesta directo") — esta spec aplica el mismo patrón ya validado conceptualmente en el propio repo.

## Algoritmo

Pasos a ejecutar en orden, por el humano con acceso a Coolify (Daniel):

### Paso 0 — Prerrequisitos

Antes de empezar, confirmar:

- Acceso de administrador/editor al recurso `metrics-hub` en la consola de Coolify.
- Capacidad de generar un hash bcrypt (`htpasswd` instalado localmente, o el generador embebido de Coolify si la versión instalada lo ofrece — ver "Manejo de Errores" para el caso en que ninguno esté disponible).
- Control sobre el DNS del dominio que se vaya a usar (poder crear/editar un registro A), salvo que se reutilice un wildcard ya configurado para `gateway`/`memory`. Si el dominio se registra en un proveedor distinto al que gestiona `omniaos.ai` hoy, resolver el acceso a ese registrador antes de continuar — no es parte del alcance de esta spec gestionar altas de dominio nuevas.
- Snapshot mental (o captura de pantalla) de la config actual del recurso `metrics-hub` en Coolify antes de tocar nada — no hay "git diff" para la config de Coolify como sí lo hay para `docker-compose.yml`, así que la única forma de poder revertir manualmente es haber visto el estado "antes".
- Un canal para guardar las credenciales generadas (Paso 1) fuera de este repo — un gestor de contraseñas del equipo, no un archivo local ni un mensaje de chat sin cifrar.

### Paso 1 — Generar el hash de credenciales

```bash
# Requiere htpasswd instalado (apache2-utils) o el generador embebido de Coolify si existe.
htpasswd -nbB <usuario-elegido> '<password-elegido>'
# Salida esperada, formato usuario:hash bcrypt:
# <usuario-elegido>:$2y$05$abcdefghijklmnopqrstuv...
```

Guardar el `<usuario-elegido>` y el hash resultante — se usan en el Paso 3.

### Paso 2 — Agregar el dominio en Coolify

1. Abrir la consola de Coolify → recurso `metrics-hub`.
2. Ir a la sección de dominios del recurso y agregar `<dominio a confirmar>` (ej. `metrics.omniaos.ai` — la elección final es del humano, no se fija en esta spec).
3. Habilitar HTTPS gestionado por Coolify (Let's Encrypt) para ese dominio.
4. Confirmar que el registro DNS tipo A del dominio elegido apunta a `148.113.203.22` (puede ya existir si se reutiliza un wildcard `*.omniaos.ai` ya configurado para `gateway`/`memory`).

### Paso 3 — Agregar las labels de Traefik BasicAuth

1. En el mismo recurso `metrics-hub`, ir a la pestaña de labels / configuración avanzada de proxy.
2. Leer el nombre del router autogenerado por Coolify para este recurso (ya presente entre las labels existentes).
3. Agregar las dos labels descritas en "Modelo de Datos", sustituyendo `<user>`, `<htpasswd-bcrypt-hash>` (Paso 1) y `<router-name>` (leído en el punto anterior) por los valores reales.
4. Guardar la configuración del recurso.

### Paso 4 — Redeploy

1. Disparar un redeploy del recurso `metrics-hub` desde Coolify.
2. No es necesario un rebuild de la imagen (`omnia/metrics-hub:latest` no cambia) — el redeploy solo necesita recargar la config de Traefik. Si Coolify no ofrece un "reload de proxy" separado, un redeploy estándar del recurso es suficiente.
3. Confirmar en el log de deploy de Coolify que el paso fue una recreación de contenedor con la imagen ya existente, no un `docker build` desde `metrics-hub/Dockerfile` — un build completo indicaría que Coolify interpretó el cambio como algo más que config de proxy, lo cual sería inesperado dado que no se tocó ningún archivo fuente.
4. Esperar a que el contenedor reporte estado `healthy`/`running` antes de pasar a la verificación (Paso 5) — un redeploy típicamente tarda unos segundos a pocos minutos, mucho menos que un build.
5. Si el redeploy dispara un build completo de todos modos, no es necesariamente un error — puede ser el comportamiento estándar de esa instalación de Coolify para cualquier cambio de config del recurso. Confirmarlo comparando contra el tiempo/log de un redeploy anterior sin cambios de labels, si existe alguno como referencia.

### Paso 5 — Verificación

Ejecutar las validaciones manuales descritas en `3_test-plan.md` (curl sin credenciales → 401, curl con credenciales → 200 + contenido del dashboard, puerto directo → sigue sin responder).

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
+ por Traefik (Coolify) con middleware BasicAuth (`metrics-auth`) —
+ configurado enteramente en la consola de Coolify (dominio + labels de
+ proxy avanzado), sin tocar `docker-compose.yml`. El puerto `4320`
+ directo sigue en loopback-only; el dominio es la única vía de acceso
+ remoto (además del túnel SSH, que sigue funcionando como fallback).
```

(El bloque `diff` de arriba ilustra la intención del cambio; el texto final debe reemplazar el placeholder `<dominio a confirmar>` con el dominio real una vez elegido en el Paso 2 — no antes.)

### Paso 7 — Rollback (si algo falla)

Si algún paso anterior no puede completarse o produce un resultado inesperado (ver "Manejo de Errores" abajo), el rollback es enteramente reversible desde la consola de Coolify, sin tocar el repo:

1. Quitar las dos labels de Traefik agregadas en el Paso 3 (o desactivar el dominio agregado en el Paso 2, según en qué punto se detectó el problema).
2. Redeploy del recurso para que Traefik recargue la config sin las labels.
3. Mientras tanto, el acceso por túnel SSH (`ssh -L 4320:127.0.0.1:4320 ...`) nunca dejó de funcionar — no hay ventana de indisponibilidad del dashboard para quien ya usaba el túnel, sea cual sea el resultado de esta feature.
4. Si el rollback se ejecuta, no hace falta revertir nada en `DEPLOY_COOLIFY.md` siempre que el Paso 6 (documentar el dominio) no se haya ejecutado todavía — por eso el Paso 6 está deliberadamente al final, después de la verificación del Paso 5, y no antes.

## Manejo de Errores

Al ser una acción operativa, esta tabla cubre tanto respuestas HTTP esperadas como fallas de configuración observables durante la ejecución del Algoritmo:

| Código / Señal | Escenario | Comportamiento esperado / Mensaje | Acción |
|---|---|---|---|
| `401` | Request sin header `Authorization`, o credenciales inválidas | Traefik responde `401 Unauthorized` con `WWW-Authenticate: Basic realm="..."`. El navegador muestra el prompt nativo de usuario/contraseña. | Comportamiento esperado — no es un error a corregir. Confirma INV-3. |
| `200` | Request con credenciales correctas | Se sirve el HTML de `dashboard/index.html` normalmente. | Comportamiento esperado. |
| Conexión rechazada / timeout | `curl` directo a `<IP-VPS>:4320` desde fuera del VPS | La conexión no se establece (loopback binding + `omnia-portblock`). | Comportamiento esperado — confirma INV-4. Si en cambio la conexión SÍ se establece, es una regresión de seguridad: detener el rollout y revisar si algo modificó el binding del puerto. |
| `404` / `502` / `503` en el dominio | El router de Traefik referenciado en la label no coincide con el router real del recurso, o el dominio no está correctamente enrutado | Traefik no encuentra el servicio detrás del dominio, o no aplica el middleware. | Releer el nombre del router autogenerado por Coolify (Paso 3.2) — es probable que `<router-name>` en la label no coincida exactamente. |
| Dashboard se sirve SIN pedir credenciales | El middleware `basicauth` no quedó aplicado al router correcto tras el redeploy | El dashboard es alcanzable sin autenticación — viola INV-3. | Verificar que la label `traefik.http.routers.<router-name>.middlewares` apunta al middleware correcto (`metrics-auth`) y forzar un redeploy completo del recurso (no solo un restart del contenedor). |
| `htpasswd: command not found` | El comando no está instalado en la máquina donde se genera el hash | El Paso 1 no puede ejecutarse localmente. | Instalar `apache2-utils` (Debian/Ubuntu) o `httpd-tools` (RHEL/Fedora), o usar el generador de hash bcrypt embebido en la propia UI de Coolify si la versión instalada lo ofrece. |
| Certificado TLS pendiente | El dominio se agregó pero Let's Encrypt aún no emitió el certificado | El navegador muestra advertencia de certificado inválido o la conexión HTTPS falla. | Esperar la emisión automática (unos minutos típicamente); confirmar que el DNS ya propagó antes de reportarlo como falla. |
| Conexión SÍ se establece por el puerto directo tras esta feature | Algo distinto a esta feature modificó el binding de `docker-compose.yml` o el estado de `omnia-portblock` | Regresión de seguridad — viola INV-4 | Detener el rollout de esta feature inmediatamente, revisar `git diff` sobre `metrics-hub/docker-compose.yml` (debe estar vacío, INV-1) y el estado de `omnia-portblock` en el VPS vía OCC (`nodes_get`/`services_list`) antes de continuar. |
| BasicAuth aparece en el dominio de `gateway` o `memory` | El middleware quedó atado al router equivocado (labels copiadas con el `<router-name>` de otro recurso) | Otro servicio empieza a pedir credenciales que no pedía antes — viola INV-8 | Revisar y corregir la label `traefik.http.routers.<router-name>.middlewares` para que apunte únicamente al router de `metrics-hub`; quitar cualquier label mal aplicada al recurso equivocado. |

## Resumen Ejecutivo

Checklist de implementación (a ejecutar por el humano con acceso a Coolify):

- [ ] Elegir usuario y contraseña para BasicAuth; generar el hash bcrypt con `htpasswd -nbB` (Paso 1).
- [ ] Elegir el dominio final (ej. `metrics.omniaos.ai`) y agregarlo al recurso `metrics-hub` en Coolify, con HTTPS gestionado (Paso 2).
- [ ] Confirmar que el DNS del dominio elegido apunta a `148.113.203.22`.
- [ ] Leer el nombre real del router Traefik autogenerado por Coolify para `metrics-hub`.
- [ ] Agregar las dos labels de Traefik (`basicauth.users` + `routers.<router>.middlewares`) en la config avanzada del recurso (Paso 3).
- [ ] Redeploy del recurso `metrics-hub` (Paso 4).
- [ ] Ejecutar la validación manual completa de `3_test-plan.md` (Paso 5).
- [ ] Confirmar que `docker-compose.yml` de `metrics-hub` sigue sin cambios (INV-1) y que el puerto directo `4320` sigue sin responder desde fuera (INV-4).
- [ ] Actualizar `DEPLOY_COOLIFY.md` con el dominio final, reemplazando el placeholder (Paso 6).
- [ ] Correr `/onspecomplete expose-metrics-hub-domain` una vez validado todo lo anterior.

Nota final para quien ejecute esta checklist: cada casilla debe cerrarse con evidencia verificable (el output real de un comando, o una captura de la consola de Coolify), no de memoria — ver la sección "Definición de 'Hecho'" en `2_acceptance-criteria.md` para el criterio exacto de cierre de la feature.
