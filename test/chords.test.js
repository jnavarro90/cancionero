import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChord, formatChord, transportar } from '../shared/chords.js';

test('parseChord reconoce la tabla de SPEC §3.4', () => {
  const casos = [
    ['LAM', { r: 9, q: '' }], ['LAm', { r: 9, q: 'm' }], ['LA', { r: 9, q: '' }],
    ['la7', { r: 9, q: '7' }], ['SOLm7', { r: 7, q: 'm7' }], ['Fa#m', { r: 6, q: 'm' }],
    ['Bb', { r: 10, q: '' }], ['Am', { r: 9, q: 'm' }], ['E7', { r: 4, q: '7' }],
    ['SIbM7', { r: 10, q: 'maj7' }], ['REsus4', { r: 2, q: 'sus4' }],
  ];
  for (const [entrada, esperado] of casos) {
    assert.deepEqual(parseChord(entrada), esperado, entrada);
  }
});

test('parseChord rechaza entradas no válidas', () => {
  for (const entrada of ['xx', 'H7', '', '7']) {
    assert.equal(parseChord(entrada), null, entrada);
  }
});

test('formatChord en español usa M para el mayor', () => {
  assert.equal(formatChord({ r: 9, q: '' }, 'es'), 'LAM');
  assert.equal(formatChord({ r: 9, q: 'm' }, 'es'), 'LAm');
  assert.equal(formatChord({ r: 10, q: 'maj7' }, 'es'), 'SIbmaj7');
});

test('formatChord en inglés no pone sufijo al mayor', () => {
  assert.equal(formatChord({ r: 9, q: '' }, 'en'), 'A');
  assert.equal(formatChord({ r: 4, q: '7' }, 'en'), 'E7');
});

test('transportar da la vuelta al octavo: SI + 1 = DO', () => {
  assert.deepEqual(transportar({ r: 11, q: '' }, 1), { r: 0, q: '' });
  assert.deepEqual(transportar({ r: 0, q: 'm' }, -1), { r: 11, q: 'm' });
});
