# 🧠 Memoria compartida del equipo (Omnia)

Este módulo conecta tu IDE a la **memoria compartida del equipo**: un único store
hosteado (Mem0 self-hosted, multi-user) donde los agentes recuerdan decisiones,
contexto y lecciones **entre repos, devs y sesiones**. No es memoria local por
persona: todos escriben y leen del mismo cerebro.

## Arquitectura (resumen)

```
Cada IDE (Claude Code, Cursor, …) ──MCP──▶ túnel SSH ──▶ Mem0 self-hosted (VPS + Coolify)
        │                              (localhost:8765)        ▲
        │ handoffs / commits / telemetría                      │ destila lecciones
        └──────────────▶  Hermes (daemon, cron) ───────────────┘  (self-learning, con gate humano)
```

> 🔒 **El servidor de memoria NO está expuesto a internet** (endurecido tras el
> incidente de jul-2026). El único acceso es por **túnel SSH** con un usuario
> restringido solo-túnel (`visiontunnel`, sin shell). Por eso todas las URLs
> apuntan a `localhost`.

- **Mem0** = store compartido, multi-user, con extracción/consolidación automática.
- **Hermes** = daemon que destila handoffs + commits + telemetría en lecciones
  durables dentro de Mem0 y propone guardrails/skills. **Propone; un humano aprueba.**
- **Fuente de verdad** sigue siendo `vision/` + handoffs en git. La memoria del
  agente es complementaria, no canónica — no dupliques ahí las decisiones de
  arquitectura.

## Esquema de namespaces (importante)

La memoria se separa por `user_id` (va en la URL del MCP: `.../sse/<user_id>`):

| Namespace | Qué guarda | Alcance |
|---|---|---|
| **proyecto** (`frutal`, `weritas`, `omniapos`, …) | contexto/decisiones del proyecto | aislado — **clientes distintos nunca se cruzan** |
| **`omnia-global`** | lecciones de ingeniería reutilizables (framework, tooling, patrones) — **sin datos de cliente** | compartido entre todos los proyectos |

Por eso tu repo tiene **dos** servidores de memoria (abajo). Regla de escritura:
lo específico del proyecto → `omnia-memory`; lo generalizable → `omnia-memory-global`.

## Qué instaló `vision init`

- Añadió **dos** servidores MCP a tu `.mcp.json` (preservando los que ya tenías,
  p.ej. `dart`), sin credenciales en claro:
  - **`omnia-memory`** → namespace del proyecto de este repo.
  - **`omnia-memory-global`** → lecciones reutilizables del equipo.
- `memory/.memory.env.example` — plantilla de conexión (URL de proyecto + global).
- Ignoró `memory/.memory.env` en `.gitignore`.

## Puesta en marcha (por dev) — recomendado: setup self-service (Windows)

Desde `self-service-memory-tunnel-onboarding` (ver
[`vision/specs/services/self-service-memory-tunnel-onboarding/`](../vision/specs/services/self-service-memory-tunnel-onboarding/)),
el camino recomendado en Windows es un script que hace todo esto por vos, una
sola vez por máquina — sin volver a depender del admin cada vez que cambiás
de equipo físico:

```powershell
.\memory\setup\windows.ps1
```

Te pide un login simple contra [Vaultwarden](../vault/README.md) (tu email +
contraseña maestra, +2FA si la activaste) para recuperar tu llave SSH, y
deja el túnel corriendo solo en background (autoarranque + reconexión
automática) y las variables `OMNIA_MEMORY_*` ya fijadas — no hace falta abrir
ninguna terminal manualmente ni volver a correr `source` en cada sesión.

Ver [`memory/setup/README.md`](setup/README.md) para el detalle completo,
qué hacer si algo falla, y el estado de macOS/Linux (todavía sin script
equivalente — usar el flujo manual de abajo mientras tanto).

**Requisito previo (lo hace el admin, una sola vez por persona):** autorizar
tu llave pública bajo `visiontunnel` y subir tu privada a tu cuenta de
Vaultwarden — ver [`vault/README.md`](../vault/README.md#alta-de-una-persona-runbook-para-el-admin).

## Puesta en marcha (por dev) — flujo manual (fallback, todo SO)

Sigue funcionando igual que siempre — útil si todavía no corriste el setup
self-service, estás en macOS/Linux, o preferís no usar Vaultwarden:

0. **Acceso (una sola vez):** genera tu llave SSH si no tienes
   (`ssh-keygen -t ed25519`) y manda la **pública** (`~/.ssh/id_ed25519.pub`)
   al admin. Él la autoriza en el usuario `visiontunnel` del servidor.
1. `cp memory/.memory.env.example memory/.memory.env` y rellénalo
   (host del servidor, ruta de tu llave, slug del proyecto, token).
2. **Abre el túnel** (deja esa terminal abierta mientras trabajas):
   ```bash
   bash memory/tunnel.sh
   ```
3. Exporta las variables **antes** de abrir el IDE:
   ```bash
   set -a; source memory/.memory.env; set +a
   ```
   (o ponlas en tu perfil de shell / variables de entorno del sistema).
4. Abre el IDE. Ya compartes memoria con el equipo.

> Tip: con `OMNIA_MEMORY_TUNNEL_PORTS=8765,4320` el mismo túnel te da también
> el dashboard de métricas del equipo en `http://localhost:4320`.

## Notas por IDE

- **Claude Code**: usa `.mcp.json` en la raíz del repo (lo que instalamos). ✅
- **Cursor**: lee `.cursor/mcp.json`; copia ahí el mismo bloque `omnia-memory`.
- **Windsurf**: MCP es global (`~/.codeium/windsurf/mcp_config.json`); añade el
  bloque una vez por máquina.
- **opencode**: la sección `mcp` de `opencode.json` usa otro esquema; ver docs.
- **Kilo Code**: configura el MCP en su panel de settings con el mismo endpoint.

El endpoint exacto (SSE vs HTTP) depende de cómo exponga Mem0 su MCP; se fija al
desplegar el VPS y se documenta aquí.
