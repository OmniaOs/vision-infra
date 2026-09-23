# Criterios de Aceptación: Onboarding self-service al túnel de memoria compartida

## Metadata

```yaml
feature: self-service-memory-tunnel-onboarding
version: 1
last_updated: 2026-09-23
```

## Resumen Ejecutivo

Total de criterios: **16**, agrupados en 5 categorías:

1. Vaultwarden — despliegue y seguridad (AC-001 a AC-004)
2. Identidad SSH por persona (AC-005 a AC-007)
3. Script de setup local (AC-008 a AC-012)
4. Regresión de la política post-incidente (AC-013 a AC-014)
5. Documentación (AC-015 a AC-016)

Todos los criterios se verifican manualmente (consola de Coolify, panel admin de Vaultwarden, y ejecución real del script en una máquina Windows) — ver `3_test-plan.md`. No hay runner automatizado.

---

## 1. Vaultwarden — despliegue y seguridad

### AC-001: Vaultwarden solo publica su puerto en loopback

**Given** el recurso `vault` está desplegado según `vault/docker-compose.yml`,
**When** se inspecciona el binding del contenedor (`docker inspect` o el propio archivo),
**Then** el único binding es `127.0.0.1:8222:80` — ningún puerto se publica en `0.0.0.0` ni en una IP pública.

### AC-002: El dominio de Vaultwarden exige login para cualquier acción

**Given** `https://vault.omniaos.ai` está configurado y desplegado,
**When** se visita la URL sin sesión iniciada,
**Then** se presenta la pantalla de login de Vaultwarden (email + contraseña maestra) — ninguna funcionalidad del vault es accesible sin autenticarse.

### AC-003: El registro abierto está deshabilitado

**Given** Vaultwarden está desplegado con `SIGNUPS_ALLOWED=false`,
**When** se intenta crear una cuenta nueva sin invitación previa del admin,
**Then** Vaultwarden rechaza el registro — confirma INV-4.

### AC-004: El puerto directo de Vaultwarden sigue bloqueado desde fuera del VPS

**Given** `omnia-portblock` incluye el puerto `8222` (Paso 3 de `1_spec.md`),
**When** se intenta `curl http://148.113.203.22:8222` desde fuera del VPS,
**Then** la conexión se rechaza o hace timeout — confirma INV-1 y el Escenario H de `0_contract.md`.

---

## 2. Identidad SSH por persona

### AC-005: Una persona tiene una sola llave autorizada, sin importar cuántas máquinas use

**Given** una persona ya completó el alta (Paso 5 de `1_spec.md`) en una máquina,
**When** esa misma persona corre `memory/setup/windows.ps1` en una máquina distinta,
**Then** el túnel conecta usando la misma llave privada (recuperada de su mismo item de Vaultwarden) — no se genera ni se autoriza una segunda llave, y el admin no participa en este paso (Escenario B).

### AC-006: El admin nunca accede a una llave privada ajena

**Given** el modelo de items personales en Vaultwarden (no colección compartida, INV-8),
**When** el admin revisa el panel de organización,
**Then** no existe ninguna vista ni permiso que le permita leer el contenido de un item personal de otra persona — solo ve membresía (quién está invitado, activo o removido).

### AC-007: Offboarding revoca acceso sin tocar la máquina de la persona

**Given** una persona deja el equipo,
**When** el admin quita su clave pública de `authorized_keys` en `visiontunnel` y la remueve de la organización de Vaultwarden (Escenario D),
**Then** un intento posterior de esa persona de abrir el túnel (con su llave ya revocada) falla en el handshake SSH — sin necesidad de ninguna acción sobre su laptop.

---

## 3. Script de setup local

### AC-008: El script deja el túnel operativo sin pasos manuales adicionales

**Given** una persona con invitación de Vaultwarden aceptada y su llave ya subida por el admin,
**When** corre `memory/setup/windows.ps1` y completa el login interactivo (email, contraseña maestra, token de `OMNIA_MEMORY_TOKEN`),
**Then** al finalizar el script: existe `memory/.memory.env` con los 6 valores requeridos, la tarea programada `OmniaMemoryTunnel` está registrada y `Running`, y las variables `OMNIA_MEMORY_*` están fijadas en el entorno de usuario (Escenario A).

### AC-009: El túnel sobrevive a un reinicio de la máquina sin intervención

**Given** el setup del AC-008 ya se completó,
**When** la máquina se reinicia y la persona vuelve a loguearse en Windows,
**Then** la tarea `OmniaMemoryTunnel` arranca sola (trigger `AtLogOn`) y el túnel queda activo sin que la persona ejecute ningún comando (Escenario E).

### AC-010: El script es idempotente

**Given** una máquina ya configurada por un AC-008 exitoso,
**When** se corre `memory/setup/windows.ps1` de nuevo,
**Then** el script detecta la llave local existente y omite el paso de login a Vaultwarden, y `Register-ScheduledTask -Force` reemplaza la tarea existente en vez de crear una duplicada — confirma INV-6 (Escenario F).

### AC-011: Las variables de entorno persisten sin necesitar una sesión de shell activa

**Given** el script terminó exitosamente,
**When** se abre un proceso completamente nuevo (ej. un IDE recién lanzado) sin haber corrido ningún `source`/`.` previo,
**Then** ese proceso hereda `OMNIA_MEMORY_MCP_URL`, `OMNIA_MEMORY_GLOBAL_MCP_URL` y `OMNIA_MEMORY_TOKEN` correctamente — confirma INV-7.

### AC-012: Un fallo de login a Vaultwarden no deja estado a medias

**Given** el servidor de Vaultwarden no está disponible o las credenciales son incorrectas,
**When** se corre `memory/setup/windows.ps1`,
**Then** el script se detiene en el Paso 2 con un mensaje de error claro — no existe `memory/.memory.env` parcial, ni tarea programada registrada, ni variables de entorno fijadas (Escenario G).

---

## 4. Regresión de la política post-incidente

### AC-013: `gateway/`, `memory/` y `metrics-hub/` no cambian de comportamiento

**Given** el estado de esos tres servicios antes de esta feature,
**When** se compara su `docker-compose.yml` y su accesibilidad antes/después de desplegar `vault`,
**Then** ningún archivo cambia (`git diff` vacío en los tres) y ninguno cambia su exposición — esta feature es aditiva.

### AC-014: `memory/tunnel.sh` no fue modificado

**Given** el repo antes de esta feature,
**When** se compara `memory/tunnel.sh` antes y después,
**Then** el diff está vacío — confirma INV-5: el autoarranque envuelve el script existente, no lo reemplaza ni edita.

---

## 5. Documentación

### AC-015: `memory/INSTRUCTIVO.md` documenta el flujo self-service como recomendado

**Given** la feature está implementada y validada,
**When** se lee `memory/INSTRUCTIVO.md`,
**Then** describe el flujo de `memory/setup/windows.ps1` como el camino recomendado, y conserva el flujo manual (túnel + `source`) como fallback explícito — no lo elimina.

### AC-016: `DEPLOY_COOLIFY.md` documenta `vault/` y el orden de deploy actualizado

**Given** `vault` está desplegado y verificado,
**When** se lee `DEPLOY_COOLIFY.md`,
**Then** incluye una sección `### vault/` con el mismo nivel de detalle que `gateway/`/`memory/`/`metrics-hub/`, y "Orden de deploy" refleja que `vault/` debe existir antes de que el onboarding de `memory/` dependa de él.

---

## Cobertura del Contrato

| Sección del contrato (`0_contract.md`) | ACs que la cubren |
|---|---|
| Escenario A (alta happy path) | AC-008 |
| Escenario B (cambio de equipo) | AC-005 |
| Escenario D (offboarding) | AC-006, AC-007 |
| Escenario E (corte de red / reinicio) | AC-009 |
| Escenario F (idempotencia) | AC-010 |
| Escenario G (vault no desplegado) | AC-012 |
| Escenario H (regresión post-incidente) | AC-004, AC-013 |
| Invariante INV-1 (loopback-only) | AC-001, AC-004 |
| Invariante INV-2 (una llave por persona) | AC-005 |
| Invariante INV-4 (sin registro abierto) | AC-003 |
| Invariante INV-5 (`tunnel.sh` sin modificar) | AC-014 |
| Invariante INV-6 (idempotencia) | AC-010 |
| Invariante INV-7 (env vars de usuario, sin admin) | AC-011 |
| Invariante INV-8 (admin sin acceso a llaves ajenas) | AC-006 |

## Notas

- No hay criterios de performance/carga — Vaultwarden y el túnel sirven a un equipo pequeño, sin requisitos de throughput.
- AC-004 y AC-013 son los más críticos: validan que esta feature, pese a agregar un servicio nuevo, no reintroduce el patrón del incidente del 20-jul-2026 en ningún servicio existente ni en el nuevo.
- AC-006 y AC-007 dependen del modelo de permisos real de Vaultwarden (items personales vs colección de organización) — deben verificarse contra la instancia real desplegada, no asumirse por el diseño.

## Definición de "Hecho" para esta feature

Esta feature se considera completa (lista para `/onspecomplete self-service-memory-tunnel-onboarding`) únicamente cuando:

1. Los 16 criterios de aceptación pasan contra la instancia real de `vault` en `server-omniaplatform` y contra al menos una máquina Windows real (no simulado).
2. Al menos una persona (además del admin) completó el alta de punta a punta (AC-008) sin que el admin haga nada más que los pasos del Paso 5 de `1_spec.md`.
3. Ningún `docker-compose.yml` de `gateway`, `memory` o `metrics-hub` cambió (AC-013).
4. `memory/INSTRUCTIVO.md` y `DEPLOY_COOLIFY.md` reflejan el estado final (AC-015, AC-016).

Si alguna condición no se cumple, la feature permanece en `in-progress` hasta resolverla.
