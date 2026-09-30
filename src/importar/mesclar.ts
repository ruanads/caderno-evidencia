// Importar CSV num caderno que ja existe.
//
// Caderno so com o test case em branco do inicio (criado sem CSV): o CSV
// substitui esse teste e o formato do arquivo passa a valer, como se o caderno
// tivesse nascido com ele. Caso contrario, os test cases do CSV entram no fim,
// com IDs novos a partir do maior existente, e o formato do caderno e mantido.
// Em ambos os casos, a massa que estava sem teste tenta ligar de novo.

import type { Caderno, FormatoCsv, TestCase } from '../modelo.ts';
import { ligarMassa } from './massa.ts';

export type ResultadoMescla = { adicionados: string[]; substituiuEmBranco: boolean };

export function cadernoEmBranco(c: Caderno): boolean {
  return c.testes.length === 1 && testeVazio(c.testes[0]);
}

function testeVazio(t: TestCase): boolean {
  const semTitulo = !t.titulo.replace(/^\[[^\]]*\]\s*/, '').trim();
  return semTitulo && t.passos.every((p) => !p.acao.trim() && !p.esperado.trim() && !p.status) && !t.status && !t.observacao.trim();
}

// "podeSubstituir" vem da tela: se o teste em branco ja tem prints, ele nao e
// substituido (os prints ficariam presos ao CT01 importado, que e outro teste).
export function mesclarTestes(c: Caderno, importados: TestCase[], formato: FormatoCsv, podeSubstituir = cadernoEmBranco(c)): ResultadoMescla {
  const substituir = podeSubstituir && cadernoEmBranco(c);
  const base = substituir ? [] : c.testes;
  const maior = Math.max(0, ...base.map((t) => Number(t.id.replace(/\D/g, '')) || 0));
  const total = base.length + importados.length;
  const largura = String(maior + importados.length).length > 2 || total > 99 ? 3 : 2;

  const novos = importados.map((t, i) => ({ ...t, id: `CT${String(maior + i + 1).padStart(largura, '0')}` }));
  c.testes = [...base, ...novos];
  if (substituir) c.formato = formato;

  const soltas = c.massa.filter((m) => !m.testeId);
  const religadas = ligarMassa(soltas, novos);
  soltas.forEach((m, i) => (m.testeId = religadas[i].testeId));

  if (substituir || !c.testes.some((t) => t.id === c.ativo.testeId)) c.ativo = { testeId: c.testes[0].id, passo: 1 };
  return { adicionados: novos.map((t) => t.id), substituiuEmBranco: substituir };
}

// Valor comum de um campo do Azure entre os testes: "" se vazio em todos,
// null se houver valores diferentes.
export function valorComum(testes: TestCase[], campo: 'areaPath' | 'assignedTo'): string | null {
  const valores = [...new Set(testes.map((t) => t.azure[campo].trim()).filter(Boolean))];
  if (valores.length > 1) return null;
  return valores[0] ?? '';
}
