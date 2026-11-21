# Cancionero local: especificación (v1.1)

Versión 1.1 · noviembre 2026. Recorta la v1.0 tras la revisión con la profesora.

Web local de un solo usuario. La profesora escribe la letra, pone los acordes encima de las palabras y exporta a PDF. Los alumnos solo leen la hoja o el PDF. Sin base de datos, sin cuentas, sin internet.

Donde este documento y `docs/prototipo.html` no coincidan, manda este documento.

---

## 1. Alcance

### 1.1 Qué hace la versión 1

1. Biblioteca con las canciones de una carpeta.
2. Crear, cambiar el título, duplicar y borrar (a la papelera) canciones.
3. Editar la letra. Las estrofas se separan con una línea en blanco.
4. Poner, cambiar y quitar un acorde sobre una palabra, con sugerencias.
5. Copiar los acordes de la primera estrofa a las demás.
6. Subir o bajar el tono de toda la canción (acordes y tono a la vez).
7. Exportar a PDF.
8. Deshacer un paso (botón y Ctrl/Cmd + Z).
9. Seleccionar acordes y borrarlos varios a la vez.

### 1.2 Fuera de la versión 1

Esta lista manda. Cualquier cosa que aparezca aquí no se construye aunque el prototipo la tenga.

- Copiar la letra con acordes como texto.
- Importar archivos `.chordpro`, `.cho` o `.txt`.
- Cambiar la notación de pantalla (LAm / Am). La pantalla usa siempre notación española.
- Historial de deshacer de 80 pasos y rehacer.
- Renombrar el archivo desde la biblioteca. El nombre de archivo (slug) se fija al crear la canción.
- Edición de archivos a mano desde fuera de la web.
- Acordes sobre sílabas, partituras, audio, cuentas de usuario y nube.

---

## 2. Tecnología

Sin cambios respecto a la especificación anterior, salvo lo indicado:

| Parte | Elección |
|---|---|
| Servidor | Node.js ≥ 20 con `node:http`, sin dependencias |
| Frontend | HTML, CSS y JavaScript con módulos ES, sin framework ni compilación |
| PDF | jsPDF 2.5.1 en `public/vendor/` |
| Tipografías | Kalam y Atkinson Hyperlegible en `public/fonts/` |
| Tests | `node:test` y `node:assert` |

Arranque: `npm start` (http://127.0.0.1:5173). `PORT` y `CANCIONES_DIR` como antes. El servidor escucha solo en `127.0.0.1`.

---

## 3. Datos

### 3.1 Canción

Cada canción es un archivo `canciones/<slug>.chordpro`, UTF-8, finales de línea `\n`.

**Decisión de este borrador: los acordes van unidos a su palabra, no a una posición.** El modelo anterior usaba `línea:palabra`, y al añadir una línea en blanco los acordes se desplazaban a palabras equivocadas sin avisar. Ahora cada palabra es un objeto y puede llevar un acorde:

```js
{
  slug: "noche-de-paz",
  title: "Noche de paz",
  key: { r: 9, m: "minor" },            // tono actual; cambia con el control de tono
  stanzas: [                            // lista de estrofas
    { words: [                          // lista de palabras de la estrofa
      { text: "Noche", chord: { r: 9, q: "m" } },  // chord: null si no tiene
      { text: "de", chord: null },
      // ...
    ] },
  ],
  updatedAt: "2026-11-21T10:48:33.000Z"
}
```

- **Estrofa:** un bloque de líneas separadas de otros por líneas en blanco. Se guarda como una lista de palabras, con el salto de línea marcado.
- **Editar la letra:** el texto nuevo se compara con el anterior palabra a palabra (alineación tipo `diff`). Una palabra que se mantiene conserva su acorde. Una palabra nueva entra sin acorde. Una palabra borrada pierde su acorde, y el aviso lo dice: «Se han quitado N acordes porque sus palabras ya no están».

### 3.2 Acorde

```js
{ r: 9, q: "m" }   // r = raíz 0..11 (0 = DO). q = calidad: "", "m", "7", "m7", "maj7", "sus4", ...
```

- Máximo 8 caracteres en `q`, solo `[a-z0-9#+()/º°ø-]`.
- Raíces: DO=0, DO#=1, RE=2, MIb=3, MI=4, FA=5, FA#=6, SOL=7, LAb=8, LA=9, SIb=10, SI=11.

### 3.3 Nombres en pantalla y en archivo

- **Pantalla:** siempre notación española. Mayor con `M`: `LAM`, `LAm`, `MI7`, `REm7`, `SIbmaj7`.
- **Archivo:** siempre notación inglesa (`C`, `Am`, `E7`), para que otras apps de ChordPro lo lean.

### 3.4 Lectura de lo que escribe la profesora

Entrada libre para un acorde, sin distinguir mayúsculas en la raíz:

- Raíz ES (`do re mi fa sol la si`, probando `sol` antes que las de dos letras) o EN (`a`–`g`).
- Alteración opcional: `#` o `b`.
- Calidad: vacío o `M` = mayor; `m`, `min`, `-` = menor; `M7` = maj7; resto tal cual.
- Si no se reconoce: se marca en rojo con «No reconozco ese acorde».

Casos de prueba: `LAM` → mayor, `LAm` → `m`, `la7` → `7`, `SOLm7` → `m7`, `Fa#m` → `m`, `SIbM7` → `maj7`, `REsus4` → `sus4`, `xx`, `H7` y vacío → inválido.

### 3.5 Tono y transporte

Un único control de tono. Al cambiarlo, se suman `n` semitonos (±1) a la raíz de todos los acordes y a la del tono, módulo 12. Se puede deshacer. La cabecera del archivo guarda el tono resultante.

Decisión de este borrador: no hay un selector de tono separado que solo cambie la etiqueta. El tono y los acordes siempre cambian juntos.

---

## 4. Archivo ChordPro

Cabecera: `{title: …}` y `{key: …}`, con la raíz en inglés y `m` si es menor. Después, cada estrofa entre `{start_of_verse}` y `{end_of_verse}`, separadas por una línea en blanco. Cada acorde se escribe como `[Am]` justo antes de su palabra.

```
{title: Noche de paz}
{key: Am}

{start_of_verse}
[Am]Noche de paz, [E7]noche de amor,
[Am]todo duerme en [E7]derredor.
{end_of_verse}
```

- `serialize` y `parse` deben ser inversos: `parse(serialize(c))` da la misma canción (test obligatorio).
- Al leer un archivo de otra app: las directivas desconocidas se ignoran y no se guardan. Un acorde que no se puede leer se descarta con `console.warn`. Un acorde a mitad de palabra (`can[Am]tando`) se asigna a esa palabra.
- Si no hay `title`, se usa el nombre del archivo. Si no hay `key`, se usa el primer acorde, o `LAm` si no hay ninguno.

---

## 5. Almacenamiento

- **Slug:** el título sin tildes, en minúsculas, con guiones. Máximo 60 caracteres. Si queda vacío, `cancion`. Si ya existe, `-2`, `-3`…
- **El slug no cambia nunca.** Cambiar el título solo cambia el título dentro de la canción.
- **Escritura atómica:** escribir `<slug>.chordpro.tmp` y luego `rename`.
- **Conflictos:** cada lectura devuelve `updatedAt`. Cada guardado envía `If-Unmodified-Since` en formato HTTP (fecha GMT). Si el archivo cambió desde entonces, responder 409 con la versión del disco. La web muestra un único aviso: «Esta canción se cambió fuera de aquí. [Cargar la del disco] [Guardar la mía]».
- **Borrar:** el archivo se mueve a `canciones/.papelera/<slug>-<fecha>.chordpro`. La papelera se conserva porque es la única forma de recuperar un archivo borrado. Para restaurar, copiar el archivo de vuelta a `canciones/` y quitar la fecha del nombre. Esto se documenta en el README.
- Tamaño máximo 200 KB por canción (413 si se supera).

---

## 6. API local

Respuestas JSON en UTF-8. Errores: `{ "error": "mensaje en español" }`.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/info` | — | `200 { dir }` |
| GET | `/api/canciones` | — | `200 [{ slug, title, key, chordCount, updatedAt }]`, más recientes primero |
| GET | `/api/canciones/:slug` | — | `200 { slug, chordpro, updatedAt }` · `404` |
| POST | `/api/canciones` | `{ title }` | `201 { slug, updatedAt }` |
| PUT | `/api/canciones/:slug` | `{ chordpro }` + `If-Unmodified-Since` | `200 { updatedAt }` · `409 { error, chordpro, updatedAt }` · `404` |
| POST | `/api/canciones/:slug/duplicar` | `{ title }` | `201 { slug, updatedAt }` |
| DELETE | `/api/canciones/:slug` | — | `204` (a la papelera) |

- El servidor guarda el texto ChordPro tal cual. Solo lee `title` y `key`, y cuenta los acordes para el listado.
- Solo se sirven `public/` y `shared/`. Comprobar la ruta con `path.resolve`.
- Validar `Host` (`127.0.0.1:<puerto>` o `localhost:<puerto>`) y, en peticiones que cambian datos, `Origin` si viene.

---

## 7. Pantallas

Todo el texto en español. Nada de `alert`, `confirm` ni `prompt`: los avisos van en una píldora y los diálogos son propios.

### 7.1 Biblioteca (`/`)

- Título «Cancionero» y botón **«Nueva canción»** (el único botón principal de la pantalla).
- Buscador por título.
- Lista: título, tono, número de acordes y «editada hace 5 min». Clic → editor.
- Por canción, un menú `⋯` con **Duplicar** y **Borrar**. Borrar pide confirmación en un diálogo propio con el texto «Se moverá a la papelera».
- Lista vacía: «Aún no hay canciones» y el botón Nueva canción.
- Pie: la ruta de la carpeta de canciones.

### 7.2 Editor (`/cancion.html?c=<slug>`)

La pantalla tiene dos modos. El cambio entre ellos es explícito, con una sola acción visible en cada modo.

**Modo acordes (por defecto).** Muestra la hoja. Botones:

- **«← Canciones»**
- **«Editar letra»**, que pasa al modo letra
- **Tono:** `−` y `+` alrededor del tono actual (por ejemplo `LAm`). Cada clic baja o sube un semitono.
- **«Copiar acordes a todas las estrofas»**, con el tooltip «Copia los acordes de la primera estrofa a las demás, en la misma palabra».
- **Deshacer** (también con Ctrl/Cmd + Z)
- **«Seleccionar para borrar»**, que activa el modo selección
- **«Descargar PDF»** (botón rojo, el principal)

**Modo selección.** Una barra oscura sustituye a la del tono con: «Marcar todos», «Desmarcar», **«Borrar N acordes»** (rojo, desactivado si no hay ninguno marcado) y «Terminar». Un clic en una palabra con acorde la marca o desmarca. Mayús + clic marca el tramo desde la última palabra marcada. Las palabras sin acorde no se marcan. Borrar quita los acordes marcados en un solo paso, que se puede deshacer. Salir del modo no borra nada, y las marcas se pierden.

**Modo letra.** Cuadro de texto grande. Un único botón visible: **«Listo»** (rojo). Al pulsarlo se guarda y se vuelve a la hoja. Los acordes se recolocan según 3.1. Hay un aviso con el número de estrofas.

**Pie:** «N acordes · tono LAm» o «Aún no hay acordes».

**Indicador de guardado:** «Guardado», «Guardando…» o «Sin guardar · reintentando» (rojo). El guardado es automático 800 ms después del último cambio y al salir de la página. Si hay cambios sin guardar, `beforeunload` avisa.

**Título:** editable en línea en la cabecera. Cambiarlo no cambia el nombre de archivo.

### 7.3 Hoja

- Cada estrofa empieza con una etiqueta pequeña «Estrofa 1», «Estrofa 2»… en gris.
- Cada palabra es un bloque: **acorde arriba, palabra abajo**. Todas las palabras reservan el hueco del acorde, aunque no lo tengan, para que las líneas no salten.
- Pasar el ratón por una palabra sin acorde muestra un **+** rojo en el hueco. Clic, Intro o Espacio abren el selector.
- En pantallas táctiles, el **+** está siempre visible con opacidad baja.
- Teclado: ← → cambian de palabra. Supr o Retroceso quita el acorde de la palabra con foco.

### 7.4 Selector de acorde (popover)

Se abre debajo de la palabra. Contenido, de arriba abajo:

1. Título: «Acorde sobre «palabra»».
2. **Sugerencias:** hasta 8 botones numerados 1–8. El primero lleva borde rojo grueso.
3. Una línea: «Sugerido: MI7, suele ir después de LAm.»
4. Campo **«Otro acorde»** (ejemplo: LAM, SOL7, Fa#m) y botón **Poner**.
5. **«Quitar acorde»**, solo si la palabra ya tiene uno.

Teclado: 1–8 eligen, Intro en el campo pone el acorde, Esc cierra y devuelve el foco a la palabra. Clic fuera cierra.

Se quitan las variantes de la raíz (`LAM LAm LA7…`). El campo libre basta para cualquier otro acorde.

### 7.5 Sugerencias

Función pura `suggest(cancion, palabra)` que devuelve hasta 8 acordes sin repetir, en este orden:

1. Lo que sigue al acorde anterior en esta canción, de más a menos frecuente.
2. Lo que suele seguir al acorde anterior según la teoría (tabla de la especificación anterior, sección 7.5, sin cambios).
3. Los acordes del tono, en orden de grado.

### 7.6 Copiar acordes a todas las estrofas

1. Estrofa origen: la primera con algún acorde.
2. Para cada otra estrofa y cada línea, copiar el acorde a la misma palabra. Si la línea destino es más corta, va a la última palabra.
3. No sobrescribir acordes existentes.
4. Aviso: «12 acordes copiados» o «Las demás estrofas ya tienen acordes». Se puede deshacer.
5. Si hay menos de dos estrofas: «Solo hay una estrofa. Deja una línea en blanco entre estrofas en «Editar letra»».

### 7.7 Deshacer

- Un único paso. Antes de cada acción de edición se guarda una copia de la canción: poner, quitar o cambiar un acorde, cambiar el tono, copiar a todas las estrofas y editar la letra.
- Botón Deshacer y Ctrl/Cmd + Z (fuera de campos de texto). Si no hay nada: «Nada que deshacer».
- Pulsar Deshacer dos veces seguidas no vuelve atrás dos veces: el segundo aviso dice «Nada que deshacer».

### 7.8 Avisos

Píldora oscura abajo en el centro, 1,8 s, `role="status"`.

---

## 8. Diseño visual

Sin cambios respecto a la especificación anterior (sección 8): cuaderno de cuadros, letra en azul, acordes en rojo, tema claro y oscuro según el sistema. Fuentes Kalam (acordes y título) y Atkinson Hyperlegible (letra e interfaz). Mínimo de texto 13 px, interfaz 16 px. Botones de al menos 44 px de alto. Sin scroll horizontal a 360 px.

---

## 9. PDF

Sin cambios respecto a la sección 9 de la especificación anterior: A4 vertical, cabecera con estrella y título, fila de tono y acordes usados, cuerpo con acordes encima de cada palabra, números de estrofa y pie con el título y el número de página. Referencia visual: `docs/pdf-ejemplo.png`.

Caracteres fuera de Latin-1 se sustituyen por `?` sin fallar.

**Una sola página.** La canción ocupa una única hoja A4 con la letra lo más grande posible: se busca la mayor escala (entre 50 % y 160 %) que quepa. Los márgenes son fijos y mínimos (56/40/36/60 pt). La vista previa tiene tres opciones: «Letra grande» (la letra crece lo que quepa, con el espacio entre líneas normal; si no cabe, el espacio baja a 75 %), «Más espacio entre líneas» (la letra queda normal y el espacio crece hasta 200 %; si no cabe, la letra baja) y «Sin ajustar» (tamaño normal, puede ocupar varias páginas). Un segundo selector elige 1 o 2 columnas para las estrofas; la cabecera ocupa siempre todo el ancho y las estrofas pasan a la segunda columna antes de cambiar de página. La vista previa muestra los porcentajes resultantes. Si ni al 50 % cabe, se divide en varias páginas (con número de página) y la vista previa lo indica.

**Vista previa.** «Descargar PDF» abre una vista previa con el selector de prioridad descrito arriba. La fila de acordes, los números de estrofa y el pie se muestran siempre. «Descargar» guarda el PDF de la vista previa.

---

## 10. Accesibilidad

- Todo se puede hacer con teclado.
- Foco visible siempre.
- Contraste AA en ambos temas.
- `aria-live="polite"` en los avisos y en el indicador de guardado.
- Respeta `prefers-reduced-motion`.

---

## 11. Pruebas

Tests unitarios obligatorios (`npm test`):

- `chords`: tabla de 3.4, nombres ES, transporte con vuelta (SI + 1 = DO).
- `chordpro`: ida y vuelta exacta; lectura de un archivo con directivas desconocidas y acordes inválidos.
- `letra`: al editar la letra, los acordes de palabras que se mantienen se conservan; las palabras nuevas entran sin acorde; las borradas avisan.
- `suggest`: con LAm en tono LAm, la primera sugerencia es MI7.
- `slug`: tildes, símbolos, vacío, duplicados, longitud.
- `storage`: crear, leer, actualizar, conflicto 409, papelera, rechazo de `../` y de slugs inválidos, sin `.tmp` al terminar.

Prueba en navegador (opcional, Playwright): poner un acorde con el `+`, copiar a todas las estrofas, subir el tono y recargar para comprobar que se guardó.

---

## 12. Criterios de aceptación

1. `npm start` arranca sin instalar nada y abre en `http://127.0.0.1:5173`.
2. Una canción creada en la web aparece como `canciones/<slug>.chordpro`, legible en un editor de texto.
3. Un `.chordpro` copiado a mano en la carpeta aparece en la biblioteca al recargar.
4. Cerrar y volver a abrir el navegador conserva todo.
5. Poner un acorde, editar la letra añadiendo una línea en blanco y comprobar que los acordes siguen en sus palabras.
6. El PDF coincide con `docs/pdf-ejemplo.png` en estructura y estilo.
7. Funciona sin internet.
8. `npm test` pasa en verde.
9. No hay scroll horizontal a 360 px.
10. Una persona que no conoce la web encuentra cómo poner un acorde en menos de un minuto, sin ayuda. Esto se comprueba con la profesora.

---

## 13. Orden de trabajo

1. `shared/chords.js`, `shared/chordpro.js` y la lógica de letra, con sus tests.
2. Servidor, almacenamiento y API, con tests.
3. Biblioteca.
4. Editor: hoja, selector, sugerencias, tono, deshacer.
5. Copiar a todas las estrofas y modo letra.
6. PDF.
7. Revisión con la profesora en un teléfono y en un portátil.

---

## 14. Derechos de autor

No se incluyen letras con derechos de autor en el repositorio. `canciones/` está en `.gitignore` salvo `ejemplo-noche-de-paz.chordpro` (traducción de Federico Fliedner, dominio público).

---

## Decisiones de la v1.1

1. Los acordes se guardan unidos a su palabra, no por posición. Así se corrige el desplazamiento al editar la letra.
2. Un único control de tono que transporta acordes y tono a la vez.
3. Fuera de la versión 1: copiar como texto, importación, notación de pantalla en inglés, historial de 80 pasos, renombrar archivo y edición de archivos a mano.
4. Se conserva la papelera y se documenta cómo restaurar.
5. El prototipo deja de ser vinculante donde contradiga este documento.
6. Pendiente: si «Duplicar» hace falta de verdad y si la importación de `.txt` vuelve en una versión posterior.
