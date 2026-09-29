<#
  Conecta esta maquina a la memoria compartida de Omnia (Mem0 + Basic Memory).
  Un solo comando, sin instalar nada:

    $env:OMNIA_TOKEN='omnia_...'; irm https://memory.omniaos.ai/setup | iex

  El token te lo da el admin. Idempotente: correrlo otra vez solo lo actualiza.
  Hace tres cosas: comprueba que el token abre las dos rutas, lo guarda como
  variable de entorno de USUARIO (OMNIA_MEMORY_TOKEN, sin admin) y listo.
  No abre tuneles, no usa llaves SSH y no toca ningun repo.
#>
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$rutas = @(
  @{ Host = 'memory.omniaos.ai'; Nombre = 'Mem0 (lecciones cortas)' },
  @{ Host = 'kb.omniaos.ai';     Nombre = 'Basic Memory (notas largas)' }
)

$token = $env:OMNIA_TOKEN
if (-not $token) {
  $sec = Read-Host 'Pega tu token de Omnia' -AsSecureString
  $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}
$token = "$token".Trim()
if ($token -notmatch '^omnia_[A-Za-z0-9_-]{20,}$') {
  throw 'Ese token no tiene el formato esperado (omnia_...). Copialo completo, sin comillas ni espacios.'
}

Write-Host '== Comprobando las dos rutas =='
$dev = $null
foreach ($r in $rutas) {
  try {
    $resp = Invoke-RestMethod -Uri "https://$($r.Host)/whoami" -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 20
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq 401) { throw "$($r.Host) rechazo el token (401). Pide uno nuevo al admin; no se cambio nada en tu maquina." }
    throw "No pude llegar a $($r.Host): $($_.Exception.Message). No se cambio nada en tu maquina."
  }
  $dev = $resp.dev
  Write-Host ("  ok  {0,-18} {1}" -f $r.Host, $r.Nombre)
}

[Environment]::SetEnvironmentVariable('OMNIA_MEMORY_TOKEN', $token, 'User')
$env:OMNIA_MEMORY_TOKEN = $token
Remove-Item Env:OMNIA_TOKEN -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "Listo, $dev. Cierra y vuelve a abrir tu IDE / Claude Code para que tome el token."

$vbs = Join-Path ([Environment]::GetFolderPath('Startup')) 'OmniaMemoryTunnel.vbs'
if (Test-Path $vbs) {
  Write-Host ''
  Write-Host 'Nota: ya no necesitas el tunel SSH para la memoria. Si no lo usas para otra cosa'
  Write-Host "(por ejemplo el dashboard de metricas), puedes borrar: $vbs"
}
