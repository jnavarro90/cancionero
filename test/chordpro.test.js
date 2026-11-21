import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize } from '../shared/chordpro.js';

const ACORDE = (r, q = '') => ({ r, q });

function silenciarAvisos(fn) {
  const avisos = [];
  const original = console.warn;
  console.warn = (m) => avisos.push(m);
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return avisos;
}

test('serialize y parse son inversos (ida y vuelta)', () => {
  const cancion = {
    title: 'Noche de paz',
    key: { r: 9, m: 'minor' },
    stanzas: [
      { lines: [
        [{ text: 'Noche', chord: ACORDE(9, 'm') }, { text: 'de', chord: null }, { text: 'paz,', chord: ACORDE(4, '7') }],
        [{ text: 'todo', chord: null }],
      ] },
      { lines: [[{ text: 'Otra', chord: ACORDE(0) }]] },
    ],
  };
  assert.deepEqual(parse(serialize(cancion)), cancion);
});

test('serialize escribe los acordes en notación inglesa', () => {
  const texto = serialize({
    title: 'T', key: { r: 9, m: 'minor' },
    stanzas: [{ lines: [[{ text: 'Hola', chord: ACORDE(4, '7') }]] }],
  });
  assert.match(texto, /\[E7\]Hola/);
  assert.match(texto, /\{key: Am\}/);
});

test('parse ignora directivas desconocidas y acepta {t:} y {k:}', () => {
  const texto = '{t: Prueba}\n{k: C}\n{comment: nota}\n{x_foo: bar}\n\n[G]Hola [Am]mundo\n';
  const c = parse(texto);
  assert.equal(c.title, 'Prueba');
  assert.deepEqual(c.key, { r: 0, m: 'major' });
  assert.equal(c.stanzas[0].lines[0][0].text, 'Hola');
  assert.deepEqual(c.stanzas[0].lines[0][0].chord, ACORDE(7));
});

test('un acorde a mitad de palabra se asigna a esa palabra, que sigue entera', () => {
  let c;
  const avisos = silenciarAvisos(() => { c = parse('[Am]can[E7]tando bien\n'); });
  const p = c.stanzas[0].lines[0];
  assert.equal(p[0].text, 'cantando');
  assert.deepEqual(p[0].chord, ACORDE(9, 'm'));
  assert.equal(p[1].text, 'bien');
  assert.ok(avisos.length >= 1);
});

test('un acorde no reconocible se descarta con aviso', () => {
  let c;
  const avisos = silenciarAvisos(() => { c = parse('[H7]Hola\n'); });
  assert.equal(c.stanzas[0].lines[0][0].chord, null);
  assert.equal(avisos.length, 1);
});

test('sin título usa el nombre del archivo; sin tono deduce el primer acorde', () => {
  const c = parse('[D]Hola\n', 'mi-cancion');
  assert.equal(c.title, 'mi-cancion');
  assert.deepEqual(c.key, { r: 2, m: 'major' });
});
