#!/bin/bash
set -e

# --- Vérification fichier .env ---
if [ ! -f backend/.env ]; then
  echo "❌ backend/.env introuvable."
  echo "Créez-le à partir de backend/.env.example et adaptez les valeurs."
  exit 1
fi

# --- Vérification Node.js ---
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js n’est pas installé."
  echo "Installez-le depuis : https://nodejs.org/en/download/"
  exit 1
fi

# --- Installation backend ---
cd backend
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances backend..."
  npm install
fi
cd ..

# --- Installation frontend ---
cd frontend
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances frontend..."
  npm install
fi
cd ..

# --- Lancement Backend ---
gnome-terminal -- bash -c "cd backend && npx dotenv -e .env -- npm start; exec bash" &

sleep 2

# --- Lancement Frontend ---
gnome-terminal -- bash -c "cd frontend && npm start; exec bash" &

echo "✅ Backend et Frontend démarrés avec backend/.env"
