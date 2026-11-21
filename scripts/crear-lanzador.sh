#!/bin/sh
# Crea ~/Applications/Cancionero.app: doble clic para arrancar la web, sin Terminal.
# Se ejecuta una vez. Si cambias de versión de Node, vuelve a ejecutarlo.
set -e
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
DESTINO="$HOME/Applications/Cancionero.app"
TMP="$(mktemp -t lanzador).applescript"

cat > "$TMP" <<EOF
do shell script quoted form of "$RAIZ/scripts/lanzar.sh" & " " & quoted form of "$NODE"
EOF

mkdir -p "$HOME/Applications"
rm -rf "$DESTINO"
osacompile -o "$DESTINO" "$TMP"
rm -f "$TMP"
cp "$RAIZ/scripts/Cancionero.icns" "$DESTINO/Contents/Resources/applet.icns"
touch "$DESTINO"
echo "Creado: $DESTINO"
