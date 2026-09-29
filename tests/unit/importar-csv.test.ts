import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importarCsvAzureSeguro, tituloCurto } from '../../src/importar/csv-azure.ts';

const exemplo = readFileSync(new URL('../../exemplos/test-cases-exemplo.csv', import.meta.url), 'utf8');

test('le os test cases, os passos e gera CT01, CT02...', () => {
  const r = importarCsvAzureSeguro(exemplo);
  assert.ok(r.ok);
  assert.deepEqual(r.testes.map((t) => t.id), ['CT01', 'CT02', 'CT03']);
  assert.deepEqual(r.testes.map((t) => t.passos.length), [2, 2, 3]);
  assert.equal(r.testes[2].passos[2].acao, 'Finalizar a compra.');
});

test('campo com virgula entre aspas vira um campo so', () => {
  const r = importarCsvAzureSeguro(exemplo);
  assert.ok(r.ok);
  assert.equal(r.testes[1].passos[1].esperado, 'O sistema deve recusar o cupom, informando que ele expirou.');
});

test('prefixo [Etapa N] vira grupo e sai do titulo curto', () => {
  const r = importarCsvAzureSeguro(exemplo);
  assert.ok(r.ok);
  assert.deepEqual(r.testes.map((t) => t.grupo), ['Etapa 1', 'Etapa 1', 'Etapa 2']);
  assert.equal(tituloCurto(r.testes[0]), 'Aplicar cupom válido no carrinho');
  assert.equal(r.testes[0].titulo, '[Etapa 1] Aplicar cupom válido no carrinho');
});

test('guarda Area Path, Assigned To e State', () => {
  const r = importarCsvAzureSeguro(exemplo);
  assert.ok(r.ok);
  assert.deepEqual(r.testes[0].azure, { id: '', areaPath: 'Loja Exemplo\\Checkout', assignedTo: 'Pessoa QA', state: 'Design' });
});

test('guarda o formato: BOM, CRLF e quebra no final', () => {
  const r = importarCsvAzureSeguro(exemplo);
  assert.ok(r.ok);
  assert.deepEqual({ bom: r.formato.bom, quebra: r.formato.quebra, fim: r.formato.terminaComQuebra }, { bom: true, quebra: '\r\n', fim: true });
});

test('titulo sem prefixo fica sem grupo', () => {
  const csv = 'ID,Work Item Type,Title,Test Step,Step Action,Step Expected,Area Path,Assigned To,State\n,Test Case,Sem grupo,1,A,B,X,Y,Design\n';
  const r = importarCsvAzureSeguro(csv);
  assert.ok(r.ok);
  assert.equal(r.testes[0].grupo, '');
});

test('cabecalho diferente gera erro claro', () => {
  const r = importarCsvAzureSeguro('ID,Titulo,Passo\n,x,1\n');
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.erro, /nao e o do Azure Test Plans[\s\S]*Faltando: Work Item Type/);
});

test('arquivo vazio ou sem test case', () => {
  assert.equal(importarCsvAzureSeguro('').ok, false);
  const soCabecalho = 'ID,Work Item Type,Title,Test Step,Step Action,Step Expected,Area Path,Assigned To,State\n';
  assert.match((importarCsvAzureSeguro(soCabecalho) as { erro: string }).erro, /Nenhum "Test Case"/);
});

test('passo antes de qualquer test case e recusado', () => {
  const csv = 'ID,Work Item Type,Title,Test Step,Step Action,Step Expected,Area Path,Assigned To,State\n,,,1,A,B,,,\n';
  assert.match((importarCsvAzureSeguro(csv) as { erro: string }).erro, /Linha 2/);
});
