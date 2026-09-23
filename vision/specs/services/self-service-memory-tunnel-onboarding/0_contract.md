# Feature: Onboarding self-service al túnel de memoria compartida

## Metadata

```yaml
status: pending
created: 2026-09-23
updated: 2026-09-23
dependencies: none
position: 6
plane_workitem_id: null
```

## User Stories

**Como** cualquier dev del equipo que rota de laptop con frecuencia **Quiero** configurar el acceso a la memoria compartida (`omnia-memory` / `omnia-memory-global`) una sola vez por máquina, con un login simple **Para** no depender del admin cada vez que cambio de equipo físico.

**Como** responsable de seguridad de `vision-infra` **Quiero** que esta simplificación no reabra ningún puerto ni introduzca password auth sobre SSH **Para** no repetir el patrón exacto del incidente del 20-jul-2026 (RCE sin auth en `openmemory-ui`, ver [postmortem](../../../../docs/postmortems/2026-07-20-openmemory-ui-rce.md)) en otro componente del repo.

**Como** Daniel (admin de `vision-infra`, con acceso a Coolify y al VPS) **Quiero** dar de alta a una persona una sola vez (autorizar su llave SSH + invitarla a Vaultwarden) y poder revocarla con la misma simplicidad cuando se va **Para** que la gestión de accesos no escale linealmente con cada cambio de hardware del equipo.

**Como** miembro del equipo que responde a un incidente o ticket fuera de su área habitual **Quiero** que conectar a la memoria compartida no tenga fricción **Para** poder consultarla o alimentarla en el momento, sin depender de la persona que normalmente sabe de ese tema.

## Naturaleza del Artefacto

Esta feature combina tres naturalezas distintas, como `port-exposure-alerts` (la spec hermana de este mismo sprint con más código real): (1) un recurso Coolify nuevo (`vault/`, Docker Compose de Vaultwarden) — acción operativa de consola + código versionado mínimo; (2) un cambio de modelo de identidad (llave SSH por persona, no por dispositivo, custodiada en el vault) — decisión de proceso, no de código; (3) un script real (`memory/setup/windows.ps1`) que automatiza el setup local de cada dev. `1_spec.md` por lo tanto mezcla pasos de consola (Coolify, admin panel de Vaultwarden) con código real (compose, script PowerShell), igual que su spec hermana mezcla runbook y bash real.

## Propósito

Hoy, conectar a la memoria compartida requiere que cada dev: (a) tenga una llave SSH autorizada por el admin bajo el usuario restringido `visiontunnel` en `server-omniaplatform`, y (b) en cada sesión de trabajo, abra manualmente `bash memory/tunnel.sh` y haga `source memory/.memory.env` antes de levantar el IDE (ver `memory/INSTRUCTIVO.md`). Esto tiene dos fricciones reales, confirmadas en esta misma sesión (`omnia-memory`/`omnia-memory-global` fallaron con `INVALID_CONFIG: 'url' is not a valid URL'` por no haberse hecho ese setup):

1. **Fricción rutinaria**: el ritual manual por sesión desalienta el uso — exactamente lo contrario de lo que el equipo necesita si la memoria compartida va a servir para resolver incidentes/tickets de áreas ajenas sin depender de la persona responsable.
2. **Fricción de identidad**: cada vez que un dev cambia de equipo físico, el admin tiene que autorizar una llave SSH nueva bajo `visiontunnel` — un cuello de botella operativo que no escala con equipos que rotan de hardware seguido.

Esta feature resuelve ambas sin tocar el modelo de seguridad ya endurecido post-incidente (SSH por llave, `127.0.0.1`-only, `omnia-portblock`):

- **Fricción rutinaria** → el túnel se registra como tarea de Windows que autoarranca al loguearse y se reconecta sola (envuelve `memory/tunnel.sh` sin modificarlo), y las variables `OMNIA_MEMORY_*` quedan fijadas como variables de entorno de usuario persistentes — el ritual por sesión desaparece.
- **Fricción de identidad** → se emite **una llave SSH por persona** (no por dispositivo), autorizada **una sola vez** por el admin. La llave privada se custodia en **Vaultwarden self-hosted** (nuevo recurso Coolify, mismo patrón de seguridad que `gateway`/`memory`/`metrics-hub`). Cuando alguien cambia de laptop, no hace falta al admin: la persona se loguea a Vaultwarden con su propio usuario+contraseña (+2FA si lo activa) y el script de setup recupera su llave sola.

Se descartaron explícitamente, en la conversación que originó esta spec, dos alternativas más pesadas (SSH CA tipo `step-ca`, y Teleport) por ser infraestructura nueva desproporcionada al tamaño del equipo — ver "Alternativas Consideradas" en `1_spec.md`. También se descartó password auth directo sobre SSH, por reintroducir el tipo de superficie de ataque que la política post-incidente cerró.

## Escenarios

**A — Alta de una persona nueva (happy path).** El admin autoriza la clave pública de la persona bajo `visiontunnel` una vez, y le crea una invitación en Vaultwarden con su llave privada adjunta en un item personal. La persona corre `memory/setup/windows.ps1`, se loguea a Vaultwarden con su propio email/contraseña, el script descarga su llave, escribe `memory/.memory.env`, registra la tarea de autoarranque y fija las variables de entorno. Sin reiniciar la máquina, abre el IDE y `omnia-memory`/`omnia-memory-global` conectan.

**B — Cambio de equipo físico.** La misma persona, en una laptop nueva, corre el mismo script. Se loguea a Vaultwarden (mismas credenciales de siempre) y todo se repite igual que en A — **sin ninguna acción del admin**. Esta es la razón de ser de la feature.

**C — Sesión de Vaultwarden vencida.** El CLI de Bitwarden (`bw`) usado por el script tiene su propia sesión con expiración — cuando vence, un re-login simple (mismo comando, misma contraseña maestra) la restablece. No hay credencial de larga vida que rotar a mano.

**D — Offboarding.** El admin revoca el acceso de una persona en dos pasos: quita su clave pública de `authorized_keys` de `visiontunnel`, y la remueve de la organización en Vaultwarden. No requiere tocar la máquina de esa persona ni coordinar con ella.

**E — Corte de red / reinicio de la laptop.** El túnel SSH se cae (red inestable, suspensión, reinicio). La tarea programada lo reintenta sola (bucle de reintento con backoff fijo) sin que la persona note nada al volver a trabajar.

**F — Reejecutar el script en una máquina ya configurada (idempotencia).** La persona corre el script de nuevo (ej. tras un cambio menor de config). El script detecta que ya existe la llave local, la tarea programada y las variables de entorno, y no duplica ni rompe nada — ver INV-6 en `1_spec.md`.

**G — Vaultwarden no está desplegado todavía / URL mal escrita.** La persona corre el script antes de que el admin haya terminado el despliegue de `vault/`, o con un typo en el servidor. `bw config server` o `bw login` fallan con un error claro; el script se detiene sin dejar estado a medias (sin `.memory.env` parcial, sin tarea programada registrada).

**H — Regresión de la política post-incidente.** Alguien intenta `curl http://148.113.203.22:8222` (puerto directo de Vaultwarden) desde fuera del VPS. La conexión no debe establecerse — mismo binding `127.0.0.1` + `omnia-portblock` que los otros tres servicios. Si se establece, es una regresión de seguridad, no una mejora.

## Alcance

### Incluye:

- Nuevo recurso Coolify `vault/` (Vaultwarden self-hosted): `vault/docker-compose.yml`, `vault/.env.example`, `vault/README.md`.
- Actualizar `infra/vps/omnia-portblock.sh` e `infra/vps/README.md` para incluir el puerto nuevo de `vault` en el bloqueo de puertos.
- Runbook para el admin: crear el token admin de Vaultwarden, desactivar registro abierto (`SIGNUPS_ALLOWED=false`), crear la organización del equipo, e invitar a cada persona.
- Modelo de identidad: una llave SSH ed25519 por persona (no por dispositivo), autorizada una vez bajo `visiontunnel`, con la privada custodiada como adjunto en un item personal de Vaultwarden (no en una colección compartida — ver "Alternativas Consideradas").
- `memory/setup/windows.ps1`: script idempotente de setup local (Windows) — login a Vaultwarden, descarga de la llave, escritura de `memory/.memory.env`, registro de la tarea de autoarranque del túnel, y variables de entorno de usuario persistentes.
- `memory/setup/README.md` documentando el flujo nuevo.
- Reescribir `memory/INSTRUCTIVO.md` con el flujo self-service (reemplaza el flujo manual actual como recomendado; el manual queda documentado como fallback).
- Actualizar `DEPLOY_COOLIFY.md` con la sección `vault/` y el nuevo orden de deploy.

### No incluye:

- SSH CA (`step-ca`) o Teleport — evaluados y descartados por desproporcionados al tamaño del equipo (ver "Alternativas Consideradas" en `1_spec.md`). Puede revisarse si el equipo crece significativamente.
- Password auth directo sobre el túnel SSH — descartado por seguridad (ver Propósito).
- Scripts equivalentes para macOS/Linux — el diseño (envolver `memory/tunnel.sh` sin modificarlo, variables de entorno persistentes) es portable a propósito, pero la implementación de esta spec es **Windows-first únicamente**; macOS/Linux queda como feature de seguimiento explícita, no implícita.
- Rotación automática o programada de llaves SSH — la rotación, si se decide, es una política operativa futura (rotar el item en Vaultwarden + reautorizar en `visiontunnel`), no algo que este script automatice.
- Migrar cualquier otro secret del repo (`OPENMEMORY_API_KEY`, tokens de Hermes, etc.) a Vaultwarden — alcance limitado a la llave SSH y el token del túnel de memoria.
- Notificaciones/SMTP obligatorio para las invitaciones de Vaultwarden — SMTP es opcional; sin él, el admin copia el link de invitación desde el panel `/admin` y lo manda por el canal que ya use el equipo.
- Crear o modificar el usuario de sistema `visiontunnel` — esta spec asume que ya existe (documentado en `memory/INSTRUCTIVO.md`), solo cambia el proceso de autorización de llaves sobre él.
- Definir la convención de **contenido** de la memoria (qué se escribe, cómo se nombra/estructura una entrada para que sea buscable entre proyectos). Es un gap real, identificado en la conversación que originó esta spec, pero deliberadamente separado: primero se resuelve el acceso (esta feature), después la convención de contenido (feature de seguimiento, ver Notas de Implementación).

## Dependencias

### Esta feature depende de:

- La política post-incidente (`82cba23`, 24-jul-2026) de puertos `127.0.0.1`-only + `omnia-portblock` — vigente, esta feature la extiende, no la reemplaza.
- Acceso de Daniel a la consola de Coolify (mismo acceso ya usado en `expose-metrics-hub-domain` y `expose-litellm-gateway-domain`).
- El usuario restringido `visiontunnel` en `server-omniaplatform`, ya existente (`memory/INSTRUCTIVO.md`).
- Control sobre el DNS de `omniaos.ai` para agregar `vault.omniaos.ai` (mismo mecanismo ya usado para `metrics.omniaos.ai` y `gateway.omniaos.ai`).
- Git for Windows (Git Bash) en la máquina de cada dev — ya asumido hoy por `memory/tunnel.sh` ("Funciona en Linux/macOS y en Windows vía Git Bash"), no es una dependencia nueva de esta feature.
- `find-related-specs` no encontró ninguna spec existente con relevancia ≥ 0.30 contra `self-service-memory-tunnel-onboarding` — no hay una spec previa de la que heredar convenciones directamente aplicables; esta spec sigue el patrón ya establecido por `expose-metrics-hub-domain` (recurso Coolify + dominio) y `port-exposure-alerts` (código real + despliegue manual).

### Esta feature es requerida por:

- Ninguna feature del backlog depende formalmente de esta. Relacionada por objetivo de negocio con dos work items de Plane hoy en estado "Backlog" (no "Todo", por eso `plane-sync list-pending-tasks` no los lista como pendientes): *"Memoria de equipo: pasar de flujo por PR a escritura directa por commits"* y *"Workflow de tickets + memoria de resolución de tickets"* — ambos asumen implícitamente que alimentar la memoria compartida es fácil; esta feature es la que hace esa premisa cierta. No son dependencias duras — pueden esperar a que esas ideas maduren en specs propias.

## Impacto

**Archivos nuevos:**

- `vault/docker-compose.yml`, `vault/.env.example`, `vault/README.md`
- `memory/setup/windows.ps1`, `memory/setup/README.md`

**Archivos modificados:**

- `infra/vps/omnia-portblock.sh` — agrega el puerto de `vault` a la lista bloqueada.
- `infra/vps/README.md` — documenta el puerto nuevo.
- `memory/INSTRUCTIVO.md` — flujo self-service como recomendado; flujo manual actual queda como fallback documentado.
- `DEPLOY_COOLIFY.md` — nueva sección `vault/`, actualiza "Orden de deploy".

**Archivos NO modificados (explícito):**

- `memory/docker-compose.yml`, `memory/tunnel.sh`, `memory/.memory.env.example` — sin cambios. El script de setup envuelve `tunnel.sh`, no lo reemplaza ni lo edita (INV-5 en `1_spec.md`).
- `gateway/`, `metrics-hub/` — sin cambios, fuera de alcance.

**Config fuera del repo (no versionada en git):**

- Recurso `vault` nuevo en la consola de Coolify, con su dominio y secrets.
- Organización y usuarios dentro de Vaultwarden (administrados vía su propio panel, no vía este repo).
- `authorized_keys` de `visiontunnel` en el VPS (una entrada por persona, no por dispositivo).
- Tarea programada de Windows y variables de entorno de usuario en la máquina de cada dev — estado local, no versionado.

## Notas de Implementación

No hay work item de Plane que matchee este nombre (`plane_workitem_id: null`). `plane-sync list-pending-tasks` devolvió 3 items en estado "Todo" (`Confirm incident scope with Emilio`, `Port exposure alerts`, `Verify plane-sync end-to-end`), ninguno relacionado. La feature viene directamente de esta conversación, no del backlog previo ni de Plane.

> Supuesto: se asume que la versión de Vaultwarden desplegada soporta adjuntos de archivo en items personales sin restricción "premium" (Vaultwarden, a diferencia de Bitwarden Cloud, habilita esa función para todos los usuarios por defecto en self-hosted). Si al ejecutar esta spec la versión desplegada no lo soporta, la alternativa es el tipo de item nativo "SSH Key" si está disponible, sin impacto en el resto del diseño — solo cambia el comando `bw get attachment` por el equivalente de lectura de ese campo.

> Supuesto: el puerto de host `8222` para Vaultwarden se eligió por estar libre frente a los ya usados (`3000`, `4000`, `4320`, `6333`, `8765`). Es arbitrario — puede cambiarse sin impacto en el diseño si colisiona con algo no documentado en `DEPLOY_COOLIFY.md`.

> Nota de seguimiento (fuera de alcance de esta spec, anotada para no perderla): una vez el acceso esté resuelto, falta definir la convención de **contenido** de la memoria — qué distingue algo que va en `omnia-global` de algo que queda solo en `vision/`, cómo nombrar/etiquetar una entrada para que sea buscable entre proyectos, y cómo evitar que escritura en volumen sin estructura vuelva el store ruidoso. Candidata a spec propia una vez esta se cierre.
