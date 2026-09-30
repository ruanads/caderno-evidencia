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

test('criar caderno sem CSV: test cases feitos na tela e exportados para o Azure', async ({ page }) => {
  await page.goto(pagina);
  await page.getByPlaceholder('Cole aqui o título da task do Azure').fill('9003 - Sem CSV');
  await expect(page.getByRole('button', { name: 'Gerar caderno' })).toBeDisabled();
  await page.getByRole('button', { name: 'Não tenho CSV: criar os test cases aqui' }).click();
  await page.getByRole('button', { name: 'Gerar caderno' }).click();

  // Ja abre editando o CT01 em branco
  await expect(page.locator('.item .t')).toHaveText('(sem título)');
  await page.getByLabel('Título do test case').fill('[Etapa 1] Cupom válido');
  await page.getByLabel('Ação do passo 1').fill('Aplicar o cupom.');
  await page.getByLabel('Resultado esperado do passo 1').fill('Desconto aplicado.');

  await page.getByRole('button', { name: '+ Novo test case' }).click();
  await expect(page.getByLabel('Título do test case')).toHaveValue('[Etapa 1] '); // herda o grupo
  await page.getByLabel('Título do test case').fill('[Etapa 1] Cupom expirado');
  await page.getByLabel('Ação do passo 1').fill('Aplicar VERAO2020.');
  await page.getByLabel('Resultado esperado do passo 1').fill('Cupom recusado.');
  await page.getByRole('button', { name: '✔ Concluir edição' }).click();

  await expect(page.locator('.item .n')).toHaveText(['CT01', 'CT02']);
  await page.getByLabel('Passo 1 passou').click(); // executa como qualquer caderno
  await expect(page.locator('#card .selo')).toHaveText('Passou');

  // Sem CSV de origem, Area Path e Assigned To nascem vazios: exportar exige preencher
  await page.getByRole('button', { name: 'Exportar CSV do Azure' }).click();
  await page.getByRole('button', { name: 'Baixar CSV' }).click();
  await expect(page.getByRole('alert')).toHaveText('Preencha o Area Path e o Assigned To.');
  await page.getByLabel('Area Path').fill('Loja Exemplo\\Checkout');
  await page.getByLabel('Assigned To').fill('Pessoa QA');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar CSV' }).click()]);
  expect(readFileSync(await download.path(), 'utf8')).toBe('﻿' + [
    'ID,Work Item Type,Title,Test Step,Step Action,Step Expected,Area Path,Assigned To,State',
    ',Test Case,[Etapa 1] Cupom válido,1,Aplicar o cupom.,Desconto aplicado.,Loja Exemplo\\Checkout,Pessoa QA,Design',
    ',Test Case,[Etapa 1] Cupom expirado,1,Aplicar VERAO2020.,Cupom recusado.,Loja Exemplo\\Checkout,Pessoa QA,Design',
    '',
  ].join('\r\n'));

  // Na proxima exportacao os campos ja vem preenchidos
  await page.getByRole('button', { name: 'Exportar CSV do Azure' }).click();
  await expect(page.getByLabel('Area Path')).toHaveValue('Loja Exemplo\\Checkout');
});

test('importar CSV num caderno criado sem CSV substitui o teste em branco; depois acrescenta', async ({ page }) => {
  await page.goto(pagina);
  await page.getByPlaceholder('Cole aqui o título da task do Azure').fill('9004 - Importar depois');
  await page.getByRole('button', { name: 'Não tenho CSV: criar os test cases aqui' }).click();
  await page.getByRole('button', { name: 'Gerar caderno' }).click();

  await page.locator('#arq-importar').setInputFiles(exemplo('test-cases-exemplo.csv'));
  await expect(page.locator('.item .n')).toHaveText(['CT01', 'CT02', 'CT03']);
  await expect(page.locator('#card h2')).toHaveText('[Etapa 1] Aplicar cupom válido no carrinho');

  // Com o CSV no lugar do teste em branco, a exportacao volta a ser identica ao arquivo
  await page.getByRole('button', { name: 'Exportar CSV do Azure' }).click();
  await expect(page.getByLabel('Area Path')).toHaveValue('Loja Exemplo\\Checkout');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar CSV' }).click()]);
  expect(readFileSync(await download.path())).toEqual(readFileSync(exemplo('test-cases-exemplo.csv')));

  // Importar de novo: agora acrescenta, com IDs novos
  await page.locator('#arq-importar').setInputFiles(exemplo('test-cases-exemplo.csv'));
  await expect(page.locator('.item .n')).toHaveText(['CT01', 'CT02', 'CT03', 'CT04', 'CT05', 'CT06']);
  await expect(page.getByText('3 test cases adicionados (CT04 a CT06).')).toBeVisible();

  // CSV invalido mostra o erro e nao mexe no caderno
  await page.locator('#arq-importar').setInputFiles(exemplo('massa-exemplo.csv'));
  await expect(page.getByRole('alert')).toContainText('nao e o do Azure Test Plans');
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('.item .n')).toHaveCount(6);
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
