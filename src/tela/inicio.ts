// Tela inicial: uma coisa por vez. 1) titulo da task, 2) CSV de test cases
// (ou criar os test cases na tela), 3) massa (opcional). O botao so libera
// quando 1 e 2 estao certos.

import * as db from '../armazenamento/db.ts';
import { importarCsvAzureSeguro, type ResultadoImportacao } from '../importar/csv-azure.ts';
import { importarMassa, type ResultadoMassa } from '../importar/massa.ts';
import { FORMATO_PADRAO, statusEfetivo, testeEmBranco, type Caderno } from '../modelo.ts';
import { criarCaderno, estado } from './estado.ts';
import { $, confirmarNoSegundoClique, esc, lerArquivo } from './util.ts';

type Entrada = {
  tarefa: string;
  csv: { nome: string; resultado: ResultadoImportacao } | null;
  semCsv: boolean;       // test cases criados na tela, sem arquivo
  massa: { nome: string; texto: string } | null;
};

export function mostrarInicio(salvos: Caderno[], abrirCaderno: (c: Caderno) => void, aoCriar: () => void): void {
  const e: Entrada = { tarefa: '', csv: null, semCsv: false, massa: null };

  const podeGerar = () => {
    const massa = massaAtual();
    return e.tarefa.trim().length > 0 && (e.semCsv || (e.csv?.resultado.ok ?? false)) && (!massa || massa.ok);
  };
  const cadernos = [...salvos].sort((a, b) => b.atualizadoEm - a.atualizadoEm);

  const massaAtual = (): ResultadoMassa | null => {
    if (!e.massa) return null;
    const testes = e.csv?.resultado.ok ? e.csv.resultado.testes : [];
    return importarMassa(e.massa.texto, e.massa.nome, testes);
  };

  const render = () => {
    const csvOk = e.semCsv || (e.csv?.resultado.ok ?? false);
    const massa = massaAtual();
    const pronto = podeGerar();

    $('#app')!.innerHTML = `<div class="inicio">
      <div>
        <h1>Caderno de Evidências</h1>
        <p class="note">Importe os test cases, execute colando os prints e exporte tudo para o Azure.</p>
      </div>
      ${cadernos.length ? `<section class="etapa"><h2>Meus cadernos</h2>
        <p class="note">Ficam salvos para o reteste. Abra um para continuar ou retestar.</p>
        <div class="cadernos">${cadernos.map(cartaoCaderno).join('')}</div></section>
        <h2 class="subtitulo">Novo caderno</h2>` : ''}

      <section class="etapa ${e.tarefa.trim() ? 'ok' : ''}">
        <h2><span class="num">1</span> Título da task</h2>
        <input type="text" id="tarefa" value="${esc(e.tarefa)}" placeholder="Cole aqui o título da task do Azure" autocomplete="off">
      </section>

      <section class="etapa ${csvOk ? 'ok' : ''}">
        <h2><span class="num">2</span> Test cases</h2>
        ${e.semCsv
          ? `<p class="resumo-import">✔ Sem CSV: o caderno começa com um test case em branco para você preencher, e os outros você inclui com "+ Novo test case".</p>
             <div><button class="btn ghost" id="usar-csv">Usar um CSV</button></div>`
          : `${zonaArquivo('csv', '.csv,text/csv', e.csv?.nome)}
             ${e.csv ? resumoCsv(e.csv.resultado) : '<p class="note">O CSV de importação do Azure Test Plans (o que a IA da empresa gera).</p>'}
             <div><button class="btn ghost" id="sem-csv">Não tenho CSV: criar os test cases aqui</button></div>`}
      </section>

      <section class="etapa ${massa?.ok ? 'ok' : ''}">
        <h2><span class="num">3</span> Massa de dados <span class="note">(opcional)</span></h2>
        ${zonaArquivo('massa', '.csv,.json,text/csv,application/json', e.massa?.nome)}
        ${massa ? resumoMassa(massa) : '<p class="note">CSV ou JSON com as colunas teste, campo, valor e observacao.</p>'}
      </section>

      <div><button class="btn primary" id="gerar" ${pronto ? '' : 'disabled'}>Gerar caderno</button></div>
      <p class="note">Os dados ficam só neste navegador, neste computador. Nada é enviado para a internet.</p>
    </div>`;

    ligarEventos();
  };

  const ligarEventos = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-abrir]').forEach((b) =>
      b.addEventListener('click', () => abrirCaderno(cadernos.find((x) => x.id === b.dataset.abrir)!)),
    );
    document.querySelectorAll<HTMLButtonElement>('[data-apagar-caderno]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirmarNoSegundoClique(b, 'Apaga o caderno e os prints. Confirmar?')) return;
        await db.apagarCaderno(b.dataset.apagarCaderno!);
        cadernos.splice(cadernos.findIndex((x) => x.id === b.dataset.apagarCaderno), 1);
        render();
      }),
    );
    $<HTMLInputElement>('#tarefa')!.addEventListener('input', (ev) => {
      e.tarefa = (ev.target as HTMLInputElement).value;
      $<HTMLButtonElement>('#gerar')!.disabled = !podeGerar();
      $('#tarefa')!.closest('.etapa')!.classList.toggle('ok', Boolean(e.tarefa.trim()));
    });
    $('#sem-csv')?.addEventListener('click', () => { e.semCsv = true; render(); });
    $('#usar-csv')?.addEventListener('click', () => { e.semCsv = false; render(); });

    for (const tipo of ['csv', 'massa'] as const) {
      const zona = $(`#zona-${tipo}`);
      if (!zona) continue; // sem CSV, a zona do arquivo nao aparece
      const receber = async (arquivo: File | undefined) => {
        if (!arquivo) return;
        const texto = await lerArquivo(arquivo);
        if (tipo === 'csv') e.csv = { nome: arquivo.name, resultado: importarCsvAzureSeguro(texto) };
        else e.massa = { nome: arquivo.name, texto };
        render();
      };
      $<HTMLInputElement>(`#arq-${tipo}`)!.addEventListener('change', (ev) => receber((ev.target as HTMLInputElement).files?.[0]));
      zona.addEventListener('dragover', (ev) => { ev.preventDefault(); zona.classList.add('hot'); });
      zona.addEventListener('dragleave', () => zona.classList.remove('hot'));
      zona.addEventListener('drop', (ev) => { ev.preventDefault(); zona.classList.remove('hot'); receber(ev.dataTransfer?.files[0]); });
    }

    $('#gerar')!.addEventListener('click', async () => {
      if (!podeGerar()) return;
      const massa = massaAtual();
      const origem = e.semCsv || !e.csv?.resultado.ok
        ? { testes: [testeEmBranco('CT01')], formato: FORMATO_PADRAO }
        : { testes: e.csv.resultado.testes, formato: e.csv.resultado.formato };
      await criarCaderno({ tarefa: e.tarefa.trim(), ...origem, massa: massa?.ok ? massa.linhas : [] });
      estado.editando = e.semCsv; // sem CSV, ja abre editando o primeiro test case
      aoCriar();
    });
  };

  render();
  $<HTMLInputElement>('#tarefa')?.focus();
}

function cartaoCaderno(c: Caderno): string {
  const st = c.testes.map(statusEfetivo);
  const n = (s: string) => st.filter((x) => x === s).length;
  const feitos = st.filter(Boolean).length;
  const quando = new Date(c.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `<div class="caderno-salvo">
    <div class="info">
      <strong>${esc(c.tarefa)}</strong>
      <span class="note">${feitos}/${c.testes.length} feitos · ${c.rodada > 1 ? `reteste (rodada ${c.rodada}) · ` : ''}atualizado ${quando}</span>
      <span><span class="chip c-ok">${n('ok')} passou</span> <span class="chip c-bad">${n('bad')} falhou</span>${n('skip') ? ` <span class="chip c-skip">${n('skip')} não executado</span>` : ''}</span>
    </div>
    <div class="acoes"><button class="btn primary" data-abrir="${c.id}">Abrir</button>
      <button class="btn ghost perigo" data-apagar-caderno="${c.id}">Excluir</button></div>
  </div>`;
}

function zonaArquivo(tipo: string, aceita: string, nome?: string): string {
  return `<div class="arquivo" id="zona-${tipo}">
    ${nome ? `<span class="nome">${esc(nome)}</span> · ` : 'Arraste o arquivo aqui ou '}
    <label for="arq-${tipo}">${nome ? 'trocar' : 'escolher arquivo'}</label>
    <input type="file" id="arq-${tipo}" accept="${aceita}" hidden>
  </div>`;
}

function resumoCsv(r: ResultadoImportacao): string {
  if (!r.ok) return `<div class="erro" role="alert">${esc(r.erro)}</div>`;
  const passos = r.testes.reduce((n, t) => n + t.passos.length, 0);
  const grupos = [...new Set(r.testes.map((t) => t.grupo).filter(Boolean))];
  return `<p class="resumo-import">✔ ${r.testes.length} test cases, ${passos} passos${grupos.length ? ` · grupos: ${esc(grupos.join(', '))}` : ''}</p>`;
}

function resumoMassa(r: ResultadoMassa): string {
  if (!r.ok) return `<div class="erro" role="alert">${esc(r.erro)}</div>`;
  const soltas = r.linhas.filter((l) => !l.testeId).length;
  return `<p class="resumo-import">✔ ${r.linhas.length} linhas de massa${soltas ? ` · <strong>${soltas} sem teste</strong> (dá para associar depois, no caderno)` : ' · todas ligadas a um teste'}</p>`;
}
