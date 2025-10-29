#!/bin/bash

set -e

echo "🚀 Démarrage Clearspace (backend + frontend)"

# Vérifier fichier .env à la racine
if [ ! -f .env ]; then
  echo "❌ Le fichier .env est introuvable."
  echo "Copiez .env.example en .env et configurez-le."
  exit 1
fi
echo ".env check OK"

# Vérifier node installé
if ! command -v node &> /dev/null; then
  echo "❌ Node.js non installé."
  echo "Téléchargez-le depuis https://nodejs.org/en/download/"
  exit 1
fi
echo "Node.js found"

# Extraction BACKEND_PORT
BACKEND_PORT=$(grep "^BACKEND_PORT=" .env | cut -d '=' -f2)
if [ -z "$BACKEND_PORT" ]; then
  echo "❌ BACKEND_PORT non défini dans .env"
  exit 1
fi
echo "BACKEND_PORT = $BACKEND_PORT"

# Extraction FRONTEND_PORT ou défaut
FRONTEND_PORT=$(grep "^FRONTEND_PORT=" .env | cut -d '=' -f2)
if [ -z "$FRONTEND_PORT" ]; then
  FRONTEND_PORT=3000
fi
echo "FRONTEND_PORT = $FRONTEND_PORT"

# Vérifier disponibilité port frontend
if ss -ltn | grep -q ":$FRONTEND_PORT"; then
  echo "❌ Port $FRONTEND_PORT déjà utilisé. Arrêt."
  exit 1
fi
echo "Port libre"

# Générer frontend/.env.local
echo "VITE_BACKEND_PORT=$BACKEND_PORT" > frontend/.env.local
echo "✨ frontend/.env.local mis à jour avec VITE_BACKEND_PORT=$BACKEND_PORT"

# Installer backend
cd backend
echo "Dans backend folder."
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances backend..."
  npm install || { echo "❌ Échec install backend"; exit 1; }
else
  echo "✔ Dépendances backend déjà installées."
fi
echo "Backend installation terminée."
cd ..

# Installer frontend
cd frontend
echo "Dans frontend folder."
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances frontend..."
  npm install || { echo "❌ Échec install frontend"; exit 1; }
else
  echo "✔ Dépendances frontend déjà installées."
fi
echo "Frontend installation terminée."
cd ..

if command -v gnome-terminal &> /dev/null; then
  TERMINAL_CMD_GNOME="gnome-terminal -- bash -c"
elif command -v konsole &> /dev/null; then
  # Konsole nécessite --hold et bash -c pour garder la console ouverte après exécution
  TERMINAL_CMD_KONSOLE="konsole --hold -e bash -c"
elif command -v x-terminal-emulator &> /dev/null; then
  TERMINAL_CMD="x-terminal-emulator -e"
elif command -v xfce4-terminal &> /dev/null; then
  TERMINAL_CMD="xfce4-terminal --command"
else
  echo "❗ Aucun terminal graphique trouvé, lancement en arrière-plan."
  TERMINAL_CMD=""
fi

# Pour lancer backend
if [ -n "$TERMINAL_CMD_GNOME" ]; then
  $TERMINAL_CMD_GNOME "cd backend && npm start; exec bash" &
  echo "🟢 Backend lancement demandé."
elif [ -n "$TERMINAL_CMD_KONSOLE" ]; then
  $TERMINAL_CMD_KONSOLE "cd backend && npm start" &
  echo "🟢 Backend lancement demandé."
elif [ -n "$TERMINAL_CMD" ]; then
  $TERMINAL_CMD "cd backend && npm start" &
  echo "🟢 Backend lancement demandé."
else
  (cd backend && npm start) &
  echo "🟢 Backend lancé en arrière-plan."
fi

# Sleep entre lanceur

sleep 2

# Pour lancer frontend
if [ -n "$TERMINAL_CMD_GNOME" ]; then
  $TERMINAL_CMD_GNOME "cd frontend && npm start; exec bash" &
  echo "🟢 Frontend lancement demandé."
elif [ -n "$TERMINAL_CMD_KONSOLE" ]; then
  $TERMINAL_CMD_KONSOLE "cd frontend && npm start" &
  echo "🟢 Frontend lancement demandé."
elif [ -n "$TERMINAL_CMD" ]; then
  $TERMINAL_CMD "cd frontend && npm start" &
  echo "🟢 Frontend lancement demandé."
else
  (cd frontend && npm start) &
  echo "🟢 Frontend lancé en arrière-plan."
fi


echo "✅ Clearspace démarré !"
