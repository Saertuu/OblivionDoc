$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
python -m PyInstaller --noconfirm --clean --onefile --windowed --name OblivionDoc `
  --icon assets/obliviondoc.ico --add-data "assets/obliviondoc.ico;assets" `
  --hidden-import uvicorn.logging --hidden-import uvicorn.loops.asyncio `
  --hidden-import uvicorn.protocols.http.h11_impl --hidden-import uvicorn.lifespan.on `
  --hidden-import sqlalchemy.dialects.sqlite --exclude-module pytest --exclude-module httpx obliviondoc.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }
