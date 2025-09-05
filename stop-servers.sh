#!/bin/bash
echo "⏹ Arrêt des serveurs..."

# Backend port 3200
backend_pids=$(lsof -ti tcp:3200)
if [ -n "$backend_pids" ]; then
  kill $backend_pids && echo "Backend arrêté."
else
  echo "Aucun backend trouvé."
fi

# Frontend port 3000
frontend_pids=$(lsof -ti tcp:3000)
if [ -n "$frontend_pids" ]; then
  kill $frontend_pids && echo "Frontend arrêté."
else
  echo "Aucun frontend trouvé."
fi
