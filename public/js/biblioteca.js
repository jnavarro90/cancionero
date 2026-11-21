// Pantalla de biblioteca (/). Ver SPEC.md §7.1.
import { api } from './api.js';
import { aviso, hace } from './aviso.js';

const $ = (id) => document.getElementById(id);
let canciones = [];
let menuAbierto = null;
let aBorrar = null;

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function render() {
  const filtro = sinTildes($('buscar').value.trim());
  const visibles = canciones.filter((c) => sinTildes(c.title).includes(filtro));
  const lista = $('lista');
  lista.replaceChildren();

  $('vacio').hidden = canciones.length > 0;
  lista.hidden = canciones.length === 0;

  for (const c of visibles) {
    const li = document.createElement('li');
    li.className = 'fila';

    const enlace = document.createElement('a');
    enlace.href = `/cancion.html?c=${encodeURIComponent(c.slug)}`;
    const titulo = document.createElement('div');
    titulo.className = 'titulo';
    titulo.textContent = c.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${c.key} · ${c.chordCount} acordes · editada ${hace(c.updatedAt)}`;
    enlace.append(titulo, meta);

    const menu = document.createElement('button');
    menu.className = 'menu-btn';
    menu.type = 'button';
    menu.textContent = '⋯';
    menu.setAttribute('aria-label', `Opciones de ${c.title}`);
    menu.setAttribute('aria-haspopup', 'menu');
    menu.addEventListener('click', (e) => { e.stopPropagation(); abrirMenu(c, menu); });

    li.append(enlace, menu);
    lista.append(li);
  }

  if (canciones.length && !visibles.length) {
    const p = document.createElement('li');
    p.className = 'vacio';
    p.textContent = 'Ninguna canción coincide con la búsqueda.';
    lista.append(p);
  }
}

async function cargar() {
  canciones = await api.listar();
  render();
}

function cerrarMenu() {
  menuAbierto?.remove();
  menuAbierto = null;
}

function abrirMenu(cancion, boton) {
  cerrarMenu();
  const m = document.createElement('div');
  m.className = 'menu-flotante';
  m.setAttribute('role', 'menu');
  const r = boton.getBoundingClientRect();
  m.style.top = `${window.scrollY + r.bottom + 4}px`;
  m.style.left = `${Math.max(8, window.scrollX + r.right - 180)}px`;

  const duplicar = document.createElement('button');
  duplicar.type = 'button';
  duplicar.textContent = 'Duplicar';
  duplicar.addEventListener('click', () => { cerrarMenu(); duplicarCancion(cancion); });

  const borrar = document.createElement('button');
  borrar.type = 'button';
  borrar.textContent = 'Borrar';
  borrar.addEventListener('click', () => { cerrarMenu(); pedirBorrar(cancion); });

  m.append(duplicar, borrar);
  document.body.append(m);
  menuAbierto = m;
  duplicar.focus();
}

document.addEventListener('click', (e) => {
  if (menuAbierto && !menuAbierto.contains(e.target)) cerrarMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenu(); });

async function duplicarCancion(c) {
  try {
    await api.duplicar(c.slug, `${c.title} (copia)`);
    aviso('Canción duplicada');
    await cargar();
  } catch (err) {
    aviso(err.message);
  }
}

function pedirBorrar(c) {
  aBorrar = c;
  $('dlg-borrar').showModal();
}

$('confirmar-borrar').addEventListener('click', async () => {
  const c = aBorrar;
  aBorrar = null;
  $('dlg-borrar').close();
  if (!c) return;
  try {
    await api.borrar(c.slug);
    aviso('Canción movida a la papelera');
    await cargar();
  } catch (err) {
    aviso(err.message);
  }
});

function nueva() {
  $('titulo-nueva').value = '';
  $('dlg-nueva').showModal();
  $('titulo-nueva').focus();
}

$('nueva').addEventListener('click', nueva);
$('nueva-vacio').addEventListener('click', nueva);

$('form-nueva').addEventListener('submit', async (e) => {
  e.preventDefault();
  const titulo = $('titulo-nueva').value.trim();
  if (!titulo) return;
  try {
    const { slug } = await api.crear(titulo);
    window.location.href = `/cancion.html?c=${encodeURIComponent(slug)}`;
  } catch (err) {
    aviso(err.message);
  }
});

document.querySelectorAll('[data-cerrar]').forEach((b) =>
  b.addEventListener('click', () => b.closest('dialog').close()));

$('buscar').addEventListener('input', render);

api.info().then(({ dir }) => { $('ruta').textContent = `Carpeta de canciones: ${dir}`; });
cargar().catch((err) => aviso(err.message));
