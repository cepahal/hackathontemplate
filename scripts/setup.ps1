param([string]$PythonPath)

# Compatibility entry point. The implementation is shared with macOS and Linux.
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    $setupArguments = @('run', 'setup')
    if ($PythonPath) { $setupArguments += @('--', '--python', $PythonPath) }
    & npm.cmd @setupArguments
    if ($LASTEXITCODE -ne 0) { throw "Setup failed with exit code $LASTEXITCODE." }
} finally { Pop-Location }
