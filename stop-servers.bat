@echo off
SETLOCAL ENABLEDELAYEDEXPANSION ENABLEEXTENSIONS

echo 🛑 Arrêt des serveurs Clearspace (backend + frontend)

REM Ports utilisés (doivent correspondre à ceux dans .env)
set BACKEND_PORT=3200
set FRONTEND_PORT=3000

REM Vérifier et tuer processus backend sur BACKEND_PORT
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
  echo Tuer processus backend PID: %%a sur port %BACKEND_PORT%
  taskkill /PID %%a /F >nul 2>&1
)

REM Vérifier et tuer processus frontend sur FRONTEND_PORT
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
  echo Tuer processus frontend PID: %%a sur port %FRONTEND_PORT%
  taskkill /PID %%a /F >nul 2>&1
)

REM Tuer toutes les fenêtres de terminal "Backend" ouvertes (adapté si vous avez lancé avec ce titre)
taskkill /FI "WINDOWTITLE eq Backend" /T /F >nul 2>&1

REM Tuer toutes les fenêtres de terminal "Frontend" ouvertes
taskkill /FI "WINDOWTITLE eq Frontend" /T /F >nul 2>&1


echo ✅ Serveurs arrêtés et terminaux fermés.

ENDLOCAL
