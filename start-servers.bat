@echo off
SETLOCAL ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION

REM Configuration commandes couleurs ANSI
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "GREEN=%ESC%[32m"
set "RED=%ESC%[31m"
set "RESET=%ESC%[0m"

echo %GREEN%Début du démarrage Clearspace (backend et frontend)%RESET%

REM Vérifier présence fichier .env
if not exist .env (
  echo %RED%Fichier .env introuvable. Copiez .env.example en .env et configurez-le.%RESET%
  exit /b 1
)
echo .env check OK

REM Récupérer BACKEND_PORT
set "BACKEND_PORT="
for /f "tokens=2 delims==" %%a in ('findstr "^BACKEND_PORT=" .env') do set "BACKEND_PORT=%%a"
if "!BACKEND_PORT!"=="" (
  echo %RED%BACKEND_PORT non défini dans .env%RESET%
  exit /b 1
)
echo BACKEND_PORT = !BACKEND_PORT!

REM Récupérer FRONTEND_PORT
set "FRONTEND_PORT="
for /f "tokens=2 delims==" %%a in ('findstr "^FRONTEND_PORT=" .env') do set "FRONTEND_PORT=%%a"
if "!FRONTEND_PORT!"=="" set "FRONTEND_PORT=3000"
echo FRONTEND_PORT = !FRONTEND_PORT!

REM Vérifier que le port frontend est libre (état LISTENING)
netstat -ano | findstr :!FRONTEND_PORT! | findstr LISTENING >nul
if !errorlevel! == 0 (
  echo %RED%Port !FRONTEND_PORT! déjà utilisé. Arrêt du lancement.%RESET%
  exit /b 1
)
echo Port libre

REM Lancer backend dans fenêtre cmd, console ouverte
start "Backend" cmd /k "cd backend && npm start"
echo %GREEN%Backend lancement demandé.%RESET%

timeout /t 2 >nul

REM Lancer frontend dans fenêtre cmd, console ouverte
start "Frontend" cmd /k "cd frontend && npm start"
echo %GREEN%Frontend lancement demandé.%RESET%

exit /b 0
