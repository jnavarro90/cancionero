import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estrofasDesdeTexto, reasignar, copiarAcordesATodas } from '../shared/letra.js';

const A = { r: 9, q: 'm' };
const E7 = { r: 4, q: '7' };

test('estrofasDesdeTexto separa por líneas en blanco, incluso varias seguidas', () => {
  const e = estrofasDesdeTexto('uno dos\ntres\n\n\ncuatro\n');
  assert.equal(e.length, 2);
  assert.equal(e[0].lines.length, 2);
  assert.equal(e[1].lines[0][0].text, 'cuatro');
});

test('reasignar conserva los acordes de las palabras que siguen y no los desplaza', () => {
  const viejas = estrofasDesdeTexto('Noche de paz\nduerme');
  viejas[0].lines[0][0].chord = A;
  viejas[0].lines[0][2].chord = E7;

  // Se añade una línea en blanco delante: los acordes no deben moverse.
  const { estrofas, quitados } = reasignar(viejas, '\nNoche de paz\nduerme');
  const [primera] = estrofas[0].lines;
  assert.deepEqual(primera[0].chord, A);
  assert.deepEqual(primera[2].chord, E7);
  assert.equal(quitados, 0);
});

test('reasignar cuenta los acordes cuyas palabras desaparecen', () => {
  const viejas = estrofasDesdeTexto('uno dos tres');
  viejas[0].lines[0][1].chord = A;
  const { quitados } = reasignar(viejas, 'uno tres');
  assert.equal(quitados, 1);
});

test('copiarAcordesATodas copia por línea y palabra sin sobrescribir', () => {
  // Estrofa 1: "a b" / "c d". Estrofa 2: "e f" / "g h".
  const e = estrofasDesdeTexto('a b\nc d\n\ne f\ng h');
  e[0].lines[0][0].chord = A;   // a -> A
  e[0].lines[1][1].chord = E7;  // d -> E7
  e[1].lines[0][1].chord = A;   // f ya tiene acorde: no se toca

  const { copiados, motivo } = copiarAcordesATodas(e);
  assert.equal(copiados, 2);      // e <- A y h <- E7
  assert.equal(motivo, null);
  assert.deepEqual(e[1].lines[0][0].chord, A);
  assert.deepEqual(e[1].lines[0][1].chord, A);
  assert.deepEqual(e[1].lines[1][1].chord, E7);
});

test('copiarAcordesATodas avisa si hay una sola estrofa', () => {
  const e = estrofasDesdeTexto('uno dos');
  assert.equal(copiarAcordesATodas(e).motivo, 'una-estrofa');
});
