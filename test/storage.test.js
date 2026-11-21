import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as storage from '../server/storage.js';

let dir;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'cancionero-test-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

test('crear escribe un .chordpro legible y lo lista', async () => {
  const r = await storage.crear(dir, 'Noche de paz');
  assert.equal(r.slug, 'noche-de-paz');
  const texto = await readFile(join(dir, 'noche-de-paz.chordpro'), 'utf8');
  assert.match(texto, /\{title: Noche de paz\}/);
  const lista = await storage.listar(dir);
  assert.equal(lista[0].title, 'Noche de paz');
});

test('un .chordpro copiado a mano aparece en el listado', async () => {
  await writeFile(join(dir, 'a-mano.chordpro'), '{title: A mano}\n[G]Hola\n', 'utf8');
  const lista = await storage.listar(dir);
  assert.ok(lista.some((c) => c.slug === 'a-mano' && c.chordCount === 1));
});

test('guardar sin conflicto actualiza el archivo', async () => {
  const { slug, updatedAt } = await storage.crear(dir, 'Prueba');
  const r = await storage.guardar(dir, slug, '{title: Prueba}\n[C]Hola\n', updatedAt);
  assert.ok(r.updatedAt);
  const leido = await storage.leer(dir, slug);
  assert.match(leido.chordpro, /\[C\]Hola/);
});

test('guardar con una versión vieja devuelve 409 con la del disco', async () => {
  const { slug, updatedAt } = await storage.crear(dir, 'Conflicto');
  // Otro cambio en el disco, posterior a la versión que tiene la web.
  const ruta = join(dir, `${slug}.chordpro`);
  await writeFile(ruta, '{title: Editada fuera}\n', 'utf8');
  const futuro = new Date(Date.parse(updatedAt) + 60_000);
  await utimes(ruta, futuro, futuro);
  await assert.rejects(
    () => storage.guardar(dir, slug, 'nueva', updatedAt),
    (err) => err.status === 409 && err.extra.chordpro.includes('Editada fuera'),
  );
});

test('rechaza slugs inválidos y rutas con ../ antes de tocar el disco', async () => {
  await assert.rejects(() => storage.leer(dir, '../secreto'), (e) => e.status === 400);
  await assert.rejects(() => storage.borrar(dir, 'A/B'), (e) => e.status === 400);
});

test('borrar mueve el archivo a la papelera y no lo elimina', async () => {
  const { slug } = await storage.crear(dir, 'Para borrar');
  await storage.borrar(dir, slug);
  const lista = await storage.listar(dir);
  assert.equal(lista.length, 0);
  const papelera = await readdir(join(dir, '.papelera'));
  assert.equal(papelera.length, 1);
  assert.match(papelera[0], /^para-borrar-\d{8}-\d{6}\.chordpro$/);
});

test('no quedan archivos .tmp tras guardar', async () => {
  const { slug, updatedAt } = await storage.crear(dir, 'Limpio');
  await storage.guardar(dir, slug, '{title: Limpio}\n', updatedAt);
  const nombres = await readdir(dir);
  assert.ok(!nombres.some((n) => n.endsWith('.tmp')));
});

test('duplicar crea una copia con otro título', async () => {
  const { slug } = await storage.crear(dir, 'Original');
  const copia = await storage.duplicar(dir, slug, 'Copia');
  assert.equal(copia.slug, 'copia');
  const lista = await storage.listar(dir);
  assert.equal(lista.length, 2);
});
