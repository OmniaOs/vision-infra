# Criterios de Aceptación: Exponer dominio autenticado para metrics-hub

## Metadata

```yaml
feature: expose-metrics-hub-domain
version: 1
last_updated: 2026-08-26
```

> **Nota (2026-08-26, vía `/modifyspec`):** AC-005, AC-009 y AC-012 se reescribieron tras descubrir que esta instalación de Coolify no tiene UI de labels para recursos Docker Compose. Ver `1_spec.md` → Historial de Cambios.

## Resumen Ejecutivo

Total de criterios: **12**, agrupados en 4 categorías:

1. Acceso autenticado (AC-001 a AC-003)
2. Regresión de seguridad post-incidente (AC-004 a AC-006)
3. Configuración de Coolify / infraestructura (AC-007 a AC-010)
4. Documentación (AC-011 a AC-012)

Todos los criterios se verifican manualmente (curl + navegador + inspección de la consola de Coolify) — ver `3_test-plan.md`. No hay un runner automatizado que ejecute estos ACs.

---

## 1. Acceso autenticado

### AC-001: El dominio sirve el dashboard con credenciales correctas

**Given** el dominio de `metrics-hub` está configurado en Coolify con el middleware BasicAuth aplicado y el certificado TLS emitido,
**When** un usuario visita `https://<dominio>/` (o hace `curl -u <usuario>:<password> https://<dominio>/`) con las credenciales correctas,
**Then** la respuesta es `200 OK` y el cuerpo contiene el HTML del dashboard (`dashboard/index.html`, el mismo contenido que serviría `scripts/serve.mjs` sin el proxy).

### AC-002: Request sin credenciales recibe el challenge BasicAuth, no el dashboard

**Given** el dominio de `metrics-hub` está configurado con el middleware BasicAuth aplicado,
**When** se hace `curl https://<dominio>/` sin la opción `-u` (sin header `Authorization`),
**Then** la respuesta es `401 Unauthorized` con el header `WWW-Authenticate: Basic realm="..."`, y el cuerpo de la respuesta **no** contiene el HTML del dashboard.

### AC-003: Credenciales incorrectas son rechazadas igual que la ausencia de credenciales

**Given** el dominio de `metrics-hub` está configurado con el middleware BasicAuth aplicado,
**When** se hace `curl -u usuario-invalido:password-invalido https://<dominio>/`,
**Then** la respuesta es `401 Unauthorized`, indistinguible en código y estructura de la respuesta del AC-002 (no se filtra si el usuario existe o no).

---

## 2. Regresión de seguridad post-incidente

### AC-004: El puerto directo 4320 sigue sin ser alcanzable desde fuera del VPS

**Given** la política post-incidente (`127.0.0.1:4320:4320` en `docker-compose.yml`, commit `82cba23`) sigue vigente y `omnia-portblock` sigue activo,
**When** se intenta `curl http://148.113.203.22:4320` desde una máquina fuera del VPS (no vía el dominio ni vía túnel SSH),
**Then** la conexión se rechaza o hace timeout — el mismo comportamiento que antes de implementar esta feature. Si la conexión se establece, es una regresión de seguridad y esta feature debe considerarse fallida, no exitosa.

### AC-005: `metrics-hub/docker-compose.yml` solo cambia en el bloque `labels:`

**Given** el repo antes de implementar esta feature,
**When** se compara `metrics-hub/docker-compose.yml` antes y después de completar la implementación (ej. `git diff` sobre ese archivo),
**Then** el diff toca únicamente un bloque `labels:` agregado al servicio `metrics-hub` — la línea `- "127.0.0.1:4320:4320"` bajo `ports:`, y las secciones `environment`, `image`, `volumes`, `build`, `restart`, permanecen exactamente iguales.

### AC-006: El acceso por túnel SSH sigue funcionando como fallback

**Given** el dominio autenticado ya está configurado y funcionando (AC-001),
**When** se ejecuta el túnel manual `ssh -L 4320:127.0.0.1:4320 <user>@148.113.203.22` y se visita `http://127.0.0.1:4320` localmente,
**Then** el dashboard se sirve igual que antes de esta feature — el túnel no queda roto ni deshabilitado por la nueva config de Traefik (que opera sobre el dominio, no sobre el puerto local).

---

## 3. Configuración de Coolify / infraestructura

### AC-007: El DNS del dominio elegido resuelve a la IP del VPS

**Given** el dominio elegido (ej. `metrics.omniaos.ai`) fue agregado en Coolify,
**When** se resuelve el dominio (`dig`/`nslookup <dominio>` o equivalente),
**Then** el registro A apunta a `148.113.203.22`.

### AC-008: El certificado TLS del dominio es válido

**Given** el dominio ya resuelve a la IP del VPS (AC-007) y Coolify tiene HTTPS gestionado habilitado para ese dominio,
**When** se visita `https://<dominio>/` con un cliente que valida certificados (navegador o `curl` sin `-k`),
**Then** la conexión TLS se establece sin advertencias de certificado inválido o autofirmado (certificado emitido por Let's Encrypt vía Coolify).

### AC-009: El middleware Traefik quedó efectivamente activo en `metrics-hub` y no afecta a otros recursos

**Given** las labels `traefik.http.middlewares.metrics-auth.basicauth.users` y `coolify.traefik.middlewares=metrics-auth` fueron agregadas al servicio `metrics-hub` en `docker-compose.yml` y desplegadas,
**When** se inspeccionan las labels efectivas del contenedor real corriendo en el VPS (`docker inspect <container> | grep traefik`, vía OCC o SSH — no basta con mirar el archivo fuente, ver INV-9 de `1_spec.md`) y se prueba acceder a los dominios de `gateway` y `memory`,
**Then** el middleware `metrics-auth` aparece efectivamente atado al router de `metrics-hub` en las labels del contenedor real, y los dominios de `gateway`/`memory` siguen respondiendo exactamente igual que antes de esta feature (sin BasicAuth agregado por error).

### AC-010: El redeploy no requiere rebuild de imagen

**Given** la imagen `omnia/metrics-hub:latest` no cambió como parte de esta feature,
**When** se dispara el redeploy del recurso `metrics-hub` en Coolify tras agregar el dominio y las labels,
**Then** Coolify reutiliza la imagen existente (no dispara un build nuevo desde `metrics-hub/Dockerfile`) y el contenedor vuelve a estar `healthy`/`running` en un tiempo comparable al de un restart normal, no al de un build completo.

---

## 4. Documentación

### AC-011: `DEPLOY_COOLIFY.md` documenta el dominio final

**Given** el dominio elegido está confirmado funcionando (AC-001 a AC-004 pasan),
**When** se lee la sección `### \`metrics-hub/\`` de `DEPLOY_COOLIFY.md`,
**Then** ya no dice "sin dominio configurado" — indica el dominio real elegido y menciona el middleware BasicAuth vía Coolify, consistente con lo documentado para `gateway` y `memory` en el mismo archivo.

### AC-012: La contraseña en texto plano nunca se committea al repo (el hash sí, por diseño)

**Given** el hash bcrypt generado en el Paso 1 de `1_spec.md` se agregó intencionalmente a `metrics-hub/docker-compose.yml` en el commit de esta feature,
**When** se inspecciona ese commit (`git show <commit>` o el diff del Paso 3 de `1_spec.md`),
**Then** el hash bcrypt (patrón `$2y$` / `$2a$` / `$2b$`, con `$` escapado a `$$`) aparece efectivamente en el diff — confirma que la implementación siguió el diseño — y en ningún lugar del mismo commit, mensaje de commit, ni ningún otro archivo del repo aparece la contraseña en texto plano usada para generarlo (confirma INV-5 de `1_spec.md`).

---

## Cobertura del Contrato

| Sección del contrato (`0_contract.md`) | ACs que la cubren |
|---|---|
| Escenario A (happy path) | AC-001 |
| Escenario B (sin credenciales) | AC-002 |
| Escenario C (credenciales incorrectas) | AC-003 |
| Escenario D (regresión post-incidente) | AC-004, AC-005 |
| Escenario E (DNS/TLS pendiente) | AC-007, AC-008 (validan el estado final; el estado transitorio se cubre en `3_test-plan.md` como caso a tolerar, no como AC) |
| Alcance → No incluye: cambiar binding a loopback | AC-004, AC-005 |
| Alcance → No incluye: cambiar `docker-compose.yml` | AC-005 |
| Alcance → Incluye: documentar dominio en `DEPLOY_COOLIFY.md` | AC-011 |
| Invariante INV-3 (401 antes de llegar a la app) | AC-002, AC-003 |
| Invariante INV-4 (puerto directo sigue bloqueado) | AC-004 |
| Invariante INV-5 (hash sí se commitea; contraseña en texto plano nunca) | AC-012 |
| Invariante INV-6 (middleware específico, sin colisión) | AC-009 |
| Invariante INV-9 (verificación empírica obligatoria, no basta con el archivo) | AC-009 |
| Notas de Implementación (fallback SSH sigue vivo) | AC-006 |

## Notas

- No hay criterios de aceptación sobre "performance" o "carga" — `metrics-hub` es un dashboard estático de bajo tráfico interno; no aplica.
- AC-004 es el criterio más crítico de todo el set: valida que la feature no reintroduce el patrón exacto del incidente del 20-jul-2026 (puerto expuesto sin auth). Si solo se puede verificar un criterio antes de dar la feature por completa, es este.
- Los criterios de esta sección se verifican en el orden en que aparecen dentro de `3_test-plan.md`, no necesariamente en el orden AC-001…AC-012 (la validación real agrupa por comando de `curl`, no por AC).
- AC-005 y AC-012 sí involucran `metrics-hub/docker-compose.yml` — es, tras el rediseño de `/modifyspec` (2026-08-26), el único archivo de código que esta feature modifica, y solo en su bloque `labels:`. Si al verificar algún AC parece necesario tocar `Dockerfile`, `docker-entrypoint.sh`, `scripts/` o `dashboard/`, es una señal de que la implementación se desvió del alcance de `0_contract.md` y conviene revisar el enfoque antes de seguir.
- Todos los criterios son verificables por una sola persona (quien tiene acceso a Coolify y al VPS) sin coordinación adicional con terceros — no hay AC que dependa de una acción de otro miembro del equipo, lo cual mantiene esta feature ejecutable de punta a punta en una sola sesión de trabajo.

## Definición de "Hecho" para esta feature

Esta feature se considera completa (lista para cerrar con `/onspecomplete expose-metrics-hub-domain`) únicamente cuando se cumplen **todas** las siguientes condiciones simultáneamente:

1. Los 12 criterios de aceptación (AC-001 a AC-012) pasan en una ejecución real contra el recurso `metrics-hub` en `server-omniaplatform`, no en un entorno de prueba local.
2. `DEPLOY_COOLIFY.md` refleja el dominio final elegido (AC-011) — no queda el placeholder `<dominio a confirmar>` sin resolver.
3. Ningún otro recurso de Coolify (`gateway`, `memory`) cambió de comportamiento como efecto secundario (AC-009).
4. El acceso por túnel SSH, usado como fallback hasta hoy, se mantiene funcional (AC-006) — esta feature es estrictamente aditiva.

Si alguna de estas cuatro condiciones no se cumple, la feature permanece en `in-progress` (o vuelve a `pending` si se revierte la config en Coolify) hasta resolverla — no se marca `done` de forma parcial.

No hay un quinto criterio implícito de "nadie se quejó" — la validación es objetiva (comandos `curl`, `dig`, `git diff`, `git log`) y no depende de que un tercero reporte o no un problema tras el despliegue.

Quien ejecute `/onspecomplete` sobre esta feature debe poder pegar, para cada AC, el output real del comando correspondiente (no una descripción de memoria de "sí funcionó") — eso es lo que distingue una feature de infraestructura verificada de una simplemente declarada como terminada.
