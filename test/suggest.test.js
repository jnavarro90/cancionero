import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest } from '../shared/suggest.js';
import { estrofasDesdeTexto } from '../shared/letra.js';

const LAm = { r: 9, m: 'minor' };

test('con LAm en tono LAm, la primera sugerencia es MI7 (teoría)', () => {
  const e = estrofasDesdeTexto('uno dos');
  e[0].lines[0][0].chord = { r: 9, q: 'm' }; // LAm en "uno"
  const lista = suggest(e, LAm, 0, 0, 1);    // palabra "dos"
  assert.deepEqual(lista[0].chord, { r: 4, q: '7' });
  assert.equal(lista[0].texto, 'MI7');
});

test('lo observado en la canción gana a la teoría', () => {
  // En esta canción, después de LAm siempre viene DO.
  const e = estrofasDesdeTexto('a b\nc d\n\ne f');
  e[0].lines[0][0].chord = { r: 9, q: 'm' };
  e[0].lines[1][0].chord = { r: 0, q: '' };
  e[1].lines[0][0].chord = { r: 9, q: 'm' };
  const lista = suggest(e, LAm, 1, 0, 1); // palabra "f", tras LAm
  assert.deepEqual(lista[0].chord, { r: 0, q: '' });
  assert.match(lista[0].motivo, /en tu canción/);
});

test('no repite acordes y devuelve como mucho 8', () => {
  const e = estrofasDesdeTexto('uno dos tres cuatro');
  const lista = suggest(e, LAm, 0, 0, 0);
  const claves = lista.map((x) => `${x.chord.r}|${x.chord.q}`);
  assert.equal(new Set(claves).size, claves.length);
  assert.ok(lista.length <= 8);
});
