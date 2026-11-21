// Diseño del PDF de una canción (SPEC.md §9).
// Dos pasos: planearPdf() calcula todo como lista de dibujos (puro, con tests);
// dibujarPdf() los pinta con jsPDF en el navegador.
// ajustarPdf() busca la letra y el espacio entre líneas que dejan la canción en una página.
import { formatChord, formatKey, clave } from './chords.js';

// Puntos. A4 vertical. Márgenes: izq 56, der 40, sup 36, inf 60.
const ANCHO = 595.28;
const ALTO = 841.89;
const X0 = 56;
const X1 = ANCHO - 40;
const ARRIBA = 36;
const FONDO = ALTO - 60;          // límite inferior del cuerpo
const PIE_Y = ALTO - 46;          // línea del pie
const ANCHO_FILA = X1 - X0;
const ESPACIO = 5.5;              // entre palabras (escala con la letra)
const GAP_ESTROFA = 22;           // entre estrofas (escala con el espacio entre líneas)
const PAD_FILA = 6;               // entre filas (escala con el espacio entre líneas)
const GUTTER = 34;                // entre columnas

const ROJO = [190, 30, 48];
const TINTA = [28, 28, 34];
const GRIS = [140, 140, 150];
const LINEA = [225, 205, 208];
const RELLENO = [253, 242, 243];

// Fuentes: [familia, estilo, tamaño base]. La letra y los acordes escalan con «letra».
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

// Fuente con la letra escalada.
const escalar = (f, s) => [f[0], f[1], f[2] * s];

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

// Cabecera de la primera página (tamaño fijo). Devuelve la y donde empieza el cuerpo.
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
  x = escribir(pag, latin1(formatKey(cancion.key, 'es')), x, yD, F_TONO, ROJO, medir);

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

// Filas de una estrofa, con la letra escalada por `s` y el espacio por `p`.
// Cada fila es una lista de bloques palabra + acorde, con x relativa a la columna.
function filasDeEstrofa(lineas, medir, s, p, anchoCol) {
  const fLetra = escalar(F_LETRA, s);
  const fAcorde = escalar(F_ACORDE, s);
  const filas = [];
  for (const linea of lineas) {
    const bloques = linea.map((pt) => {
      const acorde = pt.chord ? latin1(formatChord(pt.chord, 'es')) : null;
      const palabra = latin1(pt.text);
      const ancho = Math.max(medir(palabra, fLetra), acorde ? medir(acorde, fAcorde) + 3 * s : 0);
      return { palabra, acorde, ancho };
    });
    let fila = [];
    let ancho = 0;
    for (const b of bloques) {
      if (fila.length && ancho + ESPACIO * s + b.ancho > anchoCol) {
        filas.push(fila);
        fila = [];
        ancho = 0;
      }
      ancho += (fila.length ? ESPACIO * s : 0) + b.ancho;
      fila.push(b);
    }
    if (fila.length) filas.push(fila);
  }
  return filas.map((bloques) => {
    const conAcorde = bloques.some((b) => b.acorde);
    let x = 0;
    const pos = bloques.map((b) => {
      const pb = { ...b, x };
      x += b.ancho + ESPACIO * s;
      return pb;
    });
    return { bloques: pos, conAcorde, alto: (conAcorde ? 15 * s : 0) + 19 * s + PAD_FILA * p, s };
  });
}

// Dibuja una fila en la página. `top` es la y de la fila; `x0` la de la columna.
function colocarFila(pag, fila, top, x0) {
  const s = fila.s;
  const base = top + (fila.conAcorde ? 15 * s : 0) + 14 * s;     // línea de letra
  for (const b of fila.bloques) {
    pag.push(texto(b.palabra, x0 + b.x, base, escalar(F_LETRA, s), TINTA));
    if (b.acorde) pag.push(texto(b.acorde, x0 + b.x, top + 11 * s, escalar(F_ACORDE, s), ROJO));
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
// opciones: { letra, espacio, columnas } (todas 1 por defecto).
//   letra: escala de letra y acordes. espacio: escala del espacio entre líneas y estrofas.
//   columnas: 1 o 2 para las estrofas. La cabecera siempre ocupa todo el ancho.
// Devuelve un array de páginas; cada página, una lista de dibujos.
export function planearPdf(cancion, medir, { letra = 1, espacio = 1, columnas = 1 } = {}) {
  const s = letra;
  const p = espacio;
  const colW = (ANCHO_FILA - GUTTER * (columnas - 1)) / columnas;
  const paginas = [[]];
  let pag = paginas[0];
  const multi = cancion.stanzas.length > 1;

  let y = cabecera(pag, cancion, medir);
  let colTop = y;                                       // y donde empiezan las columnas en esta página
  let col = 0;
  const x0 = () => X0 + col * (colW + GUTTER);
  // Pasa a la siguiente columna; si no hay, a una página nueva.
  const siguiente = () => {
    if (col < columnas - 1) { col++; y = colTop; return; }
    pag = [];
    paginas.push(pag);
    col = 0;
    colTop = ARRIBA;
    y = ARRIBA;
  };

  cancion.stanzas.forEach((estrofa, ei) => {
    const filas = filasDeEstrofa(estrofa.lines, medir, s, p, colW);
    if (!filas.length) return;
    const alto = filas.reduce((t, f) => t + f.alto, 0);

    if (ei > 0) y += (GAP_ESTROFA - PAD_FILA) * p;      // la fila ya aporta su PAD
    // Una estrofa que cabe entera en una columna o página nueva no se parte.
    if (y + alto > FONDO && alto <= FONDO - colTop) siguiente();

    let inicio = y;
    let numero = multi;                                 // el número va solo en la primera fila
    const cerrar = (fin) => {
      if (multi) pag.push(linea(x0() - 12, inicio, x0() - 12, fin, 0.6, LINEA));
    };
    for (const fila of filas) {
      if (y + fila.alto > FONDO) {
        cerrar(y);
        siguiente();
        inicio = y;
      }
      colocarFila(pag, fila, y, x0());
      if (numero) {
        pag.push(texto(String(ei + 1), x0() - 26, y + (fila.conAcorde ? 15 * s : 0) + 14 * s, F_NUMERO, ROJO));
        numero = false;
      }
      y += fila.alto;
    }
    cerrar(y);
  });

  paginas.forEach((pg, i) => pie(pg, cancion.title, i + 1, paginas.length, medir));
  return paginas;
}

// Mayor valor en [lo,hi] que cumple ok(); si ni lo cumple, devuelve lo.
function mayorQueCabe(ok, lo, hi) {
  if (ok(hi)) return hi;
  if (!ok(lo)) return lo;
  for (let i = 0; i < 12; i++) {
    const m = (lo + hi) / 2;
    if (ok(m)) lo = m; else hi = m;
  }
  return lo;
}

// Ajusta la canción a una página.
//   'letra':   el espacio queda en 100 % y la letra crece lo que quepa; si no cabe, el espacio baja a 75 %.
//   'espacio': la letra queda en 100 % y el espacio crece hasta 200 %; si no cabe, la letra baja.
//   'normal':  tamaño de siempre, sin ajustar (puede ocupar varias páginas).
// Devuelve { opciones, paginas }.
export function ajustarPdf(cancion, medir, prioridad = 'letra', columnas = 1) {
  if (prioridad === 'normal') {
    const opciones = { letra: 1, espacio: 1, columnas };
    return { opciones, paginas: planearPdf(cancion, medir, opciones) };
  }
  const cabe = (letra, espacio) =>
    planearPdf(cancion, medir, { letra, espacio, columnas }).length === 1;
  let letra;
  let espacio;
  if (prioridad === 'espacio') {
    espacio = mayorQueCabe((e) => cabe(1, e), 0.75, 2);
    letra = mayorQueCabe((l) => cabe(l, espacio), 0.5, 1);
  } else {
    letra = mayorQueCabe((l) => cabe(l, 1), 0.5, 1.6);
    espacio = cabe(letra, 1) ? 1 : 0.75;
    if (espacio !== 1) letra = mayorQueCabe((l) => cabe(l, espacio), 0.5, 1.6);
  }
  const opciones = { letra, espacio, columnas };
  return { opciones, paginas: planearPdf(cancion, medir, opciones) };
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

// Punto de entrada del navegador: ajusta la canción y rellena un jsPDF con ella.
// Devuelve { doc, opciones, paginas } para que la vista previa muestre lo que se eligió.
export function construirPdf(doc, cancion, { prioridad = 'letra', columnas = 1 } = {}) {
  const { opciones, paginas } = ajustarPdf(cancion, medidorJsPdf(doc), prioridad, columnas);
  dibujarPdf(doc, paginas);
  return { doc, opciones, paginas: paginas.length };
}
