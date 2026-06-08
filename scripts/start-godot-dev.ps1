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

function Test-ApiHealthy {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:4000/api/health" -TimeoutSec 2
    return $health.ok -eq $true -and $health.database -eq "ok"
  } catch {
    return $false
  }
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
for ($i = 0; $i -lt 120; $i++) {
  if (Test-PortListening -Port 4000 -and (Test-ApiHealthy)) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  throw "DogFight API database did not become healthy on http://127.0.0.1:4000/api/health. Check $logDir\godot-dev.out.log and $logDir\godot-dev.err.log"
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
