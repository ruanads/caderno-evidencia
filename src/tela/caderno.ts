// Tela do caderno: lista de testes a esquerda, teste ativo a direita.
//
// Fluxo de execucao (poucos passos): escolher o teste, clicar no passo, tirar o
// print (Win+Shift+S), colar (Ctrl+V: cai no passo ativo), marcar ✔ ou ✖ no passo.
// Marcar ✔ avanca para o proximo passo. Um passo com ✖ reprova o teste inteiro.

import { tituloCurto } from '../importar/csv-azure.ts';
import { rascunhoBug } from '../exportar/bug.ts';
import { gerarComentario } from '../exportar/comentario.ts';
import { exportarCsvAzure } from '../exportar/csv-azure.ts';
import { nomeEvidencia, slug } from '../exportar/nomes.ts';
import { gerarPacote, nomeDoPacote } from '../exportar/pacote.ts';
import { passoQueFalhou, statusEfetivo, type Evidencia, type StatusTeste, type TestCase } from '../modelo.ts';
import * as db from '../armazenamento/db.ts';
import { iniciarReteste, testesDoReteste, type EscopoReteste } from '../reteste.ts';
import { adicionarEvidencias, c, estado, evidenciasDo, removerEvidencia, salvar, testeAtivo, type Filtro } from './estado.ts';
import { $, abrirModal, aviso, baixar, confirmarNoSegundoClique, copiarTexto, esc, fecharModal } from './util.ts';

const ROTULO: Record<StatusTeste, string> = { ok: 'Passou', bad: 'Falhou', skip: 'Não executado', '': 'A fazer' };
const urls = new Map<string, string>();
let eventosGlobaisLigados = false;
let voltar: () => void = () => {};

export function mostrarCaderno(voltarParaInicio: () => void): void {
  voltar = voltarParaInicio;
  $('#app')!.innerHTML = `<div class="wrap">
    <header class="top">
      <div class="brand"><h1>Caderno de Evidências</h1><div class="task" id="tarefa"></div></div>
      <div class="prog" id="prog"></div>
      <div class="tools">
        <button class="btn primary" data-acao="comentario">Gerar comentário</button>
        <button class="btn" data-acao="csv">Exportar CSV do Azure</button>
        <button class="btn" data-acao="zip">Baixar evidências (.zip)</button>
        <button class="btn" data-acao="reteste">Iniciar reteste</button>
        <button class="btn ghost" data-acao="novo">Meus cadernos</button>
      </div>
    </header>
    <div class="help">
      <span>1. Escolha o teste</span><span>2. Clique no passo</span>
      <span>3. <b>Win+Shift+S</b> tira o print</span><span>4. <b>Ctrl+V</b> cola no passo</span><span>5. Marque ✔ ou ✖</span>
    </div>
    <div id="pendencia"></div>
    <div class="grid">
      <aside class="list" aria-label="Testes">
        <div class="filters" id="filtros">
          <button data-filtro="todos">Todos</button><button data-filtro="falta">Falta fazer</button><button data-filtro="falhou">Falhou</button>
        </div>
        <div class="items" id="itens"></div>
        <div class="rodape"><button class="btn ghost" data-acao="novo-teste">+ Novo test case</button></div>
      </aside>
      <main id="principal"></main>
    </div>
    <p class="note">${estado.armazenamentoOk
      ? 'Os dados e os prints ficam salvos só neste navegador, neste computador. Nada é enviado para a internet. Outro navegador ou outro computador não vê este caderno.'
      : 'Este navegador não permitiu salvar (IndexedDB indisponível): se fechar a página, perde o caderno. Exporte antes de sair.'}</p>
  </div>`;

  $('#app')!.onclick = aoClicar;
  $('#app')!.oninput = aoDigitar;
  $('#app')!.onchange = aoMudar;
  ligarEventosGlobais();
  renderTudo();
}

// ------------------------------------------------------------------ render

function renderTudo(): void {
  renderTopo();
  renderLista();
  renderCard();
  renderPendencia();
}

function renderTopo(): void {
  const cad = c();
  const st = cad.testes.map(statusEfetivo);
  const n = (s: StatusTeste) => st.filter((x) => x === s).length;
  const feitos = st.filter(Boolean).length;
  const w = (x: number) => `${((x / cad.testes.length) * 100).toFixed(1)}%`;

  $('#tarefa')!.textContent = `Task ${cad.tarefa}${cad.rodada > 1 ? ` · Reteste (rodada ${cad.rodada})` : ''}`;
  $('#prog')!.innerHTML = `<div class="bar" aria-hidden="true"><i style="width:${w(n('ok'))};background:var(--ok)"></i><i style="width:${w(n('bad'))};background:var(--bad)"></i><i style="width:${w(n('skip'))};background:var(--warn)"></i></div>
    <span class="chip c-todo">${feitos}/${cad.testes.length} feitos</span><span class="chip c-ok">${n('ok')} passou</span>
    <span class="chip c-bad">${n('bad')} falhou</span>${n('skip') ? `<span class="chip c-skip">${n('skip')} não executado</span>` : ''}`;
  document.querySelectorAll<HTMLButtonElement>('#filtros button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === estado.filtro)));
}

function renderLista(): void {
  const cad = c();
  let html = '';
  let grupo: string | null = null;

  for (const t of cad.testes) {
    const st = statusEfetivo(t);
    if (estado.filtro === 'falta' && st) continue;
    if (estado.filtro === 'falhou' && st !== 'bad') continue;
    if (t.grupo !== grupo) {
      grupo = t.grupo;
      html += `<div class="grupo">${esc(grupo || 'Sem grupo')}</div>`;
    }
    const fotos = evidenciasDo(t.id).length;
    html += `<button class="item" data-teste="${t.id}" aria-current="${t.id === cad.ativo.testeId}">
      <span class="n">${t.id}</span><span class="t" title="${esc(t.titulo)}">${esc(tituloCurto(t) || t.titulo)}</span>
      <span class="meta">${fotos ? `<span class="cam">${fotos} 📷</span>` : ''}<span class="dot ${st}" title="${ROTULO[st]}"></span></span></button>`;
  }
  $('#itens')!.innerHTML = html || '<div class="grupo">Nada aqui</div>';
  $('.item[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
}

function renderPendencia(): void {
  const soltas = c().massa.filter((m) => !m.testeId).length;
  $('#pendencia')!.innerHTML = soltas
    ? `<div class="pendencia"><span>⚠ ${soltas} linha(s) de massa sem teste associado.</span><button class="btn" data-acao="associar">Associar agora</button></div>`
    : '';
}

function renderCard(): void {
  const cad = c();
  const t = testeAtivo();
  const i = cad.testes.indexOf(t);
  const st = statusEfetivo(t);
  const falhou = passoQueFalhou(t);
  const passoAtivo = t.passos.length ? cad.ativo.passo : 0;
  const massa = cad.massa.filter((m) => m.testeId === t.id);
  const evs = evidenciasDo(t.id);
  const ed = estado.editando;

  $('#principal')!.innerHTML = `<section class="card st-${st}" id="card" data-teste-ativo="${t.id}">
    <div class="head">
      <div>
        <div class="eyebrow">${t.id} · ${esc(t.grupo || 'Sem grupo')} · teste ${i + 1} de ${cad.testes.length}</div>
        ${ed ? `<input type="text" data-edit="titulo" value="${esc(t.titulo)}" aria-label="Título do test case" style="width:100%;font-size:17px;font-weight:600">`
             : `<h2>${esc(t.titulo)}</h2>`}
      </div>
      <span class="selo chip c-${st || 'todo'}">${ROTULO[st]}</span>
    </div>

    ${t.historico?.length ? `<div class="historico"><span class="lbl">Rodadas anteriores</span>
      ${t.historico.map((h) => `<div><span class="chip c-${h.status || 'todo'}">Rodada ${h.rodada}: ${ROTULO[h.status]}${h.passoQueFalhou ? ` no passo ${h.passoQueFalhou}` : ''}</span>
        ${h.observacao ? `<span class="note">${esc(h.observacao)}</span>` : ''}</div>`).join('')}</div>` : ''}

    ${tabelaPassos(t, passoAtivo, ed)}
    ${ed ? '<div class="status"><button class="btn" data-acao="add-passo">+ Adicionar passo</button></div>' : ''}

    ${massa.length ? `<div><span class="lbl">Sugestão de massa</span>
      <table class="massa"><tr><th>Campo</th><th>Valor</th><th>Observação</th></tr>
      ${massa.map((m) => `<tr><td>${esc(m.campo)}</td><td class="valor">${esc(m.valor)}</td><td>${esc(m.observacao)}</td></tr>`).join('')}</table></div>` : ''}

    <div class="status" role="group" aria-label="Resultado do teste">
      <button data-s="ok" aria-pressed="${st === 'ok'}" ${falhou ? 'disabled title="Um passo falhou"' : ''}>✔ Passou</button>
      <button data-s="bad" aria-pressed="${st === 'bad'}">✖ Falhou</button>
      <button data-s="skip" aria-pressed="${st === 'skip'}">Não consegui fazer</button>
      ${falhou ? `<span class="motivo">Falhou no passo ${falhou}</span>` : ''}
      ${st === 'bad' ? '<button class="btn ghost" data-acao="bug">Copiar rascunho de bug</button>' : ''}
    </div>

    <div><label class="lbl" for="obs">O que apareceu</label>
      <textarea id="obs" placeholder="Ex.: mensagem 'O cupom expirou'">${esc(t.observacao)}</textarea></div>

    <div class="drop" id="drop">
      <div class="big">Tire o print e aperte <b>Ctrl+V</b></div>
      <div>${passoAtivo ? `vai para o <strong>passo ${passoAtivo}</strong> · ` : ''}ou arraste a imagem aqui · <label for="arq-print">escolher arquivo</label></div>
      <input type="file" id="arq-print" accept="image/*" multiple hidden>
    </div>

    ${evs.length ? printsPorRodada(evs, cad.rodada) : '<p class="empty">Nenhum print ainda.</p>'}

    <div class="nav">
      <button class="btn ghost" data-ir="-1" ${i === 0 ? 'disabled' : ''}>← Anterior</button>
      <div class="nav-meio">
        <button class="btn ghost" data-acao="editar">${ed ? '✔ Concluir edição' : '✎ Editar'}</button>
        <button class="btn ghost perigo" data-acao="del-teste">Excluir test case</button>
      </div>
      <button class="btn" data-ir="1" ${i === cad.testes.length - 1 ? 'disabled' : ''}>Próximo teste →</button>
    </div>
  </section>`;
}

function tabelaPassos(t: TestCase, ativo: number, ed: boolean): string {
  if (!t.passos.length) return '<p class="empty">Este test case não tem passos.</p>';
  const linhas = t.passos.map((p, idx) => {
    const n = idx + 1;
    const fotos = evidenciasDo(t.id, n).length;
    if (ed) {
      return `<tr><td class="num">${n}</td>
        <td><textarea data-edit-acao="${idx}" aria-label="Ação do passo ${n}">${esc(p.acao)}</textarea></td>
        <td><textarea data-edit-esperado="${idx}" aria-label="Resultado esperado do passo ${n}">${esc(p.esperado)}</textarea></td>
        <td class="res"><button class="btn ghost" data-del-passo="${idx}" title="Remover passo">✕</button></td></tr>`;
    }
    return `<tr class="passo ${n === ativo ? 'ativo' : ''} p-${p.status || 'todo'}" data-passo-sel="${n}">
      <td class="num">${n}</td><td>${esc(p.acao)}${fotos ? `<span class="fotos">${fotos} 📷</span>` : ''}</td><td>${esc(p.esperado)}</td>
      <td class="res"><button data-p="ok" data-passo="${n}" aria-pressed="${p.status === 'ok'}" aria-label="Passo ${n} passou">✔</button>
        <button data-p="bad" data-passo="${n}" aria-pressed="${p.status === 'bad'}" aria-label="Passo ${n} falhou">✖</button></td></tr>`;
  });
  return `<table class="passos"><thead><tr><th>#</th><th>Ação</th><th>Resultado esperado</th><th>${ed ? '' : 'Passo'}</th></tr></thead><tbody>${linhas.join('')}</tbody></table>`;
}

// Na primeira rodada, uma grade so. No reteste, a rodada atual primeiro e as
// anteriores embaixo, cada uma com o seu titulo.
function printsPorRodada(evs: Evidencia[], rodadaAtual: number): string {
  const rodadas = [...new Set(evs.map((e) => e.rodada))].sort((a, b) => b - a);
  if (rodadas.length === 1 && rodadas[0] === rodadaAtual && rodadaAtual === 1) {
    return `<div class="shots">${evs.map(cartaoPrint).join('')}</div>`;
  }
  return rodadas
    .map((r) => `<div class="rodada"><span class="lbl">Rodada ${r}${r === rodadaAtual ? ' (atual)' : ''}</span>
      <div class="shots">${evs.filter((e) => e.rodada === r).map(cartaoPrint).join('')}</div></div>`)
    .join('');
}

function cartaoPrint(ev: Evidencia): string {
  return `<figure class="shot" data-ev="${ev.id}">
    <img src="${urlDe(ev)}" alt="Print ${esc(nome(ev))}" data-zoom="${ev.id}">
    <div class="cap">
      <input type="text" data-legenda="${ev.id}" value="${esc(ev.legenda)}" placeholder="Legenda (ex.: antes, depois, mensagem)" aria-label="Legenda do print">
      <div class="fname">${esc(nome(ev))}</div>
      <div class="acts"><button data-copiar="${ev.id}">Copiar</button><button data-apagar="${ev.id}">Apagar</button></div>
    </div></figure>`;
}

const nome = (ev: Evidencia) => nomeEvidencia({ ...ev, tipo: ev.blob.type });

function urlDe(ev: Evidencia): string {
  if (!urls.has(ev.id)) urls.set(ev.id, URL.createObjectURL(ev.blob));
  return urls.get(ev.id)!;
}

// ------------------------------------------------------------------ acoes

// Ao abrir um teste, o passo ativo e o primeiro ainda sem resultado: "onde parei".
function selecionar(testeId: string): void {
  const cad = c();
  const t = cad.testes.find((x) => x.id === testeId)!;
  cad.ativo = { testeId, passo: t.passos.findIndex((p) => !p.status) + 1 || 1 };
  estado.editando = false;
  salvar();
  renderLista();
  renderCard();
  window.scrollTo({ top: 0 });
}

function marcarPasso(n: number, valor: 'ok' | 'bad'): void {
  const t = testeAtivo();
  const p = t.passos[n - 1];
  p.status = p.status === valor ? '' : valor;

  // ✔ avanca para o proximo passo; o ultimo ✔ fecha o teste como Passou.
  if (p.status === 'ok' && n < t.passos.length) c().ativo.passo = n + 1;
  if (t.passos.every((x) => x.status === 'ok') && !t.status) t.status = 'ok';
  salvar();
  renderTopo();
  renderLista();
  renderCard();
}

function marcarTeste(s: Exclude<StatusTeste, ''>): void {
  const t = testeAtivo();
  t.status = t.status === s ? '' : s;
  salvar();
  renderTopo();
  renderLista();
  renderCard();
}

async function colarImagens(arquivos: File[]): Promise<void> {
  const quantos = await adicionarEvidencias(arquivos);
  if (!quantos) return;
  const t = testeAtivo();
  aviso(`${quantos} print(s) no ${t.id}${t.passos.length ? `, passo ${c().ativo.passo}` : ''}.`);
  renderLista();
  renderCard();
}

function novoTeste(): void {
  const cad = c();
  const maior = Math.max(0, ...cad.testes.map((t) => Number(t.id.replace(/\D/g, '')) || 0));
  const largura = Math.max(2, (cad.testes[0]?.id.length ?? 4) - 2);
  const base = testeAtivo();
  const t: TestCase = {
    id: `CT${String(maior + 1).padStart(largura, '0')}`,
    titulo: base.grupo ? `[${base.grupo}] Novo test case` : 'Novo test case',
    grupo: base.grupo,
    passos: [{ acao: '', esperado: '', status: '' }],
    status: '',
    observacao: '',
    azure: { id: '', areaPath: base.azure.areaPath, assignedTo: base.azure.assignedTo, state: 'Design' },
    linhasOriginais: [],
  };
  cad.testes.splice(cad.testes.indexOf(base) + 1, 0, t);
  cad.ativo = { testeId: t.id, passo: 1 };
  estado.editando = true;
  salvar();
  renderTudo();
}

async function excluirTesteAtivo(): Promise<void> {
  const cad = c();
  if (cad.testes.length === 1) return aviso('O caderno precisa de pelo menos um test case.');
  const t = testeAtivo();
  const i = cad.testes.indexOf(t);
  for (const ev of evidenciasDo(t.id)) await removerEvidencia(ev.id);
  cad.testes.splice(i, 1);
  cad.massa.forEach((m) => { if (m.testeId === t.id) m.testeId = ''; });
  cad.ativo = { testeId: cad.testes[Math.min(i, cad.testes.length - 1)].id, passo: 1 };
  estado.editando = false;
  salvar();
  renderTudo();
  aviso(`${t.id} excluído.`);
}

async function copiarImagem(ev: Evidencia): Promise<void> {
  try {
    const png = ev.blob.type === 'image/png' ? ev.blob : await paraPng(ev.blob);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    aviso('Imagem copiada. Cole no Azure com Ctrl+V.');
  } catch {
    aviso('Não deu para copiar daqui: clique com o botão direito na imagem e escolha "Copiar imagem".');
  }
}

function paraPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const tela = document.createElement('canvas');
      tela.width = img.naturalWidth;
      tela.height = img.naturalHeight;
      tela.getContext('2d')!.drawImage(img, 0, 0);
      tela.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

// ------------------------------------------------------------------ modais

function modalComentario(): void {
  const cad = c();
  const texto = gerarComentario(cad.tarefa, cad.testes);
  const modal = abrirModal(`<div class="sheet" role="dialog" aria-label="Comentário da task">
    <h3>Comentário para a task</h3>
    <label class="lbl" for="tarefa-in">Título da task</label>
    <input type="text" id="tarefa-in" value="${esc(cad.tarefa)}">
    <textarea id="comentario" readonly>${esc(texto || 'Nenhum teste com resultado marcado ainda.')}</textarea>
    <p class="note">Entram só os testes com resultado. "Não consegui fazer" vai para "Não executados".</p>
    <div class="row"><button class="btn" data-fechar>Fechar</button><button class="btn primary" id="copiar-comentario">Copiar texto</button></div>
  </div>`);
  const saida = $<HTMLTextAreaElement>('#comentario', modal)!;
  $('#tarefa-in', modal)!.addEventListener('input', (e) => {
    cad.tarefa = (e.target as HTMLInputElement).value;
    saida.value = gerarComentario(cad.tarefa, cad.testes);
    salvar();
    renderTopo();
  });
  $('#copiar-comentario', modal)!.addEventListener('click', () => copiarTexto(saida.value, saida));
}

function modalReteste(): void {
  const cad = c();
  const qtd = (e: EscopoReteste) => testesDoReteste(cad, e).length;
  const opcao = (e: EscopoReteste, texto: string, marcado = false) =>
    `<label><input type="radio" name="escopo" value="${e}" ${marcado ? 'checked' : ''} ${qtd(e) ? '' : 'disabled'}> ${texto} <strong>(${qtd(e)})</strong></label>`;

  const modal = abrirModal(`<div class="sheet" role="dialog" aria-label="Iniciar reteste">
    <h3>Iniciar reteste (rodada ${cad.rodada + 1})</h3>
    <p class="note">Os testes escolhidos voltam para "A fazer". O resultado e os prints desta rodada continuam guardados no caderno.</p>
    <div class="escopos">
      ${opcao('falharam', 'Só os que falharam', true)}
      ${opcao('falharam-e-nao-executados', 'Os que falharam e os não executados')}
      ${opcao('todos', 'Todos os testes')}
    </div>
    <div class="row"><button class="btn" data-fechar>Cancelar</button><button class="btn primary" id="confirmar-reteste">Iniciar reteste</button></div>
  </div>`);

  $('#confirmar-reteste', modal)!.addEventListener('click', () => {
    const escopo = ($<HTMLInputElement>('input[name="escopo"]:checked', modal)?.value ?? 'falharam') as EscopoReteste;
    const quantos = iniciarReteste(cad, escopo);
    fecharModal();
    if (!quantos) return aviso('Nenhum teste para retestar nesse grupo.');
    estado.filtro = 'falta';
    salvar();
    renderTudo();
    aviso(`Rodada ${cad.rodada}: ${quantos} teste(s) para retestar.`);
  });
}

function modalAssociarMassa(): void {
  const cad = c();
  const opcoes = (atual: string) =>
    `<option value="">(sem teste)</option>` +
    cad.testes.map((t) => `<option value="${t.id}" ${t.id === atual ? 'selected' : ''}>${t.id} · ${esc(tituloCurto(t) || t.titulo)}</option>`).join('');
  const modal = abrirModal(`<div class="sheet" role="dialog" aria-label="Associar massa">
    <h3>Associar massa aos testes</h3>
    <p class="note">Estas linhas não bateram com nenhum ID nem título. Escolha o teste de cada uma.</p>
    <table><tr><th>Veio como</th><th>Campo = valor</th><th>Teste</th></tr>
    ${cad.massa.map((m, i) => (m.testeId ? '' : `<tr><td>${esc(m.teste)}</td><td>${esc(m.campo)} = <strong>${esc(m.valor)}</strong></td>
      <td><select data-massa="${i}" aria-label="Teste para a massa ${esc(m.valor)}">${opcoes(m.testeId)}</select></td></tr>`)).join('')}</table>
    <div class="row"><button class="btn primary" data-fechar>Concluir</button></div>
  </div>`);
  modal.addEventListener('change', (e) => {
    const sel = e.target as HTMLSelectElement;
    if (sel.dataset.massa === undefined) return;
    cad.massa[Number(sel.dataset.massa)].testeId = sel.value;
    salvar();
    renderPendencia();
    renderCard();
  });
}

// ------------------------------------------------------------------ eventos

async function aoClicar(e: MouseEvent): Promise<void> {
  const alvo = e.target as HTMLElement;
  const b = alvo.closest<HTMLElement>('button,[data-zoom],[data-passo-sel]');
  if (!b) return;
  const d = b.dataset;
  const cad = c();

  if (d.teste) return selecionar(d.teste);
  if (d.filtro) { estado.filtro = d.filtro as Filtro; renderTopo(); return renderLista(); }
  if (d.p) return marcarPasso(Number(d.passo), d.p as 'ok' | 'bad');
  if (d.passoSel && !alvo.closest('button,textarea,input')) { cad.ativo.passo = Number(d.passoSel); salvar(); return renderCard(); }
  if (d.s) return marcarTeste(d.s as Exclude<StatusTeste, ''>);
  if (d.ir) {
    const proximo = cad.testes[cad.testes.indexOf(testeAtivo()) + Number(d.ir)];
    if (proximo) selecionar(proximo.id);
    return;
  }
  if (d.zoom) {
    const ev = estado.evidencias.find((x) => x.id === d.zoom)!;
    abrirModal(`<div class="sheet lightbox"><img src="${urlDe(ev)}" alt=""><div class="row"><span class="fname">${esc(nome(ev))}</span><button class="btn" data-fechar>Fechar</button></div></div>`);
    return;
  }
  if (d.copiar) return copiarImagem(estado.evidencias.find((x) => x.id === d.copiar)!);
  if (d.apagar) {
    if (!confirmarNoSegundoClique(b)) return;
    await removerEvidencia(d.apagar);
    renderLista();
    return renderCard();
  }
  if (d.delPasso) {
    const t = testeAtivo();
    t.passos.splice(Number(d.delPasso), 1);
    cad.ativo.passo = Math.min(cad.ativo.passo, Math.max(1, t.passos.length));
    salvar();
    return renderCard();
  }

  switch (d.acao) {
    case 'comentario': return modalComentario();
    case 'associar': return modalAssociarMassa();
    case 'reteste': return modalReteste();
    case 'csv': {
      baixar(exportarCsvAzure(cad), `test-cases_${slug(cad.tarefa, 60) || 'caderno'}.csv`, 'text/csv;charset=utf-8');
      return aviso('CSV do Azure exportado.');
    }
    case 'zip': {
      aviso('Gerando o pacote...');
      baixar(await gerarPacote(cad, estado.evidencias), nomeDoPacote(cad.tarefa), 'application/zip');
      return aviso('Pacote de evidências baixado.');
    }
    case 'bug': return copiarTexto(rascunhoBug(testeAtivo(), estado.evidencias));
    case 'novo': return voltar();
    case 'editar': estado.editando = !estado.editando; renderLista(); return renderCard();
    case 'novo-teste': return novoTeste();
    case 'add-passo': {
      const t = testeAtivo();
      t.passos.push({ acao: '', esperado: '', status: '' });
      salvar();
      renderCard();
      $<HTMLTextAreaElement>(`[data-edit-acao="${t.passos.length - 1}"]`)?.focus();
      return;
    }
    case 'del-teste': if (confirmarNoSegundoClique(b, 'Apaga o teste e os prints. Confirmar?')) await excluirTesteAtivo(); return;
  }
}

function aoDigitar(e: Event): void {
  const alvo = e.target as HTMLInputElement | HTMLTextAreaElement;
  const t = testeAtivo();
  const d = alvo.dataset;

  if (alvo.id === 'obs') { t.observacao = alvo.value; return salvar(); }
  if (d.legenda) {
    const ev = estado.evidencias.find((x) => x.id === d.legenda)!;
    ev.legenda = alvo.value;
    void db.gravarEvidencia(ev);
    const rotulo = alvo.closest('.shot')?.querySelector('.fname');
    if (rotulo) rotulo.textContent = nome(ev);
    return;
  }
  if (d.edit === 'titulo') {
    t.titulo = alvo.value;
    t.grupo = /^\[([^\]]+)\]/.exec(t.titulo.trim())?.[1].trim() ?? '';
    salvar();
    return renderLista();
  }
  if (d.editAcao) { t.passos[Number(d.editAcao)].acao = alvo.value; return salvar(); }
  if (d.editEsperado) { t.passos[Number(d.editEsperado)].esperado = alvo.value; return salvar(); }
}

function aoMudar(e: Event): void {
  const alvo = e.target as HTMLInputElement;
  if (alvo.id === 'arq-print' && alvo.files) {
    void colarImagens([...alvo.files]);
    alvo.value = '';
  }
}

// Colar e arrastar valem para a pagina inteira enquanto o caderno esta aberto.
function ligarEventosGlobais(): void {
  if (eventosGlobaisLigados) return;
  eventosGlobaisLigados = true;

  document.addEventListener('paste', (e) => {
    if (!$('#card')) return;
    const arquivos = [...(e.clipboardData?.items ?? [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter((f): f is File => Boolean(f));
    if (!arquivos.some((f) => f.type.startsWith('image/'))) return; // texto: deixa colar normalmente
    e.preventDefault();
    void colarImagens(arquivos);
  });
  document.addEventListener('dragover', (e) => { if ($('#card')) { e.preventDefault(); $('#drop')?.classList.add('hot'); } });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('#drop')?.classList.remove('hot'); });
  document.addEventListener('drop', (e) => {
    if (!$('#card')) return;
    e.preventDefault();
    $('#drop')?.classList.remove('hot');
    const arquivos = [...(e.dataTransfer?.files ?? [])];
    if (arquivos.length) void colarImagens(arquivos);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });
}
