@echo off
echo ⏹ Arrêt des serveurs...

REM Backend
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3200') do set PIDBACK=%%a
if defined PIDBACK (
  taskkill /F /PID %PIDBACK%
  echo Backend arrêté (PID %PIDBACK%)
) else (
  echo Aucun serveur backend trouvé.
)

REM Frontend
for /f "tokens=5" %%b in ('netstat -ano ^| findstr :3000') do set PIDFRONT=%%b
if defined PIDFRONT (
  taskkill /F /PID %PIDFRONT%
  echo Frontend arrêté (PID %PIDFRONT%)
) else (
  echo Aucun serveur frontend trouvé.
)

pause
