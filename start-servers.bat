@echo off
SETLOCAL ENABLEEXTENSIONS

REM --- Vérification du fichier .env ---
if not exist backend\.env (
  echo ❌ Le fichier backend\.env est introuvable.
  echo Créez-le à partir de backend\.env.example et adaptez les valeurs.
  pause
  exit /b 1
)

REM --- Vérification Node.js ---
where node >nul 2>&1
if errorlevel 1 (
  echo ❌ Node.js n’est pas installé ou non trouvé dans le PATH.
  echo Téléchargez et installez Node.js depuis :
  echo https://nodejs.org/en/download/
  start https://nodejs.org/en/download/
  pause
  exit /b 1
)

REM --- Installation backend ---
cd backend
if not exist node_modules (
  echo 📦 Installation des dépendances backend...
  npm install || exit /b 1
)
cd ..

REM --- Installation frontend ---
cd frontend
if not exist node_modules (
  echo 📦 Installation des dépendances frontend...
  npm install || exit /b 1
)
cd ..

REM --- Lancement Backend ---
start "Backend" cmd /k "cd backend && npx dotenv -e .env -- npm start"

timeout /t 3 >nul

REM --- Lancement Frontend ---
start "Frontend" cmd /k "cd frontend && npm start"

echo ✅ Backend et Frontend démarrés avec backend\.env
ENDLOCAL
