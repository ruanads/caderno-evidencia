import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rascunhoBug } from '../../src/exportar/bug.ts';
import type { TestCase } from '../../src/modelo.ts';

test('rascunho usa os passos ate a falha, o esperado do passo e o que apareceu', () => {
  const t: TestCase = {
    id: 'CT02', titulo: '[Etapa 1] Bloquear cupom expirado', grupo: 'Etapa 1', status: 'ok', observacao: 'Cupom aceito com 10%',
    passos: [
      { acao: 'Abrir o carrinho.', esperado: 'Carrinho aberto.', status: 'ok' },
      { acao: 'Aplicar VERAO2020.', esperado: 'Cupom recusado.', status: 'bad' },
      { acao: 'Finalizar.', esperado: 'Pedido sem desconto.', status: '' },
    ],
    azure: { id: '', areaPath: '', assignedTo: '', state: '' }, linhasOriginais: [],
  };
  const png = new Blob([], { type: 'image/png' });
  const texto = rascunhoBug(t, [{ id: '1', cadernoId: 'x', rodada: 1, testeId: 'CT02', passo: 2, seq: 1, legenda: 'erro', blob: png, criadoEm: 0 }]);

  assert.match(texto, /^Título: \[Bug\] \[Etapa 1\] Bloquear cupom expirado - passo 2/);
  assert.match(texto, /1\. Abrir o carrinho\.\n2\. Aplicar VERAO2020\.\n\n/);
  assert.doesNotMatch(texto, /Finalizar/);
  assert.match(texto, /Resultado esperado: Cupom recusado\.\nResultado obtido: Cupom aceito com 10%/);
  assert.match(texto, /- CT02_P2_01_erro\.png/);
});
