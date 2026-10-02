# Manual del dev: conectarte a la memoria compartida

Para cualquier persona del equipo. Te toma unos 15 minutos la primera vez y después no vuelves a tocarlo.
Cómo usarla en el día a día está en [`WORKFLOW.md`](WORKFLOW.md).

## Qué es, en tres líneas

Es la memoria del equipo: lo que uno resuelve (un incidente, un gotcha, una decisión) queda guardado y lo encuentra
cualquiera, sin depender de quién lo hizo. Son **dos memorias** conectadas con **un solo token personal**:

- **Memorias cortas (Mem0):** lecciones de una o dos oraciones. Se guardan **tal cual las escribes**.
- **Notas largas (Basic Memory):** documentos con contexto (incidentes completos, arquitectura, decisiones).

Y un **portal** para verlo todo y administrar tu acceso: `https://memorypanel.omniaos.ai`.

## Cómo se organiza: espacios

Todo vive en **espacios**, y lo que ves depende de los que tengas asignados:

| Espacio | Qué guarda | Ejemplo |
|---|---|---|
| `global` | Lecciones que sirven a cualquiera, sin nombres de clientes | «Coolify exige dominio con esquema y puerto» |
| `proy-<producto>` | Un producto o repo | `proy-omniapos`, `proy-vision-infra` |
| `int-<cliente>` | Lo que el equipo sabe de un cliente (interno) | `int-frutal` |
| `cli-<cliente>` | Lo que se comparte con el cliente | `cli-frutal` |

Los miembros leen y escriben en `global` y en sus espacios; **solo lectura** consulta sin escribir; un **cliente** solo
accede a su `cli-…`. Si necesitas un espacio que no ves, pídeselo al admin: se asigna desde el portal, sin redeploy.
El mismo nombre de espacio se usa en las memorias cortas y en las notas.

## Lo que necesitas antes de empezar

- Claude Code (o tu IDE con MCP) instalado.
- Tu **comando personal** y tu **enlace de invitación al portal**, que te manda el admin por un canal de un solo uso.
  Son tuyos: no los compartas, no los pegues en un chat ni los guardes en un repo.
- **Windows:** PowerShell normal (sin administrador). **macOS/Linux:** una terminal con `bash` y `curl`.

No necesitas llaves SSH, túneles, Vaultwarden ni Git for Windows para esto.

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

**Tu contraseña del portal:** abre tu enlace de invitación (`https://memorypanel.omniaos.ai/#invitacion=…`), elige una
contraseña de al menos 12 caracteres y entra con tu usuario. Es distinta del token del MCP: el token es para los
editores, la contraseña es para el portal. El enlace sirve **una sola vez** y caduca en 24 horas; si no lo usaste a tiempo,
pide otro.

## Paso 2: reiniciar Claude Code (por completo)

Windows solo entrega la variable nueva a los programas que se abren **después** de guardarla. Abrir otra conversación no basta:

1. Cierra **todas** las ventanas de Claude.
2. Sal también desde el icono de la bandeja del sistema (junto al reloj).
3. Vuelve a abrirlo.

## Paso 3: conectar cada repo donde trabajes

En Claude Code, dentro del repo:

```
/memory-setup
```

- Escribe en el `.mcp.json` del repo las tres conexiones (proyecto, global y notas).
- Para un repo **nuevo** usa el nombre de espacio con prefijo: `proy-<repo>`, o `int-<cliente>` si el repo es parte de un
  cliente. Los repos que ya tenían un nombre antiguo (`frutal`, `omniapos`…) **no se renombran**: el admin lo asigna a su
  espacio y sus memorias siguen donde estaban.
- **No hace commit.** Si tu repo versiona el `.mcp.json`, decides tú qué subir.
- Si el repo tenía el método anterior (túnel o variables viejas), **lo migra solo**.

Después **reinicia Claude Code otra vez** para que cargue el `.mcp.json`. Cada repo se conecta **una sola vez**. El bloque
es el mismo en todos; solo cambia el espacio:

```json
{
  "mcpServers": {
    "omnia-memory": {
      "type": "sse",
      "url": "https://memory.omniaos.ai/mcp/claude/sse/<espacio-del-proyecto>",
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

El nombre del espacio va **escrito en el archivo**, nunca como variable de entorno: si dos repos abiertos a la vez
compartieran una variable, uno escribiría en la memoria del otro. En las notas, el proyecto lo eliges en cada llamada
(`project: "<espacio>"`) y tiene que ser un espacio que tengas asignado.

## Paso 4: comprobar que funciona

Pídele a Claude:

- *«Busca en la memoria compartida cómo se redespliega memory-mem0 después de un push.»* Debe devolver lecciones del espacio global.
- *«Busca en las notas la estructura de las notas.»* Debe encontrar la guía **Estructura de las notas** del espacio `global`.

También puedes entrar al portal: **Notas** y **Grafo de memoria** muestran lo que tienes asignado.

## Tus tokens (uno por equipo)

En el portal, **Tokens** muestra los de tu cuenta: cuándo se creó cada uno, cuándo y desde dónde se usó por última vez
(IP y programa) y su estado. Crea uno por equipo («Laptop de casa», «Oficina») con **Nuevo token**: te da su comando
**una sola vez**. Si pierdes o sospechas de un equipo, **revoca solo ese token**: deja de servir al instante y los demás
siguen funcionando. Para crear tokens hay que haber entrado al portal con tu contraseña.

## Y ahora, a trabajar

Lee [`WORKFLOW.md`](WORKFLOW.md). Lo esencial:

| Cuándo | Qué |
|---|---|
| Empiezas una tarea | `/memory-recall <tema>` |
| Resuelves algo no obvio | `/memory-write` |
| Termina la sesión | `/session-close` |
| Dejas algo a medias | `/handoff` (y `/resume` para retomar) |

## Cómo escribir una lección

El servicio guarda **tu texto exacto** y lo rechaza, con el motivo, si no sirve. Escribe **una oración completa con el dato
concreto** (comando, error exacto, servicio) y su porqué. Se rechaza lo demasiado corto, un título, un id suelto, una etiqueta
y todo lo que parezca una contraseña o un token. Un mensaje `No se guardó: …` te dice qué corregir. Detalle y ejemplos:
[`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md). Para notas largas, la estructura está en [`ESTRUCTURA-NOTAS.md`](ESTRUCTURA-NOTAS.md).

## Reglas de oro

1. **Tu token es personal.** No lo compartas ni lo pegues en un chat, un ticket o un repo. Si se te escapa, revócalo en el portal (Tokens) o avisa al admin.
2. **Nunca guardes secretos** en la memoria (contraseñas, tokens, claves).
3. **Nada de datos de cliente en `global`** ni datos personales de personas. Lo de un cliente va a su espacio `int-` o `cli-`.
4. **Si una lección es incorrecta, bórrala** con `delete_memory` (una sola, de tu espacio). `delete_all_memories` es solo para administradores y nunca se usa.

## Ver las notas largas en Obsidian (opcional)

Las notas de Basic Memory viven en el repo `omnia-knowledge` de GitHub, así que puedes leerlas en Obsidian. Guía:
`omnia-knowledge/OBSIDIAN-SETUP.md`. Los cambios tardan hasta 3 minutos en aparecer; los agentes los ven al instante.

## Si algo falla

| Qué ves | Causa probable | Qué hacer |
|---|---|---|
| El script dice **401** o «rechazó el token» | Token mal copiado, o revocado | Copia el comando **completo**, sin comillas extra. Si sigue, pide uno nuevo al admin |
| El script dice que **no puede llegar** al servidor | Sin internet, VPN o DNS | Prueba en el navegador `https://memory.omniaos.ai/healthz`: debe decir `{"ok":true}` |
| Claude Code muestra las memorias como **fallidas** con 401 | Sigue usando el token viejo | Reinicia **por completo** (ventanas y bandeja) |
| **Todo** falla de golpe con «Invalid request parameters» | El servidor se reinició y tu sesión quedó vieja | Reinicia Claude Code |
| **403** o «sin acceso al espacio» | Ese espacio no está asignado a tu cuenta | Pídeselo al admin |
| **«No se guardó: …»** al escribir | El texto no pasó el filtro (corto, título, id o secreto) | Corrige lo que dice el motivo y reintenta |
| **«Project not found»** en las notas | Ese proyecto de notas no existe | Usa el nombre de un espacio que tengas; si es nuevo, avisa al admin |
| Escribiste una nota y **no aparece en Obsidian** | El sync corre cada 3 minutos | Espera un poco y haz `git pull` en `omnia-knowledge` |
| Cambiaste de **laptop** | Nada que arreglar | Pega tu mismo comando otra vez, o crea un token nuevo en el portal |
| **Perdiste** tu comando | El token no se guarda en ningún sitio | Crea otro en el portal (Tokens) y revoca el viejo |
| **No recuerdas tu contraseña del portal** | — | Pide al admin un enlace nuevo (Personas → Restablecer contraseña) |

Si nada de esto sirve, escribe al admin con el **mensaje de error**, nunca con tu token.
