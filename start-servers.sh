#!/bin/bash

set -e

echo "🚀 Démarrage Clearspace (backend + frontend)"

# Vérifier fichier .env
if [ ! -f .env ]; then
  echo "❌ Le fichier .env est introuvable."
  echo "Copiez .env.example en .env et configurez-le."
  exit 1
fi
echo ".env check OK"

# Vérifier ou installer nvm
if [ -z "$NVM_DIR" ]; then
  export NVM_DIR="$HOME/.nvm"
fi

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "🔄 Installation de nvm v0.40.3..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

# Charger nvm
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Installer ou utiliser Node.js 22.15.0
if ! nvm ls 22.15.0 &>/dev/null; then
  echo "🔄 Installation de Node.js v22.15.0 via nvm..."
  nvm install 22.15.0
fi

echo "🔧 Utilisation de Node.js 22.15.0"
nvm use 22.15.0
nvm alias default 22.15.0

# Vérifier node installé
if ! command -v node &> /dev/null; then
  echo "❌ Node.js non installé après installation nvm."
  exit 1
fi
echo "Node.js trouvé -> $(node -v)"

# Extraction ports
BACKEND_PORT=$(grep "^BACKEND_PORT=" .env | cut -d '=' -f2)
if [ -z "$BACKEND_PORT" ]; then
  echo "❌ BACKEND_PORT non défini dans .env"
  exit 1
fi
echo "BACKEND_PORT = $BACKEND_PORT"

FRONTEND_PORT=$(grep "^FRONTEND_PORT=" .env | cut -d '=' -f2)
if [ -z "$FRONTEND_PORT" ]; then
  FRONTEND_PORT=3000
fi
echo "FRONTEND_PORT = $FRONTEND_PORT"

# Vérifier port frontend libre
if ss -ltn | grep -q ":$FRONTEND_PORT"; then
  echo "❌ Port $FRONTEND_PORT déjà utilisé. Arrêt."
  exit 1
fi
echo "Port libre"

# Mise à jour env local frontend
echo "VITE_BACKEND_PORT=$BACKEND_PORT" > frontend/.env.local
echo "✨ frontend/.env.local mis à jour avec VITE_BACKEND_PORT=$BACKEND_PORT"

# Installer backend / frontend si besoin
cd backend
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances backend..."
  npm install || { echo "❌ Échec install backend"; exit 1; }
else
  echo "✔ Backend deps déjà installées."
fi
cd ..

cd frontend
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances frontend..."
  npm install || { echo "❌ Échec install frontend"; exit 1; }
else
  echo "✔ Frontend deps déjà installées."
fi
cd ..

echo "Lancement des terminaux graphiques..."

if command -v gnome-terminal &> /dev/null; then
  gnome-terminal --title=BackendTerminal -- bash -c "cd backend && npm start" --hold &
  echo "🟢 Backend lancé"
  gnome-terminal --title=FrontendTerminal -- bash -c "cd frontend && npm start" --hold &
  echo "🟢 Frontend lancé"

elif command -v konsole &> /dev/null; then
  konsole --hold --caption BackendTerminal -e bash -c "cd backend && npm start" &
  echo "🟢 Backend lancé"
  konsole --hold --caption FrontendTerminal -e bash -c "cd frontend && npm start" &
  echo "🟢 Frontend lancé"

elif command -v xfce4-terminal &> /dev/null; then
  xfce4-terminal --title=BackendTerminal --hold --command="bash -c 'cd backend && npm start'" &
  echo "🟢 Backend lancé"
  xfce4-terminal --title=FrontendTerminal --hold --command="bash -c 'cd frontend && npm start'" &
  echo "🟢 Frontend lancé"

elif command -v x-terminal-emulator &> /dev/null; then
  x-terminal-emulator -t BackendTerminal --hold -e bash -c "cd backend && npm start" &
  echo "🟢 Backend lancé"
  x-terminal-emulator -t FrontendTerminal --hold -e bash -c "cd frontend && npm start" &
  echo "🟢 Frontend lancé"

else
  echo "❗ Aucun terminal graphique trouvé, lancement en arrière-plan."
  (cd backend && npm start) &
  echo "🟢 Backend lancé en arrière-plan"
  (cd frontend && npm start) &
  echo "🟢 Frontend lancé en arrière-plan"
fi

echo "✅ Clearspace démarré !"
