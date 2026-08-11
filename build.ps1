# Builds a standalone Windows executable at dist\IronNestBallistics.exe
# Usage: powershell -ExecutionPolicy Bypass -File build.ps1

$ErrorActionPreference = "Stop"

$pythonCmd = Get-Command py -ErrorAction SilentlyContinue
if ($pythonCmd) {
    & py -3 -m venv .buildenv
} else {
    python -m venv .buildenv
}

& .\.buildenv\Scripts\pip install --quiet -r requirements.txt pyinstaller

& .\.buildenv\Scripts\pyinstaller --noconfirm --onefile --name IronNestBallistics `
    --add-data "templates;templates" `
    --add-data "static;static" `
    app.py

Write-Host ""
Write-Host "Done. Executable at dist\IronNestBallistics.exe"
Write-Host "Double-click it to start the server."
