import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarComentario } from '../../src/exportar/comentario.ts';
import type { StatusPasso, StatusTeste, TestCase } from '../../src/modelo.ts';

const teste = (titulo: string, status: StatusTeste, passos: StatusPasso[] = [], observacao = ''): TestCase => ({
  id: 'CT', titulo, grupo: '', status, observacao,
  passos: passos.map((s) => ({ acao: 'a', esperado: 'e', status: s })),
  azure: { id: '', areaPath: '', assignedTo: '', state: '' }, linhasOriginais: [],
});

test('todos passaram: texto exato do padrao', () => {
  const texto = gerarComentario('9001 - Cupom de desconto', [teste('Cenário A', 'ok'), teste('Cenário B', 'ok')]);
  assert.equal(texto, [
    'Realizados os 2 cenários de testes solicitados na task 9001 - Cupom de desconto:',
    '',
    '- Cenário A;',
    '- Cenário B;',
    '',
    'Resultado: todos os cenários executados apresentaram o comportamento esperado conforme as regras descritas na task.',
    '',
    '📎 Evidências dos testes disponíveis em anexo.',
    '',
    'Aprovado. ✅',
  ].join('\n'));
});

test('falha: lista o que falhou com o passo e a observacao, e reprova', () => {
  const texto = gerarComentario('T', [teste('A', 'ok'), teste('B', 'ok', ['ok', 'bad'], 'Mensagem de erro X')]);
  assert.match(texto, /Resultado: 1 de 2 cenários apresentaram o comportamento esperado; 1 cenário apresentou divergência/);
  assert.match(texto, /- B \(passo 2\): Mensagem de erro X/);
  assert.match(texto, /Reprovado\. ❌ Bug\(s\) aberto\(s\): #____$/);
});

test('numero do bug preenchido substitui o #____; o que faltar continua #____', () => {
  const a = teste('A', 'bad');
  const b = teste('B', 'bad');
  assert.match(gerarComentario('T', [a, b]), /Bug\(s\) aberto\(s\): #____$/);
  a.bug = '#22501';
  assert.match(gerarComentario('T', [a, b]), /Bug\(s\) aberto\(s\): #22501, #____$/);
  b.bug = '22502';
  assert.match(gerarComentario('T', [a, b]), /Bug\(s\) aberto\(s\): #22501, #22502$/);
});

test('um passo com falha reprova mesmo marcado como Passou', () => {
  assert.match(gerarComentario('T', [teste('A', 'ok', ['bad'])]), /Reprovado/);
});

test('nao executados vao numa lista separada e nao contam como realizados', () => {
  const texto = gerarComentario('T', [teste('A', 'ok'), teste('C', 'skip', [], 'Sem massa')]);
  assert.match(texto, /^Realizado o 1 cenário de teste solicitado/);
  assert.match(texto, /Não executados:\n- C: Sem massa/);
  assert.doesNotMatch(texto, /^- C;/m);
});

test('testes sem resultado nao entram; nada marcado gera vazio', () => {
  assert.doesNotMatch(gerarComentario('T', [teste('A', 'ok'), teste('Sem nada', '')]), /Sem nada/);
  assert.equal(gerarComentario('T', [teste('A', '')]), '');
});
