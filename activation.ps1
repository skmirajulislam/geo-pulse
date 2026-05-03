param(
  [int]$BackendPort = 5000,
  [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"

$backendProc = $null
$frontendProc = $null

function Write-Info($msg) {
  Write-Host "[activation] $msg"
}

function Write-Err($msg) {
  Write-Host "[activation][error] $msg" -ForegroundColor Red
}

function Test-Internet {
  try {
    Invoke-WebRequest -Uri "https://registry.npmjs.org/-/ping" -Method Get -TimeoutSec 5 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Ensure-EnvFiles {
  $backendEnv = Join-Path $BackendDir ".env"
  $frontendEnv = Join-Path $FrontendDir ".env"

  if (-not (Test-Path $backendEnv)) {
    Write-Err "Missing backend\.env"
    exit 1
  }

  if (-not (Test-Path $frontendEnv)) {
    Write-Err "Missing frontend\.env"
    exit 1
  }
}

function Ensure-NodeModules($dir, $name) {
  $nodeModules = Join-Path $dir "node_modules"
  if (Test-Path $nodeModules) {
    Write-Info "$name: node_modules already present"
    return
  }

  Write-Info "$name: node_modules missing"
  if (-not (Test-Internet)) {
    Write-Err "$name: no internet connectivity; cannot install dependencies"
    exit 1
  }

  Write-Info "$name: installing dependencies..."
  Push-Location $dir
  try {
    & npm install
  } finally {
    Pop-Location
  }
}

function Stop-PortProcess([int]$port) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
      $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($pid in $pids) {
        if ($pid -and $pid -ne $PID) {
          Write-Info "Releasing port $port (PID: $pid)"
          Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
      }
    }
  } catch {
    # Best-effort only
  }
}

function Cleanup {
  Write-Info "Stopping services..."
  if ($frontendProc -and -not $frontendProc.HasExited) {
    Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue
  }
  if ($backendProc -and -not $backendProc.HasExited) {
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
  }

  Stop-PortProcess -port $FrontendPort
  Stop-PortProcess -port $BackendPort
  Write-Info "Ports released and processes stopped."
}

try {
  Get-Command npm -ErrorAction Stop | Out-Null
  Ensure-EnvFiles

  Ensure-NodeModules -dir $BackendDir -name "backend"
  Ensure-NodeModules -dir $FrontendDir -name "frontend"

  Stop-PortProcess -port $BackendPort
  Stop-PortProcess -port $FrontendPort

  Write-Info "Starting backend on port $BackendPort"
  $backendProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "set PORT=$BackendPort&& npm start" -WorkingDirectory $BackendDir -PassThru -WindowStyle Normal

  Write-Info "Starting frontend on port $FrontendPort"
  $frontendProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "set PORT=$FrontendPort&& set BROWSER=none&& npm start" -WorkingDirectory $FrontendDir -PassThru -WindowStyle Normal

  Write-Info "Backend PID=$($backendProc.Id), Frontend PID=$($frontendProc.Id)"
  Write-Info "Press Ctrl+C to stop both services."

  while ($true) {
    Start-Sleep -Seconds 2
    if ($backendProc.HasExited -or $frontendProc.HasExited) { break }
  }
}
finally {
  Cleanup
}
