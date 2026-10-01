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

## Panel de administración (API construida; la pantalla falta)

`memorypanel.omniaos.ai` lo sirve este mismo gateway (sin servidor nuevo). Para activarlo:

1. **Coolify → `memory-mem0` → Domains del servicio `access`:** añade `https://memorypanel.omniaos.ai:8080` a los dos que ya hay.
2. Redeploy de `memory-mem0` (crea el volumen `access_data` donde vive el archivo de usuarios).

API (token de cada persona como `Authorization: Bearer`; solo `admin` toca `/api/admin/*`):

| Acción | Llamada |
|---|---|
| Quién soy | `GET /api/me` |
| Listar personas | `GET /api/admin/users` (sin hashes ni tokens) |
| **Alta** | `POST /api/admin/users` `{id, role, spaces}` → devuelve el token **una vez** y el comando de la persona |
| Cambiar rol o espacios | `PATCH /api/admin/users/<id>`; corta sus sesiones abiertas |
| Rotar token | `POST /api/admin/users/<id>/rotate`; el anterior deja de servir |
| **Baja** | `DELETE /api/admin/users/<id>`; inmediata en las dos memorias |

- **Sin redeploy:** el cambio se escribe en `/data/users.json` y se aplica en el mismo instante. Las demás personas no notan nada.
- Las personas de `ACCESS_DEVS` y `ACCESS_ADMINS` (Coolify) se ven pero **no se editan aquí**. `ACCESS_ADMINS` queda como acceso de emergencia.
- No puedes darte de baja ni quitarte el rol de admin a ti mismo.
- Cada acción administrativa queda en el log (`ev: admin_action`, con quién y a quién; nunca el token).
- El respaldo cifrado de Mem0 incluye `users.json` (solo hashes).
- Las páginas se sirven con una política de contenido estricta (sin scripts en línea) y los tokens inválidos se frenan por origen sin afectar nunca a un token válido.

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
node --test memory/access        # 45 pruebas: auth, allowlist, credenciales, SSE, roles, espacios, fugas, auditoría
```
