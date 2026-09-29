// Pacote de evidencias (.zip): prints nomeados + resumo.html + comentario.txt.
// O resumo abre offline e mostra cada teste, passos, status, observacao,
// massa e os prints (referenciados pela pasta evidencias/ do proprio zip).

import JSZip from 'jszip';
import { passoQueFalhou, statusEfetivo, type Caderno, type Evidencia, type TestCase } from '../modelo.ts';
import { gerarComentario } from './comentario.ts';
import { nomeEvidencia, slug } from './nomes.ts';

const ROTULO = { ok: 'Passou', bad: 'Falhou', skip: 'Não executado', '': 'Sem resultado' } as const;

export function nomeDoArquivo(ev: Evidencia): string {
  return nomeEvidencia({ ...ev, tipo: ev.blob.type });
}

export function nomeDoPacote(tarefa: string): string {
  return `evidencias_${slug(tarefa, 60) || 'caderno'}.zip`;
}

export async function gerarPacote(caderno: Caderno, evidencias: Evidencia[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const pasta = zip.folder('evidencias')!;

  for (const ev of ordenar(evidencias)) {
    pasta.file(nomeDoArquivo(ev), new Uint8Array(await ev.blob.arrayBuffer()));
  }
  zip.file('resumo.html', gerarResumo(caderno, evidencias));
  zip.file('comentario.txt', gerarComentario(caderno.tarefa, caderno.testes));

  return zip.generateAsync({ type: 'uint8array' });
}

export function ordenar(evidencias: Evidencia[]): Evidencia[] {
  return [...evidencias].sort((a, b) => a.testeId.localeCompare(b.testeId) || a.passo - b.passo || a.seq - b.seq);
}

export function gerarResumo(caderno: Caderno, evidencias: Evidencia[]): string {
  const testes = caderno.testes.map((t) => blocoTeste(t, caderno, ordenar(evidencias.filter((e) => e.testeId === t.id)))).join('\n');
  const total = (s: string) => caderno.testes.filter((t) => statusEfetivo(t) === s).length;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Evidências - ${esc(caderno.tarefa)}</title>
<style>
body{font:15px/1.5 "Segoe UI",system-ui,sans-serif;max-width:1000px;margin:24px auto;padding:0 16px;color:#16212b}
h1{font-size:22px;margin:0 0 4px} h2{font-size:17px;margin:0} .muted{color:#5e6b78}
section{border:1px solid #dce2e8;border-radius:10px;padding:14px 16px;margin:16px 0;border-top:4px solid #dce2e8}
section.ok{border-top-color:#1e7a46} section.bad{border-top-color:#b42318} section.skip{border-top-color:#9a6200}
.st{font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.ok .st{color:#1e7a46} .bad .st{color:#b42318} .skip .st{color:#9a6200}
table{width:100%;border-collapse:collapse;margin:8px 0;font-size:14px} td,th{border-bottom:1px solid #e5e9ee;padding:6px;text-align:left;vertical-align:top}
figure{margin:8px 0} figure img{max-width:100%;border:1px solid #dce2e8;border-radius:6px} figcaption{font:12px ui-monospace,Consolas,monospace;color:#5e6b78}
@media print{section{break-inside:avoid-page}}
</style></head><body>
<h1>Caderno de Evidências</h1>
<p class="muted">Task ${esc(caderno.tarefa)} · ${caderno.testes.length} testes · ${total('ok')} passaram · ${total('bad')} falharam · ${total('skip')} não executados</p>
${testes}
</body></html>
`;
}

function blocoTeste(t: TestCase, caderno: Caderno, evs: Evidencia[]): string {
  const st = statusEfetivo(t);
  const falhou = passoQueFalhou(t);
  const massa = caderno.massa.filter((m) => m.testeId === t.id);
  const passos = t.passos
    .map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.acao)}</td><td>${esc(p.esperado)}</td><td>${p.status === 'ok' ? '✔' : p.status === 'bad' ? '✖' : ''}</td></tr>`)
    .join('');
  const figuras = evs
    .map((e) => `<figure><img src="evidencias/${esc(nomeDoArquivo(e))}" alt=""><figcaption>${esc(nomeDoArquivo(e))}</figcaption></figure>`)
    .join('');

  return `<section class="${st}">
<div class="st">${ROTULO[st]}${falhou ? ` · falhou no passo ${falhou}` : ''}</div>
<h2>${esc(t.id)} · ${esc(t.titulo)}</h2>
${t.passos.length ? `<table><tr><th>#</th><th>Ação</th><th>Resultado esperado</th><th></th></tr>${passos}</table>` : ''}
${massa.length ? `<p><strong>Massa:</strong> ${massa.map((m) => `${esc(m.campo)} = ${esc(m.valor)}${m.observacao ? ` (${esc(m.observacao)})` : ''}`).join(' · ')}</p>` : ''}
${t.observacao.trim() ? `<p><strong>O que apareceu:</strong> ${esc(t.observacao)}</p>` : ''}
${figuras || '<p class="muted">Sem prints.</p>'}
</section>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
