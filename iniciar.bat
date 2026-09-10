@echo off
setlocal
title Systema - Tornillos Los Altos
cd /d "%~dp0"
set "SYSTEMA_PYTHON=%~dp0backend\.venv\Scripts\python.exe"
if not exist "%SYSTEMA_PYTHON%" set "SYSTEMA_PYTHON=%~dp0backend\venv\Scripts\python.exe"
if not exist "%SYSTEMA_PYTHON%" (
    echo No se encontro el entorno Python. Ejecuta actualizar.bat primero.
    goto :error
)
if not exist "%~dp0frontend\node_modules\vite\bin\vite.js" (
    echo Faltan dependencias. Ejecuta actualizar.bat primero.
    goto :error
)
"%SYSTEMA_PYTHON%" backend\mantenimiento.py comprobar-cerrado
if errorlevel 1 goto :error
echo Iniciando sistema...
start "Backend" /D "%~dp0backend" cmd /k ""%SYSTEMA_PYTHON%" main.py"
start "Frontend" /D "%~dp0frontend" cmd /k "npm run dev -- --strictPort"
timeout /t 4 /nobreak >nul
start "" http://localhost:5173
exit /b 0
:error
pause
exit /b 1
