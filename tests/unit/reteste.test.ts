import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarReteste, testesDoReteste } from '../../src/reteste.ts';
import type { Caderno, StatusPasso, StatusTeste, TestCase } from '../../src/modelo.ts';

const teste = (id: string, status: StatusTeste, passos: StatusPasso[], observacao = ''): TestCase => ({
  id, titulo: id, grupo: '', status, observacao,
  passos: passos.map((s) => ({ acao: 'a', esperado: 'e', status: s })),
  azure: { id: '', areaPath: '', assignedTo: '', state: '' }, linhasOriginais: [],
});

const caderno = (): Caderno => ({
  id: 'x', criadoEm: 0, atualizadoEm: 0, rodada: 1, tarefa: 'T', massa: [],
  formato: { cabecalho: [], bom: true, quebra: '\r\n', terminaComQuebra: true }, ativo: { testeId: 'CT01', passo: 1 },
  testes: [teste('CT01', 'ok', ['ok']), teste('CT02', '', ['ok', 'bad'], 'erro X'), teste('CT03', 'skip', ['']), teste('CT04', 'bad', [''])],
});

test('escopo do reteste', () => {
  const c = caderno();
  assert.deepEqual(testesDoReteste(c, 'falharam').map((t) => t.id), ['CT02', 'CT04']);
  assert.deepEqual(testesDoReteste(c, 'falharam-e-nao-executados').map((t) => t.id), ['CT02', 'CT03', 'CT04']);
  assert.equal(testesDoReteste(c, 'todos').length, 4);
});

test('reteste guarda a rodada anterior, zera os escolhidos e mantem os outros', () => {
  const c = caderno();
  assert.equal(iniciarReteste(c, 'falharam'), 2);
  assert.equal(c.rodada, 2);
  assert.equal(c.ativo.testeId, 'CT02');

  const [ct01, ct02] = c.testes;
  assert.deepEqual(ct02.historico, [{ rodada: 1, status: 'bad', passoQueFalhou: 2, observacao: 'erro X' }]);
  assert.deepEqual([ct02.status, ct02.observacao, ct02.passos.map((p) => p.status)], ['', '', ['', '']]);
  assert.equal(ct01.status, 'ok');
  assert.equal(ct01.historico, undefined);
});

test('segundo reteste acumula o historico; nada para retestar nao muda a rodada', () => {
  const c = caderno();
  iniciarReteste(c, 'falharam');
  c.testes[1].passos[0].status = 'bad';
  iniciarReteste(c, 'falharam');
  assert.deepEqual(c.testes[1].historico!.map((h) => [h.rodada, h.passoQueFalhou]), [[1, 2], [2, 1]]);
  assert.equal(c.rodada, 3);

  const limpo = caderno();
  limpo.testes = [teste('CT01', 'ok', ['ok'])];
  assert.equal(iniciarReteste(limpo, 'falharam'), 0);
  assert.equal(limpo.rodada, 1);
});
