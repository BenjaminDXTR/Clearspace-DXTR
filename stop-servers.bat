@echo off
SETLOCAL ENABLEEXTENSIONS

REM Extraction des ports depuis .env
for /f "tokens=2 delims==" %%a in ('findstr "^BACKEND_PORT=" .env') do set BACKEND_PORT=%%a
if "%BACKEND_PORT%"=="" set BACKEND_PORT=3200

for /f "tokens=2 delims==" %%a in ('findstr "^FRONTEND_PORT=" .env') do set FRONTEND_PORT=%%a
if "%FRONTEND_PORT%"=="" set FRONTEND_PORT=3000

echo Arret des serveurs Clearspace (frontend puis backend)
echo Backend port: %BACKEND_PORT%
echo Frontend port: %FRONTEND_PORT%

REM Fermeture frontend (processus sur le port)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
  echo Fermeture frontend - PID: %%a
  taskkill /PID %%a /F >nul 2>&1
)

timeout /t 3 /nobreak >nul

REM Envoi requête HTTP shutdown backend
echo Envoi requete HTTP shutdown backend sur port %BACKEND_PORT%
curl -m 10 -X POST http://localhost:%BACKEND_PORT%/shutdown >nul 2>&1
set "CURL_RESULT=%ERRORLEVEL%"

if "%CURL_RESULT%"=="0" (
  echo Requete shutdown envoyee correctement.
) else (
  echo Erreur lors de l'arret HTTP backend. Fermeture backend forcee.
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    echo Fermeture backend - PID: %%a
    taskkill /PID %%a /F >nul 2>&1
  )
)

timeout /t 5 /nobreak >nul

REM Fermeture des fenêtres de terminal Backend et Frontend par titre de fenêtre
taskkill /FI "WINDOWTITLE eq Backend" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend" /T /F >nul 2>&1

echo Tous les serveurs sont arretes et fenetres fermees.

exit /b 0
