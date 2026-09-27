param([string]$PythonPath)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable failed with exit code $LASTEXITCODE. Fix the error above and run setup again."
    }
}

Push-Location $projectRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js is missing from PATH. Install a current Node.js LTS release and reopen your terminal.'
    }
    $nodeVersion = [version]((& node --version).TrimStart('v'))
    if ($nodeVersion -lt [version]'22.19.0') {
        throw 'Node.js 22.19 or newer is required. Use a current LTS release.'
    }
    $npmExecutable = (Get-Command npm.cmd -ErrorAction Stop).Source
    Invoke-Checked 'node' @('scripts/ensure-idle.mjs')
    $venvPython = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'

    if (-not (Test-Path -LiteralPath $venvPython)) {
        $pythonExecutable = $null
        $pythonPrefix = @()
        if ($PythonPath) {
            if (-not (Test-Path -LiteralPath $PythonPath)) { throw "Python executable does not exist: $PythonPath" }
            $pythonExecutable = $PythonPath
        } else {
            foreach ($candidateName in @('python', 'python3', 'py')) {
                $candidateCommand = Get-Command $candidateName -ErrorAction SilentlyContinue
                if ($candidateCommand) {
                    $candidatePrefix = @()
                    if ($candidateName -eq 'py') { $candidatePrefix = @('-3') }
                    $probeSucceeded = $false
                    try {
                        & $candidateCommand.Source @candidatePrefix -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>$null
                        $probeSucceeded = $LASTEXITCODE -eq 0
                    } catch {
                        # Windows PowerShell 5.1 can turn native stderr into a terminating
                        # error. A broken Python alias should not prevent trying the next runtime.
                        $probeSucceeded = $false
                    }
                    if ($probeSucceeded) {
                        $pythonExecutable = $candidateCommand.Source
                        $pythonPrefix = $candidatePrefix
                        break
                    }
                }
            }
            if (-not $pythonExecutable) {
                $bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
                if (Test-Path -LiteralPath $bundledPython) { $pythonExecutable = $bundledPython }
            }
        }
        if (-not $pythonExecutable) {
            throw 'Python 3.11+ was not found. Install Python, reopen your terminal, and run setup again; or pass -PythonPath to this script.'
        }
        Invoke-Checked $pythonExecutable ($pythonPrefix + @('-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'))
        Write-Host "Creating a project-only Python environment using $pythonExecutable"
        Invoke-Checked $pythonExecutable ($pythonPrefix + @('-m', 'venv', (Join-Path $projectRoot 'backend\.venv')))
    }

    Write-Host 'Installing backend dependencies...'
    Push-Location (Join-Path $projectRoot 'backend')
    try { Invoke-Checked $venvPython @('-m', 'pip', 'install', '--no-cache-dir', '-r', 'requirements-dev.txt') }
    finally { Pop-Location }

    Write-Host 'Installing frontend dependencies...'
    $installCommand = 'install'
    if (Test-Path -LiteralPath (Join-Path $projectRoot 'frontend\package-lock.json')) { $installCommand = 'ci' }
    $npmCachePath = $env:npm_config_cache
    if (-not $npmCachePath) { $npmCachePath = Join-Path $projectRoot '.artifacts\npm-cache' }
    $previousNodeOptions = $env:NODE_OPTIONS
    try {
        # Use the operating system's trusted certificates; keep TLS verification enabled.
        # Restore this process setting after installation so caller settings are preserved.
        if ($env:NODE_OPTIONS -notmatch '(^|\s)--use-system-ca(\s|$)') {
            $env:NODE_OPTIONS = "$previousNodeOptions --use-system-ca".Trim()
        }
        Invoke-Checked $npmExecutable @('--prefix', 'frontend', '--cache', $npmCachePath, $installCommand)
    } finally { $env:NODE_OPTIONS = $previousNodeOptions }

    foreach ($config in @(
        @{ Example = 'backend\.env.example'; Local = 'backend\.env' },
        @{ Example = 'frontend\.env.example'; Local = 'frontend\.env.local' }
    )) {
        $localPath = Join-Path $projectRoot $config.Local
        if (-not (Test-Path -LiteralPath $localPath)) {
            Copy-Item -LiteralPath (Join-Path $projectRoot $config.Example) -Destination $localPath
            Write-Host "Created $($config.Local) from its example."
        }
    }

    Write-Host ''
    Write-Host 'Setup complete. Run npm run dev to start both services.'
    Write-Host 'Run npm run check to verify lint, types, production build, and backend tests.'
} finally { Pop-Location }
