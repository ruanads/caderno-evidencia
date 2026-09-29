// Estado da tela em memoria + gravacao no IndexedDB.

import * as db from '../armazenamento/db.ts';
import type { Caderno, Evidencia, TestCase } from '../modelo.ts';

export type Filtro = 'todos' | 'falta' | 'falhou';

export const estado = {
  caderno: null as Caderno | null,
  evidencias: [] as Evidencia[],
  filtro: 'todos' as Filtro,
  editando: false,
  armazenamentoOk: true,
};

let tempoGravar = 0;

// Grava o caderno com um pequeno atraso, para nao gravar a cada tecla.
export function salvar(): void {
  clearTimeout(tempoGravar);
  tempoGravar = window.setTimeout(() => {
    if (estado.caderno) void db.gravarCaderno(estado.caderno);
  }, 300);
}

export function c(): Caderno {
  if (!estado.caderno) throw new Error('Nenhum caderno aberto.');
  return estado.caderno;
}

export function testeAtivo(): TestCase {
  const cad = c();
  return cad.testes.find((t) => t.id === cad.ativo.testeId) ?? cad.testes[0];
}

export function evidenciasDo(testeId: string, passo?: number): Evidencia[] {
  return estado.evidencias
    .filter((e) => e.testeId === testeId && (passo === undefined || e.passo === passo))
    .sort((a, b) => a.passo - b.passo || a.seq - b.seq);
}

export async function adicionarEvidencias(arquivos: File[]): Promise<number> {
  const t = testeAtivo();
  const passo = t.passos.length ? c().ativo.passo : 0;
  let seq = Math.max(0, ...evidenciasDo(t.id, passo).map((e) => e.seq));
  let quantos = 0;

  for (const arquivo of arquivos) {
    if (!arquivo.type.startsWith('image/')) continue;
    const ev: Evidencia = { id: crypto.randomUUID(), testeId: t.id, passo, seq: ++seq, legenda: '', blob: arquivo, criadoEm: Date.now() };
    estado.evidencias.push(ev);
    await db.gravarEvidencia(ev);
    quantos++;
  }
  return quantos;
}

export async function removerEvidencia(id: string): Promise<void> {
  estado.evidencias = estado.evidencias.filter((e) => e.id !== id);
  await db.apagarEvidencia(id);
}

export async function novoCaderno(caderno: Caderno): Promise<void> {
  await db.apagarTudo();
  estado.caderno = caderno;
  estado.evidencias = [];
  estado.filtro = 'todos';
  estado.editando = false;
  await db.gravarCaderno(caderno);
}
