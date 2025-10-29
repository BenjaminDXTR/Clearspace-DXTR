#!/bin/bash

if [ ! -f ".env" ]; then
  echo "Le fichier .env est absent. Arrêt."
  exit 1
fi

BACKEND_PORT=$(grep "^BACKEND_PORT=" .env | cut -d'=' -f2)
FRONTEND_PORT=$(grep "^FRONTEND_PORT=" .env | cut -d'=' -f2)

if [ -z "$BACKEND_PORT" ] || [ -z "$FRONTEND_PORT" ]; then
  echo "Ports non définis. Arrêt."
  exit 1
fi

echo "Arrêt des serveurs..."
echo "Backend port: $BACKEND_PORT"
echo "Frontend port: $FRONTEND_PORT"

# Fermeture frontend par port
pids=$(lsof -ti :"$FRONTEND_PORT")
if [ -n "$pids" ]; then
  echo "Fermeture frontend PID: $pids"
  kill -9 $pids
fi

# Envoi requête shutdown backend
curl -s -m 10 -X POST "http://localhost:$BACKEND_PORT/shutdown" > /dev/null
if [ $? -eq 0 ]; then
  echo "Requête shutdown backend envoyée."
else
  pids=$(lsof -ti :"$BACKEND_PORT")
  if [ -n "$pids" ]; then
    echo "Fermeture backend PID: $pids"
    kill -9 $pids
  fi
fi

sleep 2

# Fermeture fenêtres terminal via wmctrl, si disponible
if command -v wmctrl &> /dev/null; then
  echo "Fermeture fenêtres terminal graphiques..."
  wmctrl -c "BackendTerminal" || echo "Impossible de fermer BackendTerminal"
  wmctrl -c "FrontendTerminal" || echo "Impossible de fermer FrontendTerminal"
else
  echo
  echo "wmctrl n'est pas installé, impossible de fermer automatiquement les terminaux graphiques."
  echo "Vous pouvez l'installer avec la commande adaptée selon votre distribution :"
  echo "  Debian / Ubuntu / Mint : sudo apt install wmctrl"
  echo "  Fedora : sudo dnf install wmctrl"
  echo "  Arch Linux : sudo pacman -S wmctrl"
  echo "  OpenSUSE : sudo zypper install wmctrl"
  echo
  echo "Pour fermer les terminaux graphiques ouverts, utilisez un gestionnaire de fenêtres ou fermez-les manuellement."
fi

echo "Tous les serveurs sont arrêtés."

exit 0
