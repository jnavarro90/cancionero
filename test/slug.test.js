import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugificar, slugLibre, SLUG_VALIDO } from '../server/slug.js';

test('quita tildes, pasa a minúsculas y pone guiones', () => {
  assert.equal(slugificar('Noche de paz'), 'noche-de-paz');
  assert.equal(slugificar('Canción ñandú'), 'cancion-nandu');
});

test('símbolos y espacios repetidos se convierten en un solo guion', () => {
  assert.equal(slugificar('  ¡Hola!!  mundo (v2) '), 'hola-mundo-v2');
});

test('vacío o sin letras da "cancion"', () => {
  assert.equal(slugificar(''), 'cancion');
  assert.equal(slugificar('¿¿??'), 'cancion');
});

test('corta a 60 caracteres sin dejar guion al final', () => {
  const s = slugificar('a'.repeat(59) + ' b');
  assert.ok(s.length <= 60);
  assert.ok(!s.endsWith('-'));
});

test('duplicados reciben -2, -3…', () => {
  const existentes = new Set(['cancion', 'cancion-2']);
  assert.equal(slugLibre('cancion', (c) => existentes.has(c)), 'cancion-3');
});

test('el validador rechaza rutas y mayúsculas', () => {
  assert.ok(SLUG_VALIDO.test('noche-de-paz'));
  for (const malo of ['../x', 'Noche', 'a--b', '-a', 'a/b', '']) {
    assert.ok(!SLUG_VALIDO.test(malo), malo);
  }
});
