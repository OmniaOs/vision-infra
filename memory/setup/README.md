# Setup self-service de la memoria compartida

Este folder automatiza la conexión de tu IDE a la memoria compartida del
equipo (`omnia-memory` / `omnia-memory-global`) — ver
[`memory/INSTRUCTIVO.md`](../INSTRUCTIVO.md) para el contexto completo y
[`vision/specs/services/self-service-memory-tunnel-onboarding/`](../../vision/specs/services/self-service-memory-tunnel-onboarding/)
para la spec.

## Requisito previo (una sola vez, lo hace el admin)

Necesitás que el admin te haya dado de alta: tu clave pública SSH autorizada
bajo `visiontunnel` en el VPS, y tu llave privada subida a tu cuenta de
[Vaultwarden](../../vault/README.md) (invitación por email). Si no tenés
todavía una cuenta de Vaultwarden, pedísela al admin antes de seguir.

## Windows

```powershell
.\memory\setup\windows.ps1
```

Te va a pedir, en este orden:

1. Tu email de Omnia (el que usaste para aceptar la invitación de Vaultwarden).
2. Tu contraseña maestra de Vaultwarden (y el segundo factor, si lo tenés
   activado) — esto es un login normal del CLI de Bitwarden, no se guarda en
   ningún lado.
3. El token `OMNIA_MEMORY_TOKEN` (te lo pasa el admin, o está junto a tu
   llave en el vault).

Al terminar: cerrá y volvé a abrir tu IDE. El túnel ya corre solo en
background y se reconecta si se corta — no hace falta abrir ninguna terminal
ni correr nada más mientras trabajás.

**Volver a correrlo en una máquina que cambiaste (o que ya tenías
configurada) es seguro** — el script detecta lo que ya existe y no duplica
nada.

## macOS / Linux

Todavía no hay un script equivalente — es una feature de seguimiento
explícita (fuera de alcance de `self-service-memory-tunnel-onboarding`).
Mientras tanto, seguí el flujo manual documentado en
[`memory/INSTRUCTIVO.md`](../INSTRUCTIVO.md) (`memory/tunnel.sh` +
`memory/.memory.env`), que sigue funcionando igual que siempre.

## Si algo falla

- **"No encuentro el item 'omnia-memory-tunnel-ssh-key'"** → el admin
  todavía no subió tu llave a Vaultwarden. Avisale.
- **El script no encuentra Git Bash** → instalá
  [Git for Windows](https://git-scm.com/download/win) primero.
- **Querés desarmar todo en una máquina** →
  ```powershell
  Remove-Item "$([Environment]::GetFolderPath('Startup'))\OmniaMemoryTunnel.vbs"
  Remove-Item memory\.memory.env
  # y cerrá manualmente cualquier bash.exe corriendo el túnel (Task Manager)
  ```
  y volvé al flujo manual de `memory/INSTRUCTIVO.md` si lo necesitás
  mientras tanto.
