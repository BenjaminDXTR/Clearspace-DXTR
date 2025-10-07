#!/bin/bash
set -e

echo "🚀 Démarrage Clearspace (backend + frontend)"

# Vérification présence fichier .env
if [ ! -f backend/.env ]; then
  echo "❌ Le fichier backend/.env est introuvable."
  echo "Merci de copier backend/.env.example en .env puis configurer les valeurs."
  exit 1
fi

# Vérification Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js n’est pas installé."
  echo "Téléchargez-le ici : https://nodejs.org/en/download/"
  exit 1
fi

# Installation backend
cd backend
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances backend..."
  npm install
else
  echo "✔ Dépendances backend déjà installées."
fi
cd ..

# Installation frontend
cd frontend
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances frontend..."
  npm install
else
  echo "✔ Dépendances frontend déjà installées."
fi
cd ..

# Lancer backend dans un nouveau terminal
gnome-terminal -- bash -c "cd backend && npx dotenv -e .env -- npm start; exec bash" &
echo "🟢 Backend lancé."

sleep 3

# Lancer frontend dans un nouveau terminal
gnome-terminal -- bash -c "cd frontend && npm start; exec bash" &
echo "🟢 Frontend lancé."

echo "✅ Clearspace démarré. Ouvrez http://localhost:3000 dans votre navigateur."
