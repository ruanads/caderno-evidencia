import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importarCsvAzure } from '../../src/importar/csv-azure.ts';
import { cadernoEmBranco, mesclarTestes, valorComum } from '../../src/importar/mesclar.ts';
import { FORMATO_PADRAO, testeEmBranco, type Caderno } from '../../src/modelo.ts';

const csv = readFileSync(new URL('../../exemplos/test-cases-exemplo.csv', import.meta.url), 'utf8');
const importar = () => {
  const r = importarCsvAzure(csv);
  if (!r.ok) throw new Error(r.erro);
  return r;
};
const caderno = (): Caderno => ({
  id: 'x', criadoEm: 0, atualizadoEm: 0, rodada: 1, tarefa: 'T', massa: [], formato: { ...FORMATO_PADRAO },
  testes: [testeEmBranco('CT01')], ativo: { testeId: 'CT01', passo: 1 },
});

test('caderno so com o teste em branco: o CSV substitui e o formato passa a valer', () => {
  const c = caderno();
  assert.equal(cadernoEmBranco(c), true);
  const r = importar();
  r.formato.quebra = '\n'; // formato do arquivo, diferente do padrao
  const m = mesclarTestes(c, r.testes, r.formato);
  assert.deepEqual(m, { adicionados: ['CT01', 'CT02', 'CT03'], substituiuEmBranco: true });
  assert.equal(c.testes[0].titulo, '[Etapa 1] Aplicar cupom válido no carrinho');
  assert.equal(c.formato.quebra, '\n');
});

test('caderno com testes: o CSV acrescenta no fim com IDs novos e mantem o formato', () => {
  const c = caderno();
  c.testes[0].titulo = 'Meu teste';
  c.testes.push({ ...testeEmBranco('CT07'), titulo: 'Outro' });
  const r = importar();
  r.formato.quebra = '\n';
  const m = mesclarTestes(c, r.testes, r.formato);
  assert.deepEqual(m.adicionados, ['CT08', 'CT09', 'CT10']);
  assert.equal(m.substituiuEmBranco, false);
  assert.deepEqual(c.testes.map((t) => t.id), ['CT01', 'CT07', 'CT08', 'CT09', 'CT10']);
  assert.equal(c.formato.quebra, '\r\n');
});

test('massa que estava sem teste liga aos test cases importados', () => {
  const c = caderno();
  c.massa = [{ teste: '[Etapa 1] Bloquear cupom expirado', campo: 'Cupom', valor: 'VERAO2020', observacao: '', testeId: '' }];
  mesclarTestes(c, importar().testes, importar().formato);
  assert.equal(c.massa[0].testeId, 'CT02');
});

test('valor comum do Area Path: igual, vazio ou diferente entre os testes', () => {
  const [a, b] = [testeEmBranco('CT01'), testeEmBranco('CT02')];
  assert.equal(valorComum([a, b], 'areaPath'), '');
  a.azure.areaPath = 'Projetos\\X';
  assert.equal(valorComum([a, b], 'areaPath'), 'Projetos\\X');
  b.azure.areaPath = 'Projetos\\Y';
  assert.equal(valorComum([a, b], 'areaPath'), null);
});
