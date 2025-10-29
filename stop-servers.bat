@echo off
SETLOCAL ENABLEEXTENSIONS

REM Vérifier si .env existe
if not exist ".env" (
  echo Le fichier .env est absent. Arrêt du script.
  exit /b 1
)

REM Extraction des ports depuis .env
for /f "tokens=2 delims==" %%a in ('findstr "^BACKEND_PORT=" .env') do set BACKEND_PORT=%%a
if "%BACKEND_PORT%"=="" (
  echo BACKEND_PORT non défini dans .env. Arrêt du script.
  exit /b 1
)

for /f "tokens=2 delims==" %%a in ('findstr "^FRONTEND_PORT=" .env') do set FRONTEND_PORT=%%a
if "%FRONTEND_PORT%"=="" (
  echo FRONTEND_PORT non défini dans .env. Arrêt du script.
  exit /b 1
)

echo Arrêt des serveurs Clearspace (frontend puis backend)
echo Backend port: %BACKEND_PORT%
echo Frontend port: %FRONTEND_PORT%

REM Fermeture frontend (processus sur le port)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
  echo Fermeture frontend - PID: %%a
  taskkill /PID %%a /F >nul 2>&1
)

timeout /t 3 /nobreak >nul

REM Envoi requête HTTP shutdown backend
echo Envoi requête HTTP shutdown backend sur port %BACKEND_PORT%
curl -m 10 -X POST http://localhost:%BACKEND_PORT%/shutdown >nul 2>&1
set "CURL_RESULT=%ERRORLEVEL%"

if "%CURL_RESULT%"=="0" (
  echo Requête shutdown envoyée correctement.
) else (
  echo Erreur lors de l'arrêt HTTP backend. Fermeture backend forcée.
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    echo Fermeture backend - PID: %%a
    taskkill /PID %%a /F >nul 2>&1
  )
)

timeout /t 5 /nobreak >nul

echo Tous les serveurs sont arrêtés. Les fenêtres ne sont pas fermées.

exit /b 0
