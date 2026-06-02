@echo off
title Systema - Tornillos Los Altos
echo Iniciando sistema...

start "Backend" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\activate && python main.py"
timeout /t 2 /nobreak >nul
start "Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:5173
