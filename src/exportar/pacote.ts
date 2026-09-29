// Pacote de evidencias (.zip): prints nomeados + relatorio.html + comentario.txt.
// O relatorio abre offline e referencia os prints pela pasta evidencias/ do zip.

import JSZip from 'jszip';
import type { Caderno, Evidencia } from '../modelo.ts';
import { gerarComentario } from './comentario.ts';
import { nomeEvidencia, slug } from './nomes.ts';
import { gerarRelatorio } from './relatorio.ts';

export function nomeDoArquivo(ev: Evidencia): string {
  return nomeEvidencia({ ...ev, tipo: ev.blob.type });
}

export function nomeDoPacote(tarefa: string): string {
  return `evidencias_${slug(tarefa, 60) || 'caderno'}.zip`;
}

export function nomeDoRelatorio(tarefa: string): string {
  return `relatorio_${slug(tarefa, 60) || 'caderno'}.html`;
}

export async function gerarPacote(caderno: Caderno, evidencias: Evidencia[]): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new JSZip();
  const pasta = zip.folder('evidencias')!;

  for (const ev of ordenar(evidencias)) {
    pasta.file(nomeDoArquivo(ev), new Uint8Array(await ev.blob.arrayBuffer()));
  }
  zip.file('relatorio.html', gerarRelatorio(caderno, evidencias, (ev) => `evidencias/${encodeURIComponent(nomeDoArquivo(ev))}`));
  zip.file('comentario.txt', gerarComentario(caderno.tarefa, caderno.testes));

  // O JSZip gera sobre um ArrayBuffer comum; o tipo generico dele nao diz isso.
  return (await zip.generateAsync({ type: 'uint8array' })) as Uint8Array<ArrayBuffer>;
}

// Relatorio num arquivo so, com as imagens embutidas: para mandar para alguem.
export async function gerarRelatorioUnico(caderno: Caderno, evidencias: Evidencia[]): Promise<string> {
  const embutidas = new Map<string, string>();
  for (const ev of evidencias) embutidas.set(ev.id, await paraDataUrl(ev.blob));
  return gerarRelatorio(caderno, evidencias, (ev) => embutidas.get(ev.id) ?? '');
}

export function ordenar(evidencias: Evidencia[]): Evidencia[] {
  return [...evidencias].sort((a, b) => a.testeId.localeCompare(b.testeId) || a.rodada - b.rodada || a.passo - b.passo || a.seq - b.seq);
}

async function paraDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/png'};base64,${btoa(binario)}`;
}
