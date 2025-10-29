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

# Fermeture des fenêtres de terminal graphiques spécifiques via wmctrl avec kill forcé si nécessaire
if command -v wmctrl &> /dev/null; then
  if ! command -v xprop &> /dev/null; then
    echo "xprop n'est pas installé, installez-le pour permettre la fermeture forcée des terminaux graphiques."
    echo "Ex: sudo apt install x11-utils"
  fi

  echo "Fermeture fenêtres terminal graphiques..."

  # Fermer uniquement fenêtres dont le titre EXACT est BackendTerminal ou FrontendTerminal
  for title in "BackendTerminal" "FrontendTerminal"; do
    wins=$(wmctrl -l | awk -v t="$title" '{
      winid=$1; desktop=$2; machine=$3;
      sub(winid FS desktop FS machine FS, "", $0);
      if ($0 == t) print winid;
    }')
    if [ -n "$wins" ]; then
      for win in $wins; do
        echo "Fermeture fenêtre: $title (id $win)"
        wmctrl -ic "$win"
        sleep 2
        # Vérifier si fenêtre encore ouverte
        still_open=$(wmctrl -l | grep "^$win ")
        if [ -n "$still_open" ]; then
          echo "Fenêtre $title toujours ouverte, fermeture forcée du processus associé..."
          pid=$(xprop -id $win _NET_WM_PID | awk '{print $3}')
          if [ -n "$pid" ]; then
            kill -9 $pid
            echo "Processus $pid tué."
          else
            echo "Impossible de récupérer le PID pour la fenêtre $win"
          fi
        fi
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
