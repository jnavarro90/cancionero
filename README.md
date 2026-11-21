# Cancionero

Web local para escribir letras, poner acordes encima de las palabras, guardar cada canción como un archivo `.chordpro` y exportarla a PDF. Sin base de datos, sin cuentas y sin internet: todo se queda en tu ordenador.

## Descargar

Con Git:

```bash
git clone https://github.com/jnavarro90/cancionero.git
```

O sin Git: en la página del repositorio, botón **Code → Download ZIP**, y descomprime el archivo.

## Instalar (una vez, en macOS)

Necesitas **Node.js 20 o superior**. Comprueba si lo tienes:

```bash
node --version
```

Si no aparece o es anterior a la 20, instálalo desde [nodejs.org](https://nodejs.org) (la opción LTS) o con Homebrew: `brew install node`.

Después:

1. Abre la Terminal y entra en la carpeta `cancionero`: escribe `cd ` (con un espacio), arrastra la carpeta a la ventana de la Terminal y pulsa Intro.
2. Crea la app. Solo se hace una vez:
   ```bash
   sh scripts/crear-lanzador.sh
   ```
   Crea `~/Applications/Cancionero.app`, con su icono.
3. Abre la app con doble clic. Si quieres tenerla siempre a mano, arrástrala al Dock.

La app arranca el servidor y abre la web en su propia ventana de Chrome (si no tienes Chrome, se abre en el navegador por defecto).

### Cosas que importan

- **Si mueves la carpeta `cancionero`**, vuelve a ejecutar `sh scripts/crear-lanzador.sh`. La app recuerda dónde está la carpeta y la ruta de Node.
- **Si cambias de versión de Node** (por ejemplo con nvm), vuelve a ejecutar `sh scripts/crear-lanzador.sh` para que la app use la nueva.
- El servidor sigue en marcha al cerrar la ventana, para que la siguiente vez arranque al instante. Para pararlo: `pkill -f server/index.js` en la Terminal.
- Los registros del servidor están en `~/Library/Logs/cancionero.log`.
- Si el Dock muestra el icono antiguo, ejecuta `killall Dock`.

## Usar

- **Nueva canción:** botón «Nueva canción» en la biblioteca.
- **Acordes:** pasa el ratón por una palabra y pulsa el **+**, o muévete con Tab y pulsa Intro. Te sugiere acordes del tono y de los que ya usas.
- **Letra:** «Editar letra» para escribir o cambiar el texto. Las estrofas se separan con una línea en blanco.
- **Tono:** los botones − y + suben o bajan todos los acordes un semitono.
- **Copiar acordes a todas las estrofas:** copia los acordes de la primera estrofa a las demás, en la misma palabra.
- **Deshacer:** botón o Ctrl/Cmd + Z (un solo paso).
- **PDF:** «Descargar PDF» descarga `<nombre-de-la-canción>.pdf` con el navegador.

Todo se guarda solo, unos 0,8 s después del último cambio.

## Dónde están las canciones

Cada canción es un archivo `canciones/<nombre>.chordpro`, legible con cualquier editor de texto. Para hacer copia de seguridad, copia la carpeta `canciones/`.

Al borrar una canción, el archivo se mueve a `canciones/.papelera/`. Para recuperarla, cópiala de vuelta a `canciones/` y quítale la fecha del nombre.

## Sin la app (opcional)

Desde la Terminal, en la carpeta del proyecto:

```bash
npm start   # abre http://127.0.0.1:5173 en el navegador
```

## Para desarrolladores

```bash
npm test    # tests unitarios (node:test, sin dependencias)
npm run dev # servidor con recarga al cambiar el código
```

No hay dependencias de producción. El servidor usa solo `node:http`, y el PDF usa jsPDF incluido en `public/vendor/`.

Qué hay en el repo:

| Ruta | Qué es |
|---|---|
| [`SPEC.md`](SPEC.md) | Especificación de la versión 1.1 (tecnología, formato, API, pantallas, PDF, pruebas) |
| `server/` | Servidor local, almacenamiento y API |
| `shared/` | Lógica compartida: acordes, ChordPro, letra, sugerencias, PDF |
| `public/` | Web: biblioteca, editor y estilos |
| `scripts/` | Lanzador de macOS (`crear-lanzador.sh`, `lanzar.sh`) e icono |
| `test/` | Tests unitarios |
| [`docs/prototipo.html`](docs/prototipo.html) | Prototipo de referencia, no vinculante donde contradiga la especificación |
| [`docs/pdf-ejemplo.png`](docs/pdf-ejemplo.png) | Cómo tiene que quedar el PDF |

## Letras

No subas letras con derechos de autor al repo. La carpeta `canciones/` está ignorada por git, salvo la canción de ejemplo `ejemplo-noche-de-paz.chordpro` (dominio público).

## Estado

Funcionan la biblioteca, el editor completo y la exportación a PDF. Pendiente: la revisión con la profesora en teléfono y portátil (paso 7 de la especificación).
