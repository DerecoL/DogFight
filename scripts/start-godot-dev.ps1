param(
  [string]$GodotExe = $env:GODOT_EXE,
  [switch]$NoGodot
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$godotProject = Join-Path $repoRoot "godot-client"
$logDir = Join-Path $repoRoot ".codex-tmp"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-PortListening {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return $null -ne $connection
}

if (-not (Test-PortListening -Port 4000)) {
  $outLog = Join-Path $logDir "godot-dev.out.log"
  $errLog = Join-Path $logDir "godot-dev.err.log"
  Remove-Item -LiteralPath $outLog, $errLog -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog
}

$ready = $false
for ($i = 0; $i -lt 90; $i++) {
  if (Test-PortListening -Port 4000) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  throw "DogFight API did not start on http://127.0.0.1:4000. Check $logDir\godot-dev.err.log"
}

Write-Host "DogFight API: http://127.0.0.1:4000"
Write-Host "DogFight Web: http://localhost:5173"

if ($NoGodot) {
  return
}

if ([string]::IsNullOrWhiteSpace($GodotExe)) {
  $bundledGodot = Join-Path $repoRoot ".codex-tmp\godot\4.6.3\Godot_v4.6.3-stable_win64_console.exe"
  if (Test-Path -LiteralPath $bundledGodot) {
    $GodotExe = $bundledGodot
  } else {
    $GodotExe = "godot"
  }
}

Start-Process -FilePath $GodotExe -ArgumentList @("--path", $godotProject) -WorkingDirectory $repoRoot
