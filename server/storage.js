// Leer, escribir, listar y borrar archivos .chordpro. Ver SPEC.md §5 y §6.
import { readdir, readFile, writeFile, rename, stat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse, serialize } from '../shared/chordpro.js';
import { formatKey } from '../shared/chords.js';
import { HttpError } from './http-utils.js';
import { SLUG_VALIDO, slugificar } from './slug.js';

const TAMANO_MAX = 200 * 1024;
const PAPELERA = '.papelera';

function rutaSlug(dir, slug) {
  if (!SLUG_VALIDO.test(slug)) throw new HttpError(400, 'Nombre de canción no válido.');
  return join(dir, `${slug}.chordpro`);
}

async function existe(ruta) {
  try {
    await stat(ruta);
    return true;
  } catch {
    return false;
  }
}

async function escribirAtomico(ruta, texto) {
  if (Buffer.byteLength(texto) > TAMANO_MAX) {
    throw new HttpError(413, 'La canción es demasiado grande (máximo 200 KB).');
  }
  const tmp = `${ruta}.tmp`;
  await writeFile(tmp, texto, 'utf8');
  await rename(tmp, ruta);
}

export async function asegurarDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function listar(dir) {
  await asegurarDir(dir);
  const nombres = (await readdir(dir)).filter((n) => n.endsWith('.chordpro'));
  const filas = [];
  for (const nombre of nombres) {
    const slug = nombre.slice(0, -'.chordpro'.length);
    if (!SLUG_VALIDO.test(slug)) continue;
    const ruta = join(dir, nombre);
    const [texto, info] = await Promise.all([readFile(ruta, 'utf8'), stat(ruta)]);
    const cancion = parse(texto, slug);
    const chordCount = cancion.stanzas.reduce((n, e) =>
      n + e.lines.reduce((m, l) => m + l.filter((p) => p.chord).length, 0), 0);
    filas.push({
      slug,
      title: cancion.title,
      key: formatKey(cancion.key, 'es'),
      chordCount,
      updatedAt: info.mtime.toISOString(),
    });
  }
  return filas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function leer(dir, slug) {
  const ruta = rutaSlug(dir, slug);
  let texto;
  let info;
  try {
    [texto, info] = await Promise.all([readFile(ruta, 'utf8'), stat(ruta)]);
  } catch {
    throw new HttpError(404, 'No existe esa canción.');
  }
  return { slug, chordpro: texto, updatedAt: info.mtime.toISOString() };
}

export async function crear(dir, titulo, chordpro) {
  await asegurarDir(dir);
  const titleLimpio = String(titulo ?? '').trim() || 'Canción nueva';
  // Versión asíncrona de slugLibre: `existe` devuelve una promesa.
  const base = slugificar(titleLimpio);
  let slug = base;
  for (let n = 2; await existe(join(dir, `${slug}.chordpro`)); n++) {
    slug = `${base}-${n}`;
  }
  const texto = chordpro ?? serialize({ title: titleLimpio, key: { r: 9, m: 'minor' }, stanzas: [] });
  const ruta = rutaSlug(dir, slug);
  await escribirAtomico(ruta, texto);
  const info = await stat(ruta);
  return { slug, updatedAt: info.mtime.toISOString() };
}

// Guarda el texto recibido. Si ifUnmodifiedSince es anterior al último cambio en disco, 409.
export async function guardar(dir, slug, chordpro, ifUnmodifiedSince) {
  const ruta = rutaSlug(dir, slug);
  let info;
  try {
    info = await stat(ruta);
  } catch {
    throw new HttpError(404, 'No existe esa canción.');
  }
  if (ifUnmodifiedSince) {
    const cuando = Date.parse(ifUnmodifiedSince);
    if (!Number.isNaN(cuando) && Math.floor(info.mtimeMs / 1000) > Math.floor(cuando / 1000)) {
      const actual = await leer(dir, slug);
      throw new HttpError(409, 'Esta canción se cambió fuera de aquí.', {
        chordpro: actual.chordpro,
        updatedAt: actual.updatedAt,
      });
    }
  }
  if (typeof chordpro !== 'string') throw new HttpError(400, 'Falta el contenido de la canción.');
  await escribirAtomico(ruta, chordpro);
  const nueva = await stat(ruta);
  return { updatedAt: nueva.mtime.toISOString() };
}

export async function duplicar(dir, slug, titulo) {
  const origen = await leer(dir, slug);
  const cancion = parse(origen.chordpro, slug);
  const titleNuevo = String(titulo ?? '').trim() || `${cancion.title} (copia)`;
  cancion.title = titleNuevo;
  return crear(dir, titleNuevo, serialize(cancion));
}

// Borrar no elimina: mueve el archivo a la papelera (SPEC §5.3).
export async function borrar(dir, slug) {
  const ruta = rutaSlug(dir, slug);
  if (!(await existe(ruta))) throw new HttpError(404, 'No existe esa canción.');
  const carpeta = join(dir, PAPELERA);
  await mkdir(carpeta, { recursive: true });
  const sello = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  await rename(ruta, join(carpeta, `${slug}-${sello}.chordpro`));
}
