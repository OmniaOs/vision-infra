# Estructura de las notas (Basic Memory)

Una sola forma de ordenar las notas largas, igual en todos los espacios. Si una nota no cabe en esta estructura, casi siempre
es que mezcla dos temas: divídela.

## 1. Un proyecto por espacio

El proyecto de Basic Memory se llama **igual que el espacio** (`global`, `proy-omniapos`, `int-frutal`, `cli-frutal`…).
Ver `PERMISOS.md` para quién ve qué. Nada de crear proyectos con otros nombres.

## 2. Carpetas fijas según el tipo de espacio

Solo estas carpetas, en minúsculas y sin acentos. Las notas van **siempre** dentro de una de ellas (no en la raíz).

| Espacio | Carpetas |
|---|---|
| `global` | `playbooks/` · `guias/` · `plantillas/` · `glosario/` |
| `proy-<producto>` | `arquitectura/` · `decisiones/` · `operacion/` · `incidentes/` · `referencia/` |
| `int-<cliente>` | `incidentes/` · `infraestructura/` · `decisiones/` · `pendientes/` · `referencia/` |
| `cli-<cliente>` | `acuerdos/` · `entregables/` · `soporte/` · `guias/` |

Qué va en cada una:

- `playbooks/`: pasos reutilizables que funcionan en cualquier proyecto («cómo restaurar un respaldo de Qdrant»).
- `guias/`: explicaciones para aprender o conectar algo, de principio a fin.
- `plantillas/`: los moldes de abajo.
- `glosario/`: una nota por término propio de Omnia.
- `arquitectura/`: cómo está hecho el producto y por qué.
- `decisiones/`: una nota por decisión (qué se decidió, alternativas, consecuencias).
- `operacion/`: runbooks, es decir, cómo se opera y qué hacer cuando algo falla.
- `incidentes/`: qué pasó, causa raíz y arreglo.
- `infraestructura/` (interno): servidores, redes, dominios del cliente. **Sin contraseñas ni tokens.**
- `pendientes/` (interno): trabajo abierto con ese cliente.
- `referencia/`: datos de consulta que no encajan en lo anterior.
- `acuerdos/` · `entregables/` · `soporte/` (cliente): lo que se acordó, lo que se entregó y las respuestas a sus consultas.

## 3. Tipos de nota y encabezado obligatorio

Toda nota lleva este encabezado (Basic Memory lo guarda al crearla):

| Campo | Valores |
|---|---|
| `type` | `playbook` · `guide` · `architecture` · `decision` · `runbook` · `incident` · `reference` · `agreement` · `deliverable` · `support` |
| `status` | `draft` · `active` · `resolved` (incidentes) · `superseded` · `archived` |
| `date` | `AAAA-MM-DD` de cuando ocurrió o se decidió |
| `author` | quien la escribe (`daniel`, `agent:claude-code`…) |
| `tags` | 2 a 5 palabras en minúsculas |

**Título:** lo que es, en una línea. Los incidentes y las decisiones empiezan con la fecha: `2026-09-24 ERPNext Frutal sin estilos`.

## 4. Cómo se escribe el cuerpo

- Una nota = un tema. Si necesitas «y además…», es otra nota.
- Estructura mínima por tipo (hay una plantilla de cada una en `global/plantillas/`):
  - **incident:** Resumen · Observations · Línea de tiempo · Pendientes · Relations
  - **decision:** Contexto · Decisión · Alternativas · Consecuencias · Relations
  - **runbook:** Cuándo usarlo · Pasos · Cómo verificar · Si falla · Relations
  - **architecture:** Qué es · Piezas · Flujo · Límites conocidos · Relations
  - **guide / playbook:** Para qué · Pasos · Verificación · Relations
- Los hechos van como `- [categoria] frase completa` en la sección **Observations**. Una frase por línea, con el dato concreto.
- Los enlaces entre notas van en **Relations** con `- tipo [[Título de otra nota]]` (`affects`, `supersedes`, `relates_to`, `depends_on`).
- Cuando algo reemplaza a otra nota: `status: superseded` en la vieja y `supersedes [[…]]` en la nueva. No se borra el historial.

## 5. Qué NO se guarda

- Contraseñas, tokens, claves, cadenas de conexión: nunca, en ningún espacio.
- Datos personales de clientes finales (la memoria no es un sistema de registros con garantía de borrado).
- Estado efímero de una tarea en curso: eso va en el handoff, no en una nota.

## 6. Dónde va algo (resumen)

1. ¿Sirve a cualquiera y no menciona a un cliente? → `global`.
2. ¿Es de un producto? → `proy-…`.
3. ¿Es del cliente pero interno? → `int-…`.
4. ¿Se lo vamos a mostrar al cliente? → `cli-…`.

## 7. Estado de aplicación

- Esta estructura se aplica a las notas **nuevas**. Las 3 notas que existían se copiaron a su espacio; la guía de memoria
  compartida se movió a `global/guias/`.
- El gateway **no** obliga todavía a respetar carpetas ni encabezado; es una convención. Si se quiere obligar, el lugar es
  el filtro de `write_note` en `policy.mjs` (comprobar `directory` contra la lista de arriba).
