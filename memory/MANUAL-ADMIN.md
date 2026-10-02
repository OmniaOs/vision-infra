# Manual del admin: operar la memoria compartida

Para quien da de alta al equipo y mantiene el gateway. Si buscas cómo conectarte tú como dev, es
[`MANUAL-DEV.md`](MANUAL-DEV.md). El porqué del diseño está en [`ARQUITECTURA.md`](ARQUITECTURA.md) y los permisos en
[`PERMISOS.md`](PERMISOS.md). **Casi todo se administra desde el portal** (`https://memorypanel.omniaos.ai`); Coolify queda
para el despliegue y unas pocas variables.

## Lo que necesitas

| Qué | Para qué |
|---|---|
| Una cuenta de **administrador** en el portal | Personas, tokens, espacios y permisos |
| Acceso a Coolify: `https://cool.omniaos.ai` | Despliegues y variables |
| Permiso de push en `OmniaOs/vision-infra` y `OmniaOs/omnia-knowledge` | Cambios de código y de despliegue |
| Un canal de un solo uso (Bitwarden Send o el Send de Vaultwarden: 1 vista, 24 h) | Entregar el comando y el enlace de invitación |
| Git Bash (Windows) | Rotar la credencial de servicio |

## El mapa: qué es cada cosa

| Pieza | Dónde vive | Notas |
|---|---|---|
| **Gateway `access` + portal** | Coolify → proyecto `vision-infra` / `production` → recurso **`memory-mem0`** | Único servicio con dominio público. Código en `memory/access/`. |
| **Servicio de memoria corta** | Dentro del gateway (`memory-service.mjs`), en loopback | Guarda el texto exacto, sin IA. Usa Qdrant y embeddings de OpenAI. |
| **Qdrant** | Recurso `memory-mem0`, solo red interna | Colección `openmemory`, filtrada por `user_id` = namespace. |
| **`openmemory-mcp`** | Recurso `memory-mem0` | **Descontinuado y sin uso** desde el 2026-10-02. Se puede apagar. |
| **Basic Memory + sync** | Coolify → recurso **`omnia-knowledge`** (servidor de Alma) | Imagen fija `0.23.2`. Notas en el repo `omnia-knowledge`. |
| **Dominios** | `memory.omniaos.ai` (Mem0), `kb.omniaos.ai` (notas), `memorypanel.omniaos.ai` (portal) | Un solo servicio `access` los atiende. |
| **Origen de Basic Memory** | `knowledge.omniaos.ai:8420` → Alma | BasicAuth: la usa **solo** el gateway. Ningún dev la conoce. |
| **Datos del portal** | Volumen `access_data` → `/data` | `users.json`, `portal.json` (solo hashes) y `aliases.json`. |

Variables importantes de `memory-mem0` (Coolify → Environment Variables):

| Variable | Qué es |
|---|---|
| `ACCESS_ADMINS` | Acceso de **emergencia**: `id:hash`, siempre admin, no se edita desde el portal. |
| `ACCESS_DEVS` | Personas del método anterior (`id:hash[:rol[:espacios]]`). Se **migran al portal** (ver abajo). |
| `OPENAI_API_KEY` | **Obligatoria** para el servicio de memoria (embeddings). Sin ella el gateway vuelve a OpenMemory y avisa en el registro. |
| `EMBEDDER_MODEL` | `text-embedding-3-small` por defecto. Debe coincidir con el de las memorias existentes. |
| `MEM0_BACKEND` | Vacío = servicio propio. `openmemory` = vuelve al contenedor viejo (marcha atrás). |
| `KB_UPSTREAM_AUTH_B64` | Base64 de `omnia:<contraseña de servicio>` de `knowledge`. Sin el prefijo `Basic `. |
| `KB_UPSTREAM` | `https://knowledge.omniaos.ai` (por defecto). |
| `ACCESS_ENFORCE` | `1` **fuerza** el bloqueo de permisos y ya no se apaga desde el portal. Normalmente vacío. |
| `ACCESS_NAMESPACE_ALIASES`, `ACCESS_PROJECT_ALIASES` | Alias fijados desde Coolify (opcionales). Los demás se gestionan en el portal. |

## Tu primer acceso al portal

La primera vez no hay nadie que te invite: pon tu hash en `ACCESS_ADMINS` (`tu-id:<sha256 de tu token>`), redeploy, y pide tu
invitación con tu token: `POST https://memorypanel.omniaos.ai/api/admin/users/<tu-id>/invite`. Abre el enlace que devuelve,
elige tu contraseña y entra. Calcula el hash en tu terminal, sin mostrar el token:
`read -rs T && printf %s "$T" | sha256sum | cut -d' ' -f1`.

## Dar de alta a una persona (desde el portal, sin redeploy)

1. **Personas → Dar de alta.** Escribe su usuario (minúsculas, números, guiones), elige su **rol** y sus **espacios**.
   Para los espacios elige primero los que ya existen; solo crea uno nuevo si hace falta.
2. El portal muestra **una sola vez**: su **token del MCP**, su **comando de conexión** (Windows y Mac/Linux) y su
   **enlace de invitación** al portal. Cópialos y mándaselos por el canal de un solo uso. **Nunca** por chat, correo ni un repo.
3. Pídele que confirme: el script debe decir `ok` dos veces y `Listo, <usuario>`, y su `/memory-recall` debe devolver resultados.

| Rol | Qué puede |
|---|---|
| Administrador | Todo, incluidas altas, bajas y permisos |
| Miembro | Leer y escribir en `global` y en sus espacios |
| Solo lectura | Leer `global` y sus espacios |
| Cliente | Leer y escribir solo en su `cli-…` (necesita al menos uno) |

**Cambiar rol o espacios:** Personas → ⋯ → *Cambiar rol y espacios*. Se aplica al instante y corta sus conexiones abiertas
para que se reabran con el permiso nuevo.

## Dar de baja a una persona

Personas → ⋯ → *Dar de baja*. Su token y sus sesiones dejan de servir al instante en las dos memorias; sus memorias y notas se
conservan. **Si la persona venía de `ACCESS_DEVS`**, la baja desde el portal solo funciona después de *migrarla* y, además,
hay que **borrar su línea de `ACCESS_DEVS`** en Coolify (y redeploy): el token definido allí no se puede revocar desde el portal.

## Migrar a las personas de `ACCESS_DEVS` al portal

Personas → ⋯ → *Migrar al portal* (o simplemente edita su rol o sus espacios: se migra sola). Conserva **el mismo token**, rol y
espacios, y desde ahí se gestiona todo en el portal. Después puedes borrar su línea de `ACCESS_DEVS`. El acceso de emergencia
(`ACCESS_ADMINS`) nunca se migra.

## Tokens

**Tokens** (pestaña *Todas las personas*) lista cada token con su nombre, creador, fecha, **último uso** (fecha, IP y programa)
y estado, con filtros y búsqueda.

- **Crear:** *Nuevo token* (eliges la persona). Cada persona puede tener hasta 20 activos, uno por equipo.
- **Revocar:** *Revocar* deja de servir el token al instante y corta sus conexiones; los demás tokens de esa persona siguen.
  Los revocados quedan 90 días como historial.
- **Incidente:** Personas → ⋯ → *Revocar todos sus tokens* corta todos los del portal de esa persona.
- Los tokens definidos en Coolify (`ACCESS_DEVS`, `ACCESS_ADMINS`) se ven pero **solo se quitan en Coolify**.
- Crear tokens exige sesión del portal: con solo un token (sin contraseña) únicamente puede un admin. Así un token robado no
  puede fabricar otros que sobrevivan a su revocación.

**Restablecer la contraseña de alguien:** Personas → ⋯ → *Restablecer contraseña* (o *Nueva invitación*): crea un enlace de un solo
uso que sustituye al anterior y cierra sus sesiones.

## Espacios y permisos

Página **Espacios** (solo admin):

- **Memorias (Mem0)** y **Notas (Basic Memory):** cada namespace o proyecto antiguo con cuántas memorias tiene y a qué espacio
  corresponde. *Asignar* decide su espacio (uno existente o uno nuevo con prefijo) **sin mover ni reescribir nada** y sin
  redeploy. Lo que no tiene espacio solo lo ve un admin.
- **Permisos de acceso:** un interruptor entre *solo registrar* (no bloquea; muestra cuántos intentos se habrían bloqueado) y
  *bloqueando*. Al activarlo avisa de las personas sin espacios y de lo que queda sin asignar. **Mientras esté en «solo
  registrar», nadie queda restringido.** Actívalo cuando el aviso salga limpio.

## Memorias: ver, limpiar y mantener

- **Grafo de memoria:** las memorias de un espacio agrupadas por tema. Como admin ves también los namespaces sin espacio.
  Clic en un punto → leer completa → *Borrar* (con confirmación; queda en el registro de auditoría con lo que se borró).
- **Qué se rechaza al escribir:** lo demasiado corto, títulos, ids sueltos, etiquetas, secretos y duplicados. Ver
  [`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md).
- **Marcha atrás del servicio de memoria:** `MEM0_BACKEND=openmemory` y redeploy. El contenedor viejo sigue levantado, sin pérdida de datos.
- En **Espacios** una etiqueta indica qué servicio guarda las memorias (*servicio propio* u *OpenMemory*).

## Rotar la credencial de servicio de Basic Memory

Es la contraseña que solo conoce el gateway. Rótala si se expuso o cada cierto tiempo. **La generas tú en tu terminal**; no la
pegues en un chat.

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
2. En `memory-mem0`, pega el portapapeles (`Ctrl+V`) en `KB_UPSTREAM_AUTH_B64` y dale Update. **Solo el base64:** sin `Basic `, sin espacios y sin salto de línea.
3. Redeploy de `memory-mem0`.
4. Comprueba: la credencial vieja debe dar **401**, y un token de dev por `kb` debe dar **200**.

Dos trampas: `openssl rand -base64` en Git Bash termina en `\r\n` (por eso el bloque usa `'/+=\r\n'`); y el hash va en el label
**tal cual**, con sus `$` y **sin duplicarlos** (un `$$` llega literal y rompe la autenticación).

## Comprobar que todo está sano

```bash
curl -s https://memory.omniaos.ai/healthz                                      # {"ok":true}
curl -s https://kb.omniaos.ai/healthz                                          # {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" https://memory.omniaos.ai/mcp/x       # 401 (sin token)
curl -s -H "Authorization: Bearer $TOKEN" https://memory.omniaos.ai/whoami     # {"dev":"...","route":"mem0","role":"admin"}
curl -s -H "Authorization: Bearer $TOKEN" https://kb.omniaos.ai/whoami         # {"dev":"...","route":"knowledge"}
curl -s -H "Authorization: Bearer $TOKEN" https://memorypanel.omniaos.ai/api/admin/settings   # memoryBackend, enforce
```

Y desde el portal: **Espacios** debe decir «servicio propio» y **Grafo de memoria** debe mostrar memorias. Si el gateway
arranca sin el servicio de memoria, el registro dice `AVISO: el servicio de memoria no pudo iniciar` (casi siempre falta
`OPENAI_API_KEY`, o el modelo de embeddings no coincide con el de la colección).

**Quién usa qué:** los logs del servicio `access` (Coolify → `memory-mem0` → Logs) son una línea JSON por pedido con el `id`,
el host, la ruta y el estado. **Nunca** llevan el token ni los parámetros de la URL.

## Basic Memory (las notas): lo que hay que saber

- **Un proyecto por espacio**, con el mismo nombre: `global`, `proy-omniapos`, `int-frutal`… Estructura fija de carpetas,
  tipos y encabezado en [`ESTRUCTURA-NOTAS.md`](ESTRUCTURA-NOTAS.md). Los proyectos antiguos (`main`, `projects`) solo los ve un admin
  hasta que se asignen en Espacios.
- **Versión fija `0.23.2`.** Antes de actualizarla: `OMNIA_MEMORY_TOKEN=<admin> node memory/access/kb-tools-snapshot.mjs` compara
  sus herramientas con la foto guardada y falla si hay una nueva o un parámetro nuevo; revisa `policy.mjs` antes de desplegar.
- Si un proyecto desaparece (`Project not found`), se recrea con `create_memory_project(project_name="<espacio>", project_path="/app/data/<espacio>")`.
  Basic Memory fuerza cada proyecto a `/app/data/<nombre>`.
- Las notas viajan **Basic Memory → `sync` (cada 3 min) → GitHub → Obsidian**. `sync` hace `git pull --rebase` y `push`; un
  conflicto real lo avisa en su log y **no reintenta solo**.
- La configuración y el índice viven en el volumen `basic-memory-config`, montado en **`/root/.basic-memory`**. Si lo mueves, cada redeploy borra los proyectos.
- **Watch Paths de `omnia-knowledge` = `deploy/**`.** Sin esto, cada commit `auto-sync` redespliega el servicio y corta las sesiones de todos.
- Tu `git push` a `omnia-knowledge` puede rechazarse (non-fast-forward) porque `sync` sube commits solo: `git pull --rebase origin main` y de nuevo.

## Redeploys: qué esperar

| Cambias… | Efecto |
|---|---|
| Personas, tokens, espacios, alias, modo de permisos (portal) | **Nada**: se aplica al instante, sin redeploy. |
| Una variable de `memory-mem0` o `memory/access/*` | Redeploy **manual** de `memory-mem0` (~2 min, se cortan las sesiones). El push a `vision-infra` no lo dispara. |
| `omnia-knowledge/deploy/*` | Redeploy de `omnia-knowledge` por webhook. |
| Notas en `omnia-knowledge/*` | **Nada.** Watch Paths lo evita. |

Después de **cualquier** redeploy que corte el servicio, **los devs deben reiniciar Claude Code**: el cliente MCP no se reconecta solo. Avísales.

Dos trampas de Coolify: los dominios van **con esquema y con puerto** (`https://memory.omniaos.ai:8080,https://kb.omniaos.ai:8080,https://memorypanel.omniaos.ai:8080`
para `access`; `https://knowledge.omniaos.ai:8420` para `basic-memory`), y un 401 de BasicAuth **no** prueba que el backend responda: prueba siempre con credencial válida.

## Seguridad

- **Cada persona ve solo lo que su rol y sus espacios permiten, pero solo cuando el interruptor de permisos está en «bloqueando».**
  Mientras esté en «solo registrar», el gateway deja pasar y anota lo que bloquearía.
- Los clientes tienen un conjunto mínimo de herramientas de notas y solo su `cli-…`. El aislamiento de las notas descansa en un
  filtro del gateway (lista blanca + foto de versión), no en una separación física: por eso la versión de Basic Memory está fija.
- `delete_all_memories` es solo de administradores. Una persona borra lecciones sueltas de su espacio con `delete_memory`.
- **Los secretos nunca van en el chat.** Si pegas o ves un secreto expuesto, rótalo. Genera las contraseñas en tu terminal y
  pásalas al portapapeles (`clip.exe`).
- **Respaldo:** la herramienta de respaldo cifrado existe (Qdrant y los archivos de `/data`), pero **no hay destino configurado**
  (falta el bucket de R2 y la clave de cifrado): hoy no hay copia fuera del servidor de las memorias ni de los usuarios. Las
  notas sí tienen copia en GitHub. Sin hacer restauración de prueba todavía.

## Si algo se rompe

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Los devs ven **401** en las memorias | Token revocado o mal copiado | Portal → Tokens: mira su estado y último uso |
| `kb` da **401** con un token válido | Credencial de servicio distinta al hash de Alma | Repite «Rotar la credencial», pasos 2 y 3 |
| `kb` da **502** | Servicio de Alma caído, o dominio sin puerto | Logs de `omnia-knowledge`; revisa `:8420` |
| **503** durante un minuto | Redeploy en curso | Espera |
| Alguien recibe **403** | Su espacio no está asignado (con el bloqueo activo) | Personas → ⋯ → *Cambiar rol y espacios* |
| «No se guardó: …» al escribir | El texto no pasó el filtro de calidad | Es lo esperado: corregir el texto (ver la convención) |
| El grafo sale vacío | El servicio de memoria no inició o no coincide el modelo de embeddings | Logs de `access`; revisa `OPENAI_API_KEY` y `EMBEDDER_MODEL` |
| El portal dice «OpenMemory» en Espacios | Falta `OPENAI_API_KEY` o `MEM0_BACKEND=openmemory` | Revisa esas variables |
| `Project not found` en Basic Memory | Config perdida (volumen mal montado) | Recrea el proyecto; verifica el montaje |
| `omnia-knowledge` en **«Restarting»** | `sync` sin identidad de git | Debe tener `user.name`/`user.email` en su comando |
| Cada nota provoca un redeploy | Falta Watch Paths | `deploy/**` en `omnia-knowledge` |
| «Invalid request parameters» | Sesión MCP vieja tras un redeploy | Que reinicie Claude Code |

## Lista de comprobación: primer día de un equipo nuevo

- [ ] Dar de alta a cada persona (Personas → Dar de alta) con su rol y sus espacios, y confirmar su `ok` doble.
- [ ] Cada persona entra al portal con su enlace de invitación y elige su contraseña.
- [ ] Cada persona corre `/memory-setup` en sus repos y reinicia Claude Code.
- [ ] Cada persona hace la comprobación de [`MANUAL-DEV.md`](MANUAL-DEV.md), paso 4.
- [ ] Les mandas [`WORKFLOW.md`](WORKFLOW.md) y [`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md).
- [ ] Avisas que, tras un redeploy, hay que reiniciar Claude Code.
- [ ] Cuando todos tengan espacios, activas el bloqueo en Espacios → Permisos de acceso.

## Pendientes conocidos

Respaldo en R2 y restauración de prueba; apagar `openmemory-mcp`; activar el bloqueo de permisos; segundo factor (TOTP) del
portal; medir cuántos proyectos aguanta una sola instancia de Basic Memory; limpieza del método anterior (túnel SSH, Vaultwarden).
Lista completa al final de [`ARQUITECTURA.md`](ARQUITECTURA.md).
