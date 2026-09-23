<#
  memory/setup/windows.ps1
  Setup self-service del tunel a la memoria compartida de Omnia (Windows).

  Autocontenido: NO depende de tener vision-infra clonado. Se puede correr
  desde el repo:
    .\memory\setup\windows.ps1
  o directo en una maquina nueva sin nada instalado:
    irm https://vault.omniaos.ai/setup | iex

  Correr UNA VEZ por maquina. Reejecutarlo en una maquina ya configurada es
  seguro (idempotente): detecta lo que ya existe y solo completa lo que falta.

  Que hace:
    1. Instala Git for Windows y Bitwarden CLI si faltan (via winget).
    2. Descarga memory/tunnel.sh -- siempre la version mas nueva del
       servidor, nunca una copia local que podria haber quedado vieja -- a
       una carpeta propia por maquina (no dentro de ningun repo: el tunel
       es config de la MAQUINA, no del checkout de un proyecto puntual).
    3. Login/unlock contra Vaultwarden (una sola vez; la persona ingresa su
       propio email + contraseña maestra + 2FA si lo tiene activado).
    4. Descarga su llave SSH privada desde su vault (adjunto en el item
       "omnia-memory-tunnel-ssh-key") a ~/.ssh/.
    5. Escribe <carpeta>/.memory.env con los valores conocidos mas lo que
       el vault entrego.
    6. Instala un lanzador en la carpeta "Startup" de Windows que mantiene
       el tunel corriendo en background (con reintento automatico si la
       conexion se corta) e inicia solo al loguearse -- sin pedir
       privilegios de administrador (Task Scheduler los pide incluso con
       RunLevel Limited; Startup nunca).
    7. Fija las variables OMNIA_MEMORY_* como variables de entorno de
       USUARIO persistentes (no requiere admin de Windows).

  Requiere: alta previa por el admin -- ver vault/README.md ("Alta de una
  persona"). Sin eso, el paso de Vaultwarden falla con un mensaje
  explicito, no en silencio.

  Spec: vision/specs/services/self-service-memory-tunnel-onboarding/
#>

param(
  [string]$VaultServer = "https://vault.omniaos.ai",
  [string]$SshHost = "148.113.203.22",
  [string]$Proyecto = "vision-infra"
)

$ErrorActionPreference = "Stop"
$installDir = "$env:LOCALAPPDATA\Omnia\memory-tunnel"
$sshDir = "$HOME\.ssh"
$keyPath = "$sshDir\id_ed25519_omnia_memory"
$tunnelScript = "$installDir\tunnel.sh"
$envFile = "$installDir\.memory.env"
$vbsPath = Join-Path ([Environment]::GetFolderPath("Startup")) "OmniaMemoryTunnel.vbs"

function Test-Command($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Write-Host "== Paso 1/7: prerrequisitos =="
if (-not (Test-Path "C:\Program Files\Git\bin\bash.exe")) {
  Write-Host "Git for Windows no encontrado. Instalando via winget..."
  winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
  if (-not (Test-Path "C:\Program Files\Git\bin\bash.exe")) {
    throw "No pude instalar Git for Windows automaticamente. Instalalo a mano: https://git-scm.com/download/win y volve a correr este script."
  }
}
if (-not (Test-Command "bw")) {
  Write-Host "Bitwarden CLI no encontrado. Instalando via winget..."
  winget install --id Bitwarden.CLI -e --accept-source-agreements --accept-package-agreements
  if (-not (Test-Command "bw")) {
    throw "La instalacion de Bitwarden CLI no quedo en PATH. Instalalo manualmente (npm install -g @bitwarden/cli, o https://bitwarden.com/download/) y vuelve a correr este script."
  }
}
bw config server $VaultServer | Out-Null

Write-Host "== Paso 2/7: descargando tunnel.sh =="
Invoke-WebRequest -Uri "$VaultServer/setup/tunnel.sh" -OutFile $tunnelScript -UseBasicParsing

Write-Host "== Paso 3-4/7: login a Vaultwarden + llave SSH =="
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

Write-Host "== Paso 5/7: escribiendo .memory.env =="
$token = Read-Host "OMNIA_MEMORY_TOKEN (te lo pasa el admin, o esta en tu vault junto a la llave)" -AsSecureString
$tokenPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))

$envLines = @(
  "OMNIA_MEMORY_MCP_URL=http://localhost:8765/mcp/claude/sse/$Proyecto"
  "OMNIA_MEMORY_GLOBAL_MCP_URL=http://localhost:8765/mcp/claude/sse/omnia-global"
  "OMNIA_MEMORY_TOKEN=$tokenPlain"
  "OMNIA_MEMORY_SSH_HOST=$SshHost"
  "OMNIA_MEMORY_SSH_USER=visiontunnel"
  # Forward slashes: tunnel.sh (bash) hace `source` de este archivo, y en
  # una asignacion sin comillas bash usa `\` como escape -- una ruta de
  # Windows con `\` se corrompe al sourcearla (confirmado en la practica).
  # Windows/Git-Bash aceptan rutas con `/` sin problema para -i de ssh.
  ("OMNIA_MEMORY_SSH_KEY=" + $keyPath.Replace('\', '/'))
  "OMNIA_MEMORY_TUNNEL_PORTS=8765"
)
# bash hace `source` de este archivo -- tiene que ser UTF-8 SIN BOM y con
# saltos de linea \n puros. `Set-Content -Encoding utf8` en Windows
# PowerShell 5.1 agrega BOM (bash lo interpreta como parte del primer token
# y revienta con "No such file or directory" -- confirmado en la practica).
$envContent = ($envLines -join "`n") + "`n"
[System.IO.File]::WriteAllText($envFile, $envContent, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "== Paso 6/7: registrando el tunel como autoarranque =="
# Deliberadamente NO usa Task Scheduler: Register-ScheduledTask pide privilegios
# de administrador incluso con -RunLevel Limited (confirmado en la practica --
# "Acceso denegado" con una cuenta estandar). La carpeta Startup de Windows
# corre lo que sea con el proceso de logon del propio usuario, sin elevacion,
# nunca -- es el unico mecanismo nativo que cumple INV-7 de verdad.
$bashExe = "C:\Program Files\Git\bin\bash.exe"
$loopCmd = "cd '$installDir' && while true; do bash tunnel.sh; sleep 5; done"
$vbsLines = @(
  'Set WshShell = CreateObject("WScript.Shell")'
  ('WshShell.Run """' + $bashExe + '"" -lc ""' + $loopCmd + '""", 0, False')
)
$vbsLines | Set-Content -Encoding ASCII $vbsPath
Write-Host "Autoarranque instalado en: $vbsPath"

# Idempotencia (INV-6): si el puerto local ya esta escuchando, ya hay un
# tunel vivo (de esta corrida o de una anterior) -- lanzar otro solo haria
# que el segundo falle el bind del puerto y quede reintentando en vano cada
# 5s para siempre. El .vbs de arriba ya quedo (re)instalado igual.
$tunnelPort = 8765
$yaEscuchando = $false
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $tcp.Connect("127.0.0.1", $tunnelPort)
  $yaEscuchando = $tcp.Connected
  $tcp.Close()
} catch {}

if ($yaEscuchando) {
  Write-Host "El tunel ya esta corriendo (puerto $tunnelPort activo) -- no se lanza otro."
} else {
  Write-Host "Iniciando el tunel ahora (sin esperar al proximo login)..."
  Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden
}

Write-Host "== Paso 7/7: variables de entorno persistentes de usuario =="
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
  $k, $v = $line -split '=', 2
  [Environment]::SetEnvironmentVariable($k, $v, "User")
}

Write-Host ""
Write-Host "Listo. Cierra y vuelve a abrir tu IDE para que tome las variables nuevas."
Write-Host "El tunel ya corre en background y se reconecta solo -- y va a arrancar sin que hagas nada la proxima vez que inicies sesion en Windows."
