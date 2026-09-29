// Le o arquivo de massa (CSV ou JSON) e liga cada linha a um test case.
//
// Colunas: teste, campo, valor, observacao. A coluna "teste" pode trazer o ID
// interno (CT03) ou o Title exato. O que nao casar fica com testeId = "" para
// a pessoa associar manualmente na tela. Um teste pode ter varias linhas.

import Papa from 'papaparse';
import type { LinhaMassa, TestCase } from '../modelo.ts';

export type ResultadoMassa = { ok: true; linhas: LinhaMassa[] } | { ok: false; erro: string };

export function importarMassa(texto: string, nomeArquivo: string, testes: TestCase[]): ResultadoMassa {
  const limpo = texto.replace(/^﻿/, '');
  if (!limpo.trim()) return { ok: false, erro: 'O arquivo de massa esta vazio.' };

  const ehJson = /\.json$/i.test(nomeArquivo) || /^[[{]/.test(limpo.trim());
  let registros: Record<string, unknown>[];

  if (ehJson) {
    try {
      const dado = JSON.parse(limpo) as unknown;
      const lista = Array.isArray(dado) ? dado : (dado as { massa?: unknown }).massa;
      if (!Array.isArray(lista)) return { ok: false, erro: 'O JSON de massa precisa ser uma lista: [{ "teste": ..., "campo": ..., "valor": ... }].' };
      registros = lista as Record<string, unknown>[];
    } catch (erro) {
      return { ok: false, erro: `JSON invalido: ${(erro as Error).message}` };
    }
  } else {
    const lido = Papa.parse<Record<string, string>>(limpo, { header: true, skipEmptyLines: true });
    if (lido.errors.length) return { ok: false, erro: `CSV de massa mal formado na linha ${(lido.errors[0].row ?? 0) + 2}: ${lido.errors[0].message}` };
    registros = lido.data;
  }

  const linhas = registros.map(normalizar);
  const semColunas = ['teste', 'campo', 'valor'].filter((c) => !registros.some((r) => chaves(r).includes(c)));
  if (semColunas.length) return { ok: false, erro: `A massa precisa das colunas teste, campo e valor. Faltando: ${semColunas.join(', ')}.` };

  return { ok: true, linhas: ligarMassa(linhas, testes) };
}

// Liga pelo ID (sem diferenca de maiusculas) ou pelo Title exato.
export function ligarMassa(linhas: LinhaMassa[], testes: TestCase[]): LinhaMassa[] {
  return linhas.map((l) => {
    const alvo = l.teste.trim();
    const achado = testes.find((t) => t.id.toLowerCase() === alvo.toLowerCase()) ?? testes.find((t) => t.titulo === alvo);
    return { ...l, testeId: achado ? achado.id : '' };
  });
}

function chaves(r: Record<string, unknown>): string[] {
  return Object.keys(r).map(chave);
}

// "Observação", " OBSERVACAO " e "observacao" viram a mesma chave.
function chave(k: string): string {
  return k.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function normalizar(r: Record<string, unknown>): LinhaMassa {
  const valor = (nome: string) => {
    const k = Object.keys(r).find((x) => chave(x) === nome);
    return k === undefined || r[k] === null || r[k] === undefined ? '' : String(r[k]).trim();
  };
  return { teste: valor('teste'), campo: valor('campo'), valor: valor('valor'), observacao: valor('observacao'), testeId: '' };
}
