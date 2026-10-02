# Access gateway — un solo método para las dos memorias

Un token por dev abre **Mem0** y **Basic Memory**. Sin túnel SSH, sin llaves,
sin Vaultwarden ni Bitwarden CLI en el camino del dev.

```
Claude Code / IDE ──HTTPS + Bearer <token del dev>──▶ access (este servicio)
                                                        ├─ memory.omniaos.ai ─▶ openmemory-mcp   (red interna, solo /mcp/*)
                                                        └─ kb.omniaos.ai     ─▶ knowledge.omniaos.ai (Basic Memory, VPS Alma)
```

- El dev solo conoce **su token**. El gateway lo valida contra hashes SHA-256
  (`ACCESS_DEVS`), lo descarta y pone del lado servidor la credencial real de
  cada backend. Ninguna credencial de backend sale del servidor.
- **OpenMemory no valida ninguna credencial** (verificado en la imagen
  `mem0/openmemory-mcp`: ningún router revisa `Authorization` ni `API_KEY`). El
  `OPENMEMORY_API_KEY` no protege nada; hasta hoy la única barrera era que el
  puerto estuviera en loopback y el túnel SSH. Con este gateway, **el token del
  dev es la única autenticación de Mem0**, por eso `openmemory-mcp` nunca debe
  publicarse fuera de la red interna del stack.
- Mem0 expone únicamente `/mcp/*`. La API de administración y `/docs` de
  OpenMemory dan 404; la UI sigue apagada (ver postmortem del 20-jul-2026).
- Basic Memory no cambia: sigue en Alma con su BasicAuth, que pasa a ser una
  credencial de servicio que solo usa este gateway.
- Cada pedido se registra con el id del dev (nunca el token ni el query string),
  y el backend recibe `x-omnia-dev` para atribución.

## Roles y espacios (construido, en modo auditoría)

El gateway decide, para cada token, a qué espacios entra y qué herramientas usa. Reglas completas,
nombres y verificación en [`../PERMISOS.md`](../PERMISOS.md). Código: `policy.mjs` (reglas), `users.mjs` (usuarios).

- **Alta con rol y espacios:** `node memory/access/devs.mjs add ana --role miembro --spaces int-frutal,proy-omniapos`
  imprime la línea `ana:<hash>:miembro:int-frutal+proy-omniapos` para `ACCESS_DEVS`. Sin `--role` sigue el formato antiguo.
- **Admin de emergencia:** `ACCESS_ADMINS` (`id:hash`) es siempre `admin` y nunca se edita desde el panel. Antes de
  activar el bloqueo, **tu propio token debe estar ahí** o en `ACCESS_DEVS` con rol `admin`.
- **`ACCESS_ENFORCE` vacío = auditoría:** nada se bloquea, pero cada pedido que se denegaría queda en el log con
  `pol: "would_deny:<motivo>"`. Con `ACCESS_ENFORCE=1` se bloquea con 403 y `pol: "deny:<motivo>"`.
- Un token con el formato antiguo (`id:hash`) es `miembro` sin espacios asignados: solo ve `global`. En auditoría no
  afecta, pero **antes de activar el bloqueo hay que asignarle espacios**.
- Cada pedido a Basic Memory se valida por lista blanca: herramientas conocidas, `project` obligatorio y válido,
  sin `project_id`, `workspace` ni `search_all_projects`, y cualquier `memory://` debe apuntar al mismo proyecto.
- Un límite de 1200 pedidos por minuto por persona y de 256 KB por mensaje.

Revisar la auditoría en los logs del servicio `access`:

```bash
docker logs <contenedor-access> 2>&1 | grep would_deny | head
```

## Portal (acceso por usuario y contraseña)

**Pantallas** (`portal/`, React + Vite + Tailwind + shadcn/ui + TanStack Table/Query + Framer Motion): entrada,
canje de invitación, Personas (tabla con filtros, altas, cambios de rol/espacios, bajas, token e invitación nuevos)
y Mi cuenta. Arquitectura por funcionalidad (`features/`) y piezas compartidas (`shared/`), nombres en kebab-case.
El `Dockerfile` compila el portal y el gateway lo sirve desde `panel/` (rutas sin extensión → `index.html`,
CSP con nonce por respuesta). Desarrollo: `cd portal && npm run dev` (proxy a un gateway local en :18100).
Pendiente: Notas (lector de Basic Memory) y Grafo de memoria (Mem0); aparecen como «Pronto» en el menú.

`memorypanel.omniaos.ai` lo sirve este mismo gateway (sin servidor nuevo). Para activarlo:

1. **Coolify → `memory-mem0` → Domains del servicio `access`:** añade `https://memorypanel.omniaos.ai:8080` a los dos que ya hay.
2. Redeploy de `memory-mem0` (crea el volumen `access_data` donde vive el archivo de usuarios).

**El portal y el MCP usan credenciales distintas.** El token (`omnia_...`) es solo para el MCP; el navegador entra con
usuario y contraseña. Un token robado no abre el portal, ni al revés.

- **Primer acceso por invitación:** el alta (o `POST /api/admin/users/<id>/invite`) devuelve un enlace de un solo uso, 24 h,
  tipo `https://memorypanel.omniaos.ai/#invitacion=...`. La persona **elige su contraseña** (mínimo 12 caracteres); nadie más
  la conoce. Un enlace nuevo sustituye al anterior y sirve también para **restablecer una contraseña**.
- Contraseñas con `scrypt` y sal propia; sesión por cookie `HttpOnly` + `Secure` + `SameSite=Strict`, caduca a las 4 h sin
  actividad y a las 12 h en total. Se guarda solo el hash de la sesión, y vive en memoria: un redeploy pide volver a entrar.
- **Cada petición con cookie relee a la persona:** un cambio de rol o una baja se aplican al instante, sin volver a entrar.
- Toda escritura con cookie exige el mismo origen y una marca CSRF propia de la sesión.
- **5 fallos de contraseña bloquean 15 minutos** esa combinación origen+usuario (y 30 el usuario en general). Nunca bloquea
  sesiones ya abiertas ni a otras personas.
- Cada persona puede cambiar su contraseña (cierra sus otras sesiones) y **gestionar sus propios tokens** (ver abajo).
- Las personas de `ACCESS_DEVS` y `ACCESS_ADMINS` (Coolify) también reciben invitación al portal.
- **Pendiente:** segundo factor (TOTP). Se decidió empezar solo con contraseña.
- **Primer admin:** pon tu hash en `ACCESS_ADMINS` de Coolify y pide tu propia invitación con tu token de MCP:
  `curl -X POST -H "Authorization: Bearer $OMNIA_MEMORY_TOKEN" https://memorypanel.omniaos.ai/api/admin/users/<tu-id>/invite`.

API (cookie de sesión, o el token de la persona como `Authorization: Bearer` para automatizar desde la terminal; solo `admin` toca `/api/admin/*`):

| Acción | Llamada |
|---|---|
| Entrar / canjear invitación | `POST /api/auth/login` · `POST /api/auth/accept-invite` |
| Quién soy, salir, cambiar contraseña | `GET /api/me` · `POST /api/auth/logout` · `/api/auth/password` |
| Mis tokens: listar, crear, revocar | `GET/POST /api/me/tokens` · `DELETE /api/me/tokens/<tid>` |
| Listar personas | `GET /api/admin/users` (sin hashes ni tokens) |
| **Alta** | `POST /api/admin/users` `{id, role, spaces}` → devuelve **una vez** el token del MCP, su comando y la invitación al portal |
| Invitación / restablecer contraseña | `POST /api/admin/users/<id>/invite` |
| Cambiar rol o espacios | `PATCH /api/admin/users/<id>`; corta sus sesiones abiertas |
| Tokens de todos | `GET /api/admin/tokens` · `GET/POST /api/admin/users/<id>/tokens` · `DELETE /api/admin/tokens/<tid>` · `POST /api/admin/users/<id>/tokens/revoke-all` |
| **Migrar** a una persona de `ACCESS_DEVS` al portal | `POST /api/admin/users/<id>/adopt` (conserva su token) |
| **Baja** | `DELETE /api/admin/users/<id>`; inmediata en las dos memorias |

- **Sin redeploy:** el cambio se escribe en `/data/users.json` y se aplica en el mismo instante. Las demás personas no notan nada.
- Las personas de `ACCESS_DEVS` se ven pero **no se editan aquí** hasta migrarlas al portal (botón «Migrar al portal»). `ACCESS_ADMINS` queda como acceso de emergencia y nunca se migra.
- No puedes darte de baja ni quitarte el rol de admin a ti mismo.
- Cada acción administrativa queda en el log (`ev: admin_action`, con quién y a quién; nunca el token).
- El respaldo cifrado de Mem0 incluye `users.json` y `portal.json` (solo hashes).
- Las páginas se sirven con una política de contenido estricta (sin scripts en línea) y los tokens inválidos se frenan por origen sin afectar nunca a un token válido.

## Tokens (varios por persona)

Una persona puede tener **varios tokens**, uno por equipo o editor. Cada uno guarda nombre, quién y cuándo lo creó,
**último uso** (fecha, IP y cliente) y estado. Se ven y se revocan en el portal (página *Tokens*); revocar corta al
instante las conexiones abiertas de ese token y deja funcionando los demás.

- Los tokens de **Coolify** (`ACCESS_DEVS` / `ACCESS_ADMINS`) se ven pero **no se revocan desde el portal**; se quitan en Coolify.
  Ya no se pisan: un token nuevo en `ACCESS_ADMINS` no deja fuera al anterior de la misma persona.
- **Dejar de depender de Coolify:** «Migrar al portal» pasa a una persona de `ACCESS_DEVS` al archivo con su mismo token;
  después se borra su línea en Coolify. Los tokens nuevos de cualquiera nacen ya en el portal.
- **Límites:** 20 tokens activos por persona. Los revocados quedan 90 días como historial.
- Crear tokens exige sesión del portal (contraseña); con solo un token (Bearer) únicamente puede un admin. Así un token
  robado no puede fabricar otros que sobrevivan a su revocación.
- «Último uso» se guarda en disco como mucho cada 30 s; el de los tokens de Coolify vive solo en memoria (se reinicia al redeployar).
- El «dispositivo» es el cliente que se conectó (su `User-Agent`) más la IP; no hay forma de nombrar el equipo físico.
- Archivo `users.json` v2 (`users` + `tokens`); el formato anterior se migra solo al leerlo.

## Notas y Grafo de memoria (solo lectura)

- **Notas:** lee las notas de Basic Memory sin clonar nada (árbol por carpetas, buscador, markdown con etiquetas del encabezado).
  El gateway las pide con **sus** credenciales (`viewer.mjs` + `mcp-client.mjs`) y solo muestra los proyectos cuyo nombre es un
  espacio al que la persona tiene acceso. Un admin también ve proyectos aún sin nombre de espacio (p. ej. `projects`).
- **Grafo de memoria:** las memorias de Mem0 de un espacio, agrupadas por categoría (nodos y enlaces). Usa la REST interna de
  OpenMemory (`/api/v1/memories/?user_id=<espacio>`) con la red interna del gateway.
- **Seguridad:** nada escribe; `project` lo fija el servidor; `memory://` en un identificador se rechaza; el markdown no admite
  HTML en bruto, filtra enlaces (solo http/https/mailto) y no carga imágenes; React escapa el texto de las memorias.
- **Por qué Qdrant:** al hacer persistentes las bases de OpenMemory, su SQL (lista y categorías) arrancó vacío mientras los textos seguían en Qdrant. Las memorias antiguas no tienen categoría: se agrupan por mes. Las nuevas sí traen categoría.

## Espacios, alias y permisos (todo desde el portal)

Página **Espacios** (solo admin), con tres cosas:
- **Memorias (Mem0):** cada namespace con cuántas memorias tiene y a qué espacio corresponde. «Asignar» decide el espacio de
  uno antiguo (existente o nuevo con prefijo) **sin mover ni reescribir memorias** y sin redeploy. Cambiarlo corta las
  conexiones MCP de ese espacio para que se reabran con el permiso nuevo.
- **Notas (Basic Memory):** lo mismo para los proyectos (`main`, `projects`…). Varios proyectos pueden apuntar al mismo espacio y
  el nombre propio de un espacio sigue valiendo. Basic Memory revisa el proyecto en cada mensaje, así que no hay conexiones que cortar.
  Un proyecto sin espacio solo lo ve un admin.
- **Permisos de acceso:** interruptor entre *solo registrar* (auditoría) y *bloqueando*. Muestra cuántos intentos se habrían
  bloqueado y los últimos, y al activar avisa de personas sin espacios y de namespaces o proyectos sin asignar. Si Coolify tiene
  `ACCESS_ENFORCE=1`, queda forzado y no se apaga desde el portal. El registro de auditoría vive en memoria (se reinicia al redeployar).

Todo se guarda en `ACCESS_ALIASES_FILE` (`/data/aliases.json`: `mem0`, `kb`, `enforce`). Los alias de Coolify
(`ACCESS_NAMESPACE_ALIASES`, `ACCESS_PROJECT_ALIASES`) se respetan pero solo se editan allí. Un alias inválido se rechaza sin
dejar nada a medias.

Además, el selector de espacios de una persona ofrece primero los que ya existen, y al editar a alguien de `ACCESS_DEVS` pasa
solo al portal conservando su token (solo `ACCESS_ADMINS` no se edita).

## Dar de alta a un dev (admin, ~1 minuto)

```bash
node memory/access/devs.mjs add ana
```

1. Pega la línea `ana:<hash>` en `ACCESS_DEVS` (coma entre entradas) del recurso
   `memory` en Coolify y haz **Redeploy** del servicio `access`.
2. Mándale a la persona **solo el comando** que imprime el script, por Vaultwarden
   Send (1 vista, 24 h). Es lo único que hace: pegarlo.

```powershell
$env:OMNIA_TOKEN='omnia_...'; irm https://memory.omniaos.ai/setup | iex
```

El script comprueba las dos rutas antes de tocar nada, guarda
`OMNIA_MEMORY_TOKEN` como variable de usuario (sin admin) y pide reiniciar el
IDE. Cambiar de laptop = pegar el mismo comando otra vez.

## Dar de baja

Borrar su línea de `ACCESS_DEVS` y redeploy de `access`. El token deja de servir
en las dos rutas a la vez; no hay nada que tocar en su máquina.

## Conectar un repo

Mismo bloque para cualquier repo, solo cambia el slug del proyecto
([`../mcp-omnia-access.example.json`](../mcp-omnia-access.example.json)). El
token es global de la máquina; el slug va en el `.mcp.json` de cada repo.

## Despliegue (una vez)

1. **DNS:** registros A para `memory.omniaos.ai` y `kb.omniaos.ai` hacia
   `server-omniaplatform`. `knowledge.omniaos.ai` **no se toca**.
2. **Coolify → recurso `memory`:** secrets `ACCESS_DEVS`, `KB_UPSTREAM_AUTH_B64`
   (el mismo base64 de `usuario:clave` que hoy protege `knowledge.omniaos.ai`).
   Domains del servicio `access`, **con esquema**:
   `https://memory.omniaos.ai:8080,https://kb.omniaos.ai:8080`.
3. **Verificar** (sustituye `$T` por un token dado de alta):
   ```bash
   curl -s https://memory.omniaos.ai/healthz                                   # {"ok":true}
   curl -s -o /dev/null -w "%{http_code}\n" https://memory.omniaos.ai/mcp/x    # 401
   curl -s -H "Authorization: Bearer $T" https://kb.omniaos.ai/whoami          # {"dev":"...","route":"knowledge"}
   curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $T" https://memory.omniaos.ai/docs   # 404
   ```
   Y desde Claude Code con el token puesto: `omnia-memory` y `basic-memory`
   conectan, y un `add_memories` + `search_memory` devuelve lo escrito.

## Qué no cubre (a propósito)

- **Aislamiento entre devs:** todos los devs ven todos los namespaces, igual que
  hoy. Si hace falta limitar por proyecto/cliente, se agrega una lista de slugs
  permitidos por dev en el gateway.
- **Rate limiting:** los tokens son de 256 bits, la fuerza bruta no es viable, pero
  el gateway no limita volumen. Si un token se filtra, la baja lo corta.
- **Escrituras simultáneas a la misma nota de Basic Memory:** el gateway no las
  serializa. Sigue abierto en `omnia-knowledge/deploy/DEPLOY.md`.

## Desarrollo

```bash
node --test memory/access        # 59 pruebas: auth, allowlist, credenciales, SSE, roles, espacios, fugas, auditoría
```
