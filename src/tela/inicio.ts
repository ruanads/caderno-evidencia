// Tela inicial: uma coisa por vez. 1) titulo da task, 2) CSV de test cases,
// 3) massa (opcional). O botao so libera quando 1 e 2 estao certos.

import * as db from '../armazenamento/db.ts';
import { importarCsvAzureSeguro, type ResultadoImportacao } from '../importar/csv-azure.ts';
import { importarMassa, type ResultadoMassa } from '../importar/massa.ts';
import { statusEfetivo, type Caderno } from '../modelo.ts';
import { criarCaderno } from './estado.ts';
import { $, confirmarNoSegundoClique, esc, lerArquivo } from './util.ts';

type Entrada = {
  tarefa: string;
  csv: { nome: string; resultado: ResultadoImportacao } | null;
  massa: { nome: string; texto: string } | null;
};

export function mostrarInicio(salvos: Caderno[], abrirCaderno: (c: Caderno) => void, aoCriar: () => void): void {
  const e: Entrada = { tarefa: '', csv: null, massa: null };
  const cadernos = [...salvos].sort((a, b) => b.atualizadoEm - a.atualizadoEm);

  const massaAtual = (): ResultadoMassa | null => {
    if (!e.massa) return null;
    const testes = e.csv?.resultado.ok ? e.csv.resultado.testes : [];
    return importarMassa(e.massa.texto, e.massa.nome, testes);
  };

  const render = () => {
    const csvOk = e.csv?.resultado.ok ?? false;
    const massa = massaAtual();
    const pronto = e.tarefa.trim().length > 0 && csvOk && (!massa || massa.ok);

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
        <h2><span class="num">2</span> CSV de test cases</h2>
        ${zonaArquivo('csv', '.csv,text/csv', e.csv?.nome)}
        ${e.csv ? resumoCsv(e.csv.resultado) : '<p class="note">O CSV de importação do Azure Test Plans (o que a IA da empresa gera).</p>'}
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
      const btn = $<HTMLButtonElement>('#gerar')!;
      const massa = massaAtual();
      btn.disabled = !(e.tarefa.trim() && e.csv?.resultado.ok && (!massa || massa.ok));
      $('#tarefa')!.closest('.etapa')!.classList.toggle('ok', Boolean(e.tarefa.trim()));
    });

    for (const tipo of ['csv', 'massa'] as const) {
      const zona = $(`#zona-${tipo}`)!;
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
      if (!e.csv?.resultado.ok) return;
      const { testes, formato } = e.csv.resultado;
      const massa = massaAtual();
      await criarCaderno({ tarefa: e.tarefa.trim(), testes, formato, massa: massa?.ok ? massa.linhas : [] });
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
