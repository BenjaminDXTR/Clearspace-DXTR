@echo off
SETLOCAL ENABLEDELAYEDEXPANSION ENABLEEXTENSIONS

echo 🛑 Arrêt des serveurs Clearspace (backend + frontend)

REM Vérifier .env
if not exist .env (
  echo ❌ Le fichier .env est introuvable.
  echo Copiez .env.example en .env et configurez-le.
  exit /b 1
)
echo .env check OK

REM Extraction BACKEND_PORT
set "BACKEND_PORT="
for /f "tokens=2 delims==" %%a in ('findstr "^BACKEND_PORT=" .env') do set "BACKEND_PORT=%%a"
if "!BACKEND_PORT!"=="" (
  echo ❌ BACKEND_PORT non défini dans .env, utiliser 3200 par défaut
  set "BACKEND_PORT=3200"
)
echo BACKEND_PORT = !BACKEND_PORT!

REM Extraction FRONTEND_PORT
set "FRONTEND_PORT="
for /f "tokens=2 delims==" %%a in ('findstr "^FRONTEND_PORT=" .env') do set "FRONTEND_PORT=%%a"
if "!FRONTEND_PORT!"=="" set "FRONTEND_PORT=3000"
echo FRONTEND_PORT = !FRONTEND_PORT!

REM Solution : utiliser le mode delayed expansion sur toutes les expressions avec !

REM Envoi requête arrêt HTTP backend
echo Envoi requête arrêt HTTP au backend sur port !BACKEND_PORT!
curl -X POST http://localhost:!BACKEND_PORT!/shutdown
if errorlevel 1 (
  echo ❌ Erreur lors de l’appel à l’arrêt HTTP du backend
) else (
  echo 📥 Requête d’arrêt envoyée, attente fermeture backend...
)

REM Pause en attendant fermeture backend
timeout /t 15 /nobreak

REM Vérifier si backend tourne toujours
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :!BACKEND_PORT! ^| findstr LISTENING') do (
  echo Backend (PID: %%a) toujours actif, veuillez fermer manuellement le terminal ou patienter.
)

REM Tuer frontend si actif
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :!FRONTEND_PORT! ^| findstr LISTENING') do (
  echo Fermeture frontend (PID: %%a)
  taskkill /PID %%a /T /F
)

echo.
echo Appuyez sur CTRL+C pour fermer manuellement ou fermez ce terminal.
pause >nul

ENDLOCAL
