#!/bin/sh
# Arranca el servidor si no está en marcha y abre la web en una ventana de Chrome.
# Uso: lanzar.sh [ruta-a-node]. Lo llama el lanzador de crear-lanzador.sh.
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
NODE="${1:-node}"
URL="http://127.0.0.1:5173"
LOG="$HOME/Library/Logs/cancionero.log"

if ! curl -s -o /dev/null "$URL/api/info"; then
  mkdir -p "$(dirname "$LOG")"
  cd "$RAIZ" && nohup "$NODE" server/index.js >> "$LOG" 2>&1 &
  for _ in $(seq 1 50); do
    curl -s -o /dev/null "$URL/api/info" && break
    sleep 0.1
  done
fi

# -n: una instancia nueva de Chrome, para que --app abra su propia ventana aunque Chrome ya esté abierto.
open -na "Google Chrome" --args --app="$URL" 2>/dev/null || open "$URL"
