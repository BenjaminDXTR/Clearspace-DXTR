#!/bin/bash

echo "🛑 Arrêt des serveurs Clearspace (backend + frontend)"

BACKEND_PORT=3201
FRONTEND_PORT=3001

# Trouver et tuer processus sur BACKEND_PORT
pids=$(lsof -ti tcp:$BACKEND_PORT)
if [ -n "$pids" ]; then
  echo "Tuer processus backend PID(s): $pids sur port $BACKEND_PORT"
  kill -9 $pids
else
  echo "Aucun processus backend trouvé sur le port $BACKEND_PORT"
fi

# Trouver et tuer processus sur FRONTEND_PORT
pids=$(lsof -ti tcp:$FRONTEND_PORT)
if [ -n "$pids" ]; then
  echo "Tuer processus frontend PID(s): $pids sur port $FRONTEND_PORT"
  kill -9 $pids
else
  echo "Aucun processus frontend trouvé sur le port $FRONTEND_PORT"
fi

# Si vous avez les noms de fenêtre terminal spécifiques, vous pouvez les tuer par titre via wmctrl (Linux) ou AppleScript (macOS)
# Voici un exemple pour Linux avec wmctrl (à installer) - optionnel
# wmctrl -l | grep "Backend" | awk '{print $1}' | xargs -r wmctrl -ic

echo "✅ Serveurs arrêtés et terminaux fermés."
