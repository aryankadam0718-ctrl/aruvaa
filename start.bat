@echo off
echo.
echo  Starting ARUVA Platform...
echo.
cd /d "%~dp0backend"
if not exist node_modules (
  echo  Installing dependencies...
  call npm install
)
timeout /t 1 /nobreak >nul
start "" "http://localhost:3000/login.html"
node --experimental-sqlite server.js
pause
