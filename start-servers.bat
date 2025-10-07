@echo off
SETLOCAL ENABLEEXTENSIONS

echo 🚀 Démarrage Clearspace (backend + frontend)

REM Vérification du fichier .env
if not exist backend\.env (
  echo ❌ Le fichier backend\.env est introuvable.
  echo Copiez backend\.env.example en backend\.env et configurez-le.
  pause
  exit /b 1
)

REM Vérification Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo ❌ Node.js n’est pas installé ou absent du PATH.
  echo Téléchargez et installez depuis : https://nodejs.org/en/download/
  start https://nodejs.org/en/download/
  pause
  exit /b 1
)

REM Installation backend
cd backend
if not exist node_modules (
  echo 📦 Installation des dépendances backend...
  npm install || exit /b 1
) else (
  echo ✔ Dépendances backend déjà installées.
)
cd ..

REM Installation frontend
cd frontend
if not exist node_modules (
  echo 📦 Installation des dépendances frontend...
  npm install || exit /b 1
) else (
  echo ✔ Dépendances frontend déjà installées.
)
cd ..

REM Lancement backend dans un nouveau terminal
start "Backend" cmd /k "cd backend && npx dotenv -e .env -- npm start"

timeout /t 3 >nul

REM Lancement frontend dans un nouveau terminal
start "Frontend" cmd /k "cd frontend && npm start"

echo ✅ Clearspace démarré.

ENDLOCAL
