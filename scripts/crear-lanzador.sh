#!/bin/sh
# Crea ~/Applications/Cancionero.app: doble clic para arrancar la web, sin Terminal.
# Se ejecuta una vez en cada equipo (la app guarda la ruta de la carpeta del proyecto).
set -e
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="$HOME/Applications/Cancionero.app"
TMP="$(mktemp -t lanzador).applescript"

cat > "$TMP" <<EOF
do shell script quoted form of "$RAIZ/scripts/lanzar.sh"
EOF

mkdir -p "$HOME/Applications"
rm -rf "$DESTINO"
osacompile -o "$DESTINO" "$TMP"
rm -f "$TMP"
cp "$RAIZ/scripts/Cancionero.icns" "$DESTINO/Contents/Resources/applet.icns"
touch "$DESTINO"
echo "Creado: $DESTINO"
