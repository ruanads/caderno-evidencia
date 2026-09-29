import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importarCsvAzure } from '../../src/importar/csv-azure.ts';
import { importarMassa } from '../../src/importar/massa.ts';

const ler = (nome: string) => readFileSync(new URL(`../../exemplos/${nome}`, import.meta.url), 'utf8');
const r = importarCsvAzure(ler('test-cases-exemplo.csv'));
if (!r.ok) throw new Error(r.erro);
const testes = r.testes;

test('CSV: liga pelo ID e pelo Title exato; o resto fica para associar', () => {
  const m = importarMassa(ler('massa-exemplo.csv'), 'massa-exemplo.csv', testes);
  assert.ok(m.ok);
  assert.deepEqual(m.linhas.map((l) => l.testeId), ['CT01', 'CT02', 'CT03', '']);
  assert.equal(m.linhas[0].valor, 'BEMVINDO10');
});

test('JSON: um teste pode ter varias linhas', () => {
  const m = importarMassa(ler('massa-exemplo.json'), 'massa-exemplo.json', testes);
  assert.ok(m.ok);
  assert.equal(m.linhas.filter((l) => l.testeId === 'CT01').length, 2);
});

test('ID sem diferenca de maiusculas e cabecalho com acento', () => {
  const m = importarMassa('Teste,Campo,Valor,Observação\nct02,Cupom,X,obs\n', 'm.csv', testes);
  assert.ok(m.ok);
  assert.deepEqual([m.linhas[0].testeId, m.linhas[0].observacao], ['CT02', 'obs']);
});

test('coluna obrigatoria faltando e JSON invalido', () => {
  assert.match((importarMassa('teste,campo\nCT01,x\n', 'm.csv', testes) as { erro: string }).erro, /Faltando: valor/);
  assert.match((importarMassa('[{"teste":', 'm.json', testes) as { erro: string }).erro, /JSON invalido/);
  assert.match((importarMassa('{"a":1}', 'm.json', testes) as { erro: string }).erro, /precisa ser uma lista/);
});
