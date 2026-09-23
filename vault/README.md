# 🔐 Omnia Vault

Vaultwarden self-hosted (server Bitwarden-compatible). Custodia la llave SSH
privada de cada persona del equipo, para el onboarding self-service al túnel
de memoria compartida — ver
[`vision/specs/services/self-service-memory-tunnel-onboarding/`](../vision/specs/services/self-service-memory-tunnel-onboarding/).
Deploy: ver [`DEPLOY_COOLIFY.md`](../DEPLOY_COOLIFY.md) en la raíz del repo.

## Por qué existe

Antes de este servicio, cada vez que alguien del equipo cambiaba de laptop, el
admin tenía que autorizar una llave SSH nueva bajo `visiontunnel` a mano.
Con Vaultwarden: **una llave SSH por persona** (no por dispositivo), el admin
la autoriza una sola vez, y la persona la recupera sola desde su propio vault
cada vez que configura una máquina nueva — con su propio login (email +
contraseña maestra + 2FA opcional), sin volver a involucrar al admin.

## Seguridad

Mismo patrón post-incidente (20-jul-2026) que `gateway/`, `memory/` y
`metrics-hub/`:

- Puerto publicado solo en `127.0.0.1` (`8222:80`) — acceso remoto únicamente
  vía el dominio de Coolify (`vault.omniaos.ai`), nunca puerto directo.
  Bloqueado además a nivel de VPS por `omnia-portblock` (ver `infra/vps/`).
- `SIGNUPS_ALLOWED=false` — solo se entra por invitación explícita del admin,
  nunca por registro abierto.
- Cada llave privada vive en un **item personal** de cada persona, no en una
  colección compartida de la organización — el admin administra invitaciones
  y claves públicas autorizadas, nunca tiene acceso de lectura al material
  privado de otra persona.

## Alta de una persona (runbook para el admin)

1. Generar el par de llaves de la persona (o pedirle que mande solo la
   pública): `ssh-keygen -t ed25519 -C "<email>" -f id_ed25519_omnia_memory`.
2. Autorizar la **pública** bajo `visiontunnel` en `server-omniaplatform`
   (una sola vez, nunca por dispositivo).
3. Invitar a la persona a la organización desde `https://vault.omniaos.ai/admin`
   (o el panel normal si ya tiene cuenta).
4. Subir la **privada** al item personal de esa persona, nombrado exactamente
   `omnia-memory-tunnel-ssh-key`, como adjunto de archivo. La privada nunca
   se manda por chat/email en texto plano.
5. La persona corre `memory/setup/windows.ps1` en cada máquina que use — sin
   volver a involucrar al admin.

## Offboarding

Dos pasos, sin tocar la máquina de la persona:

1. Quitar su clave pública de `authorized_keys` en `visiontunnel`.
2. Removerla de la organización en Vaultwarden.

## Notas

- Sin SMTP configurado, las invitaciones se copian a mano desde el panel
  `/admin` (Vaultwarden loguea el link de invitación) y se mandan por el
  canal que ya use el equipo.
- Este servicio no reemplaza `vision/` + handoffs como fuente de verdad del
  proyecto — solo custodia una credencial operativa (la llave SSH del túnel
  de memoria), no decisiones de arquitectura ni secrets de aplicación.
