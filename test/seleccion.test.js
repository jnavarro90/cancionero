import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoEntre } from '../shared/seleccion.js';

const lista = ['0,0,0', '0,0,2', '0,1,0', '1,0,0'];

test('rangoEntre devuelve las posiciones entre dos marcas, en cualquier sentido', () => {
  assert.deepEqual(rangoEntre(lista, '0,0,0', '0,1,0'), ['0,0,0', '0,0,2', '0,1,0']);
  assert.deepEqual(rangoEntre(lista, '0,1,0', '0,0,0'), ['0,0,0', '0,0,2', '0,1,0']);
});

test('una misma posición da solo esa', () => {
  assert.deepEqual(rangoEntre(lista, '0,0,2', '0,0,2'), ['0,0,2']);
});

test('si una posición no está en la lista, solo se devuelve la indicada', () => {
  assert.deepEqual(rangoEntre(lista, 'x', '0,1,0'), ['0,1,0']);
});
