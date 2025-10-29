#!/bin/bash

if [ ! -f ".env" ]; then
  echo "Le fichier .env est absent. Arrêt."
  exit 1
fi

BACKEND_PORT=$(grep "^BACKEND_PORT=" .env | cut -d'=' -f2)
FRONTEND_PORT=$(grep "^FRONTEND_PORT=" .env | cut -d'=' .env | cut -d'=' -f2)

if [ -z "$BACKEND_PORT" ]; then
  BACKEND_PORT=3200
fi

if [ -z "$FRONTEND_PORT" ]; then
  FRONTEND_PORT=3000
fi

echo "Arrêt des serveurs..."
echo "Backend port: $BACKEND_PORT"
echo "Frontend port: $FRONTEND_PORT"

# Fermeture frontend par port
pids=$(lsof -ti :"$FRONTEND_PORT")
if [ -n "$pids" ]; then
  echo "Fermeture frontend PID(s): $pids"
  kill -9 $pids
fi

# Envoi requête shutdown backend
curl -s -m 10 -X POST "http://localhost:$BACKEND_PORT/shutdown" > /dev/null
if [ $? -eq 0 ]; then
  echo "Requête shutdown backend envoyée."
else
  pids=$(lsof -ti :"$BACKEND_PORT")
  if [ -n "$pids" ]; then
    echo "Fermeture backend PID(s): $pids"
    kill -9 $pids
  fi
fi

sleep 2

# Fermeture des fenêtres de terminal graphiques spécifiques via wmctrl
if command -v wmctrl &> /dev/null; then
  echo "Fermeture fenêtres terminal graphiques..."

  # Fermer uniquement fenêtres dont le titre EXACT est BackendTerminal ou FrontendTerminal
  for title in "BackendTerminal" "FrontendTerminal"; do
    # Liste des fenêtres matching le titre exact
    wins=$(wmctrl -l | awk -v t="$title" '$0 ~ t {print $1}')
    if [ -n "$wins" ]; then
      for win in $wins; do
        echo "Fermeture fenêtre: $title (id $win)"
        wmctrl -ic "$win"
      done
    else
      echo "Aucune fenêtre trouvée pour le titre $title"
    fi
  done
else
  echo
  echo "wmctrl n'est pas installé, impossible de fermer automatiquement les terminaux graphiques."
  echo "Installation :"
  echo "  Debian/Ubuntu : sudo apt install wmctrl"
  echo "  Fedora        : sudo dnf install wmctrl"
  echo "  Arch Linux    : sudo pacman -S wmctrl"
  echo "  OpenSUSE      : sudo zypper install wmctrl"
  echo
  echo "Fermez les terminaux manuellement ou ajoutez cette fonctionnalité."
fi

echo "Tous les serveurs sont arrêtés."

exit 0
