// Relatorio de execucao de testes (Test Summary Report) em um HTML offline.
//
// Visual inspirado no Allure, mas o conteudo vem do caderno manual: veredito,
// numeros, grafico por status e por grupo, evolucao das rodadas de reteste,
// ambiente, riscos, defeitos e o detalhe de cada teste com os prints.
//
// "fonte" decide como a imagem entra: caminho relativo (dentro do .zip) ou
// data URL (arquivo unico para compartilhar).

import { passoQueFalhou, statusEfetivo, type Caderno, type Evidencia, type StatusTeste, type TestCase } from '../modelo.ts';
import { nomeEvidencia } from './nomes.ts';

export type Veredito = 'aprovado' | 'reprovado' | 'andamento';
export type LinhaRodada = { rodada: number; executados: number; ok: number; bad: number; skip: number };

const ROTULO: Record<StatusTeste, string> = { ok: 'Passou', bad: 'Falhou', skip: 'Não executado', '': 'Sem resultado' };
const COR: Record<StatusTeste, string> = { ok: '#1e7a46', bad: '#c0392b', skip: '#b7791f', '': '#aab4bf' };
const NIVEL = { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' } as const;

export function veredito(c: Caderno): Veredito {
  const st = c.testes.map(statusEfetivo);
  if (st.includes('bad')) return 'reprovado';
  if (st.some((s) => s !== 'ok')) return 'andamento';
  return 'aprovado';
}

// Status de um teste ao fim da rodada r. Quando um teste e reaberto, o
// resultado da rodada que terminou vai para o historico; se nao ha registro
// para r, o teste nao foi reaberto e o status valido e o seguinte conhecido.
export function statusNaRodada(t: TestCase, r: number): StatusTeste {
  const registro = (t.historico ?? []).filter((h) => h.rodada >= r).sort((a, b) => a.rodada - b.rodada)[0];
  return registro ? registro.status : statusEfetivo(t);
}

// Bug de teste que ainda falha esta aberto; bug de teste que passou no
// reteste foi corrigido.
export function situacaoBugs(c: Caderno): { abertos: string[]; corrigidos: string[] } {
  const num = (t: TestCase) => (t.bug ?? '').trim().replace(/^#/, '');
  const unicos = (ts: TestCase[]) => [...new Set(ts.map(num).filter(Boolean))];
  return {
    abertos: unicos(c.testes.filter((t) => statusEfetivo(t) === 'bad')),
    corrigidos: unicos(c.testes.filter((t) => statusEfetivo(t) === 'ok')),
  };
}

// Na rodada 1 todos executam; da 2 em diante, so os reabertos no reteste.
export function evolucaoRodadas(c: Caderno): LinhaRodada[] {
  const linhas: LinhaRodada[] = [];
  for (let r = 1; r <= c.rodada; r++) {
    const executados = r === 1 ? c.testes : c.testes.filter((t) => (t.historico ?? []).some((h) => h.rodada === r - 1));
    const st = executados.map((t) => statusNaRodada(t, r));
    linhas.push({ rodada: r, executados: executados.length, ok: st.filter((s) => s === 'ok').length, bad: st.filter((s) => s === 'bad').length, skip: st.filter((s) => s === 'skip').length });
  }
  return linhas;
}

export function gerarRelatorio(c: Caderno, evidencias: Evidencia[], fonte: (ev: Evidencia) => string, agora = Date.now()): string {
  const st = c.testes.map(statusEfetivo);
  const n = (s: StatusTeste) => st.filter((x) => x === s).length;
  const executados = n('ok') + n('bad');
  const taxa = executados ? Math.round((n('ok') / executados) * 100) : 0;
  const falharam = c.testes.filter((t) => statusEfetivo(t) === 'bad');
  const bugs = situacaoBugs(c);
  const subBugs = [...bugs.abertos.map((b) => `#${b} aberto`), ...bugs.corrigidos.map((b) => `#${b} corrigido`)].join(' · ');
  const totalBugs = bugs.abertos.length + bugs.corrigidos.length;
  const v = veredito(c);
  const rotuloVeredito = { aprovado: 'Aprovado', reprovado: 'Reprovado', andamento: 'Em andamento' }[v];

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório de execução - ${esc(c.tarefa)}</title>
<style>${CSS}</style></head><body>
<header class="topo v-${v}">
  <div class="topo-in">
    <div>
      <div class="rotulo">Relatório de execução de testes</div>
      <h1>${esc(c.tarefa)}</h1>
      <div class="meta">${data(c.criadoEm)} → ${data(c.atualizadoEm)}${c.rodada > 1 ? ` · ${c.rodada} rodadas (reteste)` : ''}${c.execucao?.executor ? ` · executado por ${esc(c.execucao.executor)}` : ''}</div>
    </div>
    <div class="veredito">${v === 'aprovado' ? '✔' : v === 'reprovado' ? '✖' : '…'} ${rotuloVeredito}</div>
  </div>
</header>

<main>
<section class="kpis">
  ${kpi('Test cases', c.testes.length, '')}
  ${kpi('Passaram', n('ok'), 'ok')}
  ${kpi('Falharam', n('bad'), 'bad')}
  ${kpi('Não executados', n('skip'), 'skip')}
  ${n('') ? kpi('Sem resultado', n(''), 'todo') : ''}
  ${kpi('Taxa de sucesso', `${taxa}%`, taxa === 100 ? 'ok' : taxa < 80 ? 'bad' : 'skip', 'dos executados')}
  ${kpi('Bugs', totalBugs, bugs.abertos.length || falharam.length ? 'bad' : totalBugs ? 'ok' : '', subBugs || (falharam.length ? 'número não informado' : ''))}
</section>

<section class="grade2">
  <div class="painel">
    <h2>Resultado</h2>
    <div class="rosca">${rosca(c.testes.map(statusEfetivo))}
      <ul class="legenda">${(['ok', 'bad', 'skip', ''] as StatusTeste[]).filter((s) => n(s)).map((s) => `<li><i style="background:${COR[s]}"></i>${ROTULO[s]} <b>${n(s)}</b></li>`).join('')}</ul>
    </div>
  </div>
  <div class="painel">
    <h2>Por grupo</h2>
    ${porGrupo(c)}
  </div>
</section>

${c.rodada > 1 ? `<section class="painel"><h2>Evolução por rodada</h2>${tabelaRodadas(c)}</section>` : ''}

<section class="grade2">
  <div class="painel"><h2>Ambiente</h2>${ambiente(c)}</div>
  <div class="painel"><h2>Riscos</h2>${riscos(c)}</div>
</section>

${falharam.length ? `<section class="painel"><h2>Defeitos</h2>
  <table class="tab"><tr><th>Teste</th><th>Passo</th><th>O que apareceu</th><th>Bug</th></tr>
  ${falharam.map((t) => `<tr><td><a href="#${t.id}">${t.id}</a> ${esc(t.titulo)}</td><td>${passoQueFalhou(t) || '—'}</td><td>${esc(t.observacao) || '<span class="mudo">—</span>'}</td>
    <td>${t.bug?.trim() ? `<b>#${esc(t.bug.trim().replace(/^#/, ''))}</b>` : '<span class="mudo">não informado</span>'}</td></tr>`).join('')}</table></section>` : ''}

<section class="painel">
  <div class="cab-detalhe"><h2>Testes</h2>
    <div class="filtros" role="group" aria-label="Filtrar testes">
      <button data-f="todos" aria-pressed="true">Todos ${c.testes.length}</button>
      ${(['ok', 'bad', 'skip', ''] as StatusTeste[]).filter((s) => n(s)).map((s) => `<button data-f="${s || 'nenhum'}" aria-pressed="false">${ROTULO[s]} ${n(s)}</button>`).join('')}
    </div>
  </div>
  ${c.testes.map((t) => detalhe(t, c, evidencias.filter((e) => e.testeId === t.id), fonte)).join('\n')}
</section>
</main>

<footer>Gerado pelo Caderno de Evidências em ${data(agora)} · os dados deste relatório vêm do caderno local e não foram enviados para lugar nenhum.</footer>
<div id="zoom" hidden><img alt=""></div>
<script>${SCRIPT}</script>
</body></html>
`;
}

// ------------------------------------------------------------------ blocos

function kpi(titulo: string, valor: string | number, tom: string, sub = ''): string {
  return `<div class="kpi ${tom}"><div class="v">${valor}</div><div class="t">${titulo}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;
}

function rosca(status: StatusTeste[]): string {
  const r = 54;
  const volta = 2 * Math.PI * r;
  let inicio = 0;
  const partes = (['ok', 'bad', 'skip', ''] as StatusTeste[]).map((s) => {
    const fatia = (status.filter((x) => x === s).length / status.length) * volta;
    const arco = fatia ? `<circle r="${r}" cx="70" cy="70" fill="none" stroke="${COR[s]}" stroke-width="22" stroke-dasharray="${fatia} ${volta - fatia}" stroke-dashoffset="${-inicio}"/>` : '';
    inicio += fatia;
    return arco;
  });
  const ok = status.filter((s) => s === 'ok').length;
  return `<svg viewBox="0 0 140 140" width="160" height="160" role="img" aria-label="${ok} de ${status.length} passaram">
    <g transform="rotate(-90 70 70)">${partes.join('')}</g>
    <text x="70" y="68" text-anchor="middle" class="rosca-n">${ok}/${status.length}</text>
    <text x="70" y="88" text-anchor="middle" class="rosca-t">passaram</text></svg>`;
}

function porGrupo(c: Caderno): string {
  const grupos = [...new Set(c.testes.map((t) => t.grupo))];
  return `<div class="barras">${grupos.map((g) => {
    const ts = c.testes.filter((t) => t.grupo === g);
    const seg = (['ok', 'bad', 'skip', ''] as StatusTeste[]).map((s) => {
      const q = ts.filter((t) => statusEfetivo(t) === s).length;
      return q ? `<i style="width:${(q / ts.length) * 100}%;background:${COR[s]}" title="${ROTULO[s]}: ${q}"></i>` : '';
    }).join('');
    const ok = ts.filter((t) => statusEfetivo(t) === 'ok').length;
    return `<div class="barra"><span class="nome">${esc(g || 'Sem grupo')}</span><span class="trilho">${seg}</span><span class="q">${ok}/${ts.length}</span></div>`;
  }).join('')}</div>`;
}

function tabelaRodadas(c: Caderno): string {
  return `<table class="tab"><tr><th>Rodada</th><th>Executados</th><th>Passaram</th><th>Falharam</th><th>Não executados</th></tr>
  ${evolucaoRodadas(c).map((l) => `<tr><td>${l.rodada === 1 ? '1 · execução' : `${l.rodada} · reteste`}</td><td>${l.executados}</td>
    <td class="c-ok">${l.ok}</td><td class="c-bad">${l.bad}</td><td class="c-skip">${l.skip}</td></tr>`).join('')}</table>`;
}

function ambiente(c: Caderno): string {
  const e = c.execucao;
  const linhas: [string, string][] = e
    ? ([['Ambiente', e.ambiente], ['Versão / build', e.versao], ['Branch', e.branch], ['Base de dados', e.baseDados], ['Executado por', e.executor]] as [string, string][]).filter(([, v]) => v.trim())
    : [];
  const navegadores = e?.navegadores.length ? `<tr><th>Navegadores</th><td>${e.navegadores.map((b) => `<span class="chip">${esc(b)}</span>`).join(' ')}</td></tr>` : '';
  if (!linhas.length && !navegadores && !e?.observacoes.trim()) return '<p class="mudo">Dados do ambiente não informados.</p>';
  return `<table class="kv">${linhas.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}${navegadores}</table>
    ${e?.observacoes.trim() ? `<p class="obs">${esc(e.observacoes)}</p>` : ''}`;
}

function riscos(c: Caderno): string {
  const rs = (c.riscos ?? []).filter((r) => r.descricao.trim());
  if (!rs.length) return '<p class="mudo">Nenhum risco registrado.</p>';
  const ordem = { alto: 0, medio: 1, baixo: 2 };
  return `<ul class="riscos">${[...rs].sort((a, b) => ordem[a.nivel] - ordem[b.nivel]).map((r) => `<li><span class="nivel n-${r.nivel}">${NIVEL[r.nivel]}</span>${esc(r.descricao)}</li>`).join('')}</ul>`;
}

function detalhe(t: TestCase, c: Caderno, evs: Evidencia[], fonte: (ev: Evidencia) => string): string {
  const st = statusEfetivo(t);
  const falhou = passoQueFalhou(t);
  const massa = c.massa.filter((m) => m.testeId === t.id);
  const ordenadas = [...evs].sort((a, b) => a.rodada - b.rodada || a.passo - b.passo || a.seq - b.seq);
  return `<details class="teste s-${st || 'nenhum'}" id="${t.id}" data-s="${st || 'nenhum'}" ${st === 'bad' ? 'open' : ''}>
  <summary><span class="dot" style="background:${COR[st]}"></span><span class="id">${t.id}</span><span class="tt">${esc(t.titulo)}</span>
    <span class="st">${ROTULO[st]}${falhou ? ` · passo ${falhou}` : ''}${t.bug?.trim() ? ` · bug #${esc(t.bug.trim().replace(/^#/, ''))}${st === 'ok' ? ' corrigido' : ''}` : ''}</span>${evs.length ? `<span class="cam">${evs.length} 📷</span>` : ''}</summary>
  <div class="corpo">
    ${t.passos.length ? `<table class="tab passos"><tr><th>#</th><th>Ação</th><th>Resultado esperado</th><th></th></tr>
      ${t.passos.map((p, i) => `<tr class="${p.status === 'bad' ? 'p-bad' : ''}"><td>${i + 1}</td><td>${esc(p.acao)}</td><td>${esc(p.esperado)}</td>
        <td>${p.status === 'ok' ? '<span class="c-ok">✔</span>' : p.status === 'bad' ? '<span class="c-bad">✖</span>' : ''}</td></tr>`).join('')}</table>` : ''}
    ${massa.length ? `<p><b>Massa:</b> ${massa.map((m) => `${esc(m.campo)} = <code>${esc(m.valor)}</code>${m.observacao ? ` (${esc(m.observacao)})` : ''}`).join(' · ')}</p>` : ''}
    ${t.observacao.trim() ? `<p><b>O que apareceu:</b> ${esc(t.observacao)}</p>` : ''}
    ${t.historico?.length ? `<p class="mudo"><b>Rodadas anteriores:</b> ${t.historico.map((h) => `rodada ${h.rodada}: ${ROTULO[h.status]}${h.passoQueFalhou ? ` no passo ${h.passoQueFalhou}` : ''}${h.observacao ? ` (${esc(h.observacao)})` : ''}`).join(' · ')}</p>` : ''}
    ${ordenadas.length ? `<div class="prints">${ordenadas.map((e) => {
      const nome = nomeEvidencia({ ...e, tipo: e.blob.type });
      return `<figure><img src="${fonte(e)}" alt="${esc(nome)}" loading="lazy"><figcaption>${esc(nome)}</figcaption></figure>`;
    }).join('')}</div>` : '<p class="mudo">Sem prints.</p>'}
  </div>
</details>`;
}

function data(ms: number): string {
  return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

// Filtro por status e ampliar print. Fica dentro do HTML gerado (offline).
const SCRIPT = `
document.querySelectorAll('.filtros button').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.filtros button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    document.querySelectorAll('details.teste').forEach(function (d) { d.hidden = b.dataset.f !== 'todos' && d.dataset.s !== b.dataset.f; });
  });
});
var zoom = document.getElementById('zoom');
document.addEventListener('click', function (e) {
  if (e.target.matches('.prints img')) { zoom.querySelector('img').src = e.target.src; zoom.hidden = false; }
  else if (e.target.closest('#zoom')) { zoom.hidden = true; }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zoom.hidden = true; });
`;

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#f3f5f7;color:#16212b;font:15px/1.5 "Segoe UI",system-ui,sans-serif}
.topo{color:#fff;padding:28px 16px}
.topo.v-aprovado{background:linear-gradient(135deg,#145a33,#1e7a46)}
.topo.v-reprovado{background:linear-gradient(135deg,#8e2318,#c0392b)}
.topo.v-andamento{background:linear-gradient(135deg,#1b3f5e,#1d5c8c)}
.topo-in,main,footer{max-width:1180px;margin:0 auto}
.topo-in{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.rotulo{text-transform:uppercase;letter-spacing:.08em;font-size:12px;opacity:.85;font-weight:600}
h1{margin:4px 0;font-size:24px}
.meta{opacity:.9;font-size:14px}
.veredito{font-size:26px;font-weight:700;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.5);border-radius:12px;padding:10px 20px;white-space:nowrap}
main{padding:20px 16px;display:flex;flex-direction:column;gap:16px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.kpi{background:#fff;border:1px solid #dce2e8;border-radius:12px;padding:14px 16px;border-top:4px solid #aab4bf}
.kpi .v{font-size:28px;font-weight:700;line-height:1.1}
.kpi .t{color:#5e6b78;font-size:13px;font-weight:600}
.kpi .s{color:#5e6b78;font-size:12px;margin-top:2px}
.kpi.ok{border-top-color:#1e7a46}.kpi.ok .v{color:#1e7a46}
.kpi.bad{border-top-color:#c0392b}.kpi.bad .v{color:#c0392b}
.kpi.skip{border-top-color:#b7791f}.kpi.skip .v{color:#b7791f}
.grade2{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}
.painel{background:#fff;border:1px solid #dce2e8;border-radius:12px;padding:16px 18px;min-width:0}
h2{margin:0 0 12px;font-size:16px}
.rosca{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.rosca-n{font-size:22px;font-weight:700;fill:#16212b}.rosca-t{font-size:11px;fill:#5e6b78}
.legenda{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.legenda i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:8px;vertical-align:-1px}
.barras{display:flex;flex-direction:column;gap:12px}
.barra{display:grid;grid-template-columns:110px 1fr 44px;gap:10px;align-items:center;font-size:14px}
.barra .nome{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trilho{display:flex;height:14px;border-radius:99px;overflow:hidden;background:#ebeff3}
.trilho i{display:block;height:100%}
.barra .q{text-align:right;color:#5e6b78;font-variant-numeric:tabular-nums}
.tab{width:100%;border-collapse:collapse;font-size:14px}
.tab th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#5e6b78;border-bottom:1px solid #dce2e8;padding:6px 8px}
.tab td{border-bottom:1px solid #ebeff3;padding:7px 8px;vertical-align:top}
.tab a{color:#1d5c8c;font-weight:600;text-decoration:none}
.kv{border-collapse:collapse;font-size:14px}.kv th{text-align:left;color:#5e6b78;font-weight:600;padding:4px 16px 4px 0;white-space:nowrap}.kv td{padding:4px 0}
.chip{display:inline-block;background:#e3eef7;color:#1d5c8c;border-radius:99px;padding:1px 10px;font-size:13px;font-weight:600}
.obs{margin:10px 0 0;color:#5e6b78;font-size:14px}
.riscos{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.riscos li{display:flex;gap:10px;align-items:baseline}
.nivel{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-radius:5px;padding:2px 8px;white-space:nowrap}
.n-alto{background:#fbe4e1;color:#c0392b}.n-medio{background:#fcf0d6;color:#9a6200}.n-baixo{background:#dff3e7;color:#1e7a46}
.c-ok{color:#1e7a46;font-weight:700}.c-bad{color:#c0392b;font-weight:700}.c-skip{color:#b7791f;font-weight:700}
.mudo{color:#8391a0}
.cab-detalhe{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.cab-detalhe h2{margin:0}
.filtros{display:flex;gap:6px;flex-wrap:wrap}
.filtros button{border:1px solid #dce2e8;background:#fff;border-radius:99px;padding:4px 12px;font:inherit;font-size:13px;font-weight:600;color:#5e6b78;cursor:pointer}
.filtros button[aria-pressed=true]{background:#16212b;color:#fff;border-color:#16212b}
details.teste{border:1px solid #dce2e8;border-radius:10px;margin-top:8px;border-left:5px solid #aab4bf;background:#fff}
details.s-ok{border-left-color:#1e7a46}details.s-bad{border-left-color:#c0392b}details.s-skip{border-left-color:#b7791f}
summary{display:flex;gap:10px;align-items:center;padding:10px 14px;cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
summary .dot{width:10px;height:10px;border-radius:50%;flex:none}
summary .id{font:600 12px ui-monospace,Consolas,monospace;color:#5e6b78}
summary .tt{flex:1;font-weight:600;min-width:0}
summary .st{font-size:13px;color:#5e6b78;white-space:nowrap}
summary .cam{font-size:12px;color:#5e6b78}
.corpo{padding:0 14px 14px}
.passos .p-bad td{background:#fdf1ef}
.prints{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:8px}
.prints figure{margin:0;border:1px solid #dce2e8;border-radius:8px;overflow:hidden}
.prints img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top left;cursor:zoom-in;background:#ebeff3}
.prints figcaption{font:11.5px ui-monospace,Consolas,monospace;color:#5e6b78;padding:6px 8px;overflow-wrap:anywhere}
code{background:#ebeff3;border-radius:4px;padding:0 5px}
#zoom{position:fixed;inset:0;background:rgba(10,16,22,.8);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out}
#zoom[hidden]{display:none}
#zoom img{max-width:100%;max-height:100%;border-radius:8px}
footer{padding:8px 16px 32px;color:#8391a0;font-size:12.5px}
@media print{.topo,.kpi,.trilho i,.nivel{-webkit-print-color-adjust:exact;print-color-adjust:exact}.filtros{display:none}details.teste{break-inside:avoid-page}}
`;
