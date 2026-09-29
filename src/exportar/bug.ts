// Rascunho de bug para colar no Azure. Abrir o bug continua manual: isto so
// monta o texto a partir do teste que falhou (passos ate a falha, esperado e
// o que apareceu) e lista os prints para anexar.

import { passoQueFalhou, type Evidencia, type TestCase } from '../modelo.ts';
import { nomeEvidencia } from './nomes.ts';

export function rascunhoBug(t: TestCase, evidencias: Evidencia[]): string {
  const falhou = passoQueFalhou(t);
  const ate = falhou || t.passos.length;
  const passo = falhou ? t.passos[falhou - 1] : undefined;

  const linhas = [
    `Título: [Bug] ${t.titulo}${falhou ? ` - passo ${falhou}` : ''}`,
    '',
    'Passos para reproduzir:',
    ...t.passos.slice(0, ate).map((p, i) => `${i + 1}. ${p.acao}`),
    '',
    `Resultado esperado: ${passo?.esperado ?? t.passos.at(-1)?.esperado ?? ''}`,
    `Resultado obtido: ${t.observacao.trim() || '[descrever]'}`,
    '',
    `Test case: ${t.id} - ${t.titulo}`,
  ];

  const prints = evidencias.filter((e) => e.testeId === t.id).map((e) => nomeEvidencia({ ...e, tipo: e.blob.type }));
  if (prints.length) linhas.push('', 'Evidências:', ...prints.map((p) => `- ${p}`));
  return linhas.join('\n');
}
