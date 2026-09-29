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
node --test memory/access        # 7 pruebas: auth, allowlist, inyección de credenciales, SSE, revocación
```
