# Permisos y separación de espacios (diseño, pendiente de implementar)

> **Estado: propuesta del 2026-10-01, aprobada en sus decisiones de fondo; verificada contra el código y los servicios reales el mismo día. En construcción.**
> Hoy la separación es solo por convención: cualquier token puede leer y escribir cualquier
> namespace de Mem0 y cualquier carpeta de Basic Memory, y todos tienen `delete_all_memories`.
> Este documento fija **los nombres y las reglas antes de la carga masiva**, porque Mem0 no
> mueve recuerdos entre namespaces y mover notas rompe sus enlaces.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Clientes | Se conectan directamente con su propio token, con **lectura y escritura**, solo a su espacio |
| Roles internos | `admin`, `miembro` (por cliente/proyecto), `lectura` y acceso `global` para todos |
| Mem0 | Filtro por namespace en el gateway (es robusto: el namespace va en la URL) |
| Basic Memory | **Híbrido:** filtro en el gateway para lo interno; **instancia separada por cliente** que escribe |
| Arranque | Frutal, Weritas y OmniaPOS (producto). Separación organizada en las dos memorias |
| Carga masiva | **Pausada** hasta cerrar este documento y construir los pasos 1 a 3 |

## Los cuatro tipos de espacio

| Tipo | Qué guarda | Quién accede |
|---|---|---|
| `global` | Lecciones de ingeniería reutilizables, **cero datos de cliente** | Todo el equipo (lee y escribe) |
| `proy-<repo>` | Decisiones y operación de un producto o repo | Miembros asignados |
| `int-<cliente>` | Lo que el **equipo sabe del cliente** (sensible, nunca lo ve el cliente) | Miembros asignados a ese cliente |
| `cli-<cliente>` | Lo que se **comparte con el cliente** (curado) | El cliente, más los miembros asignados |

La separación clave es `int-` frente a `cli-`: sin ella, un cliente con escritura acabaría leyendo
notas internas sobre sí mismo.

## Nombres definitivos (Frutal, Weritas y OmniaPOS)

| Espacio | Mem0 (namespace) | Basic Memory (proyecto) |
|---|---|---|
| Global | `omnia-global` (ya existe) | `global` |
| OmniaPOS (producto) | `proy-omniapos` | `proy-omniapos` |
| Frutal, interno | `int-frutal` | `int-frutal` |
| Frutal, cliente | `cli-frutal` | instancia propia `cli-frutal` |
| Weritas, interno | `int-weritas` | `int-weritas` |
| Weritas, cliente | `cli-weritas` | instancia propia `cli-weritas` |

Reglas de nombre: minúsculas, dígitos y `-`; prefijo obligatorio (`proy-`, `int-`, `cli-`); sin espacios.
Un repo que es parte de un cliente (por ejemplo `frutal-hr`, `weritas-erpnext`) usa `int-<cliente>`,
no un namespace propio.

## Verificado el 2026-10-01 (contra la imagen de Mem0 y el Basic Memory desplegado)

**Mem0 (OpenMemory)**
- El aislamiento por namespace es **real**: las búsquedas filtran por `user_id` tanto en la base de datos como en Qdrant.
- El namespace se fija **solo al abrir la conexión SSE** (`GET /mcp/<cliente>/sse/<namespace>`). Los mensajes siguientes (`POST /mcp/messages/?session_id=...`) **no lo repiten**: el gateway debe asociar cada `session_id` a su namespace al abrir la conexión.
- `delete_all_memories` borra solo los recuerdos **del namespace de esa conexión**, no todo Mem0.
- Cada recuerdo recibe **categorías** asignadas por el propio OpenMemory, y existe un endpoint de recuerdos relacionados. El grafo puede usar relaciones reales, sin agrupaciones inventadas.
- La API REST (`/api/v1/memories/?user_id=...`) **no pide credenciales**: solo debe usarla el gateway por la red interna.

**Basic Memory** (21 herramientas)
- Siete herramientas **no llevan parámetro de proyecto** (`search`, `fetch`, `list_memory_projects`, `list_workspaces`, `create_memory_project`, `delete_project`, `basic_memory_diagnostics`) y las demás aceptan `project` **o** `project_id`.
- **Cuatro fugas comprobadas:** omitir `project` con una URL `memory://<otro-proyecto>/...` lee el otro proyecto; `build_context` hace lo mismo; `search_notes` con `search_all_projects` busca en todos; `project_id` de otro proyecto lista su contenido.
- Consecuencia: el filtro del gateway será **de lista blanca**: solo herramientas conocidas, `project` obligatorio y válido, prohibido `project_id`, `workspace` y `search_all_projects`, y cualquier texto `memory://` debe apuntar al mismo proyecto. Aun así es un filtro: por eso los clientes van en instancias separadas.

## Despliegue por etapas (para no romper a quien ya usa la memoria)

1. **Modo auditoría** (`ACCESS_ENFORCE` apagado): el gateway evalúa todo y **registra** lo que denegaría, sin bloquear nada.
2. Migrar los namespaces y proyectos existentes a los nombres nuevos y asignar espacios a cada persona.
3. **Activar el bloqueo** (`ACCESS_ENFORCE=1`) cuando el registro de auditoría salga limpio.

Los repos hoy usan nombres antiguos (`frutal`, `omniapos`, `weritas`...). Activar el bloqueo antes de migrar los dejaría sin memoria.

## Qué sigue sin resolverse (no lo doy por hecho)

- **Respaldos de Mem0:** no hay copia automática; vive en volúmenes del servidor.
- **Cliente que escribe:** el equipo lee lo que él escribe; sin filtro de contenido.
- Los cortes de sesión por un **redeploy del código** del gateway seguirán existiendo: el panel elimina los reinicios por altas y bajas, no los de código.

## Roles

| Rol | Puede | No puede |
|---|---|---|
| `admin` | Todo, incluido `delete_all_memories` y todos los espacios | — |
| `miembro` | Leer y escribir `global` y los espacios que se le asignan | Espacios no asignados; borrado masivo |
| `lectura` | Consultar `global` y los asignados | Escribir |
| `cliente` | Leer y escribir **solo** su `cli-<cliente>` | Cualquier otro espacio, incluido `int-` |

Un token = una persona = un rol + una lista de espacios. Ejemplo de entrada futura de `ACCESS_DEVS`:
`ana:<hash>:miembro:int-frutal+proy-omniapos`, `contacto-frutal:<hash>:cliente:cli-frutal`.

## Cómo se aplica en cada memoria

- **Mem0:** el gateway comprueba el namespace de la URL contra la lista del token y recuerda a qué
  sesión pertenece cada mensaje (los mensajes posteriores no repiten el namespace). Bloquea por nombre
  de herramienta: `delete_all_memories` solo para `admin`; `add_memories` no para `lectura`.
- **Basic Memory, interno:** un solo servicio con un proyecto por espacio. El gateway filtra el
  parámetro `project` de cada llamada. Hay que bloquear también `search_all_projects`, los listados
  de proyectos y `create/delete_memory_project` salvo para `admin`. Es un filtro y por tanto frágil:
  por eso no se usa para clientes.
- **Basic Memory, cliente:** una instancia por cliente (servicio, volumen y repo propios). El token de
  cliente solo enruta a su instancia; no existe ruta física hacia lo interno.

## Avance (2026-10-01)

| Paso | Estado |
|---|---|
| 1. Motor de roles y espacios en el gateway, con pruebas | **Construido y probado (33 pruebas); sin desplegar.** Incluye las cuatro fugas, sesiones por namespace, auditoría, cierre de sesiones, límite de peticiones y almacén de usuarios con archivo |
| 2. Panel de altas y bajas (escribe el archivo de usuarios) | **API construida y probada en contenedor real (45 pruebas); sin desplegar. Falta la pantalla** |
| 3. Visor de notas y grafo | Pendiente |
| 4. Reorganizar Basic Memory (un proyecto por espacio) y migrar nombres | Pendiente |
| 5. Instancias de cliente de Basic Memory | Pendiente |
| 6. Activar el bloqueo y cargar | Pendiente |

## Orden de construcción

1. Gateway: roles y espacios por token, filtro de Mem0 y bloqueo de herramientas, **con pruebas automáticas**
   (incluyendo los intentos de salto entre espacios).
2. Basic Memory interno: reorganizar el repo `omnia-knowledge` a un proyecto por espacio y filtrar `project`.
3. Instancias de cliente de Basic Memory (Frutal y Weritas) y su enrutado desde el gateway.
4. Migrar lo existente a los nombres nuevos (unas 40 entradas de Mem0 y 3 notas) y actualizar `memory-setup`
   para escribir `proy-<repo>`/`int-<cliente>` en el `.mcp.json`.
5. Actualizar `MANUAL-ADMIN.md`, `MANUAL-DEV.md`, `WORKFLOW.md` y las skills con los nombres definitivos.
6. Carga masiva.

## Puntos abiertos

- **Cliente que escribe:** su contenido llega a un espacio que el equipo también lee. Conviene revisarlo
  antes de actuar sobre él; no se aplica ningún filtro de contenido.
- **Datos personales de clientes:** la memoria no es un sistema de registros con garantías de borrado
  individual. Si algún cliente exige derecho de borrado, su instancia separada permite eliminarlo entero.
- **Respaldos:** Mem0 vive solo en volúmenes del servidor y no tiene copia automática. Resolver antes de
  que los clientes confíen su información.
- **Alta de personas:** hoy cada alta requiere editar una variable y redesplegar. Con roles y espacios por
  persona conviene que la lista viva en un archivo que el gateway relea sin redeploy.
