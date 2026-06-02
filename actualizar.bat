@echo off
title Actualizando Systema...
echo Descargando cambios de GitHub...
git pull

echo.
echo Actualizando dependencias del backend...
cd /d "%~dp0backend"
call .venv\Scripts\activate
pip install -r requirements.txt -q

echo.
echo Actualizando dependencias del frontend...
cd /d "%~dp0frontend"
call npm install --silent

echo.
echo ========================================
echo  Actualizacion completada.
echo  Cierra las ventanas del sistema y
echo  vuelve a ejecutar iniciar.bat
echo ========================================
pause
