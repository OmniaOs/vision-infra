<#
  memory/setup/windows.ps1
  Setup self-service del tunel a la memoria compartida de Omnia (Windows).

  Correr UNA VEZ por maquina. Reejecutarlo en una maquina ya configurada es
  seguro (idempotente): detecta lo que ya existe y solo completa lo que falta.

  Que hace:
    1. Confirma prerrequisitos (Git Bash, Bitwarden CLI).
    2. Login/unlock contra Vaultwarden (una sola vez; la persona ingresa su
       propio email + contraseña maestra + 2FA si lo tiene activado).
    3. Descarga su llave SSH privada desde su vault (adjunto en el item
       "omnia-memory-tunnel-ssh-key") a ~/.ssh/.
    4. Escribe memory/.memory.env con los valores conocidos del repo mas lo
       que el vault entrego.
    5. Registra una Tarea Programada que mantiene memory/tunnel.sh corriendo
       en background, con reintento automatico, iniciando sola al loguearse.
    6. Fija las variables OMNIA_MEMORY_* como variables de entorno de
       USUARIO persistentes (no requiere admin de Windows).

  Requiere: alta previa por el admin -- ver vault/README.md ("Alta de una
  persona"). Sin eso, el Paso 2-3 falla con un mensaje explicito, no en
  silencio.

  Spec: vision/specs/services/self-service-memory-tunnel-onboarding/
#>

param(
  [string]$VaultServer = "https://vault.omniaos.ai",
  [string]$SshHost = "148.113.203.22",
  [string]$Proyecto = "vision-infra"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$sshDir = "$HOME\.ssh"
$keyPath = "$sshDir\id_ed25519_omnia_memory"
$envFile = "$repoRoot\memory\.memory.env"
$taskName = "OmniaMemoryTunnel"

function Test-Command($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

Write-Host "== Paso 1/6: prerrequisitos =="
if (-not (Test-Path "C:\Program Files\Git\bin\bash.exe")) {
  throw "No encuentro Git Bash. Instala Git for Windows: https://git-scm.com/download/win"
}
if (-not (Test-Command "bw")) {
  Write-Host "Bitwarden CLI no encontrado. Instalando via winget..."
  winget install --id Bitwarden.CLI -e --accept-source-agreements --accept-package-agreements
  if (-not (Test-Command "bw")) {
    throw "La instalacion de Bitwarden CLI no quedo en PATH. Instalalo manualmente (npm install -g @bitwarden/cli, o https://bitwarden.com/download/) y vuelve a correr este script."
  }
}
bw config server $VaultServer | Out-Null

Write-Host "== Paso 2-3/6: login a Vaultwarden + llave SSH =="
if (-not (Test-Path $keyPath)) {
  $email = Read-Host "Tu email de Omnia (el que te invito el admin a Vaultwarden)"
  bw login $email
  $session = bw unlock --raw
  if (-not $session) { throw "No se pudo desbloquear el vault. Reintenta." }

  bw sync --session $session | Out-Null
  $itemJson = bw get item "omnia-memory-tunnel-ssh-key" --session $session
  if (-not $itemJson) {
    throw "No encuentro el item 'omnia-memory-tunnel-ssh-key' en tu vault. Pidele al admin que te invite y suba tu llave (ver vault/README.md, 'Alta de una persona')."
  }
  $item = $itemJson | ConvertFrom-Json
  if (-not $item.attachments -or $item.attachments.Count -eq 0) {
    throw "El item 'omnia-memory-tunnel-ssh-key' existe pero no tiene ningun adjunto. Pidele al admin que suba tu llave privada como adjunto de ese item."
  }

  New-Item -ItemType Directory -Force -Path $sshDir | Out-Null
  $attachmentId = $item.attachments[0].id
  bw get attachment $attachmentId --itemid $item.id --output $keyPath --session $session | Out-Null
  icacls $keyPath /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
  bw lock | Out-Null
  Write-Host "Llave guardada en $keyPath"
} else {
  Write-Host "Ya existe una llave local ($keyPath) -- se omite el paso de Vaultwarden."
}

Write-Host "== Paso 4/6: escribiendo memory\.memory.env =="
$token = Read-Host "OMNIA_MEMORY_TOKEN (te lo pasa el admin, o esta en tu vault junto a la llave)" -AsSecureString
$tokenPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))

@"
OMNIA_MEMORY_MCP_URL=http://localhost:8765/mcp/claude/sse/$Proyecto
OMNIA_MEMORY_GLOBAL_MCP_URL=http://localhost:8765/mcp/claude/sse/omnia-global
OMNIA_MEMORY_TOKEN=$tokenPlain
OMNIA_MEMORY_SSH_HOST=$SshHost
OMNIA_MEMORY_SSH_USER=visiontunnel
OMNIA_MEMORY_SSH_KEY=$keyPath
OMNIA_MEMORY_TUNNEL_PORTS=8765
"@ | Set-Content -Encoding utf8 $envFile

Write-Host "== Paso 5/6: registrando el tunel como tarea de autoarranque =="
$bashExe = "C:\Program Files\Git\bin\bash.exe"
$loopCmd = "cd '$repoRoot' && while true; do bash memory/tunnel.sh; sleep 5; done"
$action = New-ScheduledTaskAction -Execute $bashExe -Argument "-lc `"$loopCmd`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
  -RunLevel Limited -Force -Description "Tunel SSH persistente a la memoria compartida de Omnia (self-service-memory-tunnel-onboarding)" | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "== Paso 6/6: variables de entorno persistentes de usuario =="
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
  $k, $v = $line -split '=', 2
  [Environment]::SetEnvironmentVariable($k, $v, "User")
}

Write-Host ""
Write-Host "Listo. Cierra y vuelve a abrir tu IDE para que tome las variables nuevas."
Write-Host "El tunel ya corre en background (tarea programada '$taskName') y se reconecta solo."
