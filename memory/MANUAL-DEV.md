# Manual del dev: conectarte a la memoria compartida

Para cualquier persona del equipo. Te toma unos 15 minutos la primera vez y
después no vuelves a tocarlo. Cómo usarla en el día a día está en
[`WORKFLOW.md`](WORKFLOW.md).

## Qué es, en tres líneas

Es la memoria del equipo: lo que uno resuelve (un incidente, un gotcha, una
decisión) queda guardado y lo encuentra cualquiera, sin depender de quién lo hizo.
Son **dos memorias** que ya vienen conectadas con **un solo token personal**:

- **Mem0:** lecciones cortas, una oración cada una.
- **Basic Memory:** notas largas con contexto (incidentes completos, fichas de clientes).

## Lo que necesitas antes de empezar

- Claude Code (o tu IDE con MCP) instalado.
- Tu **comando personal**, que te manda el admin por un enlace de un solo uso. Es
  tuyo: no lo compartas, no lo pegues en un chat ni lo guardes en un repo.
- **Windows:** PowerShell normal (sin administrador). **macOS/Linux:** una terminal con `bash` y `curl`.

No necesitas instalar llaves SSH, túneles, Vaultwarden ni Git for Windows para esto.

## Paso 1: darte de alta (una vez por persona)

**Windows (PowerShell):** pega tu comando. Se ve así, con tu token en lugar de `omnia_...`:

```powershell
$env:OMNIA_TOKEN='omnia_...'; irm https://memory.omniaos.ai/setup | iex
```

**macOS / Linux:**

```bash
OMNIA_TOKEN='omnia_...' bash -c "$(curl -fsSL https://memory.omniaos.ai/setup.sh)"
```

Qué hace, en orden:
1. Comprueba que tu token abre las **dos** memorias. Si falla, **no cambia nada** en tu equipo.
2. Guarda tu token en la variable de usuario `OMNIA_MEMORY_TOKEN` (sin permisos de administrador).
3. Te pide reiniciar.

**Salió bien si ves:**

```
== Comprobando las dos rutas ==
  ok  memory.omniaos.ai   Mem0 (lecciones cortas)
  ok  kb.omniaos.ai       Basic Memory (notas largas)

Listo, <tu nombre>. Cierra y vuelve a abrir tu IDE / Claude Code...
```

Si te avisa del `OmniaMemoryTunnel.vbs`: es el túnel del método anterior. Déjalo
mientras lo uses para otra cosa (dashboard de métricas); ya no hace falta para la memoria.

## Paso 2: reiniciar Claude Code (por completo)

Windows solo entrega la variable nueva a los programas que se abren **después** de guardarla.
Abrir otra conversación no basta:

1. Cierra **todas** las ventanas de Claude.
2. Sal también desde el icono de la bandeja del sistema (junto al reloj).
3. Vuelve a abrirlo.

## Paso 3: conectar cada repo donde trabajes

En Claude Code, dentro del repo:

```
/memory-setup
```

- Escribe en el `.mcp.json` del repo las tres conexiones (proyecto, global y Basic Memory).
- El nombre del proyecto sale de la carpeta del repo (`frutal`, `omniapos`…).
- **No hace commit.** Si tu repo versiona el `.mcp.json`, decides tú qué subir.
- Si el repo tenía el método anterior (túnel o variables viejas), **lo migra solo**.

Alternativa para un repo nuevo con el framework: `vision init`.

Después **reinicia Claude Code otra vez** para que cargue el `.mcp.json`.

Cada repo se conecta **una sola vez**. El bloque es el mismo en todos; solo cambia el nombre del proyecto:

```json
{
  "mcpServers": {
    "omnia-memory": {
      "type": "sse",
      "url": "https://memory.omniaos.ai/mcp/claude/sse/<nombre-del-proyecto>",
      "headers": { "Authorization": "Bearer ${OMNIA_MEMORY_TOKEN}" }
    },
    "omnia-memory-global": {
      "type": "sse",
      "url": "https://memory.omniaos.ai/mcp/claude/sse/omnia-global",
      "headers": { "Authorization": "Bearer ${OMNIA_MEMORY_TOKEN}" }
    },
    "basic-memory": {
      "type": "sse",
      "url": "https://kb.omniaos.ai/mcp",
      "headers": { "Authorization": "Bearer ${OMNIA_MEMORY_TOKEN}" }
    }
  }
}
```

El nombre del proyecto va **escrito en el archivo**, nunca como variable de entorno:
si dos repos abiertos a la vez compartieran una variable, uno escribiría en la
memoria del otro.

## Paso 4: comprobar que funciona

Pídele a Claude:

- *"Busca en la memoria compartida por qué OpenMemory no debe publicarse sin autenticación."*
  Debe devolver hechos del namespace global.
- *"Busca en las notas la arquitectura de la memoria compartida."*
  Debe encontrar la nota `omnia-infra/memoria-compartida`.

Otra forma, si tienes el framework instalado: `vision doctor`. Comprueba que tu
token es aceptado por el gateway (nunca lo imprime).

## Y ahora, a trabajar

Lee [`WORKFLOW.md`](WORKFLOW.md). Lo esencial:

| Cuándo | Qué |
|---|---|
| Empiezas una tarea | `/memory-recall <tema>` |
| Resuelves algo no obvio | `/memory-write` |
| Termina la sesión | `/session-close` |
| Dejas algo a medias | `/handoff` (y `/resume` para retomar) |

## Reglas de oro

1. **Tu token es personal.** No lo compartas ni lo pegues en un chat, un ticket o un repo.
   Si se te escapa, avisa al admin: se da de baja y se te da otro.
2. **Nunca guardes secretos** en la memoria (contraseñas, tokens, claves).
3. **Nada de datos de cliente** en el namespace global.
4. **Nunca uses `delete_all_memories`.** Borra todo un namespace, sin vuelta atrás.

## Ver las notas largas en Obsidian (opcional)

Las notas de Basic Memory viven en el repo `omnia-knowledge` de GitHub, así que
puedes leerlas en Obsidian. Guía: `omnia-knowledge/OBSIDIAN-SETUP.md`. Los cambios
tardan hasta 3 minutos en aparecer; los agentes los ven al instante.

## Si algo falla

| Qué ves | Causa probable | Qué hacer |
|---|---|---|
| El script dice **401** o "rechazó el token" | Token mal copiado, o dado de baja | Copia el comando **completo**, sin comillas extra. Si sigue, pide uno nuevo al admin |
| El script dice que **no puede llegar** al servidor | Sin internet, VPN o DNS | Prueba en el navegador `https://memory.omniaos.ai/healthz`: debe decir `{"ok":true}` |
| Claude Code muestra las memorias como **fallidas** con 401 | Sigue usando el token viejo | Reinicia **por completo** (ventanas y bandeja) |
| **Todo** falla de golpe con "Invalid request parameters" | El servidor se reinició y tu sesión quedó vieja | Reinicia Claude Code |
| **"Project not found"** en Basic Memory | El servicio perdió la configuración | Avisa al admin: se recrea el proyecto `projects` |
| Escribiste una nota y **no aparece en Obsidian** | El sync corre cada 3 minutos | Espera un poco y haz `git pull` en `omnia-knowledge` |
| `/memory-write` devuelve **`results: []`** | Mem0 no extrajo ningún hecho | Reescríbelo como decisión del equipo, en una oración |
| Cambiaste de **laptop** | Nada que arreglar | Pega tu mismo comando otra vez |
| **Perdiste** tu comando | El token no se guarda en ningún sitio | Pide uno nuevo: el admin da de baja el anterior |

Si nada de esto sirve, escribe al admin con el **mensaje de error**, nunca con tu token.
