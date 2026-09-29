import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importarCsvAzure } from '../../src/importar/csv-azure.ts';
import { exportarCsvAzure } from '../../src/exportar/csv-azure.ts';

const exemplo = readFileSync(new URL('../../exemplos/test-cases-exemplo.csv', import.meta.url), 'utf8');
const ida = (texto: string) => {
  const r = importarCsvAzure(texto);
  if (!r.ok) throw new Error(r.erro);
  return r;
};

test('sem edicao, o CSV exportado e identico ao importado', () => {
  assert.equal(exportarCsvAzure(ida(exemplo)), exemplo);
});

test('identico tambem sem BOM, com LF e sem quebra no final', () => {
  const variacao = exemplo.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\n$/, '');
  assert.equal(exportarCsvAzure(ida(variacao)), variacao);
});

test('o arquivo real do Azure (se existir em dados/) volta identico', { skip: !existe('../../dados/azure-real.csv') }, () => {
  const real = readFileSync(new URL('../../dados/azure-real.csv', import.meta.url), 'utf8');
  assert.equal(exportarCsvAzure(ida(real)), real);
});

test('editar o titulo e um passo muda so esses campos', () => {
  const c = ida(exemplo);
  c.testes[0].titulo = '[Etapa 1] Aplicar cupom, com virgula';
  c.testes[0].passos[1].esperado = 'Desconto de 10%.';
  const linhas = exportarCsvAzure(c).split('\r\n');
  assert.equal(linhas[1], ',Test Case,"[Etapa 1] Aplicar cupom, com virgula",1,Acessar o carrinho com um produto adicionado.,O carrinho deve exibir o produto e o subtotal.,Loja Exemplo\\Checkout,Pessoa QA,Design');
  assert.equal(linhas[2], ',,,2,Informar o cupom BEMVINDO10 e aplicar.,Desconto de 10%.,,,');
});

test('incluir e remover passos renumera o Test Step', () => {
  const c = ida(exemplo);
  c.testes[2].passos.splice(1, 1);
  c.testes[0].passos.push({ acao: 'Remover o cupom.', esperado: 'O subtotal volta ao valor original.', status: '' });
  const linhas = exportarCsvAzure(c).split('\r\n');
  assert.equal(linhas[3], ',,,3,Remover o cupom.,O subtotal volta ao valor original.,,,');
  assert.deepEqual(linhas.filter((l) => l.startsWith(',,,')).map((l) => l.split(',')[3]), ['2', '3', '2', '2']);
});

test('resultado da execucao nao entra no CSV', () => {
  const c = ida(exemplo);
  c.testes[0].status = 'bad';
  c.testes[0].passos[0].status = 'bad';
  c.testes[0].observacao = 'falhou';
  assert.equal(exportarCsvAzure(c), exemplo);
});

function existe(relativo: string): boolean {
  try {
    readFileSync(new URL(relativo, import.meta.url));
    return true;
  } catch {
    return false;
  }
}
