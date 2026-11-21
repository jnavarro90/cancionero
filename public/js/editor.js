// Editor de una canción: hoja, selector de acorde, tono, copiar, deshacer, modo letra.
// Ver SPEC.md §7.2 a §7.7. Toda la lógica de texto vive en shared/.
import { api } from './api.js';
import { aviso } from './aviso.js';
import { parse, serialize } from '/shared/chordpro.js';
import { formatChord, formatKey, parseChord, transportar } from '/shared/chords.js';
import { reasignar, copiarAcordesATodas, textoDesdeEstrofas, estrofasDesdeTexto } from '/shared/letra.js';
import { suggest } from '/shared/suggest.js';

const $ = (id) => document.getElementById(id);
const hoja = $('hoja');
const estadoEl = $('estado');
const slug = new URLSearchParams(location.search).get('c');

let cancion = null;       // { title, key: {r, m}, stanzas }
let updatedAt = null;     // versión que tenemos en disco
let deshacer = null;      // copia de un único paso atrás (SPEC §7.7)
let modoLetra = false;
let popover = null;       // { el, pos, sugs }
let sucio = false;        // hay cambios sin guardar
let guardando = false;
let enConflicto = false;
let datosConflicto = null;
let tmr = null;           // temporizador del guardado automático

const MENSAJE_COPIA = {
  'una-estrofa': 'Solo hay una estrofa. Deja una línea en blanco entre estrofas en «Editar letra»',
  'sin-origen': 'Aún no hay acordes que copiar',
  'ya-tienen': 'Las demás estrofas ya tienen acordes',
};

function el(tag, clase, texto) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto != null) n.textContent = texto;
  return n;
}

function celda(pos) {
  const [ei, li, wi] = pos.split(',').map(Number);
  return cancion.stanzas[ei].lines[li][wi];
}

function esCampo(nodo) {
  return nodo.matches?.('input, textarea, [contenteditable]');
}

// ---------- Pintar ----------

function pintar(enfocar = null) {
  popover = null;
  const estrofas = cancion.stanzas.map((estrofa, ei) => {
    const sec = el('section', 'estrofa');
    sec.append(el('div', 'etiqueta-estrofa', `Estrofa ${ei + 1}`));
    estrofa.lines.forEach((linea, li) => {
      const fila = el('div', 'linea');
      linea.forEach((p, wi) => fila.append(celdaPalabra(p, `${ei},${li},${wi}`)));
      sec.append(fila);
    });
    return sec;
  });
  hoja.replaceChildren(...(estrofas.length
    ? estrofas
    : [el('p', 'vacio', 'Aún no hay letra. Pulsa «Editar letra» para escribirla.')]));
  if (enfocar) hoja.querySelector(`[data-pos="${enfocar}"]`)?.focus();

  $('tono').textContent = formatKey(cancion.key, 'es');
  const n = cancion.stanzas.flatMap((e) => e.lines.flat()).filter((p) => p.chord).length;
  $('pie').textContent = n
    ? `${n} acorde${n === 1 ? '' : 's'} · tono ${formatKey(cancion.key, 'es')}`
    : 'Aún no hay acordes';
}

function celdaPalabra(p, pos) {
  const b = el('span', p.chord ? 'palabra con-acorde' : 'palabra');
  b.tabIndex = 0;
  b.setAttribute('role', 'button');
  b.dataset.pos = pos;
  const texto = p.chord ? formatChord(p.chord, 'es') : '';
  b.setAttribute('aria-label', `${p.text}${texto ? `, acorde ${texto}` : ', sin acorde'}`);
  b.append(el('span', 'acorde', texto), el('span', 'texto', p.text));
  if (!p.chord) b.append(el('span', 'mas', '+'));
  return b;
}

// ---------- Edición (cada acción guarda un paso para Deshacer) ----------

function editar(fn, enfocar = null) {
  deshacer = structuredClone(cancion);
  fn();
  pintar(enfocar);
  marcarCambio();
}

function ponerAcorde(pos, chord) {
  editar(() => { celda(pos).chord = chord; }, pos);
}

function deshacerPaso() {
  if (!deshacer) return aviso('Nada que deshacer');
  cancion = { ...deshacer, title: cancion.title };
  deshacer = null;
  pintar();
  marcarCambio();
}

function cambiarTono(n) {
  editar(() => {
    cancion.key = { r: (cancion.key.r + n + 12) % 12, m: cancion.key.m };
    for (const e of cancion.stanzas) for (const l of e.lines) for (const p of l) {
      if (p.chord) p.chord = transportar(p.chord, n);
    }
  });
}

// ---------- Selector de acorde (SPEC §7.4) ----------

function abrirPopover(bEl) {
  cerrarPopover(false);
  const pos = bEl.dataset.pos;
  const [ei, li, wi] = pos.split(',').map(Number);
  const palabra = celda(pos);
  const sugs = suggest(cancion.stanzas, cancion.key, ei, li, wi);

  const pop = el('div', 'popover');
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Elegir acorde');
  pop.append(el('h2', null, `Acorde sobre «${palabra.text}»`));

  const grid = el('div', 'sugerencias');
  sugs.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.append(el('span', 'num', String(i + 1)), s.texto);
    b.onclick = () => ponerAcorde(pos, s.chord);
    grid.append(b);
  });
  pop.append(grid);
  if (sugs[0]) pop.append(el('p', 'motivo', `Sugerido: ${sugs[0].texto}, ${sugs[0].motivo}.`));

  const fila = el('div', 'fila-otro');
  const input = el('input');
  input.type = 'text';
  input.placeholder = 'Ejemplo: LAM, SOL7, Fa#m';
  input.setAttribute('aria-label', 'Otro acorde');
  input.maxLength = 12;
  input.autocomplete = 'off';
  input.spellcheck = false;
  const errorEl = el('p', 'error-acorde');
  errorEl.setAttribute('role', 'status');
  const intentar = () => {
    const c = parseChord(input.value);
    if (!c) { errorEl.textContent = 'No reconozco ese acorde'; input.focus(); return; }
    ponerAcorde(pos, c);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); intentar(); } });
  const botonPoner = el('button', 'boton principal', 'Poner');
  botonPoner.type = 'button';
  botonPoner.onclick = intentar;
  fila.append(input, botonPoner);
  pop.append(fila, errorEl);

  if (palabra.chord) {
    const quitar = el('button', 'boton quitar', 'Quitar acorde');
    quitar.type = 'button';
    quitar.onclick = () => ponerAcorde(pos, null);
    pop.append(quitar);
  }

  hoja.append(pop);
  pop.style.left = `${Math.max(0, Math.min(bEl.offsetLeft, hoja.clientWidth - pop.offsetWidth - 4))}px`;
  pop.style.top = `${bEl.offsetTop + bEl.offsetHeight + 6}px`;
  popover = { el: pop, pos, sugs };
  grid.querySelector('button')?.focus();
}

function cerrarPopover(conFoco) {
  if (!popover) return;
  const pos = popover.pos;
  popover.el.remove();
  popover = null;
  if (conFoco) hoja.querySelector(`[data-pos="${pos}"]`)?.focus();
}

// ---------- Modo letra (SPEC §7.2) ----------

function entrarLetra() {
  cerrarPopover(false);
  modoLetra = true;
  hoja.hidden = true;
  $('ayuda').hidden = true;
  $('vista-letra').hidden = false;
  for (const c of $('barra').children) c.hidden = c.id !== 'btn-listo';
  $('letra').value = textoDesdeEstrofas(cancion.stanzas);
  contarEstrofas();
  $('letra').focus();
}

function salirLetra() {
  const texto = $('letra').value;
  if (texto !== textoDesdeEstrofas(cancion.stanzas)) {
    const { estrofas, quitados } = reasignar(cancion.stanzas, texto);
    deshacer = structuredClone(cancion);
    cancion.stanzas = estrofas;
    if (quitados) aviso(`Se han quitado ${quitados} acordes porque sus palabras ya no están`);
    marcarCambio({ ahora: true });
  }
  modoLetra = false;
  hoja.hidden = false;
  $('vista-letra').hidden = true;
  $('ayuda').hidden = false;
  for (const c of $('barra').children) c.hidden = c.id === 'btn-listo';
  pintar();
}

function contarEstrofas() {
  const n = estrofasDesdeTexto($('letra').value).length;
  $('aviso-letra').textContent = `${n} ${n === 1 ? 'estrofa' : 'estrofas'}. Deja una línea en blanco entre estrofas.`;
}

// ---------- Guardado (SPEC §5 y §7.2) ----------

function estado(texto, error = false) {
  estadoEl.textContent = texto;
  estadoEl.classList.toggle('error', error);
}

function marcarCambio({ ahora = false } = {}) {
  sucio = true;
  if (enConflicto) return;
  clearTimeout(tmr);
  if (ahora) return guardar();
  estado('Guardando…');
  tmr = setTimeout(guardar, 800);
}

async function guardar() {
  tmr = null;
  if (!sucio || enConflicto || guardando) return; // si ya guarda, el finally vuelve a mirar
  guardando = true;
  const texto = serialize(cancion);
  estado('Guardando…');
  try {
    const r = await api.guardar(slug, texto, updatedAt);
    updatedAt = r.updatedAt;
    sucio = serialize(cancion) !== texto;
    if (!sucio) estado('Guardado');
  } catch (err) {
    if (err.status === 409) {
      enConflicto = true;
      datosConflicto = err.datos;
      $('conflicto').hidden = false;
      estado('Sin guardar', true);
    } else {
      estado('Sin guardar · reintentando', true);
      tmr = setTimeout(guardar, 3000);
    }
  } finally {
    guardando = false;
  }
  if (sucio && !enConflicto && !tmr) tmr = setTimeout(guardar, 800);
}

function resolverConflicto(cargarDisco) {
  const d = datosConflicto;
  enConflicto = false;
  datosConflicto = null;
  $('conflicto').hidden = true;
  updatedAt = d.updatedAt;
  if (cargarDisco) {
    deshacer = structuredClone(cancion); // Deshacer devuelve la versión que había en pantalla
    cancion = parse(d.chordpro, slug);
    $('titulo').value = cancion.title;
    sucio = false;
    pintar();
    estado('Guardado');
  } else {
    marcarCambio({ ahora: true });
  }
}

// ---------- Eventos ----------

hoja.addEventListener('click', (e) => {
  const b = e.target.closest('.palabra');
  if (b) abrirPopover(b);
});

hoja.addEventListener('keydown', (e) => {
  const b = e.target.closest('.palabra');
  if (!b) return;
  const todas = [...hoja.querySelectorAll('.palabra')];
  const i = todas.indexOf(b);
  if (e.key === 'ArrowRight') { e.preventDefault(); todas[i + 1]?.focus(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); todas[i - 1]?.focus(); }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirPopover(b); }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!celda(b.dataset.pos).chord) return;
    e.preventDefault();
    editar(() => { celda(b.dataset.pos).chord = null; }, b.dataset.pos);
  }
});

// Clic fuera cierra el selector; Esc lo cierra y devuelve el foco a la palabra.
document.addEventListener('mousedown', (e) => {
  if (popover && !popover.el.contains(e.target) && !e.target.closest('.palabra')) cerrarPopover(false);
});

document.addEventListener('keydown', (e) => {
  if (popover) {
    if (e.key === 'Escape') { e.preventDefault(); cerrarPopover(true); return; }
    if (!esCampo(e.target) && /^[1-8]$/.test(e.key)) {
      const s = popover.sugs[Number(e.key) - 1];
      if (s) { e.preventDefault(); ponerAcorde(popover.pos, s.chord); }
      return;
    }
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !esCampo(e.target)) {
    e.preventDefault();
    deshacerPaso();
  }
});

$('tono-bajar').onclick = () => cambiarTono(-1);
$('tono-subir').onclick = () => cambiarTono(1);
$('btn-deshacer').onclick = deshacerPaso;
$('btn-editar').onclick = entrarLetra;
$('btn-listo').onclick = salirLetra;
$('letra').addEventListener('input', contarEstrofas);
$('cargar-disco').onclick = () => resolverConflicto(true);
$('guardar-mia').onclick = () => resolverConflicto(false);

$('btn-copiar').onclick = () => {
  const tmp = structuredClone(cancion.stanzas);
  const { copiados, motivo } = copiarAcordesATodas(tmp);
  if (!copiados) return aviso(MENSAJE_COPIA[motivo]);
  editar(() => { cancion.stanzas = tmp; });
  aviso(`${copiados} acordes copiados`);
};

$('titulo').addEventListener('input', () => {
  cancion.title = $('titulo').value;
  marcarCambio();
});

// Avisar si hay cambios sin guardar; al salir por otra vía, intentar guardar.
window.addEventListener('beforeunload', (e) => {
  if (sucio) { e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('pagehide', () => { if (sucio) guardar(); });

// ---------- Arranque ----------

async function iniciar() {
  if (!slug) { location.replace('/'); return; }
  try {
    const d = await api.leer(slug);
    cancion = parse(d.chordpro, slug);
    updatedAt = d.updatedAt;
    $('titulo').value = cancion.title;
    pintar();
    estado('Guardado');
  } catch (err) {
    estado(err.status === 404 ? 'Esta canción no existe' : 'No se pudo cargar', true);
    aviso(err.message);
  }
}

iniciar();
