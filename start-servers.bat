@echo off
SETLOCAL ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION

echo Début du démarrage Clearspace (backend et frontend)

REM Vérifier présence fichier .env
if not exist .env (
  echo Fichier .env introuvable. Copiez .env.example en .env et configurez-le.
  exit /b 1
)
echo .env check OK

REM Vérifier présence Node.js
node -v >nul 2>&1
if errorlevel 1 (
  echo Node.js non trouvé.
  echo Veuillez installer Node.js depuis https://nodejs.org/en/download/
  exit /b 1
)
echo Node.js trouvé

REM Récupérer BACKEND_PORT
set "BACKEND_PORT="
for /f "tokens=2 delims==" %%a in ('findstr "^BACKEND_PORT=" .env') do set "BACKEND_PORT=%%a"
if "!BACKEND_PORT!"=="" (
  echo BACKEND_PORT non défini dans .env
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
  echo Port !FRONTEND_PORT! déjà utilisé. Arrêt du lancement.
  exit /b 1
)
echo Port libre

REM Installer dépendances backend si besoin
if not exist backend\node_modules (
  echo Installation des dépendances backend...
  pushd backend
  npm install || (
    echo Echec installation backend.
    popd
    exit /b 1
  )
  popd
) else (
  echo Dépendances backend déjà installées.
)

REM Installer dépendances frontend si besoin
if not exist frontend\node_modules (
  echo Installation des dépendances frontend...
  pushd frontend
  npm install || (
    echo Echec installation frontend.
    popd
    exit /b 1
  )
  popd
) else (
  echo Dépendances frontend déjà installées.
)

REM Lancer backend dans fenêtre cmd, console ouverte
start "Backend" cmd /k "cd backend && npm start"
echo Backend lancement demandé.

timeout /t 2 >nul

REM Lancer frontend dans fenêtre cmd, console ouverte
start "Frontend" cmd /k "cd frontend && npm start"
echo Frontend lancement demandé.

exit /b 0
