import { test } from 'node:test';
import assert from 'node:assert/strict';
import { espessura, pontaSeta } from '../../src/tela/anotacao.ts';

test('ponta da seta horizontal fica atras da ponta, simetrica', () => {
  const [[ax, ay], [bx, by]] = pontaSeta(0, 0, 100, 0, 20);
  assert.ok(ax < 100 && bx < 100);
  assert.ok(Math.abs(ay + by) < 1e-9); // um acima, outro abaixo, mesma distancia
  assert.ok(Math.abs(Math.hypot(100 - ax, ay) - 20) < 1e-9);
});

test('espessura acompanha o tamanho do print, com minimo de 3px', () => {
  assert.equal(espessura(300), 3);
  assert.equal(espessura(1920), 8);
});
