import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { importarCsvAzure } from '../../src/importar/csv-azure.ts';
import { nomeEvidencia } from '../../src/exportar/nomes.ts';
import { gerarPacote, nomeDoPacote } from '../../src/exportar/pacote.ts';
import type { Caderno, Evidencia } from '../../src/modelo.ts';

test('nome do print: teste, passo, sequencia e legenda opcional', () => {
  assert.equal(nomeEvidencia({ testeId: 'CT03', passo: 2, seq: 1, legenda: '', tipo: 'image/png' }), 'CT03_P2_01.png');
  assert.equal(nomeEvidencia({ testeId: 'CT03', passo: 2, seq: 12, legenda: 'Depois da gravação!', tipo: 'image/png' }), 'CT03_P2_12_depois-da-gravacao.png');
  assert.equal(nomeEvidencia({ testeId: 'CT03', passo: 0, seq: 1, legenda: '', tipo: 'image/jpeg' }), 'CT03_01.jpg');
});

test('nome do pacote vem da task', () => {
  assert.equal(nomeDoPacote('9001 · Cupom de desconto'), 'evidencias_9001-cupom-de-desconto.zip');
});

test('zip tem os prints nomeados, o resumo e o comentario', async () => {
  const r = importarCsvAzure(readFileSync(new URL('../../exemplos/test-cases-exemplo.csv', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(r.erro);
  r.testes[0].status = 'ok';
  const caderno: Caderno = { tarefa: 'Cupom', testes: r.testes, massa: [], formato: r.formato, ativo: { testeId: 'CT01', passo: 1 } };
  const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
  const evs: Evidencia[] = [
    { id: 'b', testeId: 'CT01', passo: 2, seq: 1, legenda: '', blob: png, criadoEm: 2 },
    { id: 'a', testeId: 'CT01', passo: 1, seq: 1, legenda: 'antes', blob: png, criadoEm: 1 },
  ];

  const zip = await JSZip.loadAsync(await gerarPacote(caderno, evs));
  const nomes = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
  assert.deepEqual(nomes, ['comentario.txt', 'evidencias/CT01_P1_01_antes.png', 'evidencias/CT01_P2_01.png', 'resumo.html']);

  const resumo = await zip.file('resumo.html')!.async('string');
  assert.match(resumo, /src="evidencias\/CT01_P1_01_antes.png"/);
  assert.match(resumo, /CT01 · \[Etapa 1\] Aplicar cupom válido no carrinho/);
  assert.match(await zip.file('comentario.txt')!.async('string'), /Aprovado/);
});
