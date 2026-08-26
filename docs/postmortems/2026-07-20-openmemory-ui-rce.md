# Postmortem: RCE sin autenticación en openmemory-ui

> **Estado: borrador reconstruido el 2026-08-26.** No existía ningún
> postmortem escrito — solo el commit del fix. Los campos marcados
> **[CONFIRMAR CON EMILIO]** son inferencias razonables a partir del código y
> el commit, no hechos verificados de primera mano. Este documento es
> blameless: el objetivo es la línea de tiempo y las acciones, no
> responsabilidad individual.

## Resumen

El 2026-07-20, `openmemory-ui` (el dashboard web de la memoria compartida del
equipo, puerto 3000) quedó expuesta directamente a internet sin
autenticación, permitiendo ejecución remota de código (RCE). Se corrigió
cuatro días después, el 2026-07-24, en el commit `82cba23`.

## Impacto

- **Servicio afectado:** `openmemory-ui` (`mem0/openmemory-ui:latest`),
  parte del stack de `memory/` en `server-omniaplatform`.
- **Alcance real de la explotación** — **[CONFIRMAR CON EMILIO]**: no hay
  registro local de qué se ejecutó, si se leyeron/exfiltraron datos de la
  memoria compartida (Qdrant/`mem0_store`), o si el atacante pivoteó a otros
  contenedores del stack.
- **Dato agravante confirmado por el propio fix:** Coolify inyecta las
  variables de entorno de toda la app a cada contenedor del stack, así que
  `openmemory-ui` tenía acceso a secrets (`OPENMEMORY_API_KEY` y
  potencialmente otros) que ni siquiera usaba — el radio de exposición
  probablemente excedía la propia UI.

## Causa raíz

Dos factores compuestos:

1. **Puerto publicado a todas las interfaces.** El `docker-compose.yml` de
   `memory/` publicaba `openmemory-ui` como `"3000:3000"` (equivalente a
   `0.0.0.0:3000:3000`) — alcanzable desde la IP pública del VPS sin pasar
   por Traefik ni por ningún control de acceso de Coolify.
2. **Sin autenticación propia.** La imagen `mem0/openmemory-ui:latest` no
   trae auth incorporada; se asumía (incorrectamente) que la exposición
   controlada por Coolify (dominio + TLS) era suficiente barrera.

**Cómo se detectó** — **[CONFIRMAR CON EMILIO]**: no hay registro de si fue
monitoreo activo, un scan externo reportado, o hallazgo directo del
atacante notado por comportamiento anómalo.

## Resolución

Commit `82cba23` (2026-07-24), `fix(security): puertos solo en loopback +
UI de OpenMemory desactivada por defecto`:

- **Todos** los puertos de los tres servicios (`gateway`, `memory`,
  `metrics-hub`) pasaron de publicarse en todas las interfaces a
  `127.0.0.1` únicamente — acceso remoto ahora solo por túnel SSH.
- `openmemory-ui` se movió detrás de un Compose profile (`ui`), **apagada
  por defecto** — ya no arranca a menos que se invoque explícitamente con
  `COMPOSE_PROFILES=ui`, y en ese caso debe ir detrás de Traefik BasicAuth o
  túnel, nunca expuesta directo.
- Ver detalle técnico completo en [`DEPLOY_COOLIFY.md`](../../DEPLOY_COOLIFY.md#política-de-seguridad-post-incidente-20-jul-2026).

**Tiempo de exposición:** ~4 días (20-jul a 24-jul).

## Lecciones / acciones de seguimiento

- ✅ **Hecho.** Ningún puerto de servicio se publica sin `127.0.0.1` por
  defecto — el mismo patrón se aplicó a los tres servicios de una vez, no
  solo al afectado.
- ✅ **Hecho.** Toda UI/dashboard nuevo en este repo debe nacer con
  autenticación (BasicAuth de Traefik como mínimo) o detrás de profile
  desactivado — no asumir que "es interno" basta.
- **Abierto — [CONFIRMAR CON EMILIO].** Reconstruir, aunque sea
  aproximadamente, si hubo acceso/exfiltración real de datos de memoria
  durante la ventana de exposición, revisando logs de Qdrant/OpenMemory si
  todavía existen.
- **Abierto.** No hay alertas automáticas configuradas para puertos
  publicados inesperadamente en el VPS — evaluar un check periódico (podría
  vivir en Hermes o en un cron simple) que avise si algo vuelve a publicarse
  fuera de loopback sin querer.
- **Relacionado:** la propuesta de memoria #6 del backlog de Hermes
  ("Configuración Baked-in en Contenedores", ingerida a Mem0 el
  2026-08-26) documenta la lección de `COPY` vs bind-mount aplicada en el
  mismo periodo — mismo espíritu de "hornear la config correcta en vez de
  confiar en el entorno de deploy".
