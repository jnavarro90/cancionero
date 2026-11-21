import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latin1, planearPdf } from '../shared/pdf.js';

// Medidor falso: ancho proporcional al texto. Basta para probar la maquetación.
const medir = (s, [, , tamano]) => s.length * tamano * 0.5;

const palabra = (text, chord = null) => ({ text, chord });
const estrofaDeLineas = (n) => ({ lines: Array.from({ length: n }, (_, i) => [palabra(`verso${i}`)]) });
const cancionCon = (stanzas, title = 'Prueba') => ({ title, key: { r: 9, m: 'minor' }, stanzas });

const textos = (paginas) => paginas.map((ops) => ops.filter((o) => o.k === 't').map((o) => o.s));

test('latin1 sustituye cada punto de código fuera de Latin-1 por ?', () => {
  assert.equal(latin1('ñá¿😀€'), 'ñá¿??');
  assert.equal(latin1('Sí, señor'), 'Sí, señor');
});

test('la cabecera muestra el tono y los acordes en orden de aparición, en español', () => {
  const c = cancionCon([{ lines: [[palabra('Noche', { r: 9, q: 'm' }), palabra('de'), palabra('paz', { r: 4, q: '7' })],
    [palabra('y', { r: 9, q: 'm' })]] }]);
  const [pag] = planearPdf(c, medir);
  const pastillas = pag.filter((o) => o.k === 't' && o.f[2] === 9 && o.f[1] === 'bold').map((o) => o.s);
  assert.deepEqual(pastillas, ['LAm', 'MI7']);
  assert.ok(pag.some((o) => o.k === 't' && o.s === 'LAm' && o.f[2] === 9.5), 'tono en la cabecera');
});

test('una estrofa que cabe entera en una página no se parte', () => {
  // Estrofa A: 20 filas de 25 pt; B: 14 filas. Tras A no cabe B, pero sí en una página nueva.
  const c = cancionCon([estrofaDeLineas(20), estrofaDeLineas(14)]);
  const paginas = planearPdf(c, medir);
  assert.equal(paginas.length, 2);
  const numeros = textos(paginas).map((t) => t.filter((s) => s === '1' || s === '2'));
  assert.deepEqual(numeros, [['1'], ['2']], 'cada número de estrofa en su página');
});

test('una estrofa más alta que una página se parte por filas', () => {
  // Con dos estrofas hay números. La primera, de 40 filas, se parte; su número va una sola vez.
  const paginas = planearPdf(cancionCon([estrofaDeLineas(40), estrofaDeLineas(1)]), medir);
  assert.ok(paginas.length >= 2);
  const numeros = textos(paginas).flat().filter((s) => s === '1');
  assert.equal(numeros.length, 1, 'el número va una sola vez, en la primera fila');
});

test('con varias páginas, el pie lleva «n / N» y el título', () => {
  const paginas = planearPdf(cancionCon([estrofaDeLineas(40)], 'Mi canción'), medir);
  const todos = textos(paginas).flat();
  assert.ok(todos.includes(`1 / ${paginas.length}`));
  assert.ok(todos.includes('Mi canción'));
});

test('una sola página no lleva numeración', () => {
  const paginas = planearPdf(cancionCon([estrofaDeLineas(2)]), medir);
  assert.equal(paginas.length, 1);
  assert.ok(!textos(paginas).flat().some((s) => s.includes(' / ')));
});

test('el título con caracteres fuera de Latin-1 llega sustituido', () => {
  const paginas = planearPdf(cancionCon([estrofaDeLineas(1)], 'Paz 😀'), medir);
  assert.ok(textos(paginas).flat().some((s) => s === 'Paz ?'));
});
