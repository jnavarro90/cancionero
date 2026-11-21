// Modelo de acorde: { r: 0..11, q: calidad }. Ver SPEC.md §3.2 y §3.4.

export const NOMBRES_ES = ['DO', 'DO#', 'RE', 'MIb', 'MI', 'FA', 'FA#', 'SOL', 'LAb', 'LA', 'SIb', 'SI'];
export const NOMBRES_EN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const RAIZ_ES = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
const RAIZ_EN = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

const CALIDAD_ALIAS = {
  '': '', m: 'm', M: '', maj: '', may: '', mayor: '',
  min: 'm', menor: 'm', '-': 'm', M7: 'maj7', maj7: 'maj7',
};

// Devuelve { r, q } o null si no se reconoce.
export function parseChord(entrada) {
  const s = String(entrada ?? '').replace(/\s+/g, '');
  if (!s) return null;
  const m = /^(sol|do|re|mi|fa|la|si|[a-g])(.*)$/i.exec(s);
  if (!m) return null;
  const raizTxt = m[1].toLowerCase();
  let r = raizTxt.length > 1 ? RAIZ_ES[raizTxt] : RAIZ_EN[raizTxt];
  let resto = m[2];
  if (r === undefined) return null;
  if (resto[0] === '#') { r = (r + 1) % 12; resto = resto.slice(1); }
  else if (resto[0] === 'b') { r = (r + 11) % 12; resto = resto.slice(1); }

  let q;
  if (Object.prototype.hasOwnProperty.call(CALIDAD_ALIAS, resto)) {
    q = CALIDAD_ALIAS[resto];
  } else if (resto[0] === 'm') {
    q = 'm' + resto.slice(1).toLowerCase();
  } else {
    q = resto.toLowerCase();
  }
  if (!/^[a-z0-9#+()/º°ø-]{0,8}$/.test(q)) return null;
  return { r, q };
}

// Texto para mostrar. notacion: 'es' (LAM, LAm, MI7) o 'en' (A, Am, E7).
export function formatChord(c, notacion = 'es') {
  if (!c) return '';
  if (notacion === 'en') return NOMBRES_EN[c.r] + c.q;
  // En español el mayor se escribe con M para distinguirlo del menor.
  const sufijo = c.q === '' ? 'M' : c.q;
  return NOMBRES_ES[c.r] + sufijo;
}

// Tono: { r, m: 'major' | 'minor' }. Se muestra como LAm o DO.
export function formatKey(key, notacion = 'es') {
  const menor = key.m === 'minor';
  if (notacion === 'en') return NOMBRES_EN[key.r] + (menor ? 'm' : '');
  return NOMBRES_ES[key.r] + (menor ? 'm' : '');
}

export function transportar(c, n) {
  return { r: (c.r + n + 12) % 12, q: c.q };
}

export function mismoAcorde(a, b) {
  return !!a && !!b && a.r === b.r && a.q === b.q;
}

export function clave(c) {
  return c ? `${c.r}|${c.q}` : '';
}
