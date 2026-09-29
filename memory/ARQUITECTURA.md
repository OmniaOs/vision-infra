# Memoria compartida de Omnia: arquitectura y workflow

> **Estado: 2026-09-29.** Método único (un token por persona) desplegado y
> verificado de punta a punta. Repos y framework migrados localmente; falta
> publicar y dar de alta al equipo (ver pendientes al final).
> Esta es la **fuente canónica**; el resto de `memory/` es detalle o historia.

## Para qué sirve

Que lo que resolvió una persona (un incidente, una implementación, un gap) lo
pueda usar cualquiera del equipo sin depender de quién lo hizo. Requisitos que
guiaron el diseño:

1. **Poca fricción:** un comando para conectarse, uso diario simple.
2. **Independiente del repo:** no depende de PRs ni commits (hay sesiones de
   soporte, VPS o fixes sin código).
3. **Tiempo real:** lo que guarda uno lo ve el resto al instante (agentes).
4. **Sin conflictos:** cada aporte es una entrada nueva, nadie edita un archivo compartido.

## Arquitectura

```
Claude Code / IDE de cada dev
   │  .mcp.json: 3 servidores MCP, todos con  Authorization: Bearer ${OMNIA_MEMORY_TOKEN}
   ▼
┌──────────────────────────── access (gateway, un servicio Node sin dependencias) ───────────────┐
│  memory.omniaos.ai  ──►  Mem0 / OpenMemory   (solo /mcp/*, red interna del stack)              │
│  kb.omniaos.ai      ──►  Basic Memory        (vía knowledge.omniaos.ai, credencial de servicio)│
│  valida el token (hash SHA-256), lo descarta e inyecta la credencial real de cada backend      │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
   server-omniaplatform (Coolify, recurso memory-mem0)            hostinger-vps-almalinux (Coolify, recurso omnia-knowledge)
   ├─ access            (único servicio con dominio público)     ├─ basic-memory :8420  (loopback, detrás de Traefik + BasicAuth)
   ├─ openmemory-mcp    (solo red interna, SIN autenticación)    ├─ sync                (commit/push cada 3 min)
   ├─ Qdrant            (vectores)                               └─ volúmenes: knowledge-data (notas), basic-memory-config (índice)
   └─ Hermes            (propone lecciones; un humano aprueba)                    │
                                                                                 ▼
                                                    GitHub OmniaOs/omnia-knowledge  ◄── Obsidian (personas, plugin Git)
```

| Pieza | Dónde | Qué es |
|---|---|---|
| **access** | `memory/access/` → servicio `access` en `memory-mem0` | Única puerta pública. Un token por dev. |
| **Mem0** | `memory/docker-compose.yml` | Hechos cortos (una oración). Namespace por proyecto + `omnia-global`. |
| **Basic Memory** | repo `omnia-knowledge` (`deploy/`) | Notas largas en Markdown. Un proyecto `projects`; los clientes son carpetas (`omniapos/`, `frutal/`). |
| **Coolify** | `cool.omniaos.ai` | Despliega todo por webhook desde GitHub. |

Qué va en cada memoria: ver [`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md)
(fuente canónica). Regla corta: una oración con una lección → Mem0; un incidente
o documento con causa, solución y contexto → Basic Memory.

## Workflow del dev

**Alta (una vez por persona):** el admin le manda su comando personal. Lo pega en PowerShell:

```powershell
$env:OMNIA_TOKEN='omnia_...'; irm https://memory.omniaos.ai/setup | iex
```

Comprueba las dos rutas antes de tocar nada, guarda `OMNIA_MEMORY_TOKEN` como variable
de usuario (sin admin) y pide reiniciar. macOS/Linux: `setup.sh` (mismo dominio).
Cambiar de laptop = pegar el mismo comando otra vez. El comando es igual para todos
salvo el `omnia_...`, que es individual.

**Conectar un repo:** copiar [`mcp-omnia-access.example.json`](mcp-omnia-access.example.json)
a su `.mcp.json`, cambiando solo el slug del proyecto en `omnia-memory`.

**Uso diario** (skills del repo): `memory-recall` antes de una tarea, `memory-write`
para una lección corta, `session-close` al terminar cualquier sesión (con o sin código).

**Tras un redeploy del servidor** hay que **reiniciar Claude Code**: el cliente MCP no se
reconecta solo cuando la sesión SSE muere. Con Watch Paths esto debería ser raro.

## Workflow del admin

| Tarea | Cómo |
|---|---|
| **Alta** | `node memory/access/devs.mjs add <id>` → pegar la línea `id:hash` en `ACCESS_DEVS` (Coolify, `memory-mem0`) → redeploy de `access` → mandar el comando por un canal de un solo uso (Vaultwarden/Bitwarden Send). |
| **Baja** | Borrar su línea de `ACCESS_DEVS` y redeploy de `access`. Corta las dos rutas a la vez. |
| **Rotar credencial de Basic Memory** | Generar contraseña con `tr -d '/+=\r\n'` (con `\r`), poner el hash apr1 en el label de `omnia-knowledge/deploy/docker-compose.yml`, el base64 en `KB_UPSTREAM_AUTH_B64`. |
| **Verificar** | `memory/access/README.md` (comprobaciones con curl) y prueba de humo MCP. |
| **Cambios en Coolify** | Dominios **con esquema y puerto** (`https://…:8420`). `omnia-knowledge` tiene Watch Paths `deploy/**`. |

## Seguridad

- **OpenMemory no valida ninguna credencial** (verificado en la imagen). El token del
  gateway es la **única** autenticación de Mem0. `openmemory-mcp` nunca debe publicarse
  fuera de la red interna; la UI sigue apagada (incidente del 20-jul-2026).
- El gateway expone de Mem0 solo `/mcp/*`; `/api` y `/docs` dan 404. No inyecta ni registra
  tokens; sus logs llevan el id del dev, sin query string.
- Todos los devs ven todos los namespaces y tienen `delete_all_memories`. No hay
  limitación de volumen. Ver "Pendientes".
- Un token filtrado se corta con la baja. Los secretos nunca van en chat ni en un repo.

## Gotchas aprendidos (todos costaron tiempo)

1. **Git Bash + openssl:** `openssl rand -base64` termina en `\r\n`; `tr -d '\n'` deja un `\r`
   invisible que rompe hash y base64. Usar `tr -d '\r\n'`.
2. **Coolify + Docker Compose:** si Domains no lleva el puerto interno, Traefik va al puerto 80
   y da 502 aunque el servicio esté sano. Un 401 de BasicAuth **no** prueba que el backend responda.
3. **Basic Memory fuerza cada proyecto a `/app/data/<nombre>`**, sin importar `project_path`.
   Por eso un solo proyecto `projects`, con los clientes como carpetas.
4. **Basic Memory corre como root** y guarda config e índice en `/root/.basic-memory`: el
   volumen debe montarse ahí, o cada redeploy borra los proyectos.
5. **`sync` necesita identidad de git** (`user.name`/`user.email`); sin ella el commit falla y
   el contenedor entra en bucle de reinicios. Un fallo de commit no debe matar el contenedor.
6. **Cada commit `auto-sync` redespliega el recurso** salvo que Watch Paths lo limite a `deploy/**`.
7. **Pegado en terminal:** algunas terminales añaden marcas de "pegado protegido" que rompen
   comandos. Y el visor del app busca rutas relativas al repo abierto, no a repos hermanos.

## Estado y pendientes

**Verificado (2026-09-29):** las 3 memorias conectan con el token individual;
`add_memories` + `search_memory` en Mem0; proyecto `projects` de Basic Memory con las notas
del repo; escritura → `sync` → GitHub; el proyecto sobrevive a un redeploy.

**Pendiente:**
- [ ] **Rotar la credencial de `knowledge`**: la actual quedó expuesta en un chat y lleva un `\r` incrustado (funciona, pero rotar con `tr -d '\r\n'`).
- [x] **`.mcp.json` migrados en la máquina de Daniel:** 19 repos apuntan al gateway (cambios locales, sin commit; 13 de ellos ni siquiera versionan el archivo). Cada dev migra los suyos corriendo la skill `memory-setup`.
- [x] **Framework y skills al método nuevo** (`VisionFramework`: `vision init`, `vision doctor`, skills de memoria; y su espejo en este repo). Commits locales, **sin publicar**.
- [ ] **Publicar `VisionFramework`** y que cada repo actualice sus skills e instalador (`vision init`).
- [ ] **Reescribir `EMPEZAR.md` y `ADOPCION.md`** del framework (hoy llevan solo un aviso; el túnel sigue vigente solo para LiteLLM `:4000` y Metrics `:4320`).
- [ ] **Dar de alta a los demás devs.**
- [ ] **Limpieza del método anterior:** túnel SSH y `visiontunnel`, Vaultwarden (`vault/`), `memory/setup/windows.ps1`, `memory/tunnel.sh`, variables `OMNIA_MEMORY_SSH_*`, `OMNIA_KNOWLEDGE_BASICAUTH_B64`, spec `self-service-memory-tunnel-onboarding`. Solo tras una ventana de convivencia.
- [ ] Decidir si el gateway bloquea `delete_all_memories` y si limita namespaces por dev.
- [ ] Probar escrituras simultáneas a la misma nota de Basic Memory (sigue sin verificar).
- [ ] Endurecimiento opcional: firewall de Alma para aceptar `knowledge.omniaos.ai` solo desde el servidor de Mem0.

## Mapa de archivos

| Archivo | Para qué |
|---|---|
| [`access/README.md`](access/README.md) | Operación del gateway: alta, baja, despliegue, verificación. |
| [`access/server.mjs`](access/server.mjs), [`server.test.mjs`](access/server.test.mjs) | Código y pruebas (`node --test memory/access`). |
| [`access/devs.mjs`](access/devs.mjs) | CLI de alta. |
| [`access/setup/`](access/setup/) | Scripts que el dev pega (`connect.ps1`, `connect.sh`). |
| [`mcp-omnia-access.example.json`](mcp-omnia-access.example.json) | Bloque `.mcp.json` para cualquier repo. |
| [`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md) | Qué escribir y dónde. |
| `RUNBOOK.md`, `INSTRUCTIVO.md`, `setup/`, `tunnel.sh` | **Método anterior** (túnel SSH + Vaultwarden). Historia hasta la limpieza. |
