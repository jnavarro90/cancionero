// Diseño del PDF de una canción (SPEC.md §9, heredado de la v1.0).
// Dos pasos: planearPdf() calcula todo como lista de dibujos (puro, con tests);
// dibujarPdf() los pinta con jsPDF en el navegador.
import { formatChord, formatKey, clave } from './chords.js';

// Puntos. A4 vertical. Márgenes: izq 86, der 64, sup 64, inf 72.
const ANCHO = 595.28;
const ALTO = 841.89;
const X0 = 86;
const X1 = ANCHO - 64;
const ARRIBA = 64;
const FONDO = ALTO - 72;          // límite inferior del cuerpo
const PIE_Y = ALTO - 46;          // línea del pie
const ANCHO_FILA = X1 - X0;
const ESPACIO = 5.5;              // entre palabras
const GAP_ESTROFA = 22;
const PAD_FILA = 6;

const ROJO = [190, 30, 48];
const TINTA = [28, 28, 34];
const GRIS = [140, 140, 150];
const LINEA = [225, 205, 208];
const RELLENO = [253, 242, 243];

const F_LETRA = ['times', 'normal', 14];
const F_ACORDE = ['helvetica', 'bold', 11];
const F_TITULO = ['times', 'bolditalic', 30];
const F_ETIQUETA = ['helvetica', 'normal', 9.5];
const F_TONO = ['helvetica', 'bold', 9.5];
const F_PASTILLA = ['helvetica', 'bold', 9];
const F_PIE = ['times', 'italic', 9.5];
const F_PAGINA = ['helvetica', 'normal', 9];
const F_NUMERO = ['times', 'italic', 13];

// Fuentes estándar de jsPDF: Latin-1. Cada punto de código fuera se sustituye por «?».
export function latin1(texto) {
  return [...String(texto)].map((c) => (c.codePointAt(0) > 255 ? '?' : c)).join('');
}

// Partir un texto en líneas que caben en `ancho`, por espacios.
function partir(texto, ancho, fuente, medir) {
  const lineas = [];
  let actual = '';
  for (const palabra of latin1(texto).split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && medir(prueba, fuente) > ancho) { lineas.push(actual); actual = palabra; }
    else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [''];
}

// Dibujos como datos: { k: 't' | 'l' | 'r' | 'e', ... }. Ver dibujarOp().
const texto = (s, x, y, f, c) => ({ k: 't', s, x, y, f, c });
const linea = (x1, y1, x2, y2, w, c) => ({ k: 'l', x1, y1, x2, y2, w, c });

// Escribe el texto y devuelve su x final, para encadenar.
function escribir(pag, s, x, y, f, c, medir) {
  pag.push(texto(s, x, y, f, c));
  return x + medir(s, f);
}

// Estrella de 5 puntas (radio 8, interior 42 %), en coordenadas absolutas.
function estrella(cx, cy, R = 8) {
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? R : R * 0.42;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return { k: 'e', pts };
}

// Acordes distintos en orden de aparición, en notación española.
function acordesUsados(cancion) {
  const vistos = new Set();
  const lista = [];
  for (const e of cancion.stanzas) for (const l of e.lines) for (const p of l) {
    if (!p.chord || vistos.has(clave(p.chord))) continue;
    vistos.add(clave(p.chord));
    lista.push(latin1(formatChord(p.chord, 'es')));
  }
  return lista;
}

// Cabecera de la primera página. Devuelve la y donde empieza el cuerpo.
function cabecera(pag, cancion, medir) {
  const xT = X0 + 16 + 24;                                       // 24 pt de la estrella
  const lineasT = partir(cancion.title, X1 - xT, F_TITULO, medir);
  const baseT = ARRIBA + 30;
  pag.push(estrella(X0 + 8, baseT - 10));
  lineasT.forEach((l, i) => pag.push(texto(l, xT, baseT + i * 32, F_TITULO, TINTA)));
  const yReg = baseT + (lineasT.length - 1) * 32 + 12;
  pag.push(linea(X0, yReg, X0 + 56, yReg, 1.2, ROJO));
  pag.push(linea(X0 + 56, yReg, X1, yReg, 0.6, LINEA));

  const yD = yReg + 18;
  let x = escribir(pag, 'Tono', X0, yD, F_ETIQUETA, GRIS, medir) + 6;
  x = escribir(pag, formatKey(cancion.key, 'es'), x, yD, F_TONO, ROJO, medir);

  const usados = acordesUsados(cancion);
  let yUltima = yD;
  if (usados.length) {
    x = escribir(pag, 'Acordes', x + 14, yD, F_ETIQUETA, GRIS, medir) + 6;
    for (const a of usados) {
      const w = medir(a, F_PASTILLA) + 12;
      if (x + w > X1) { x = X0; yUltima += 21; }
      pag.push({ k: 'r', x, y: yUltima - 10.5, w, h: 15, rad: 7, relleno: RELLENO, borde: LINEA });
      pag.push(texto(a, x + 6, yUltima, F_PASTILLA, ROJO));
      x += w + 5;
    }
  }
  return yUltima + 6 + 22;
}

// Filas de una estrofa: cada fila es una lista de bloques palabra + acorde.
function filasDeEstrofa(lineas, medir) {
  const filas = [];
  for (const linea of lineas) {
    const bloques = linea.map((p) => {
      const acorde = p.chord ? latin1(formatChord(p.chord, 'es')) : null;
      const palabra = latin1(p.text);
      const ancho = Math.max(medir(palabra, F_LETRA), acorde ? medir(acorde, F_ACORDE) + 3 : 0);
      return { palabra, acorde, ancho };
    });
    let fila = [];
    let ancho = 0;
    for (const b of bloques) {
      const sep = fila.length ? ESPACIO : 0;
      if (fila.length && ancho + sep + b.ancho > ANCHO_FILA) {
        filas.push(fila);
        fila = [];
        ancho = 0;
      }
      ancho += (fila.length ? ESPACIO : 0) + b.ancho;
      fila.push(b);
    }
    if (fila.length) filas.push(fila);
  }
  return filas.map((bloques) => {
    const conAcorde = bloques.some((b) => b.acorde);
    let x = X0;
    const pos = bloques.map((b) => {
      const p = { ...b, x };
      x += b.ancho + ESPACIO;
      return p;
    });
    return { bloques: pos, conAcorde, alto: (conAcorde ? 15 : 0) + 19 + PAD_FILA };
  });
}

// Dibuja una fila en la página. `top` es la y de la fila.
function colocarFila(pag, fila, top) {
  const base = top + (fila.conAcorde ? 15 : 0) + 14;     // línea de letra
  for (const b of fila.bloques) {
    pag.push(texto(b.palabra, b.x, base, F_LETRA, TINTA));
    if (b.acorde) pag.push(texto(b.acorde, b.x, top + 11, F_ACORDE, ROJO));
  }
}

// Pie de página: línea fina, título a la izquierda y «n / N» si hay varias páginas.
function pie(pag, titulo, numero, total, medir) {
  pag.push(linea(X0, PIE_Y, X1, PIE_Y, 0.6, LINEA));
  pag.push(texto(latin1(titulo), X0, PIE_Y + 14, F_PIE, GRIS));
  if (total > 1) {
    const s = `${numero} / ${total}`;
    pag.push(texto(s, X1 - medir(s, F_PAGINA), PIE_Y + 14, F_PAGINA, GRIS));
  }
}

// Calcula las páginas. medir(texto, [familia, estilo, tamaño]) -> ancho en puntos.
// Devuelve un array de páginas; cada página, una lista de dibujos.
export function planearPdf(cancion, medir) {
  const paginas = [[]];
  let pag = paginas[0];
  const nueva = () => { pag = []; paginas.push(pag); return ARRIBA; };
  const multi = cancion.stanzas.length > 1;

  let y = cabecera(pag, cancion, medir);

  cancion.stanzas.forEach((estrofa, ei) => {
    const filas = filasDeEstrofa(estrofa.lines, medir);
    if (!filas.length) return;
    const alto = filas.reduce((s, f) => s + f.alto, 0);

    if (ei > 0) y += GAP_ESTROFA - PAD_FILA;              // la fila ya aporta 6
    // Una estrofa que cabe entera en una página no se parte.
    if (y + alto > FONDO && alto <= FONDO - ARRIBA) y = nueva();

    let inicio = y;
    let numero = multi;                                   // el número va solo en la primera fila
    const cerrar = (fin) => {
      if (multi) pag.push(linea(X0 - 12, inicio, X0 - 12, fin, 0.6, LINEA));
    };
    for (const fila of filas) {
      if (y + fila.alto > FONDO) {
        cerrar(y);
        y = nueva();
        inicio = y;
      }
      colocarFila(pag, fila, y);
      if (numero) {
        pag.push(texto(String(ei + 1), X0 - 26, y + (fila.conAcorde ? 15 : 0) + 14, F_NUMERO, ROJO));
        numero = false;
      }
      y += fila.alto;
    }
    cerrar(y);
  });

  paginas.forEach((p, i) => pie(p, cancion.title, i + 1, paginas.length, medir));
  return paginas;
}

function dibujarOp(doc, o) {
  if (o.k === 't') {
    doc.setFont(o.f[0], o.f[1]);
    doc.setFontSize(o.f[2]);
    doc.setTextColor(...(o.c ?? TINTA));
    doc.text(o.s, o.x, o.y);
  } else if (o.k === 'l') {
    doc.setDrawColor(...o.c);
    doc.setLineWidth(o.w);
    doc.line(o.x1, o.y1, o.x2, o.y2);
  } else if (o.k === 'r') {
    doc.setFillColor(...o.relleno);
    doc.setDrawColor(...o.borde);
    doc.setLineWidth(0.6);
    doc.roundedRect(o.x, o.y, o.w, o.h, o.rad, o.rad, 'FD');
  } else if (o.k === 'e') {
    const [x0, y0] = o.pts[0];
    const vec = o.pts.slice(1).map(([x, y], i) => [x - o.pts[i][0], y - o.pts[i][1]]);
    doc.setFillColor(...ROJO);
    doc.lines(vec, x0, y0, [1, 1], 'F', true);
  }
}

// Pinta las páginas planeadas en un documento jsPDF (solo navegador).
export function dibujarPdf(doc, paginas) {
  paginas.forEach((ops, i) => {
    if (i > 0) doc.addPage();
    ops.forEach((o) => dibujarOp(doc, o));
  });
}

// Medidor sobre un jsPDF real: usa la fuente que tiene activa el documento.
function medidorJsPdf(doc) {
  return (s, [familia, estilo, tamano]) => {
    doc.setFont(familia, estilo);
    doc.setFontSize(tamano);
    return doc.getTextWidth(s);
  };
}

// Punto de entrada del navegador: rellena un jsPDF con la canción.
export function construirPdf(doc, cancion) {
  dibujarPdf(doc, planearPdf(cancion, medidorJsPdf(doc)));
  return doc;
}
