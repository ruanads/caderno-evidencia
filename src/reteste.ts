// Reteste: abre uma nova rodada no mesmo caderno.
//
// Os testes escolhidos voltam para "A fazer" (status, passos e observacao
// zerados), mas o resultado da rodada que terminou fica no historico, e os
// prints antigos continuam no caderno com a rodada deles. Os testes que nao
// foram escolhidos mantem o resultado que ja tinham.

import { passoQueFalhou, statusEfetivo, type Caderno, type TestCase } from './modelo.ts';

export type EscopoReteste = 'falharam' | 'falharam-e-nao-executados' | 'todos';

export function testesDoReteste(caderno: Caderno, escopo: EscopoReteste): TestCase[] {
  return caderno.testes.filter((t) => {
    const st = statusEfetivo(t);
    if (escopo === 'todos') return true;
    if (escopo === 'falharam') return st === 'bad';
    return st === 'bad' || st === 'skip';
  });
}

export function iniciarReteste(caderno: Caderno, escopo: EscopoReteste): number {
  const escolhidos = testesDoReteste(caderno, escopo);
  if (!escolhidos.length) return 0;

  for (const t of escolhidos) {
    t.historico = [
      ...(t.historico ?? []),
      { rodada: caderno.rodada, status: statusEfetivo(t), passoQueFalhou: passoQueFalhou(t), observacao: t.observacao },
    ];
    t.status = '';
    t.observacao = '';
    t.passos.forEach((p) => (p.status = ''));
  }
  caderno.rodada += 1;
  caderno.ativo = { testeId: escolhidos[0].id, passo: 1 };
  return escolhidos.length;
}
