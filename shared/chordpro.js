// Archivo ChordPro <-> modelo de canción. Ver SPEC.md §3.1 y §4.
// Modelo: { title, key: {r, m}, stanzas: [ { lines: [ [ {text, chord} ] ] } ] }
// Lo usan: server/storage.js (listado y guardado), public/js/editor.js, tests.
import { parseChord, formatChord, formatKey } from './chords.js';

const DIRECTIVA = /^\{\s*([a-zA-Z_]+)\s*(?::\s*(.*?))?\s*\}$/;
const ACORDE_EN_LINEA = /\[([^\]]*)\]/;

export function esMenor(q) {
  return q.startsWith('m') && !q.startsWith('maj');
}

// Tono por defecto: el primer acorde de la canción; si no hay, LAm.
export function tonoDeAcordes(stanzas) {
  for (const e of stanzas) for (const l of e.lines) for (const p of l) {
    if (p.chord) return { r: p.chord.r, m: esMenor(p.chord.q) ? 'minor' : 'major' };
  }
  return { r: 9, m: 'minor' };
}

export function serialize(song) {
  const out = [`{title: ${song.title}}`, `{key: ${formatKey(song.key, 'en')}}`, ''];
  song.stanzas.forEach((estrofa, i) => {
    if (i > 0) out.push('');
    out.push('{start_of_verse}');
    for (const linea of estrofa.lines) {
      out.push(linea.map(({ text, chord }) =>
        (chord ? `[${formatChord(chord, 'en')}]` : '') + text
      ).join(' '));
    }
    out.push('{end_of_verse}');
  });
  return out.join('\n') + '\n';
}

// Lee un archivo ChordPro. Tolera directivas desconocidas (se ignoran).
export function parse(texto, nombreArchivo = 'cancion') {
  let title = null;
  let keyTxt = null;
  const stanzas = [];
  let lineas = [];

  const cerrarEstrofa = () => {
    if (lineas.length) stanzas.push({ lines: lineas });
    lineas = [];
  };

  for (const crudo of String(texto).replace(/\r\n?/g, '\n').split('\n')) {
    const linea = crudo.trim();
    if (linea === '') { cerrarEstrofa(); continue; }

    const dir = DIRECTIVA.exec(linea);
    if (dir) {
      const nombre = dir[1].toLowerCase();
      if (nombre === 'title' || nombre === 't') title = dir[2] ?? '';
      else if (nombre === 'key' || nombre === 'k') keyTxt = dir[2] ?? '';
      else if (nombre.startsWith('end_of_')) cerrarEstrofa();
      continue; // start_of_* y otras directivas: se ignoran
    }

    const palabras = lineaAPalabras(linea);
    if (palabras.length) lineas.push(palabras);
    else console.warn(`Línea sin palabras descartada: "${linea}"`);
  }
  cerrarEstrofa();

  const c = keyTxt ? parseChord(keyTxt) : null;
  const tono = c
    ? { r: c.r, m: esMenor(c.q) ? 'minor' : 'major' }
    : tonoDeAcordes(stanzas);

  return { title: title || nombreArchivo, key: tono, stanzas };
}

// "[Am]Noche de [E7]paz" -> [{text:'Noche', chord}, {text:'de'}, {text:'paz', chord}]
export function lineaAPalabras(linea) {
  const palabras = [];
  let pendiente = null;   // acorde que espera a la siguiente palabra
  let actual = null;      // palabra en construcción (sin espacio tras ella)
  let resto = linea;

  while (resto.length) {
    const m = ACORDE_EN_LINEA.exec(resto);
    const trozo = m ? resto.slice(0, m.index) : resto;
    resto = m ? resto.slice(m.index + m[0].length) : '';

    for (const ch of trozo) {
      if (/\s/.test(ch)) { actual = null; continue; }
      if (!actual) {
        actual = { text: '', chord: pendiente };
        pendiente = null;
        palabras.push(actual);
      }
      actual.text += ch;
    }

    if (m) {
      const c = parseChord(m[1]);
      if (!c) { console.warn(`Acorde no reconocido descartado: [${m[1]}]`); continue; }
      if (actual) {
        // Acorde en medio de una palabra: se asigna a esa palabra (SPEC §4).
        console.warn(`Acorde [${m[1]}] a mitad de palabra "${actual.text}": se asigna a la palabra.`);
        actual.chord ??= c; // la palabra sigue: "can" + "tando" queda como una sola
      } else {
        pendiente = c;
      }
    }
  }
  if (pendiente) console.warn('Acorde al final de línea sin palabra: descartado.');
  return palabras;
}
