// Comentario da task no padrao do Ricardo. O texto das frases e fixo: mudar so
// com ele. Entram os testes com resultado; "Nao consegui fazer" vai numa lista
// separada; testes sem resultado nao entram.

import { passoQueFalhou, statusEfetivo, type TestCase } from '../modelo.ts';

export function gerarComentario(tarefa: string, testes: TestCase[]): string {
  const executados = testes.filter((t) => ['ok', 'bad'].includes(statusEfetivo(t)));
  const falharam = executados.filter((t) => statusEfetivo(t) === 'bad');
  const naoExecutados = testes.filter((t) => statusEfetivo(t) === 'skip');
  const n = executados.length;

  if (n === 0 && naoExecutados.length === 0) return '';

  const linhas: string[] = [
    n === 1
      ? `Realizado o 1 cenário de teste solicitado na task ${tarefa}:`
      : `Realizados os ${n} cenários de testes solicitados na task ${tarefa}:`,
    '',
    ...executados.map((t) => `- ${t.titulo};`),
    '',
  ];

  if (falharam.length === 0) {
    linhas.push('Resultado: todos os cenários executados apresentaram o comportamento esperado conforme as regras descritas na task.', '');
  } else {
    const ok = n - falharam.length;
    const divergencia = falharam.length === 1 ? '1 cenário apresentou divergência' : `${falharam.length} cenários apresentaram divergência`;
    linhas.push(`Resultado: ${ok} de ${n} cenários apresentaram o comportamento esperado; ${divergencia} em relação às regras descritas na task:`);
    falharam.forEach((t) => {
      const passo = passoQueFalhou(t);
      linhas.push(`- ${t.titulo}${passo ? ` (passo ${passo})` : ''}: ${t.observacao.trim() || 'ver evidência'}`);
    });
    linhas.push('');
  }

  if (naoExecutados.length) {
    linhas.push('Não executados:');
    naoExecutados.forEach((t) => linhas.push(`- ${t.titulo}${t.observacao.trim() ? `: ${t.observacao.trim()}` : ''}`));
    linhas.push('');
  }

  linhas.push('📎 Evidências dos testes disponíveis em anexo.', '');

  if (falharam.length) linhas.push(`Reprovado. ❌ Bug(s) aberto(s): ${bugsAbertos(falharam)}`);
  else if (naoExecutados.length) linhas.push('Pendente de execução.');
  else linhas.push('Aprovado. ✅');

  return linhas.join('\n');
}

// Bugs preenchidos nos testes que falharam; o que faltar continua "#____".
export function bugsAbertos(falharam: TestCase[]): string {
  const numeros = [...new Set(falharam.map((t) => (t.bug ?? '').trim().replace(/^#/, '')).filter(Boolean))];
  const faltando = falharam.some((t) => !(t.bug ?? '').trim());
  return [...numeros.map((n) => `#${n}`), ...(faltando || !numeros.length ? ['#____'] : [])].join(', ');
}
