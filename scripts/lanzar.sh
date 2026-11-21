#!/bin/sh
# Arranca el servidor si no está en marcha y abre la web en una ventana de Chrome.
# Busca Node en tiempo de ejecución: un doble clic no hereda el PATH de la Terminal.
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
URL="http://127.0.0.1:5173"
LOG="$HOME/Library/Logs/cancionero.log"

aviso() {
  osascript -e "display dialog \"$1\" with title \"Cancionero\" buttons {\"OK\"} default button \"OK\" with icon stop" >/dev/null 2>&1
  exit 1
}

# Node 20 o superior: el PATH de la Terminal, rutas habituales de Homebrew/instalador y el perfil de zsh (nvm, fnm...).
buscar_node() {
  for c in "$(command -v node 2>/dev/null)" /opt/homebrew/bin/node /usr/local/bin/node \
           "$(/bin/zsh -lic 'command -v node' 2>/dev/null | tail -1)"; do
    if [ -n "$c" ] && [ -x "$c" ] && "$c" -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)' 2>/dev/null; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

if ! curl -s -o /dev/null "$URL/api/info"; then
  NODE="$(buscar_node)" || aviso "No encuentro Node.js 20 o superior. Instálalo desde nodejs.org (opción LTS) y vuelve a abrir la app."
  mkdir -p "$(dirname "$LOG")"
  cd "$RAIZ" && nohup "$NODE" server/index.js >> "$LOG" 2>&1 &
  for _ in $(seq 1 50); do
    curl -s -o /dev/null "$URL/api/info" && break
    sleep 0.1
  done
  curl -s -o /dev/null "$URL/api/info" || aviso "El servidor no ha arrancado. Revisa el registro: ~/Library/Logs/cancionero.log"
fi

# -n: una instancia nueva de Chrome, para que --app abra su propia ventana aunque Chrome ya esté abierto.
open -na "Google Chrome" --args --app="$URL" 2>/dev/null || open "$URL"
