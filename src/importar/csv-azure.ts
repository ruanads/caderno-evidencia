// Le o CSV de importacao do Azure Test Plans (o mesmo que a IA da empresa gera).
//
// Formato: uma linha "Test Case" abre o teste; as linhas seguintes com Title
// vazio sao os passos dele. O parser e o PapaParse, nunca split(","): campos
// com virgula vem entre aspas.

import Papa from 'papaparse';
import { CABECALHO_AZURE, type FormatoCsv, type TestCase } from '../modelo.ts';

const COL = { id: 0, tipo: 1, titulo: 2, passo: 3, acao: 4, esperado: 5, area: 6, responsavel: 7, estado: 8 } as const;

export type ResultadoImportacao =
  | { ok: true; testes: TestCase[]; formato: FormatoCsv }
  | { ok: false; erro: string };

export function importarCsvAzure(texto: string): ResultadoImportacao {
  const bom = texto.startsWith('﻿');
  const semBom = bom ? texto.slice(1) : texto;
  if (!semBom.trim()) return { ok: false, erro: 'O arquivo esta vazio.' };

  const quebra: FormatoCsv['quebra'] = semBom.includes('\r\n') ? '\r\n' : '\n';
  const terminaComQuebra = semBom.endsWith('\n');

  const lido = Papa.parse<string[]>(semBom, { skipEmptyLines: true });
  if (lido.errors.length) {
    const e = lido.errors[0];
    return { ok: false, erro: `O CSV esta mal formado na linha ${(e.row ?? 0) + 1}: ${e.message}` };
  }

  const [cabecalho, ...linhas] = lido.data;
  const erroCabecalho = validarCabecalho(cabecalho);
  if (erroCabecalho) return { ok: false, erro: erroCabecalho };

  const testes: TestCase[] = [];
  let atual: TestCase | null = null;

  linhas.forEach((linha, i) => {
    const tipo = (linha[COL.tipo] ?? '').trim();
    const titulo = (linha[COL.titulo] ?? '').trim();

    if (tipo === 'Test Case') {
      atual = novoTeste(linha, testes.length + 1);
      testes.push(atual);
    } else if (!titulo && atual) {
      atual.linhasOriginais.push(linha);
    } else {
      throw new Error(`Linha ${i + 2}: esperava um "Test Case" ou um passo (Title vazio).`);
    }

    const acao = linha[COL.acao] ?? '';
    const esperado = linha[COL.esperado] ?? '';
    if (atual && (acao || esperado || linha[COL.passo])) atual.passos.push({ acao, esperado, status: '' });
  });

  if (testes.length === 0) return { ok: false, erro: 'Nenhum "Test Case" encontrado no arquivo.' };

  const largura = String(testes.length).length > 2 ? 3 : 2;
  testes.forEach((t, i) => (t.id = `CT${String(i + 1).padStart(largura, '0')}`));

  return { ok: true, testes, formato: { cabecalho, bom, quebra, terminaComQuebra } };
}

// Versao que nunca lanca: erros de estrutura viram mensagem para a tela.
export function importarCsvAzureSeguro(texto: string): ResultadoImportacao {
  try {
    return importarCsvAzure(texto);
  } catch (erro) {
    return { ok: false, erro: (erro as Error).message };
  }
}

function validarCabecalho(cabecalho: string[] | undefined): string | null {
  const esperado = [...CABECALHO_AZURE];
  const recebido = (cabecalho ?? []).map((c) => c.trim());
  if (esperado.length === recebido.length && esperado.every((c, i) => c === recebido[i])) return null;

  const faltando = esperado.filter((c) => !recebido.includes(c));
  const sobrando = recebido.filter((c) => !(esperado as string[]).includes(c));
  const partes = ['O cabecalho do CSV nao e o do Azure Test Plans.'];
  if (faltando.length) partes.push(`Faltando: ${faltando.join(', ')}.`);
  if (sobrando.length) partes.push(`Nao reconhecidas: ${sobrando.join(', ')}.`);
  if (!faltando.length && !sobrando.length) partes.push('As colunas estao fora de ordem.');
  partes.push(`Esperado: ${esperado.join(',')}`);
  return partes.join('\n');
}

function novoTeste(linha: string[], ordem: number): TestCase {
  const titulo = (linha[COL.titulo] ?? '').trim();
  const prefixo = /^\[([^\]]+)\]\s*/.exec(titulo);
  return {
    id: `CT${ordem}`,
    titulo,
    grupo: prefixo ? prefixo[1].trim() : '',
    passos: [],
    status: '',
    observacao: '',
    azure: {
      id: linha[COL.id] ?? '',
      areaPath: linha[COL.area] ?? '',
      assignedTo: linha[COL.responsavel] ?? '',
      state: linha[COL.estado] ?? '',
    },
    linhasOriginais: [linha],
  };
}

// Titulo sem o prefixo de grupo, para a lista lateral.
export function tituloCurto(t: TestCase): string {
  return t.titulo.replace(/^\[[^\]]+\]\s*/, '');
}
