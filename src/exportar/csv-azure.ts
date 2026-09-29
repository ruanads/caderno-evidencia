// Gera o CSV de importacao do Azure Test Plans a partir do caderno.
//
// Regra principal: se nada foi editado, o arquivo sai identico ao importado
// (BOM, quebra de linha, aspas). Por isso cada linha parte da linha original e
// so as colunas que o caderno controla sao sobrescritas; o resto volta como veio.
//
// O resultado da execucao (passou/falhou) NAO vai para este arquivo: fica so no
// caderno e no comentario da task.

import Papa from 'papaparse';
import type { Caderno, FormatoCsv, TestCase } from '../modelo.ts';

const COL = { id: 0, tipo: 1, titulo: 2, passo: 3, acao: 4, esperado: 5, area: 6, responsavel: 7, estado: 8 } as const;

export function exportarCsvAzure(caderno: Pick<Caderno, 'testes' | 'formato'>): string {
  const { formato } = caderno;
  const linhas: string[][] = [formato.cabecalho, ...caderno.testes.flatMap((t) => linhasDoTeste(t, formato))];

  const corpo = Papa.unparse(linhas, { newline: formato.quebra, quotes: false });
  return (formato.bom ? '﻿' : '') + corpo + (formato.terminaComQuebra ? formato.quebra : '');
}

function linhasDoTeste(t: TestCase, formato: FormatoCsv): string[][] {
  const largura = formato.cabecalho.length;
  const quantidade = Math.max(1, t.passos.length);
  const linhas: string[][] = [];

  for (let i = 0; i < quantidade; i++) {
    const linha = [...(t.linhasOriginais[i] ?? Array<string>(largura).fill(''))];
    while (linha.length < largura) linha.push('');
    const passo = t.passos[i];

    if (i === 0) {
      linha[COL.id] = t.azure.id;
      linha[COL.tipo] = 'Test Case';
      linha[COL.titulo] = t.titulo;
      linha[COL.area] = t.azure.areaPath;
      linha[COL.responsavel] = t.azure.assignedTo;
      linha[COL.estado] = t.azure.state;
    } else {
      // Linha de passo: as colunas do test case ficam vazias, como o Azure espera.
      linha[COL.id] = '';
      linha[COL.tipo] = '';
      linha[COL.titulo] = '';
    }

    linha[COL.passo] = passo ? String(i + 1) : '';
    linha[COL.acao] = passo?.acao ?? '';
    linha[COL.esperado] = passo?.esperado ?? '';
    linhas.push(linha);
  }
  return linhas;
}
