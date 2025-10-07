@echo off
echo ⏹ Arrêt des serveurs Clearspace...

REM Arrêt backend sur port 3200
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3200') do set PIDBACK=%%a
if defined PIDBACK (
  taskkill /F /PID %PIDBACK%
  echo 🛑 Backend arrêté (PID %PIDBACK%)
) else (
  echo ⚠ Aucun backend trouvé sur le port 3200.
)

REM Arrêt frontend sur port 3000
for /f "tokens=5" %%b in ('netstat -ano ^| findstr :3000') do set PIDFRONT=%%b
if defined PIDFRONT (
  taskkill /F /PID %PIDFRONT%
  echo 🛑 Frontend arrêté (PID %PIDFRONT%)
) else (
  echo ⚠ Aucun frontend trouvé sur le port 3000.
)

pause
