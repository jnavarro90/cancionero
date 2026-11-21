# Cancionero local: especificación

Versión 1.0 · noviembre 2026

Web local para escribir letras de canciones, poner acordes encima de las palabras, guardar cada canción como un archivo en disco y exportarla a PDF. Sin base de datos, sin cuentas de usuario, sin conexión a internet una vez instalada.

El comportamiento de referencia es el prototipo de [`docs/prototipo.html`](docs/prototipo.html). Si este documento y el prototipo no coinciden, manda este documento.

---

## 1. Objetivo y alcance

### 1.1 Qué tiene que hacer

1. Mostrar una **biblioteca** con todas las canciones guardadas en una carpeta.
2. Crear, abrir, renombrar, duplicar y borrar canciones.
3. **Editar la letra** de una canción en un cuadro de texto, con las estrofas separadas por líneas en blanco.
4. **Poner acordes** encima de las palabras pasando el ratón y pulsando un `+`, con sugerencias.
5. Guardar automáticamente cada canción como **un archivo de texto** (formato ChordPro) en la carpeta de canciones.
6. **Exportar a PDF** con el diseño descrito en la sección 9.
7. Funcionar en `http://localhost` y sin internet.

### 1.2 Qué no entra en la versión 1

- Base de datos de ningún tipo (ni SQLite, ni IndexedDB como almacén principal).
- Usuarios, contraseñas o acceso desde otros ordenadores de la red.
- Acordes sobre sílabas dentro de una palabra (el acorde va sobre la palabra entera). El formato de archivo sí lo admite, para poder añadirlo más adelante (ver 5.4).
- Partituras, tablaturas, diagramas de acordes o audio.
- Sincronización en la nube.

---

## 2. Tecnología

| Parte | Elección | Motivo |
|---|---|---|
| Servidor | Node.js ≥ 20, módulo `node:http` sin framework | Cero dependencias en el servidor, se arranca con `npm start` |
| Frontend | HTML, CSS y JavaScript sin framework ni paso de compilación (módulos ES nativos) | Se abre y se modifica sin herramientas |
| PDF | jsPDF 2.5.1, copiado en `public/vendor/jspdf.umd.min.js` (no CDN) | Funciona sin internet |
| Tipografías | Kalam y Atkinson Hyperlegible en `public/fonts/` (`.woff2`, licencia OFL) | Funciona sin internet |
| Tests | `node:test` + `node:assert` para la lógica; Playwright opcional para el navegador | Sin dependencias en producción |

Única dependencia de desarrollo permitida: `@playwright/test` (opcional). En producción, `package.json` no tiene `dependencies`.

### 2.1 Arranque

```bash
npm start                         # http://127.0.0.1:5173
PORT=8080 npm start               # otro puerto
CANCIONES_DIR=~/Música/letras npm start   # otra carpeta
```

- El servidor escucha **solo en `127.0.0.1`**, nunca en `0.0.0.0`.
- Al arrancar, crea la carpeta de canciones si no existe y muestra en consola la URL y la ruta absoluta de la carpeta.
- Si el puerto está ocupado, muestra un mensaje claro en español y termina con código 1.
- `npm run dev` hace lo mismo con `node --watch`.

---

## 3. Estructura del repositorio

```
cancionero/
├── package.json
├── README.md
├── SPEC.md
├── server/
│   ├── index.js          # arranque, rutas, estáticos
│   ├── storage.js        # leer, escribir, listar y borrar archivos
│   ├── slug.js           # nombres de archivo seguros
│   └── http-utils.js     # JSON, errores, límites de tamaño
├── shared/               # código que usan servidor y navegador
│   ├── chords.js         # modelo de acorde, parseo, nombres, transporte
│   ├── chordpro.js       # archivo ChordPro <-> modelo de canción
│   └── stanzas.js        # detección de estrofas y copiar acordes
├── public/
│   ├── index.html        # biblioteca
│   ├── cancion.html      # editor
│   ├── css/app.css
│   ├── js/
│   │   ├── api.js        # llamadas al servidor
│   │   ├── biblioteca.js
│   │   ├── editor.js     # hoja, popover, selección, atajos
│   │   ├── suggest.js    # sugerencias de acordes
│   │   ├── history.js    # deshacer / rehacer
│   │   └── pdf.js        # exportación a PDF
│   ├── vendor/jspdf.umd.min.js
│   └── fonts/
├── canciones/            # datos (en .gitignore salvo el ejemplo)
│   └── ejemplo-noche-de-paz.chordpro
├── test/
│   ├── chords.test.js
│   ├── chordpro.test.js
│   ├── stanzas.test.js
│   ├── suggest.test.js
│   ├── slug.test.js
│   └── storage.test.js
└── docs/
    ├── prototipo.html
    └── pdf-ejemplo.png
```

`server/index.js` sirve `shared/` en la ruta `/shared/` para que el navegador importe los mismos módulos que usan los tests.

---

## 4. Modelo de datos

### 4.1 Acorde

```js
{ r: 9, q: "m" }   // r = raíz, 0..11 (0 = DO / C). q = calidad, texto
```

- `r` es un entero de 0 a 11: DO=0, DO#=1, RE=2, MIb=3, MI=4, FA=5, FA#=6, SOL=7, LAb=8, LA=9, SIb=10, SI=11.
- `q` es la calidad normalizada: `""` (mayor), `"m"`, `"7"`, `"m7"`, `"maj7"`, `"sus4"`, `"dim"`, etc. Máximo 8 caracteres, solo `[a-z0-9#+()/º°ø-]`, sin distinguir mayúsculas.

### 4.2 Canción en memoria

```js
{
  slug: "noche-de-paz",        // nombre del archivo sin extensión, fijo
  title: "Noche de paz",
  key: { r: 9, m: "minor" },   // tono; m es "major" o "minor"
  notation: "es",              // "es" (LAm) o "en" (Am)
  transpose: 0,                // semitonos acumulados, solo informativo
  text: "Noche de paz, noche de amor,\n...", // letra sin acordes
  chords: { "0:0": {r:9,q:"m"}, "0:3": {r:4,q:"7"} }, // "línea:palabra"
  updatedAt: "2026-11-21T10:48:33.000Z" // fecha de modificación del archivo
}
```

- **Línea** = índice en `text.split("\n")`, contando las líneas en blanco.
- **Palabra** = índice en `línea.trim().split(/\s+/)`. Las líneas vacías no tienen palabras.
- Un acorde en una posición que no existe se descarta al cargar o al editar la letra.

### 4.3 Nombres de acordes

| Raíz | ES | EN |
|---|---|---|
| 0 | DO | C |
| 1 | DO# | C# |
| 2 | RE | D |
| 3 | MIb | Eb |
| 4 | MI | E |
| 5 | FA | F |
| 6 | FA# | F# |
| 7 | SOL | G |
| 8 | LAb | Ab |
| 9 | LA | A |
| 10 | SIb | Bb |
| 11 | SI | B |

Regla de visualización:

- **Notación ES:** raíz + calidad, y el **mayor se escribe con `M`**: `LAM`, `SOLM`, `LAm`, `MI7`, `REm7`, `SIbmaj7`.
- **Notación EN:** raíz + calidad, el mayor sin sufijo: `A`, `G`, `Am`, `E7`.

### 4.4 Parseo de lo que escribe el usuario (`parseChord`)

Entrada libre, sin distinguir mayúsculas en la raíz. Se quitan los espacios.

1. Raíz ES: `sol|do|re|mi|fa|la|si` (probar `sol` antes que las de dos letras). Si no, raíz EN: `[a-g]`.
2. Alteración opcional: `#` sube un semitono, `b` lo baja.
3. Calidad (el resto):
   - `M`, `maj`, `may`, `mayor` → `""` (mayor)
   - `min`, `menor`, `-` → `"m"`
   - `M7` → `"maj7"`
   - si empieza por `m` → `"m"` + resto en minúsculas
   - otro caso → tal cual, con `maj` normalizado
4. Si no encaja o la calidad no es válida → `null` y el campo se marca en rojo con el aviso «No reconozco ese acorde».

Casos que deben pasar los tests:

| Entrada | Resultado |
|---|---|
| `LAM` | `{r:9,q:""}` |
| `LAm` | `{r:9,q:"m"}` |
| `LA` | `{r:9,q:""}` |
| `la7` | `{r:9,q:"7"}` |
| `SOLm7` | `{r:7,q:"m7"}` |
| `Fa#m` | `{r:6,q:"m"}` |
| `Bb` | `{r:10,q:""}` |
| `Am` | `{r:9,q:"m"}` |
| `E7` | `{r:4,q:"7"}` |
| `SIbM7` | `{r:10,q:"maj7"}` |
| `REsus4` | `{r:2,q:"sus4"}` |
| `xx`, `H7`, `` (vacío) | `null` |

### 4.5 Transporte

Sumar `n` semitonos (`±1`) a la raíz de todos los acordes y del tono, módulo 12. Guardar `transpose += n`. Se puede deshacer.

---

## 5. Archivos de canciones

### 5.1 Ubicación y nombre

- Carpeta: `CANCIONES_DIR` o `./canciones` por defecto.
- Un archivo por canción: `<slug>.chordpro`, codificado en UTF-8 sin BOM, finales de línea `\n`.
- **Slug:** a partir del título, quitar tildes (NFD y borrar diacríticos), pasar a minúsculas, cambiar todo lo que no sea `[a-z0-9]` por `-`, juntar guiones repetidos, quitar guiones al principio y al final, cortar a 60 caracteres. Si queda vacío → `cancion`. Si ya existe → añadir `-2`, `-3`…
- El slug **no cambia** al cambiar el título, para no romper enlaces. Renombrar el archivo es una acción aparte, desde la biblioteca (7.1).
- Regex de slug válido: `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Cualquier otra cosa se rechaza con 400 antes de tocar el disco.

### 5.2 Formato (ChordPro)

Los acordes se guardan **siempre en notación inglesa** dentro del archivo, para que sea compatible con otras apps de ChordPro. La notación de pantalla es una preferencia aparte.

```
{title: Noche de paz}
{key: Am}
{x_notation: es}
{x_transpose: 0}

{start_of_verse}
[Am]Noche de paz, [E7]noche de amor,
[Am]todo duerme en [E7]derredor.
{end_of_verse}

{start_of_verse}
[Am]Noche de paz, [E7]noche de amor,
...
{end_of_verse}
```

Reglas de escritura (`serialize`):

- Cabecera con `title`, `key` (raíz EN + `m` si es menor), `x_notation`, `x_transpose`, y una línea en blanco.
- Cada estrofa entre `{start_of_verse}` y `{end_of_verse}`, separadas por una línea en blanco.
- Cada acorde se escribe como `[Am]` pegado justo antes de su palabra.
- Las palabras se separan con un espacio (los espacios múltiples de la letra original no se conservan).

Reglas de lectura (`parse`), tolerantes para aceptar archivos de otras apps:

- Directivas `{nombre: valor}` o `{nombre}`; también las formas cortas `{t:}` y `{k:}`. Directivas desconocidas se ignoran sin error y **no se conservan** al guardar (avisarlo en el README).
- Si no hay `title`, usar el nombre del archivo.
- Si no hay `key`, deducirlo: el primer acorde de la canción; si no hay acordes, `LAm`.
- Las estrofas se separan por líneas en blanco; `{start_of_*}` / `{end_of_*}` se ignoran.
- Un acorde `[X]` se asigna a la palabra que empieza en esa posición. Si cae **en medio de una palabra** (`can[Am]tando`), en la versión 1 se asigna a esa palabra y se pierde la posición exacta de la sílaba; registrarlo con `console.warn`.
- Un acorde que no se puede parsear se descarta con `console.warn`.
- `parse(serialize(cancion))` tiene que devolver la misma canción (test obligatorio).

### 5.3 Escritura segura

- Escritura atómica: escribir `<slug>.chordpro.tmp` y después `rename`.
- Tamaño máximo de una canción: 200 KB. Si se pasa, 413.
- **Control de conflictos:** cada lectura devuelve `updatedAt` (`mtime` del archivo). Cada `PUT` lo envía en la cabecera `If-Unmodified-Since` (ISO). Si el archivo cambió desde entonces (por otra pestaña o editado a mano), responder 409 con la versión actual. La web muestra: «Esta canción ha cambiado fuera de aquí. [Cargar la versión del disco] [Sobrescribir con la mía]».
- Borrar no elimina: mueve el archivo a `canciones/.papelera/<slug>-<fecha>.chordpro`.

### 5.4 Ampliación prevista: acordes sobre sílabas

Para una versión futura, el modelo pasará de `"línea:palabra"` a `"línea:palabra:carácter"`. El formato ChordPro ya lo representa (`can[Am]tando`), así que los archivos no cambian. No implementarlo en la v1, pero que `chordpro.js` tenga la conversión aislada en una función para que el cambio sea local.

---

## 6. API local

Todas las respuestas son JSON en UTF-8. Los errores tienen la forma `{ "error": "mensaje en español" }`.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/info` | — | `200 { dir }` con la ruta absoluta de la carpeta de canciones |
| GET | `/api/canciones` | — | `200 [{ slug, title, key, chordCount, updatedAt }]` ordenado por `updatedAt` descendente |
| GET | `/api/canciones/:slug` | — | `200 { slug, chordpro, updatedAt }` · `404` |
| POST | `/api/canciones` | `{ title, chordpro? }` | `201 { slug, updatedAt }`. Sin `chordpro`, crea una canción vacía con ese título |
| PUT | `/api/canciones/:slug` | `{ chordpro }` + cabecera `If-Unmodified-Since` | `200 { updatedAt }` · `409 { error, chordpro, updatedAt }` · `404` |
| POST | `/api/canciones/:slug/duplicar` | `{ title }` | `201 { slug, updatedAt }` |
| POST | `/api/canciones/:slug/renombrar` | `{ slug }` | `200 { slug }` · `409` si ya existe |
| DELETE | `/api/canciones/:slug` | — | `204` (archivo movido a `.papelera`) |

- El servidor **no interpreta acordes**: guarda y devuelve el texto ChordPro tal cual. Solo lee `title`, `key` y cuenta los `[...]` para el listado.
- Las rutas que no empiezan por `/api/` sirven `public/` y `shared/`. Ruta desconocida → 404. Nunca servir nada fuera de esas dos carpetas (comprobar con `path.resolve` que la ruta final empieza por la carpeta permitida).
- Comprobar la cabecera `Host` (`127.0.0.1:<puerto>` o `localhost:<puerto>`) y, en peticiones que cambian datos, que `Origin`, si viene, sea el mismo. Así otra web abierta en el navegador no puede escribir en la carpeta.
- Tipos MIME correctos para `.html .css .js .woff2 .png .svg`.

---

## 7. Interfaz

Idioma: español en toda la interfaz. Diseño visual en la sección 8.

### 7.1 Biblioteca (`/`)

- Título «Cancionero» y botón principal **«Nueva canción»**.
- Buscador que filtra por título mientras se escribe, sin distinguir tildes ni mayúsculas.
- Lista de canciones: título, tono y número de acordes, y «editada hace 5 min» (`Intl.RelativeTimeFormat` en `es`). Clic → abre el editor.
- Menú por canción (botón `⋯`): Duplicar, Renombrar archivo, Descargar `.chordpro`, Borrar. Borrar pide confirmación en un diálogo propio (no `confirm()`), con el texto «Se moverá a la papelera de la carpeta de canciones».
- **Importar:** botón y zona para soltar archivos `.chordpro`, `.cho`, `.txt`. Un `.txt` se importa como letra sin acordes, con el nombre del archivo como título. Se crea una canción nueva por archivo.
- Lista vacía: texto «Aún no hay canciones» y los botones Nueva canción e Importar.
- Al pie, la ruta de la carpeta de canciones (la da `GET /api/info` → `{ dir }`).

### 7.2 Editor (`/cancion.html?c=<slug>`)

Estructura de arriba abajo:

1. **Cabecera:** enlace «← Canciones», título editable en línea (sin borde hasta hover o foco), indicador de guardado.
2. **Ayuda de una línea:** «Pasa el ratón por una palabra y pulsa **+** para poner el acorde encima.»
3. **Barra de herramientas** (se parte en varias filas en pantallas estrechas):
   - Tono: selector con los 24 tonos (12 mayores y 12 menores), con nombres según la notación activa.
   - Notación: botón doble `LAm` / `Am`.
   - Transporte: `−½`, valor actual (`0`, `+2`, `−1`), `+½`.
   - **«Copiar acordes a todas»** (tooltip: «Copia los acordes de la 1.ª estrofa a las demás, en la misma línea y la misma palabra»).
   - **«Seleccionar para borrar»**.
   - **«Editar letra»**, que cambia a **«Listo»** (botón rojo) en modo edición.
   - Deshacer.
   - Copiar (texto con acordes entre corchetes, en la notación de pantalla).
   - **«Descargar PDF»** (botón rojo principal).
4. **Hoja** (modo acordes) o **editor de letra** (modo edición).
5. **Pie:** «N acordes · tono LAm» o «Aún no hay acordes».

**Indicador de guardado:** «Guardado» (gris), «Guardando…», «Sin guardar · reintentando» (rojo) si falla. El guardado es automático 800 ms después del último cambio, y también al salir de la página (`visibilitychange` → `fetch` con `keepalive`). Si hay cambios sin guardar, `beforeunload` avisa.

### 7.3 Hoja de la canción

- Cada estrofa empieza con una etiqueta pequeña «Estrofa 1», «Estrofa 2»… en gris, seguida de una línea fina.
- Cada línea es una fila que se parte si no cabe. Cada palabra es un bloque en columna: **acorde arriba, palabra abajo**. El ancho del bloque es el mayor de los dos, así que las palabras se separan solas cuando el acorde es más largo.
- Hueco reservado para el acorde en todas las palabras (1,35 em), aunque no tengan acorde, para que las líneas no salten.
- **Hover sobre una palabra sin acorde:** fondo rosado y aparece un `+` en un círculo discontinuo rojo de 20 px en el hueco del acorde (transición de 120 ms en opacidad y escala, desactivada con `prefers-reduced-motion`).
- En pantallas táctiles (`hover: none`) el `+` se ve siempre con opacidad 0,28.
- Clic, Intro o Espacio en una palabra → abre el **selector de acorde** (7.4).
- Tras poner un acorde, el foco pasa a la palabra siguiente y su `+` se ve atenuado como pista.
- Teclado: flechas ← → mueven entre palabras; Supr/Retroceso borra el acorde de la palabra con foco.
- Cada palabra es un elemento con `tabindex="0"`, foco visible y `aria-label` «Acorde sobre "palabra"».

### 7.4 Selector de acorde (popover)

Se abre debajo de la palabra, sin salirse de la pantalla (ajustar a izquierda y derecha con 12 px de margen). Ancho `min(340px, 100vw − 24px)`.

Contenido, de arriba abajo:

1. «Acorde sobre **«palabra»**».
2. **Variantes** de la raíz actual (la del acorde que ya hay o, si no hay, la de la primera sugerencia): `LAM LAm LA7 LAm7 LAmaj7 LAsus4`. La que coincide con el acorde actual va rellena en rojo.
3. **Sugerencias:** cuadrícula de 4 columnas, hasta 8 botones de 44 px de alto, con su número (1–8) en una esquina. El primero lleva borde rojo grueso.
4. Una línea explicando la primera sugerencia: «Sugerido: MI7, suele ir después de LAm. Teclas 1–8 para elegir.»
5. Campo «Otro: LAM, SOL7, Fa#m…» + botón **Poner**. Si hay acorde, el campo viene relleno con él.
6. **«Quitar acorde»** si la palabra ya tiene uno.

Teclado: 1–8 eligen sugerencia, Intro en el campo pone el acorde, Esc cierra y devuelve el foco a la palabra. Clic fuera cierra.

### 7.5 Sugerencias (`suggest.js`)

Función pura `suggest(cancion, posicion) → { lista: Acorde[], motivo: Map }`. Se construye una lista sin repetidos, en este orden, y se cortan las 8 primeras:

1. **Lo que ya haces en esta canción:** buscar el acorde anterior a la posición (en orden de lectura). Contar qué acordes lo siguen en el resto de la canción y añadirlos de más a menos frecuente. Motivo: «sigue a LAm en tu canción».
2. **Teoría:** los que suelen seguir al anterior según la tabla de abajo. Motivo: «suele ir después de LAm».
3. **Los que ya usas**, de más a menos frecuentes. Motivo: «ya lo usas».
4. **Los del tono**, en el orden de la tabla. Motivo: «del tono».

Grados del tono (desplazamiento en semitonos + calidad):

- Mayor: `0`, `5`, `7`, `9m`, `7·7`, `2m`, `4m`, `0·7`
- Menor: `0m`, `7·7`, `5m`, `8`, `3`, `10`, `7m`, `2m7`

(`7·7` = quinto grado con séptima, por ejemplo MI7 en LAm.)

Tabla de siguientes (clave = grado del acorde anterior respecto al tono):

| Tono | Anterior | Siguientes probables |
|---|---|---|
| Mayor | `0` | `7`, `5`, `9m` |
| Mayor | `5` | `0`, `7`, `2m` |
| Mayor | `7` y `7·7` | `0`, `9m` |
| Mayor | `9m` | `5`, `2m`, `4m` |
| Mayor | `2m` | `7·7`, `7` |
| Mayor | `4m` | `9m`, `5` |
| Menor | `0m` | `7·7`, `5m`, `8` |
| Menor | `5m` | `0m`, `7·7` |
| Menor | `7·7` y `7m` | `0m`, `8` |
| Menor | `8` | `5m`, `7·7`, `3` |
| Menor | `3` | `8`, `10` |
| Menor | `10` | `3`, `0m` |

### 7.6 Selección múltiple para borrar

- Botón **«Seleccionar para borrar»** activa el modo. Aparece una **barra oscura fija arriba** con: «Pulsa o arrastra sobre los acordes que quieras borrar. Mayús + clic marca un tramo.», **Marcar todos**, **Desmarcar**, **Borrar N acordes** (rojo, desactivado si N = 0) y **Terminar**.
- En este modo: los acordes marcados se ven tachados con fondo rojo suave; el `+` no aparece; el cursor es `cell`; no se puede seleccionar texto.
- **Clic** marca o desmarca un acorde. Clic en palabra sin acorde → aviso «Esa palabra no tiene acorde».
- **Arrastrar** (botón principal pulsado): marca todo el tramo entre la palabra inicial y la actual, aunque ocupe varias líneas. Si se empieza sobre un acorde ya marcado, el tramo se desmarca.
- **Mayús + clic** marca todos los acordes entre el último pulsado y este. **Funciona también fuera del modo:** si se hace Mayús + clic sin estar en el modo, se activa el modo y se marca el tramo desde la última palabra abierta o con foco.
- Supr con acordes marcados = Borrar. Esc = Terminar.
- Borrar se puede deshacer; el aviso dice «4 acordes borrados · puedes deshacer».

### 7.7 Editor de letra

- Cuadro de texto grande (fuente 18 px, interlineado 1,7) en lugar de la hoja.
- Encima, aviso de una línea: «**Línea en blanco entre estrofas.** 3 estrofas». El número se actualiza al escribir. Si hay una sola estrofa y más de 8 líneas, añade «· ¿falta alguna línea en blanco?».
- **Margen izquierdo de 96 px** (76 px en móvil) con una línea roja suave, donde aparecen **«Estrofa 1», «Estrofa 2»…** a la altura de la primera línea de cada estrofa. Se calculan con un `div` espejo invisible que copia ancho, fuente y relleno del cuadro de texto, y se recolocan al escribir, al hacer scroll y al cambiar el tamaño (`ResizeObserver`).
- **Listo** guarda la letra y vuelve a la hoja. Los acordes en posiciones que ya no existen se descartan; el resto se mantiene por `línea:palabra`.
- Se puede deshacer como un único paso.

### 7.8 Copiar acordes a todas las estrofas

1. Detectar estrofas: grupos de líneas no vacías separados por una o más líneas vacías.
2. Estrofa origen: la primera que tenga algún acorde.
3. Si hay menos de dos estrofas → aviso «Solo hay una estrofa. En «Editar letra», deja una línea en blanco entre estrofas».
4. Para cada otra estrofa y cada línea `j`, copiar los acordes de la línea `j` del origen a la misma palabra. Si la línea destino tiene menos palabras, el acorde va a la última palabra.
5. **No sobrescribir** acordes que ya existan en el destino.
6. Aviso: «12 acordes copiados» o «Las demás estrofas ya tienen acordes». Se puede deshacer.

### 7.9 Deshacer

- Pila de hasta 80 instantáneas del modelo antes de cada cambio (poner o quitar acorde, borrar en bloque, copiar a todas, transportar, cambiar tono, editar letra, nueva canción).
- Botón Deshacer y `Ctrl/Cmd + Z` (fuera de campos de texto). `Ctrl/Cmd + Mayús + Z` rehace.
- Si no hay nada → aviso «Nada que deshacer».

### 7.10 Avisos

Píldora oscura abajo en el centro, 1,8 s, `role="status"`. No usar nunca `alert`, `confirm` ni `prompt`.

---

## 8. Diseño visual

La idea es un **cuaderno de cuadros con espiral**: la letra en tinta azul de bolígrafo y los acordes en boli rojo, como en el cuaderno original.

### 8.1 Colores (tema claro / oscuro con `light-dark()`)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#e8ecf4` | `#0b0f1d` | fondo de página |
| `--paper` | `#ffffff` | `#131a2e` | hoja, barra, popover |
| `--grid` | `#dde5f2` | `#1f2842` | cuadrícula de 22 px |
| `--ink` | `#1a2766` | `#e2e7ff` | letra y textos |
| `--soft` | `#5b6694` | `#9aa4cf` | textos secundarios |
| `--red` | `#cf2236` | `#ff7b87` | acordes, `+`, botón principal |
| `--redsoft` | `#fde8ea` | `#3a1d27` | hover y marcados |
| `--edge` | `#c9d2e6` | `#2c3758` | bordes |

El tema sigue `prefers-color-scheme`; no hay selector de tema.

### 8.2 Tipografía

- **Acordes y título:** Kalam 700. Acordes 19 px; título `clamp(28px, 4.5vw, 44px)`.
- **Letra y resto:** Atkinson Hyperlegible 400/700. Letra `clamp(18px, 2.2vw, 21px)`; interfaz 16–17 px; nada por debajo de 13 px.

### 8.3 Hoja

- Fondo `--paper` con cuadrícula de 22 px dibujada con dos `linear-gradient`.
- Línea de margen roja vertical (rojo al 35 %) a `clamp(20px, 3vw, 38px)` del borde izquierdo.
- Relleno: `16px clamp(14px,3vw,32px) 24px clamp(30px,4.5vw,54px)`; en móvil `12px 10px 18px 28px`.
- Bordes redondeados `4px 14px 14px 4px` (lado de la espiral recto).

### 8.4 Controles

- Botones de al menos 40 px de alto (44 px en el popover), radio 9 px, borde `--edge`; hover con borde `--ink`; foco con contorno de 3 px rojo al 55 %.
- Botón principal relleno en `--red` con texto blanco.
- Ancho máximo del contenido 1040 px. Sin scroll horizontal a 360 px.

---

## 9. Exportación a PDF

Generado en el navegador con jsPDF, en puntos, tamaño **A4 vertical**, **fondo blanco** y sin cuadrícula. Descarga directa como `<slug>.pdf`. La referencia visual es [`docs/pdf-ejemplo.png`](docs/pdf-ejemplo.png).

### 9.1 Medidas y colores

- Márgenes: izquierdo 86, derecho 64, superior 64, inferior 72.
- Colores RGB: rojo `190,30,48`; tinta `28,28,34`; gris `140,140,150`; línea `225,205,208`; relleno de pastilla `253,242,243`.
- Fuentes estándar de jsPDF (sin incrustar): **Times** para título, letra y pie; **Helvetica** para acordes y datos.

### 9.2 Cabecera

1. **Estrella roja** de 5 puntas (radio 8, radio interior 42 %), rellena, a la izquierda del título.
2. **Título** en Times negrita cursiva 30 pt, a 24 pt de la estrella. Si no cabe, se parte en varias líneas (interlineado 32).
3. **Doble línea:** un tramo rojo de 56 pt (grosor 1,2) y, seguido, una línea fina de color línea hasta el margen derecho (grosor 0,6).
4. **Fila de datos** a 9,5 pt: «Tono» en gris + el tono en Helvetica negrita roja; después «Acordes» en gris + cada acorde distinto usado, en orden de aparición, dentro de una **pastilla** redondeada (alto 15, radio 7, borde color línea, relleno rosado, texto Helvetica negrita 9 pt rojo). Si no caben, siguen en la línea de abajo.

### 9.3 Cuerpo

- Letra en Times 14 pt; acordes en Helvetica negrita 11 pt rojo, encima de la palabra, alineados a su inicio.
- Altura de fila: 15 (solo si la fila tiene algún acorde) + 19 + 6 de separación. Separación entre palabras 5,5 pt. El ancho de cada palabra es el mayor entre la palabra y el acorde + 3.
- Las líneas largas se parten respetando los bloques palabra + acorde.
- Si hay más de una estrofa, cada una lleva su **número en Times cursiva 13 pt rojo** en el margen izquierdo, alineado con la primera línea de letra, y una **línea vertical fina** de color línea que abarca la estrofa.
- Separación entre estrofas 22 pt.
- **Una estrofa no se parte entre páginas** si cabe entera en una página; si no cabe en ninguna, se parte por filas.

### 9.4 Pie (en todas las páginas)

Línea fina a 46 pt del borde inferior; debajo, el título en Times cursiva 9,5 pt gris a la izquierda y, si hay más de una página, «1 / 2» en Helvetica 9 pt gris a la derecha.

### 9.5 Caracteres

Las fuentes estándar de jsPDF cubren el español (á é í ó ú ü ñ ¿ ¡). Un carácter fuera de Latin‑1 (emoji, comillas tipográficas raras) se sustituye por `?` sin fallar; el test lo comprueba.

---

## 10. Accesibilidad

- Todo se puede hacer con teclado: navegar palabras, abrir el selector, elegir, quitar, seleccionar en bloque (Intro / Espacio marcan, Mayús amplía el tramo).
- Foco siempre visible. Objetivos táctiles de al menos 44 px en el popover.
- Contraste AA en ambos temas.
- `aria-live="polite"` en los avisos y en el indicador de guardado.
- Respeta `prefers-reduced-motion`.

---

## 11. Pruebas

### 11.1 Unitarias (obligatorias, `npm test`)

- `chords`: tabla de 4.4, nombres ES/EN (mayor con `M` en ES), transporte con vuelta (SI + 1 = DO).
- `chordpro`: ida y vuelta exacta; lectura de un archivo de otra app con directivas desconocidas, `{t:}`, acordes a mitad de palabra y acordes inválidos.
- `stanzas`: detección con varias líneas en blanco seguidas; copiar a todas con líneas más cortas y sin sobrescribir.
- `suggest`: con un acorde anterior LAm en tono LAm, la primera sugerencia es MI7; con historial propio, gana lo observado sobre la teoría.
- `slug`: tildes, eñes, símbolos, vacío, duplicados, longitud.
- `storage`: crear, leer, actualizar, conflicto 409, renombrar, papelera, rechazo de `../` y de slugs inválidos, escritura atómica (no queda `.tmp`).

### 11.2 En navegador (opcional, Playwright)

- Poner un acorde con el `+`, con el teclado y escribiéndolo.
- Mayús + clic sin modo activo marca un tramo; arrastrar marca un tramo de dos líneas.
- Editar letra añadiendo una estrofa y comprobar las etiquetas «Estrofa N».
- Recargar la página y comprobar que todo sigue (se guardó en disco).
- Descargar el PDF y comprobar que tiene el número de páginas esperado.

---

## 12. Criterios de aceptación

La versión 1 está terminada cuando:

1. `npm start` arranca sin instalar nada y abre en `http://127.0.0.1:5173`.
2. Una canción creada en la web aparece como `canciones/<slug>.chordpro` legible en un editor de texto.
3. Un `.chordpro` copiado a mano en la carpeta aparece en la biblioteca al recargar.
4. Cerrar el navegador y volver a abrir conserva todo.
5. Todo lo descrito en la sección 7 funciona como en el prototipo.
6. El PDF coincide con `docs/pdf-ejemplo.png` en estructura y estilo.
7. Funciona sin internet (desconectar la red y probar los puntos 1–6).
8. `npm test` pasa en verde.
9. No hay scroll horizontal a 360 px de ancho.

---

## 13. Orden de trabajo sugerido

1. `shared/chords.js`, `shared/chordpro.js`, `shared/stanzas.js` con sus tests.
2. Servidor: estáticos, `slug.js`, `storage.js`, API y tests.
3. Biblioteca.
4. Editor: hoja, popover, sugerencias, deshacer.
5. Selección múltiple, editor de letra con etiquetas, copiar a todas.
6. PDF.
7. Repaso de accesibilidad, móvil y modo oscuro.

---

## 14. Derechos de autor de las letras

El repositorio **no debe incluir letras con derechos de autor**. La carpeta `canciones/` está en `.gitignore` excepto `ejemplo-noche-de-paz.chordpro`, que usa la traducción de Federico Fliedner (siglo XIX, dominio público). Cada usuario guarda sus letras en su propia carpeta local.
