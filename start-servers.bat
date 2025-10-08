@echo off
SETLOCAL ENABLEDELAYEDEXPANSION ENABLEEXTENSIONS

echo 🚀 Démarrage Clearspace (backend + frontend)

REM Vérifier .env
if not exist .env (
  echo ❌ Le fichier .env est introuvable.
  echo Copiez .env.example en .env et configurez-le.
  exit /b 1
)
echo .env check OK

REM Vérifier Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo ❌ Node.js non installé ou absent du PATH.
  echo Téléchargez-le depuis https://nodejs.org/en/download/
  start https://nodejs.org/en/download/
  exit /b 1
)
echo Node.js found

REM Extraction BACKEND_PORT
set "BACKEND_PORT="
for /f "tokens=2 delims==" %%a in ('findstr "^BACKEND_PORT=" .env') do set "BACKEND_PORT=%%a"
if "!BACKEND_PORT!"=="" (
  echo ❌ BACKEND_PORT non défini dans .env
  exit /b 1
)
echo BACKEND_PORT = !BACKEND_PORT!

REM Extraction FRONTEND_PORT
set "FRONTEND_PORT="
for /f "tokens=2 delims==" %%a in ('findstr "^FRONTEND_PORT=" .env') do set "FRONTEND_PORT=%%a"
if "!FRONTEND_PORT!"=="" set "FRONTEND_PORT=3000"
echo FRONTEND_PORT = !FRONTEND_PORT!

REM Vérifier disponibilité port frontend
netstat -ano | findstr :!FRONTEND_PORT! >nul
if not errorlevel 1 (
  echo ❌ Port !FRONTEND_PORT! déjà utilisé. Arrêt du lancement.
  exit /b 1
)
echo Port libre

REM Générer frontend\.env.local
echo VITE_BACKEND_PORT=!BACKEND_PORT! > frontend\.env.local
echo ✨ frontend\.env.local mis à jour avec VITE_BACKEND_PORT=!BACKEND_PORT!

REM Installer backend
cd backend
echo Dans backend folder.
if not exist node_modules (
  echo 📦 Installation des dépendances backend...
  call npm install
  if errorlevel 1 (
    echo ❌ Échec de l'installation des dépendances backend.
    exit /b 1
  )
) else (
  echo ✔ Dépendances backend déjà installées.
)
echo Backend installation terminée.
cd ..

REM Installer frontend
cd frontend
echo Dans frontend folder.
if not exist node_modules (
  echo 📦 Installation des dépendances frontend...
  call npm install
  if errorlevel 1 (
    echo ❌ Échec de l'installation des dépendances frontend.
    exit /b 1
  )
) else (
  echo ✔ Dépendances frontend déjà installées.
)
echo Frontend installation terminée.
cd ..

REM Lancer backend - s’appuie sur start script modifié dans package.json
start "Backend" cmd /k "cd backend && npm start"
echo 🟢 Backend lancement demandé.

timeout /t 2 >nul

REM Lancer frontend
start "Frontend" cmd /k "cd frontend && npm start"
echo 🟢 Frontend lancement demandé.

echo ✅ Clearspace démarré !
ENDLOCAL
