@echo off
setlocal
title Actualizando Systema
cd /d "%~dp0"
set "SYSTEMA_PYTHON=%~dp0backend\.venv\Scripts\python.exe"
if not exist "%SYSTEMA_PYTHON%" set "SYSTEMA_PYTHON=%~dp0backend\venv\Scripts\python.exe"
if not exist "%SYSTEMA_PYTHON%" (
    python -m venv "%~dp0backend\.venv"
    if errorlevel 1 goto :error
    set "SYSTEMA_PYTHON=%~dp0backend\.venv\Scripts\python.exe"
)
"%SYSTEMA_PYTHON%" "%~dp0backend\actualizar.py"
exit /b %errorlevel%
:error
echo No se completo la actualizacion. Revisa el error mostrado arriba.
pause
exit /b 1
