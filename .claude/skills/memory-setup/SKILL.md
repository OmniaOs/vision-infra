---
name: memory-setup
description: 'Configura el .mcp.json de un repo para conectarlo a TODA la memoria compartida de Omnia en un solo paso, por el gateway único (un token individual, OMNIA_MEMORY_TOKEN): Mem0 (omnia-memory con slug hardcodeado + omnia-memory-global) y Basic Memory (basic-memory). Detecta alta nueva, migración del método anterior (túnel localhost:8765, ${OMNIA_MEMORY_MCP_URL}, ${OMNIA_MEMORY_GLOBAL_MCP_URL}, BasicAuth de knowledge) y git worktrees (heredan el slug del repo principal). No hace preguntas salvo conflicto de slug ya usado.'
---

# Memory Setup

## Propósito

Conecta un repo a la memoria compartida editando su `.mcp.json`, con el método
vigente descrito en `memory/ARQUITECTURA.md` (repo `vision-infra`): un solo
gateway (`memory.omniaos.ai` para Mem0, `kb.omniaos.ai` para Basic Memory) y un
token individual por persona en `OMNIA_MEMORY_TOKEN`. Sin esta skill, cada alta
es un procedimiento manual con formas documentadas de salir mal (usar una
variable en vez del slug hardcodeado → dos repos abiertos a la vez compiten por
el mismo namespace; confirmado roto así en `cfdi` y `omnia-client-portal`).

También **migra** los repos que todavía usan el método anterior (túnel SSH a
`localhost:8765`, `${OMNIA_MEMORY_GLOBAL_MCP_URL}`, BasicAuth de
`knowledge.omniaos.ai`) sin tocar el slug del proyecto.

No escribe contenido en la memoria ni la consulta — solo cablea la
conexión. Para eso ver `memory-write` y `memory-recall`.

Cablea las **tres** conexiones en una sola corrida (`omnia-memory`,
`omnia-memory-global`, `basic-memory`) — antes eran pasos manuales
separados, lo que significaba que cada repo nuevo requería acordarse de
tres cosas en vez de correr una skill. `basic-memory` no tiene namespace
por repo (es un solo server con un proyecto `projects` y los clientes como
carpetas, ver `omnia-knowledge/deploy/DEPLOY.md`), así que su bloque es el
mismo en cualquier repo — no necesita el Paso 3 (slug) para nada.

## Entrada

- **`projectRoot`** (string, path absoluto, opcional): repo a configurar.
  Default: directorio de trabajo actual del agente.
- **`slug`** (string, opcional): fuerza el slug del proyecto en vez de
  inferirlo. Usalo solo si el Paso 3 del algoritmo produciría un slug
  distinto al que el equipo ya usa para ese proyecto en otro lado.

## Algoritmo

Ejecuta los pasos en orden. No omitas pasos. No reordenes pasos.

### Paso 1 — Chequeo blando del prerrequisito de máquina

1. Comprueba si `OMNIA_MEMORY_TOKEN` está presente en el entorno del
   proceso actual.
2. Si **no** está → no bloquees; registra la advertencia del Caso Especial
   3 para incluirla en el reporte final. El `.mcp.json` que vas a escribir
   es correcto igual: usa `${OMNIA_MEMORY_TOKEN}`, que cada máquina resuelve
   por su cuenta una vez pegue su comando personal de alta (ver
   `memory/ARQUITECTURA.md`, "Workflow del dev").

### Paso 2 — Detectar si `projectRoot` es un git worktree

1. Lee `<projectRoot>/.git`.
2. Si es un **directorio** → repo normal, no es worktree. Sigue al Paso 3
   con `slugSourceRoot = projectRoot`.
3. Si es un **archivo** cuyo contenido matchea `^gitdir: (.+)/\.git/worktrees/[^/]+\s*$`
   → es un worktree. El repo principal es el path capturado en el grupo 1
   (quitando el `/.git/worktrees/<nombre>` final). `slugSourceRoot` = ese
   path del repo principal, no `projectRoot`.
4. Motivo: un worktree es otra rama del **mismo** código (ej. `OmniaPOS-cicd`
   es un worktree de `OmniaPOS`). La regla "aislá por cliente, no por
   feature/branch" de `RUNBOOK.md` aplica literalmente acá — debe compartir
   namespace con el repo principal, nunca tener uno propio.

### Paso 3 — Determinar el slug (si no vino forzado por Entrada)

1. Toma el nombre de la carpeta de `slugSourceRoot` (Paso 2).
2. Normaliza: minúsculas, espacios y `_` a `-`, colapsa guiones repetidos.
3. Excepción documentada — repos de deployment ERPNext por cliente: si el
   nombre normalizado termina en `-erpnext`, el slug es el nombre sin ese
   sufijo (ej. `weritas-erpnext` → `weritas`). Motivo: la memoria se aísla
   por **cliente**, no por el stack técnico del deployment — mismo criterio
   ya documentado en `memory/.memory.env.example` (lista `omniapos | frutal
   | weritas`).
4. Cualquier otra excepción de este tipo que el equipo decida debe
   agregarse a esta lista y a `memory/.memory.env.example` a la vez — no
   dejes que diverjan.
5. El resultado es `slug`.
6. **Nombre de espacio (altas nuevas).** Desde que existen roles y espacios (`memory/PERMISOS.md`), el namespace de un
   repo **nuevo** lleva prefijo: `int-<cliente>` si el repo es parte de un cliente (el caso `-erpnext` del punto 3, o
   `frutal-hr`, `weritas-...`), y `proy-<slug>` para cualquier otro. Ese es el valor que va en la URL (`.../sse/<namespace>`).
   Un repo que **ya** tiene un slug antiguo en su `.mcp.json` no se renombra: el gateway lo trata como alias de su espacio
   (`ACCESS_NAMESPACE_ALIASES`), así que sus memorias siguen donde están y no hay que migrar nada. Al comparar con lo
   existente (Paso 4) usa el `slug` sin prefijo.

### Paso 4 — Leer el estado actual de `<projectRoot>/.mcp.json`

1. Si el archivo **no existe** → `caso = "alta-nueva"`.
2. Si existe, parsea como JSON.
   - Si el parseo falla → devuelve el output del Caso Especial 1 y
     **termina sin escribir nada**.
3. Si no existe la clave `mcpServers.omnia-memory` → `caso =
   "agregar-a-existente"` (mismo tratamiento que alta nueva, pero
   preservando los demás servidores ya presentes).
4. Si existe `mcpServers.omnia-memory.url`:
   - Si su valor es literalmente `${OMNIA_MEMORY_MCP_URL}` → `caso =
     "retrofit"`.
   - Si matchea `^https://memory\.omniaos\.ai/mcp/claude/sse/(.+)$` (método
     vigente):
     - Si el slug capturado === `slug` (Paso 3) → `caso = "ya-ok"` (aun así
       revisa los otros dos bloques en el Paso 5).
     - Si es distinto → Caso Especial 2, sin escribir nada.
   - Si matchea `^http://localhost:8765/mcp/claude/sse/(.+)$` (método anterior,
     túnel SSH):
     - Si el slug capturado === `slug` → `caso = "migrar"`: se reemplaza solo
       el dominio por `https://memory.omniaos.ai`, conservando el slug.
     - Si es distinto → devuelve el output del Caso Especial 2 y **termina
       sin escribir nada** — no pises un namespace que otro proceso podría
       estar usando a propósito con un nombre distinto al inferido.
   - Si no matchea ningún patrón conocido → trátalo igual que el caso
     "slug distinto" de arriba (Caso Especial 2): no lo toques sin
     confirmación explícita.

### Paso 5 — Aplicar (`alta-nueva`, `agregar-a-existente`, `retrofit`, `migrar`)

1. Bloque objetivo para `mcpServers.omnia-memory`:
   ```json
   {
     "type": "sse",
     "url": "https://memory.omniaos.ai/mcp/claude/sse/<slug>",
     "headers": { "Authorization": "Bearer ${OMNIA_MEMORY_TOKEN}" }
   }
   ```
2. Bloque objetivo para `mcpServers.omnia-memory-global` (si la clave no
   existe, o si existe con un valor del método anterior):
   ```json
   {
     "type": "sse",
     "url": "https://memory.omniaos.ai/mcp/claude/sse/omnia-global",
     "headers": { "Authorization": "Bearer ${OMNIA_MEMORY_TOKEN}" }
   }
   ```
   Se **reemplaza** sin preguntar si su `url` es exactamente
   `${OMNIA_MEMORY_GLOBAL_MCP_URL}` o
   `http://localhost:8765/mcp/claude/sse/omnia-global` (método anterior). Si
   existe con cualquier **otro** `url` → no lo toques (personalización
   explícita de alguien); agrega la advertencia del Caso Especial 4 al
   reporte.
3. Bloque objetivo para `mcpServers.basic-memory` (sin `slug`; ver
   `omnia-knowledge/deploy/DEPLOY.md`). Basic Memory no tiene auth propia:
   el gateway `kb.omniaos.ai` valida el mismo token individual y pone del
   lado servidor la credencial real, así que **el dev ya no maneja ninguna
   contraseña de knowledge**:
   ```json
   {
     "type": "sse",
     "url": "https://kb.omniaos.ai/mcp",
     "headers": { "Authorization": "Bearer ${OMNIA_MEMORY_TOKEN}" }
   }
   ```
   Se **reemplaza** sin preguntar si su `url` es
   `https://knowledge.omniaos.ai/mcp` (método anterior, con
   `Basic ${OMNIA_KNOWLEDGE_BASICAUTH_B64}`; esa variable queda obsoleta). Si
   existe con cualquier **otro** `url`, no lo toques y agrega la advertencia
   del Caso Especial 5.
4. Si el archivo no existía (`alta-nueva` sin archivo previo): créalo con
   `{ "mcpServers": { ...bloques del Paso 5.1/5.2/5.3 } }`.
5. Si existía: fusiona los bloques dentro de `mcpServers` **preservando
   textualmente** cualquier otra clave top-level y cualquier otro servidor
   ya presente (no reordenes, no reformatees lo que no tocaste).
6. Escribe el archivo con indentación de 2 espacios, igual al resto de los
   `.mcp.json` del monorepo.
7. Relee y parsea el archivo escrito para confirmar que el JSON resultante
   es válido. Si falla → esto es un bug de la skill, repórtalo como error,
   no lo dejes a medio escribir (restaura el contenido original si lo
   tenías en memoria).

### Paso 6 — Nunca hacer commit

Esta skill solo edita el working tree. Nunca ejecuta `git add`, `git
commit` ni `git push`. Dejar la decisión de commitear a quien invoca la
skill (usuario o workflow) es intencional — algunos repos gitignoran
`.mcp.json` (confirmado en `soft-next-connector`), y otros lo versionan.

## Formato de Salida

```markdown
### memory-setup — <nombre de carpeta de projectRoot>

- Slug resuelto (`omnia-memory`): `<slug>`<si fue worktree: " (heredado de <repo principal>, es un git worktree)">
- `omnia-memory`: <"archivo creado" | "bloque agregado" | "URL rota reemplazada (retrofit)" | "migrado del túnel al gateway" | "ya estaba, sin cambios">
- `omnia-memory-global`: <"agregado" | "migrado" | "ya estaba, sin cambios" | "personalizado, no tocado">
- `basic-memory`: <"agregado" | "migrado" | "ya estaba, sin cambios" | "personalizado, no tocado">
- Archivo: `<path>/.mcp.json`
<advertencias, una por línea, si las hay>

<Si OMNIA_MEMORY_TOKEN no estaba en el entorno:>
⚠️ No encuentro `OMNIA_MEMORY_TOKEN` en el entorno de esta sesión. El
`.mcp.json` quedó bien escrito, pero no va a conectar hasta que esta
máquina pegue su comando personal de alta (ver `memory/ARQUITECTURA.md`).
```

Para una corrida sobre varios repos a la vez, agrega estas líneas por cada
uno bajo un único encabezado `### memory-setup — resultados`.

## Casos Especiales

### Caso Especial 1 — `.mcp.json` preexistente con JSON inválido

```markdown
### memory-setup — <repo>

No pude parsear `.mcp.json` como JSON válido — no toqué el archivo.
Arreglá la sintaxis a mano y volvé a correr la skill.
```

### Caso Especial 2 — El repo ya apunta a un namespace distinto al inferido

```markdown
### memory-setup — <repo>

`omnia-memory` en este repo ya apunta al slug `<slug-actual>`, distinto al
que inferí (`<slug-inferido>`). No lo sobreescribí — podría ser
intencional (ej. dos repos que comparten memoria a propósito).

Si el slug actual es un error, corré la skill de nuevo pasando
`slug: "<slug-inferido>"` explícito para forzar el reemplazo.
```

### Caso Especial 3 — Token de memoria no configurado en esta máquina

Ver la advertencia embebida en el Formato de Salida principal — no es un
caso que detenga la skill, solo se agrega como nota.

### Caso Especial 4 — `omnia-memory-global` personalizado

```markdown
⚠️ `omnia-memory-global` en este repo ya tenía una URL distinta a la
universal (`https://memory.omniaos.ai/mcp/claude/sse/omnia-global`) y no era
una del método anterior. La dejé como estaba.
```

### Caso Especial 5 — `basic-memory` personalizado

```markdown
⚠️ `basic-memory` en este repo ya tenía una URL distinta a
`https://kb.omniaos.ai/mcp` y no era la del método anterior. La dejé como estaba.
```

## Reglas Clave

1. **El slug del proyecto nunca es una variable de entorno** en el
   `.mcp.json` — siempre texto hardcodeado. Usar `${OMNIA_MEMORY_MCP_URL}`
   ahí es exactamente el bug que esta skill existe para reparar (dos repos
   abiertos en la misma máquina compitiendo por el mismo namespace).
2. **Nunca pisa servidores MCP ya presentes** en el archivo que no sean
   `omnia-memory` / `omnia-memory-global` / `basic-memory`.
3. **Nunca commitea ni pushea.**
4. **Nunca sobreescribe un slug ya configurado distinto al inferido** sin
   que se lo pidan explícitamente (Caso Especial 2) — perder la conexión a
   un namespace donde el equipo ya cargó memoria es peor que dejarlo como
   está.
5. Worktrees comparten slug con su repo principal, siempre — nunca tienen
   namespace propio.
