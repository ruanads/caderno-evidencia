import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evolucaoRodadas, gerarRelatorio, situacaoBugs, statusNaRodada, veredito } from '../../src/exportar/relatorio.ts';
import { iniciarReteste } from '../../src/reteste.ts';
import type { Caderno, StatusPasso, StatusTeste, TestCase } from '../../src/modelo.ts';

const teste = (id: string, status: StatusTeste, passos: StatusPasso[] = ['ok'], grupo = 'Etapa 1'): TestCase => ({
  id, titulo: `[${grupo}] ${id}`, grupo, status, observacao: '',
  passos: passos.map((s) => ({ acao: 'a', esperado: 'e', status: s })),
  azure: { id: '', areaPath: '', assignedTo: '', state: '' }, linhasOriginais: [],
});

const caderno = (testes: TestCase[]): Caderno => ({
  id: 'x', criadoEm: 0, atualizadoEm: 0, rodada: 1, tarefa: '9001 - Cupom', massa: [], testes,
  formato: { cabecalho: [], bom: true, quebra: '\r\n', terminaComQuebra: true }, ativo: { testeId: testes[0].id, passo: 1 },
});

test('veredito: qualquer falha reprova; algo pendente fica em andamento', () => {
  assert.equal(veredito(caderno([teste('CT01', 'ok'), teste('CT02', 'ok')])), 'aprovado');
  assert.equal(veredito(caderno([teste('CT01', 'ok'), teste('CT02', 'skip')])), 'andamento');
  assert.equal(veredito(caderno([teste('CT01', 'ok'), teste('CT02', '')])), 'andamento');
  assert.equal(veredito(caderno([teste('CT01', 'ok', ['bad'])])), 'reprovado');
});

test('evolucao por rodada: reteste conta so os reabertos, e quem nao voltou mantem o resultado', () => {
  const c = caderno([teste('CT01', 'ok'), teste('CT02', '', ['bad']), teste('CT03', 'bad')]);
  iniciarReteste(c, 'falharam'); // rodada 2 com CT02 e CT03
  c.testes[1].passos[0].status = 'ok';
  c.testes[1].status = 'ok';
  c.testes[2].status = 'bad';

  assert.deepEqual(evolucaoRodadas(c), [
    { rodada: 1, executados: 3, ok: 1, bad: 2, skip: 0 },
    { rodada: 2, executados: 2, ok: 1, bad: 1, skip: 0 },
  ]);
  assert.equal(statusNaRodada(c.testes[0], 1), 'ok');
  assert.equal(statusNaRodada(c.testes[1], 1), 'bad');
  assert.equal(statusNaRodada(c.testes[1], 2), 'ok');
});

test('relatorio mostra ambiente, riscos e defeitos so quando existem', () => {
  const c = caderno([teste('CT01', 'ok'), teste('CT02', 'bad', ['ok'], 'Etapa 2')]);
  let html = gerarRelatorio(c, [], () => '', 0);
  assert.match(html, /Dados do ambiente não informados/);
  assert.match(html, /Nenhum risco registrado/);
  assert.match(html, /não informado/); // bug do CT02
  assert.doesNotMatch(html, /Evolução por rodada/);

  c.execucao = { ambiente: 'Homologação', versao: '2026.09.3', branch: '', baseDados: 'DBCorp_Homolog', navegadores: ['Chrome', 'Edge'], executor: 'Pessoa QA', observacoes: '' };
  c.riscos = [{ descricao: 'Sem teste em base de cliente', nivel: 'medio' }, { descricao: 'Fluxo de estorno fora do escopo', nivel: 'alto' }];
  c.testes[1].bug = '22501';
  html = gerarRelatorio(c, [], () => '', 0);
  assert.match(html, /<th>Ambiente<\/th><td>Homologação<\/td>/);
  assert.doesNotMatch(html, /<th>Branch<\/th>/);
  assert.match(html, /<span class="chip">Chrome<\/span> <span class="chip">Edge<\/span>/);
  assert.match(html, /n-alto">Alto<\/span>Fluxo de estorno[\s\S]*n-medio">Médio/); // alto primeiro
  assert.match(html, /<b>#22501<\/b>/);
  assert.match(html, /class="topo v-reprovado"/);
});

test('bug de teste que passou no reteste conta como corrigido', () => {
  const c = caderno([teste('CT01', 'ok'), teste('CT02', 'bad'), teste('CT03', 'bad')]);
  c.testes[0].bug = '1001';
  c.testes[1].bug = '#1002';
  assert.deepEqual(situacaoBugs(c), { abertos: ['1002'], corrigidos: ['1001'] });
  const html = gerarRelatorio(c, [], () => '', 0);
  assert.match(html, /#1002 aberto · #1001 corrigido/);
  assert.match(html, /bug #1001 corrigido/);
});

test('texto do caderno e escapado no relatorio', () => {
  const c = caderno([teste('CT01', 'ok')]);
  c.tarefa = '<script>alert(1)</script>';
  assert.doesNotMatch(gerarRelatorio(c, [], () => '', 0), /<script>alert/);
});
