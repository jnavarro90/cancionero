// Sugerencias de acordes para una palabra. Ver SPEC.md §7.5.
// Función pura: no toca el DOM ni el disco.
import { mismoAcorde, clave, formatChord } from './chords.js';
import { aplanar } from './letra.js';

const GRADOS_MAYOR = [
  { g: '0', d: 0, q: '' }, { g: '5', d: 5, q: '' }, { g: '7', d: 7, q: '' },
  { g: '9m', d: 9, q: 'm' }, { g: '7·7', d: 7, q: '7' }, { g: '2m', d: 2, q: 'm' },
  { g: '4m', d: 4, q: 'm' }, { g: '0·7', d: 0, q: 'maj7' },
];
const GRADOS_MENOR = [
  { g: '0m', d: 0, q: 'm' }, { g: '7·7', d: 7, q: '7' }, { g: '5m', d: 5, q: 'm' },
  { g: '8', d: 8, q: '' }, { g: '3', d: 3, q: '' }, { g: '10', d: 10, q: '' },
  { g: '7m', d: 7, q: 'm' }, { g: '2m7', d: 2, q: 'm7' },
];
// Tabla de siguientes probables (SPEC §7.5). Clave = grado del acorde anterior.
const SIGUIENTES = {
  mayor: {
    '0': ['7', '5', '9m'], '5': ['0', '7', '2m'], '7': ['0', '9m'], '7·7': ['0', '9m'],
    '9m': ['5', '2m', '4m'], '2m': ['7·7', '7'], '4m': ['9m', '5'],
  },
  menor: {
    '0m': ['7·7', '5m', '8'], '5m': ['0m', '7·7'], '7·7': ['0m', '8'], '7m': ['0m', '8'],
    '8': ['5m', '7·7', '3'], '3': ['8', '10'], '10': ['3', '0m'],
  },
};

function gradoDe(c, key) {
  const tabla = key.m === 'minor' ? GRADOS_MENOR : GRADOS_MAYOR;
  const d = (c.r - key.r + 12) % 12;
  return tabla.find((g) => g.d === d && g.q === c.q) ?? null;
}

function acordeDeGrado(g, key) {
  return { r: (key.r + g.d) % 12, q: g.q };
}

export function suggest(estrofas, key, ei, li, wi) {
  const lista = aplanar(estrofas);
  const pos = lista.findIndex((x) => x.e === ei && x.l === li && x.w === wi);
  if (pos < 0) return [];

  // Acorde anterior en orden de lectura.
  let anterior = null;
  for (let k = pos - 1; k >= 0; k--) {
    if (lista[k].ref.chord) { anterior = lista[k].ref.chord; break; }
  }
  const menor = key.m === 'minor';
  const base = anterior ?? { r: key.r, q: menor ? 'm' : '' };

  const resultado = [];
  const vistos = new Set();
  const añadir = (chord, motivo) => {
    const k = clave(chord);
    if (vistos.has(k)) return;
    vistos.add(k);
    resultado.push({ chord, motivo, texto: formatChord(chord, 'es') });
  };

  // 1. Lo que sigue al mismo acorde en esta canción.
  if (anterior) {
    const cuenta = new Map();
    for (let k = 0; k < lista.length; k++) {
      if (!mismoAcorde(lista[k].ref.chord, anterior)) continue;
      const sig = lista.slice(k + 1).find((x) => x.ref.chord);
      if (!sig) continue;
      const c = sig.ref.chord;
      cuenta.set(clave(c), { chord: c, n: (cuenta.get(clave(c))?.n ?? 0) + 1 });
    }
    [...cuenta.values()].sort((a, b) => b.n - a.n).forEach(({ chord }) =>
      añadir(chord, `sigue a ${formatChord(anterior, 'es')} en tu canción`));
  }

  // 2. Teoría: siguientes probables según el grado del acorde anterior.
  const gradoAnt = gradoDe(base, key);
  if (gradoAnt) {
    const tabla = SIGUIENTES[menor ? 'menor' : 'mayor'];
    const defs = menor ? GRADOS_MENOR : GRADOS_MAYOR;
    for (const g of tabla[gradoAnt.g] ?? []) {
      const def = defs.find((x) => x.g === g);
      if (def) añadir(acordeDeGrado(def, key), `suele ir después de ${formatChord(base, 'es')}`);
    }
  }

  // 3. Los que ya usa en la canción, de más a menos frecuentes.
  const usos = new Map();
  for (const x of lista) {
    if (!x.ref.chord) continue;
    const k = clave(x.ref.chord);
    usos.set(k, { chord: x.ref.chord, n: (usos.get(k)?.n ?? 0) + 1 });
  }
  [...usos.values()].sort((a, b) => b.n - a.n).forEach(({ chord }) => añadir(chord, 'ya lo usas'));

  // 4. Los del tono, en orden de la tabla.
  for (const g of menor ? GRADOS_MENOR : GRADOS_MAYOR) {
    añadir(acordeDeGrado(g, key), 'del tono');
  }

  return resultado.slice(0, 8);
}
