// Gera os prints do README e o relatorio de exemplo a partir dos exemplos
// ficticios: "npm run docs:prints". Assim o README nunca mostra dados reais.

import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { colarPrint, exemplo, pagina } from './apoio.ts';

const destino = (nome: string) => new URL(`../../docs/${nome}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('prints do README e relatorio de exemplo @docs', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });

  await page.goto(pagina);
  await page.getByPlaceholder('Cole aqui o título da task do Azure').fill('9001 - Cupom de desconto');
  await page.locator('#arq-csv').setInputFiles(exemplo('test-cases-exemplo.csv'));
  await page.locator('#arq-massa').setInputFiles(exemplo('massa-exemplo.csv'));
  await page.screenshot({ path: destino('img/1-inicio.png'), fullPage: true });
  await page.getByRole('button', { name: 'Gerar caderno' }).click();

  // Rodada 1: CT01 passa, CT02 falha (bug), CT03 nao executado
  await colarPrint(page, '#1d5c8c', 'Subtotal: R$ 120,00');
  await page.getByLabel('Passo 1 passou').click();
  await colarPrint(page, '#1e7a46', 'Cupom BEMVINDO10 aplicado: -R$ 12,00');
  await page.getByLabel('Legenda do print').nth(1).fill('desconto aplicado');
  await page.getByLabel('Passo 2 passou').click();

  await page.getByRole('button', { name: 'Próximo teste →' }).click();
  await page.getByLabel('Passo 1 passou').click();
  await colarPrint(page, '#b42318', 'Cupom VERAO2020 aplicado: -R$ 12,00');
  await page.getByLabel('Passo 2 falhou').click();
  await page.getByPlaceholder("Ex.: mensagem 'O cupom expirou'").fill('O cupom expirado foi aceito e o desconto aplicado.');
  await page.getByLabel('Legenda do print').fill('cupom expirado aceito');
  await page.getByLabel('Nº do bug').fill('1001');
  await page.locator('.item', { hasText: 'CT01' }).click();
  await page.evaluate(() => (document.querySelector('#toast')!.innerHTML = ''));
  await page.screenshot({ path: destino('img/2-caderno.png') });

  await page.locator('.item', { hasText: 'CT02' }).click();
  await page.evaluate(() => (document.querySelector('#toast')!.innerHTML = ''));
  await page.screenshot({ path: destino('img/3-falha.png') });

  await page.locator('.item', { hasText: 'CT03' }).click();
  await page.getByRole('button', { name: 'Não consegui fazer' }).click();
  await page.getByPlaceholder("Ex.: mensagem 'O cupom expirou'").fill('Ambiente fora do ar durante a janela de teste.');

  await page.getByRole('button', { name: 'Gerar comentário' }).click();
  await page.screenshot({ path: destino('img/4-comentario.png') });
  await page.getByRole('button', { name: 'Fechar' }).click();

  // Rodada 2 (reteste): CT02 corrigido passa; CT03 executado falha (novo bug)
  await page.getByRole('button', { name: 'Iniciar reteste' }).click();
  await page.getByLabel('Os que falharam e os não executados (2)').check();
  await page.locator('#confirmar-reteste').click();
  await page.getByLabel('Passo 1 passou').click();
  await colarPrint(page, '#1e7a46', 'Cupom VERAO2020 recusado: cupom expirado');
  await page.getByLabel('Passo 2 passou').click();
  await page.locator('.item', { hasText: 'CT03' }).click();
  await page.getByLabel('Passo 1 passou').click();
  await page.getByLabel('Passo 2 passou').click();
  await colarPrint(page, '#b42318', 'Carrinho recarregado: cupom removido');
  await page.getByLabel('Passo 3 falhou').click();
  await page.getByPlaceholder("Ex.: mensagem 'O cupom expirou'").fill('Ao recarregar a página o cupom some do pedido.');
  await page.getByLabel('Nº do bug').fill('1002');

  await page.getByRole('button', { name: 'Relatório', exact: true }).click();
  await page.getByLabel('Ambiente').fill('Homologação');
  await page.getByLabel('Versão / build').fill('2026.09.3');
  await page.getByLabel('Base de dados').fill('Loja_Homolog');
  await page.getByLabel('Executado por').fill('Pessoa QA');
  await page.getByLabel('Chrome').check();
  await page.getByLabel('Edge').check();
  await page.getByRole('button', { name: '+ Adicionar risco' }).click();
  await page.getByLabel('Risco 1', { exact: true }).fill('Cupom em pedidos com frete grátis não foi testado.');
  await page.getByRole('button', { name: '+ Adicionar risco' }).click();
  await page.getByLabel('Risco 2', { exact: true }).fill('Persistência do cupom após recarregar falha (bug 1002): pode afetar o faturamento.');
  await page.getByLabel('Nível do risco 2').selectOption('alto');
  await page.evaluate(() => (document.querySelector('#toast')!.innerHTML = ''));
  await page.screenshot({ path: destino('img/5-dados-relatorio.png') });

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar relatório (.html)' }).click()]);
  await download.saveAs(destino('exemplo-relatorio.html'));

  await page.goto(pathToFileURL(destino('exemplo-relatorio.html')).href);
  await expect(page.locator('.veredito')).toContainText('Reprovado');
  await page.screenshot({ path: destino('img/6-relatorio.png'), fullPage: true });
});
