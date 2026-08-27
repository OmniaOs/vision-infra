# Plan de Testing: Exponer dominio autenticado para metrics-hub

## Metadata

```yaml
test_framework: ninguno (validación manual)
version: 1
last_updated: 2026-08-26
```

## Estrategia de Testing

Esta feature es una acción operativa de infraestructura (config de Coolify + Traefik vía consola web), no código de aplicación. El repo **no tiene un harness de test automatizado para config de infraestructura de Coolify** — el constitution declara explícitamente `Testing: ninguno configurado todavía`, y no hay ningún framework de test (unit/integration) en `metrics-hub/package.json`. Sería una ficción escribir aquí una suite `vitest`/`jest` que no existe y que no correría en CI (no hay CI configurado en este repo).

Por eso este plan de testing es **enteramente manual**: una secuencia de comandos `curl`, una verificación en navegador, e inspección directa de la consola de Coolify. Cada paso mapea a uno o más criterios de `2_acceptance-criteria.md`. La ejecución la hace la misma persona que implementa la spec (Daniel, con acceso a Coolify y al VPS), inmediatamente después del Paso 4 (redeploy) de `1_spec.md`.

Si en el futuro este repo adopta un harness de smoke-tests HTTP (ej. un script simple que corra los `curl` de abajo contra el dominio de producción en un cron), ese trabajo es una feature aparte — no está en el alcance de esta spec (ver `0_contract.md` → Alcance → No incluye).

## Validación Manual

Ejecutar en orden. Reemplazar `<dominio>` por el dominio real elegido en el Paso 2 de `1_spec.md`, y `<usuario>`/`<password>` por las credenciales generadas en el Paso 1.

### Paso 1 — Acceso sin credenciales (cubre AC-002)

```bash
curl -i https://<dominio>/
```

**Esperado:**
- Status `401`.
- Header `WWW-Authenticate: Basic realm="..."` presente en la respuesta.
- El cuerpo de la respuesta NO contiene el HTML del dashboard (no hay `<title>` ni marcado de `dashboard/index.html`).

### Paso 2 — Acceso con credenciales incorrectas (cubre AC-003)

```bash
curl -i -u usuario-invalido:password-invalido https://<dominio>/
```

**Esperado:**
- Status `401`, misma forma de respuesta que el Paso 1 (no hay forma de distinguir "usuario no existe" de "password incorrecta").

### Paso 3 — Acceso con credenciales correctas (cubre AC-001)

```bash
curl -i -u <usuario>:<password> https://<dominio>/
```

**Esperado:**
- Status `200`.
- El cuerpo contiene el HTML de `dashboard/index.html` (ej. buscar una cadena conocida del dashboard, como el título del leaderboard).

Repetir este paso desde un navegador normal: visitar `https://<dominio>/`, confirmar que aparece el prompt nativo de usuario/contraseña del navegador (no un formulario HTML custom — BasicAuth es a nivel de protocolo HTTP), ingresar las credenciales, y confirmar que el dashboard renderiza visualmente igual que accediendo por el túnel SSH.

### Paso 4 — Certificado TLS válido (cubre AC-008)

```bash
curl -v https://<dominio>/ 2>&1 | grep -i "SSL certificate verify ok\|subject:"
```

**Esperado:** no hay errores de verificación de certificado; `curl` no requiere `-k` para conectar. Si se usa un navegador, confirmar que no aparece la advertencia de "conexión no privada" / certificado inválido.

### Paso 5 — DNS resuelve a la IP del VPS (cubre AC-007)

```bash
dig +short <dominio>
# o: nslookup <dominio>
```

**Esperado:** la salida incluye `148.113.203.22`.

### Paso 6 — Regresión: puerto directo sigue bloqueado (cubre AC-004 — el más crítico de todo el plan)

Ejecutar **desde una máquina fuera del VPS** (nunca desde dentro del propio VPS, donde `127.0.0.1:4320` sí respondería intencionalmente):

```bash
curl -v --connect-timeout 5 http://148.113.203.22:4320/
```

**Esperado:** timeout o conexión rechazada — el mismo comportamiento que existía antes de esta feature. Si esta request devuelve `200` o cualquier respuesta del dashboard, **detener la validación inmediatamente**: es una regresión de seguridad (el puerto quedó expuesto), no un síntoma de que la feature "funciona de más".

### Paso 7 — Túnel SSH sigue funcionando como fallback (cubre AC-006)

```bash
ssh -L 4320:127.0.0.1:4320 <user>@148.113.203.22
# en otra terminal / pestaña, mientras el túnel está abierto:
curl -i http://127.0.0.1:4320/
```

**Esperado:** status `200` con el dashboard, exactamente como funcionaba antes de esta feature — el túnel no pasa por Traefik ni por el middleware BasicAuth (va directo al puerto local reenviado), así que no debería pedir credenciales.

### Paso 8 — `docker-compose.yml` sin cambios (cubre AC-005)

```bash
git diff -- metrics-hub/docker-compose.yml
```

**Esperado:** salida vacía (sin diferencias) al comparar contra el estado del repo antes de implementar esta feature.

### Paso 9 — Credenciales nunca committeadas (cubre AC-012)

```bash
git log -p --all -- metrics-hub/ DEPLOY_COOLIFY.md | grep -E '\$2[aby]\$'
```

**Esperado:** sin resultados — ningún hash bcrypt (patrón `$2a$`, `$2b$` o `$2y$`) aparece en el historial de git de los archivos tocados por esta feature.

### Paso 10 — Middleware no afecta a otros recursos (cubre AC-009)

```bash
# Sustituir por los dominios reales de gateway y memory, ya documentados en DEPLOY_COOLIFY.md
curl -i https://gateway.omniaos.ai/health   # o el endpoint que exponga
curl -i https://memory.omniaos.ai/          # según corresponda
```

**Esperado:** ambos responden exactamente igual que antes de implementar esta feature (sin pedir BasicAuth) — confirma que el middleware `metrics-auth` quedó atado únicamente al router de `metrics-hub`.

### Paso 11 — Documentación actualizada (cubre AC-011)

Inspección manual (no comando): abrir `DEPLOY_COOLIFY.md`, confirmar que la sección `### \`metrics-hub/\`` ya no contiene la frase "sin dominio configurado" y en su lugar referencia el dominio real y el middleware BasicAuth.

### Paso 12 — Redeploy sin rebuild (cubre AC-010)

Inspección manual en la consola de Coolify: revisar el log del último deploy del recurso `metrics-hub` tras agregar dominio + labels. Confirmar que el log no muestra un `docker build` completo (solo recreación del contenedor con la imagen existente `omnia/metrics-hub:latest`).

## Helpers y Fixtures

No aplica — no hay fixtures de datos ni helpers de test que instalar. Los únicos "insumos" son:

- El dominio elegido (Paso 2 de `1_spec.md`).
- Las credenciales generadas con `htpasswd` (Paso 1 de `1_spec.md`) — guardarlas en un gestor de contraseñas del equipo, no en texto plano en ningún archivo de este repo.
- Acceso SSH al VPS (`server-omniaplatform`, `148.113.203.22`) para el Paso 7 y, opcionalmente, para correr el Paso 6 desde una red distinta si no se dispone de otra máquina externa.
- Alternativa sin SSH/VPS directo para el Paso 6: usar el MCP `occ` (`nodes_get` / `processes_list` sobre `server-omniaplatform`) para confirmar el estado del binding sin necesidad de una conexión externa real, como ya se hace en `DEPLOY_COOLIFY.md` para verificar el nodo en vivo.

## Comandos de Ejecución

No hay un comando único tipo `npm test`. La ejecución es la secuencia de los Pasos 1 a 12 de la sección "Validación Manual", en orden, tras completar el Paso 4 (redeploy) de `1_spec.md`. Se recomienda copiar los comandos `curl` a un script de shell temporal (fuera del repo, ej. en el scratchpad local) sustituyendo los placeholders una sola vez, para no repetir la sustitución manual en cada paso.

## Resumen de Tests

| Paso | Cubre | Tipo |
|---|---|---|
| 1 | AC-002 | curl |
| 2 | AC-003 | curl |
| 3 | AC-001 | curl + navegador |
| 4 | AC-008 | curl |
| 5 | AC-007 | dig/nslookup |
| 6 | AC-004 (crítico) | curl desde fuera del VPS |
| 7 | AC-006 | ssh + curl |
| 8 | AC-005 | git diff |
| 9 | AC-012 | git log + grep |
| 10 | AC-009 | curl a otros dominios |
| 11 | AC-011 | inspección manual |
| 12 | AC-010 | inspección manual (log de Coolify) |

Total: 12 pasos manuales, cubriendo los 12 criterios de aceptación de `2_acceptance-criteria.md` uno a uno. La feature se considera completa (lista para `/onspecomplete`) solo cuando los 12 pasos pasan, con el Paso 6 como bloqueante absoluto: si el puerto directo responde desde fuera del VPS, la feature no está lista sin importar qué tan bien funcione el dominio.
