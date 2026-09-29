# Manual del admin: operar la memoria compartida

Para quien da de alta al equipo y mantiene el gateway. Si buscas cómo conectarte
tú como dev, es [`MANUAL-DEV.md`](MANUAL-DEV.md). El porqué del diseño está en
[`ARQUITECTURA.md`](ARQUITECTURA.md).

## Lo que necesitas

| Qué | Para qué |
|---|---|
| Clon de `vision-infra` y Node 18 o superior | Correr `node memory/access/devs.mjs` |
| Acceso a Coolify: `https://cool.omniaos.ai` | Variables, dominios y redeploys |
| Permiso de push en `OmniaOs/vision-infra` y `OmniaOs/omnia-knowledge` | Cambios de código y de despliegue |
| Un canal de un solo uso (Bitwarden Send o el Send de Vaultwarden: 1 vista, 24 h) | Entregar el comando personal |
| Git Bash (Windows) para generar contraseñas | Rotar la credencial de servicio |

## El mapa: qué es cada cosa

| Pieza | Dónde vive | Notas |
|---|---|---|
| **Gateway `access`** | Coolify → proyecto `vision-infra` / `production` → recurso **`memory-mem0`** | Único servicio con dominio público. Código en `memory/access/`. |
| **Mem0 + Qdrant + Hermes** | Mismo recurso `memory-mem0` | Solo red interna. OpenMemory **no valida credenciales**. |
| **Basic Memory + sync** | Coolify → recurso **`omnia-knowledge`** (servidor de Alma) | Notas en el repo `omnia-knowledge` de GitHub. |
| **Dominios** | `memory.omniaos.ai` (Mem0), `kb.omniaos.ai` (Basic Memory) → servidor de producción | Registros DNS tipo A. |
| **Origen de Basic Memory** | `knowledge.omniaos.ai:8420` → Alma | BasicAuth: la usa **solo** el gateway. Ningún dev la conoce. |

Variables importantes de `memory-mem0` (Coolify → Environment Variables):

| Variable | Qué es |
|---|---|
| `ACCESS_DEVS` | Un dev por entrada, `id:hash`, separadas por coma. Solo hashes. |
| `KB_UPSTREAM_AUTH_B64` | Base64 de `omnia:<contraseña de servicio>` de `knowledge`. Sin el prefijo `Basic `. |
| `KB_UPSTREAM` | `https://knowledge.omniaos.ai` (por defecto). |
| `OPENMEMORY_API_KEY` | No protege nada (OpenMemory la ignora). Se conserva por compatibilidad. |

## Dar de alta a una persona (2 minutos)

```bash
cd vision-infra
node memory/access/devs.mjs add ana
```

Imprime dos cosas: la línea `ana:<hash>` y el comando personal de `ana`. Luego:

1. **Coolify → `memory-mem0` → Environment Variables → `ACCESS_DEVS`:** añade la línea al final,
   separada por coma. Dale **Update**.
2. **Redeploy** del recurso `memory-mem0` (unos 2 minutos). El servicio `access` reinicia y
   corta unos segundos las sesiones abiertas.
3. **Manda el comando a `ana`** por el canal de un solo uso. **Nunca** por chat, correo ni un repo.
   El token en claro no se guarda en ningún sitio: si se pierde, se da de alta otro.
4. **Pídele que confirme:** el script debe decir `ok` dos veces y `Listo, ana`. Su `/memory-recall`
   debe devolver resultados.

Reglas para el `id`: minúsculas, dígitos, `.`, `_` o `-` (por ejemplo `ana`, `luis.m`). Es lo
que verás en los logs.

## Dar de baja a una persona

1. Borra su línea de `ACCESS_DEVS` y dale Update.
2. Redeploy de `memory-mem0`.

El token deja de servir en **las dos memorias a la vez**. No hay nada que tocar en su equipo.

## Cambiar el token de una persona (sospecha de filtración, o lo perdió)

1. Corre `node memory/access/devs.mjs add <mismo-id>`: genera un token y un hash nuevos.
2. Añade la línea nueva a `ACCESS_DEVS` **sin quitar la vieja** todavía. Redeploy.
3. Manda el comando nuevo. Cuando confirme que ya conecta, **borra la línea vieja** y redeploy.

Si la filtración es grave, invierte el orden: primero quita la vieja y redeploy, y luego da de alta
la nueva. La persona queda unos minutos sin memoria, pero el token filtrado deja de servir ya.

## Rotar la credencial de servicio de Basic Memory

Es la contraseña que solo conoce el gateway. Rótala si se expuso o cada cierto tiempo. **La generas
tú en tu terminal**; no la pegues en un chat.

En **Git Bash**, dentro de un clon de `omnia-knowledge`:

```bash
bind 'set enable-bracketed-paste off'
cd /c/ruta/a/omnia-knowledge
PASS=$(openssl rand -base64 30 | tr -d '/+=\r\n')
HASH=$(openssl passwd -apr1 "$PASS" | tr -d '\r')
SALT=$(echo "$HASH" | cut -d'$' -f3)
[ "$(openssl passwd -apr1 -salt "$SALT" "$PASS" | tr -d '\r')" = "$HASH" ] || { echo "hash inconsistente, no sigo"; false; }
sed -i -E "s#(basicauth\.users=omnia:)[^\"]+#\1${HASH}#" deploy/docker-compose.yml
printf 'omnia:%s' "$PASS" | base64 -w0 | clip.exe
git add deploy/docker-compose.yml && git commit -qm "chore(deploy): rotar hash de BasicAuth de basic-memory" && git pull --rebase origin main && git push origin main
```

Después, **en este orden**:

1. Espera a que Coolify redespliegue `omnia-knowledge` (el commit toca `deploy/`, así que dispara).
2. En `memory-mem0`, pega el portapapeles (`Ctrl+V`) en `KB_UPSTREAM_AUTH_B64` y dale Update.
   **Solo el base64:** sin `Basic `, sin espacios y sin salto de línea.
3. Redeploy de `memory-mem0`.
4. Comprueba: la credencial vieja debe dar **401**, y un token de dev por `kb` debe dar **200**.

Dos trampas de este procedimiento:
- `openssl rand -base64` en Git Bash termina en `\r\n`. Con `tr -d '\n'` queda un `\r` invisible que
  rompe hash y base64 (por eso el bloque usa `'/+=\r\n'`).
- El hash va en el label **tal cual**, con sus `$` y **sin duplicarlos**. Un `$$` llega literal y rompe la autenticación.

## Comprobar que todo está sano

```bash
curl -s https://memory.omniaos.ai/healthz                                     # {"ok":true}
curl -s https://kb.omniaos.ai/healthz                                         # {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" https://memory.omniaos.ai/mcp/x      # 401 (sin token)
curl -s -H "Authorization: Bearer $OMNIA_MEMORY_TOKEN" https://kb.omniaos.ai/whoami    # {"dev":"...","route":"knowledge"}
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $OMNIA_MEMORY_TOKEN" https://memory.omniaos.ai/docs   # 404
curl -s -m 6 -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $OMNIA_MEMORY_TOKEN" -H "Accept: text/event-stream" https://kb.omniaos.ai/mcp   # 200
```

El último llega hasta Basic Memory: si da **401**, la credencial de servicio no coincide con el hash;
si da **502**, el servicio de Alma no responde.

**Quién usa qué:** los logs del servicio `access` (Coolify → `memory-mem0` → Logs) son una línea JSON
por pedido con el `id` del dev, el host, la ruta y el estado. **Nunca** llevan el token ni los
parámetros de la URL.

## Basic Memory: lo que hay que saber

- **Un solo proyecto, llamado `projects`**, en `/app/data/projects`. Los clientes (`omniapos`,
  `frutal`) son **carpetas**. Basic Memory fuerza cada proyecto a `/app/data/<nombre>` sin
  importar la ruta que le pases.
- Si desaparece (`Project not found`), se recrea con
  `create_memory_project(project_name="projects", project_path="projects")`. Reindexa las notas que
  ya están en disco.
- Las notas viajan **Basic Memory → `sync` (cada 3 min) → GitHub → Obsidian**. `sync` hace
  `git pull --rebase` y `push`. Un conflicto real lo avisa en su log y **no reintenta solo**.
- La configuración y el índice viven en el volumen `basic-memory-config`, montado en
  **`/root/.basic-memory`** (el contenedor corre como root). Si lo mueves, cada redeploy borra los proyectos.
- **Watch Paths de `omnia-knowledge` = `deploy/**`.** Sin esto, cada commit `auto-sync` redespliega
  el servicio y corta las sesiones de todos.

### Cuando tú subes cambios a `omnia-knowledge`

`sync` empuja commits solo, así que tu `git push` puede ser rechazado ("non-fast-forward").
No es un conflicto de archivos. Configúralo una vez:

```powershell
git config --global pull.rebase true
git config --global core.editor "code --wait"
```

y usa `git pull` antes de `git push`. El segundo ajuste evita quedarte atrapado en `vim`.

## Redeploys: qué esperar

| Cambias… | Efecto |
|---|---|
| `ACCESS_DEVS` o cualquier variable de `memory-mem0` | Redeploy de `memory-mem0`: 2 minutos, se cortan las sesiones abiertas. |
| `memory/access/*` (código del gateway) | Igual, al hacer push de `vision-infra` (según cómo esté el webhook) o con redeploy manual. |
| `omnia-knowledge/deploy/*` | Redeploy de `omnia-knowledge` por webhook. |
| Notas en `omnia-knowledge/projects/*` | **Nada.** Watch Paths lo evita. |

Después de **cualquier** redeploy que corte el servicio, **los devs deben reiniciar Claude Code**: el
cliente MCP no se reconecta solo. Avísales.

Dos trampas de Coolify:
- Los dominios van **con esquema y con puerto**: `https://memory.omniaos.ai:8080,https://kb.omniaos.ai:8080` para
  `access`, y `https://knowledge.omniaos.ai:8420` para `basic-memory`. Sin puerto, Traefik va al puerto 80 y responde 502.
- Un 401 de BasicAuth **no** prueba que el backend responda: el middleware contesta antes de llegar a él.
  Prueba siempre con credencial válida y espera un 200.

## Seguridad

- **OpenMemory no valida ninguna credencial.** El token del gateway es la única barrera de Mem0.
  `openmemory-mcp` nunca se publica fuera de la red interna del stack; su UI sigue apagada
  (incidente del 20-jul-2026).
- El gateway expone de Mem0 solo `/mcp/*`. `/api` y `/docs` dan 404.
- **Todos los devs ven todos los namespaces y tienen `delete_all_memories`.** No hay límite de
  volumen ni de namespaces por persona. Decisión pendiente.
- **Los secretos nunca van en el chat.** Si pegas o ves un secreto expuesto, rótalo. Genera las
  contraseñas en tu terminal y pásalas al portapapeles (`clip.exe`), no a la pantalla.
- No hay respaldo automático de Mem0 configurado en el repo: vive en volúmenes de Docker del
  servidor. Las notas de Basic Memory sí tienen copia en GitHub.

## Si algo se rompe

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Los devs ven **401** en las tres memorias | Token distinto al de `ACCESS_DEVS`, o falta redeploy | Revisa la línea del dev y que se redesplegó `memory-mem0` |
| `kb` da **401** con un token válido de dev | Credencial de servicio no coincide con el hash de Alma | Repite "Rotar la credencial", paso 2 y 3 |
| `kb` da **502** | Servicio de Alma caído, o dominio sin puerto | Logs de `omnia-knowledge`; revisa `:8420` |
| **503** durante un minuto | Redeploy en curso | Espera |
| `Project not found` en Basic Memory | Config perdida (volumen mal montado) | Recrea `projects`; verifica el montaje en `/root/.basic-memory` |
| `omnia-knowledge` en **"Restarting"** | `sync` sin identidad de git | Debe tener `user.name`/`user.email` en su comando |
| Cada nota provoca un redeploy | Falta Watch Paths | `deploy/**` en `omnia-knowledge` |
| Un dev dice "Invalid request parameters" | Su sesión MCP quedó vieja tras un redeploy | Que reinicie Claude Code |
| `git push` rechazado en `omnia-knowledge` | `sync` subió un commit antes | `git pull --rebase origin main` y de nuevo |

## Lista de comprobación: primer día de un equipo nuevo

- [ ] Dar de alta a cada persona (una por una) y confirmar su `ok` doble.
- [ ] Cada persona corre `/memory-setup` en sus repos y reinicia Claude Code.
- [ ] Cada persona hace la comprobación de [`MANUAL-DEV.md`](MANUAL-DEV.md), paso 4.
- [ ] Les mandas [`WORKFLOW.md`](WORKFLOW.md).
- [ ] Avisas que, tras un redeploy, hay que reiniciar Claude Code.

## Pendientes conocidos

Ver la lista al final de [`ARQUITECTURA.md`](ARQUITECTURA.md): limpieza del método anterior
(túnel SSH, Vaultwarden), decidir si se bloquea `delete_all_memories`, y probar escrituras
simultáneas a la misma nota de Basic Memory.
