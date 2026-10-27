$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
& node (Join-Path $PSScriptRoot 'verify.mjs') @args
exit $LASTEXITCODE
