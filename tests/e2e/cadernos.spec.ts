import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { colarPrint, exemplo, gerarCaderno, pagina } from './apoio.ts';

test('varios cadernos: criar outro nao apaga o primeiro', async ({ page }) => {
  await gerarCaderno(page);
  await colarPrint(page);
  await page.getByRole('button', { name: 'Meus cadernos' }).click();

  await page.getByPlaceholder('Cole aqui o título da task do Azure').fill('9002 - Frete gratis');
  await page.locator('#arq-csv').setInputFiles(exemplo('test-cases-exemplo.csv'));
  await page.getByRole('button', { name: 'Gerar caderno' }).click();
  await expect(page.locator('#tarefa')).toHaveText('Task 9002 - Frete gratis');
  await expect(page.locator('.shot')).toHaveCount(0);

  await page.getByRole('button', { name: 'Meus cadernos' }).click();
  await expect(page.locator('.caderno-salvo strong')).toHaveText(['9002 - Frete gratis', '9001 - Cupom de desconto']);
  await page.locator('.caderno-salvo', { hasText: '9001' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('.shot .fname')).toHaveText(['CT01_P1_01.png']);
});

test('excluir caderno da lista pede confirmacao', async ({ page }) => {
  await gerarCaderno(page);
  await page.getByRole('button', { name: 'Meus cadernos' }).click();
  await page.getByRole('button', { name: 'Excluir' }).click();
  await expect(page.locator('.caderno-salvo')).toHaveCount(1);
  await page.getByRole('button', { name: 'Apaga o caderno e os prints. Confirmar?' }).click();
  await expect(page.locator('.caderno-salvo')).toHaveCount(0);
});

test('reteste: reabre so os que falharam, guarda a rodada anterior e separa os prints', async ({ page }) => {
  await gerarCaderno(page);
  await page.getByLabel('Passo 1 passou').click();
  await page.getByLabel('Passo 2 passou').click();
  await page.getByRole('button', { name: 'Próximo teste →' }).click();
  await colarPrint(page);
  await page.getByLabel('Passo 1 falhou').click();
  await page.getByPlaceholder("Ex.: mensagem 'O cupom expirou'").fill('Carrinho vazio');

  await page.getByRole('button', { name: 'Iniciar reteste' }).click();
  await expect(page.getByLabel('Só os que falharam (1)')).toBeChecked();
  await page.locator('#confirmar-reteste').click();

  await expect(page.locator('#tarefa')).toHaveText('Task 9001 - Cupom de desconto · Reteste (rodada 2)');
  await expect(page.locator('.item .n')).toHaveText(['CT02', 'CT03']); // filtro "Falta fazer"
  await expect(page.locator('#card .selo')).toHaveText('A fazer');
  await expect(page.locator('.historico')).toContainText('Rodada 1: Falhou no passo 1');
  await expect(page.locator('.historico')).toContainText('Carrinho vazio');

  await colarPrint(page);
  await expect(page.locator('.rodada .lbl')).toHaveText(['Rodada 2 (atual)', 'Rodada 1']);
  await expect(page.locator('.shot .fname')).toHaveText(['CT02_R2_P1_01.png', 'CT02_P1_01.png']);

  await page.getByRole('button', { name: 'Todos' }).click();
  await page.locator('.item', { hasText: 'CT01' }).click();
  await expect(page.locator('#card .selo')).toHaveText('Passou'); // quem passou nao volta
});

test('migra o caderno salvo na versao 1 (um caderno so) sem perder prints', async ({ page }) => {
  const csv = readFileSync(exemplo('test-cases-exemplo.csv'), 'utf8');
  // Antes de a pagina carregar, cria o banco exatamente como a versao 1 gravava.
  await page.addInitScript((texto) => {
    if (sessionStorage.getItem('v1-criado')) return;
    sessionStorage.setItem('v1-criado', '1');
    const pedido = indexedDB.open('caderno-evidencias', 1);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      const kv = db.createObjectStore('kv');
      const evs = db.createObjectStore('evidencias', { keyPath: 'id' });
      kv.put({
        tarefa: 'Caderno antigo',
        testes: [{ id: 'CT01', titulo: 'Teste antigo', grupo: '', passos: [{ acao: 'a', esperado: 'e', status: 'ok' }], status: 'ok', observacao: '', azure: { id: '', areaPath: '', assignedTo: '', state: '' }, linhasOriginais: [] }],
        massa: [], formato: { cabecalho: [], bom: true, quebra: '\r\n', terminaComQuebra: true }, ativo: { testeId: 'CT01', passo: 1 },
        csv: texto.length,
      }, 'caderno');
      evs.put({ id: 'ev1', testeId: 'CT01', passo: 1, seq: 1, legenda: 'antigo', blob: new Blob([new Uint8Array([1])], { type: 'image/png' }), criadoEm: 1 });
    };
    pedido.onsuccess = () => pedido.result.close();
  }, csv);

  await page.goto(pagina);
  await expect(page.locator('.caderno-salvo strong')).toHaveText('Caderno antigo');
  await page.getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('#card .selo')).toHaveText('Passou');
  await expect(page.locator('.shot .fname')).toHaveText('CT01_P1_01_antigo.png');
});
