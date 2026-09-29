import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { colarPrint, exemplo, gerarCaderno, pagina } from './apoio.ts';

test('importar CSV: monta a lista por grupo e liga a massa', async ({ page }) => {
  await gerarCaderno(page, { massa: 'massa-exemplo.csv' });

  await expect(page.locator('.grupo')).toHaveText(['Etapa 1', 'Etapa 2']);
  await expect(page.locator('.item .n')).toHaveText(['CT01', 'CT02', 'CT03']);
  await expect(page.locator('#card h2')).toHaveText('[Etapa 1] Aplicar cupom válido no carrinho');
  await expect(page.locator('.passos tbody tr')).toHaveCount(2);
  await expect(page.locator('.massa td.valor')).toHaveText('BEMVINDO10');
  await expect(page.getByText('1 linha(s) de massa sem teste associado')).toBeVisible();
});

test('CSV com cabecalho errado mostra o erro e nao libera o botao', async ({ page }) => {
  await page.goto(pagina);
  await page.getByPlaceholder('Cole aqui o título da task do Azure').fill('X');
  await page.locator('#arq-csv').setInputFiles(exemplo('massa-exemplo.csv'));
  await expect(page.getByRole('alert')).toContainText('nao e o do Azure Test Plans');
  await expect(page.getByRole('button', { name: 'Gerar caderno' })).toBeDisabled();
});

test('associar manualmente a massa que nao bateu', async ({ page }) => {
  await gerarCaderno(page, { massa: 'massa-exemplo.csv' });
  await page.getByRole('button', { name: 'Associar agora' }).click();
  await page.getByLabel('Teste para a massa NAOEXISTE').selectOption('CT02');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.locator('#pendencia')).toBeEmpty();
  await page.locator('.item', { hasText: 'CT02' }).click();
  await expect(page.locator('.massa td.valor')).toHaveText(['VERAO2020', 'NAOEXISTE']);
});

test('colar print: cai no passo ativo, com nome automatico, e sobrevive ao recarregar', async ({ page }) => {
  await gerarCaderno(page);

  await colarPrint(page);
  await expect(page.locator('.shot .fname')).toHaveText(['CT01_P1_01.png']);

  await page.locator('tr[data-passo-sel="2"] td').nth(1).click();
  await colarPrint(page);
  await page.getByLabel('Legenda do print').nth(1).fill('Depois do cupom');
  await expect(page.locator('.shot .fname')).toHaveText(['CT01_P1_01.png', 'CT01_P2_01_depois-do-cupom.png']);
  await expect(page.locator('.item', { hasText: 'CT01' })).toContainText('2 📷');

  await page.waitForTimeout(400); // gravacao com atraso
  await page.reload();
  await page.getByRole('button', { name: 'Continuar de onde parei' }).click();
  await expect(page.locator('.shot .fname')).toHaveText(['CT01_P1_01.png', 'CT01_P2_01_depois-do-cupom.png']);
});

test('marcar status: passo com falha reprova o teste e entra no comentario', async ({ page }) => {
  await gerarCaderno(page);

  // CT01: os dois passos passam -> o teste vira Passou sozinho
  await page.getByLabel('Passo 1 passou').click();
  await page.getByLabel('Passo 2 passou').click();
  await expect(page.locator('#card .selo')).toHaveText('Passou');

  // CT02: passo 2 falha -> teste Falhou, mostra o passo, "Passou" bloqueado
  await page.getByRole('button', { name: 'Próximo teste →' }).click();
  await page.getByLabel('Passo 1 passou').click();
  await page.getByLabel('Passo 2 falhou').click();
  await page.getByPlaceholder("Ex.: mensagem 'O cupom expirou'").fill('Cupom expirado foi aceito');
  await expect(page.locator('#card .selo')).toHaveText('Falhou');
  await expect(page.locator('.motivo')).toHaveText('Falhou no passo 2');
  await expect(page.getByRole('button', { name: '✔ Passou' })).toBeDisabled();

  // CT03: nao consegui fazer
  await page.getByRole('button', { name: 'Próximo teste →' }).click();
  await page.getByRole('button', { name: 'Não consegui fazer' }).click();

  await expect(page.locator('#prog')).toContainText('3/3 feitos');
  await page.getByRole('button', { name: 'Gerar comentário' }).click();
  const comentario = await page.locator('#comentario').inputValue();
  expect(comentario).toContain('Realizados os 2 cenários de testes solicitados na task 9001 - Cupom de desconto:');
  expect(comentario).toContain('- [Etapa 1] Bloquear cupom expirado (passo 2): Cupom expirado foi aceito');
  expect(comentario).toContain('Não executados:\n- [Etapa 2] Manter cupom após recarregar a página');
  expect(comentario.endsWith('Reprovado. ❌ Bug(s) aberto(s): #____')).toBe(true);
});

test('exportar CSV do Azure: sem edicao sai identico ao importado', async ({ page }) => {
  await gerarCaderno(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV do Azure' }).click()]);
  expect(download.suggestedFilename()).toBe('test-cases_9001-cupom-de-desconto.csv');
  expect(readFileSync(await download.path())).toEqual(readFileSync(exemplo('test-cases-exemplo.csv')));
});

test('editar: incluir passo e test case entram no CSV exportado', async ({ page }) => {
  await gerarCaderno(page);
  await page.getByRole('button', { name: '✎ Editar' }).click();
  await page.getByRole('button', { name: '+ Adicionar passo' }).click();
  await page.getByLabel('Ação do passo 3').fill('Remover o cupom.');
  await page.getByLabel('Resultado esperado do passo 3').fill('O subtotal volta ao original.');
  await page.getByRole('button', { name: '+ Novo test case' }).click();
  await page.getByLabel('Título do test case').fill('[Etapa 1] Cupom em maiusculas e minusculas');
  await page.getByLabel('Ação do passo 1').fill('Aplicar bemvindo10.');
  await page.getByLabel('Resultado esperado do passo 1').fill('Desconto aplicado.');
  await page.getByRole('button', { name: '✔ Concluir edição' }).click();

  await expect(page.locator('.item .n')).toHaveText(['CT01', 'CT04', 'CT02', 'CT03']);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV do Azure' }).click()]);
  const csv = readFileSync(await download.path(), 'utf8');
  expect(csv).toContain(',,,3,Remover o cupom.,O subtotal volta ao original.,,,\r\n');
  expect(csv).toContain(',Test Case,[Etapa 1] Cupom em maiusculas e minusculas,1,Aplicar bemvindo10.,Desconto aplicado.,Loja Exemplo\\Checkout,Pessoa QA,Design\r\n');
});

test('baixar evidencias: zip com prints nomeados, resumo e comentario', async ({ page }) => {
  await gerarCaderno(page);
  await colarPrint(page);
  await page.getByLabel('Passo 1 passou').click();
  await page.getByLabel('Passo 2 passou').click();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar evidências (.zip)' }).click()]);
  expect(download.suggestedFilename()).toBe('evidencias_9001-cupom-de-desconto.zip');
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  expect(Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort()).toEqual(['comentario.txt', 'evidencias/CT01_P1_01.png', 'resumo.html']);
  expect(await zip.file('comentario.txt')!.async('string')).toContain('Aprovado. ✅');
});
