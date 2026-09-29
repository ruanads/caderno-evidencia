// Gera os prints do README a partir dos exemplos ficticios: "npm run docs:prints".
// Assim o README nunca mostra dados reais e pode ser refeito quando a tela mudar.

import { test } from '@playwright/test';
import { colarPrint, exemplo, gerarCaderno, pagina } from './apoio.ts';

const destino = (nome: string) => new URL(`../../docs/img/${nome}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('prints do README @docs', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });

  await page.goto(pagina);
  await page.getByPlaceholder('Cole aqui o título da task do Azure').fill('9001 - Cupom de desconto');
  await page.locator('#arq-csv').setInputFiles(exemplo('test-cases-exemplo.csv'));
  await page.locator('#arq-massa').setInputFiles(exemplo('massa-exemplo.csv'));
  await page.screenshot({ path: destino('1-inicio.png'), fullPage: true });

  await page.getByRole('button', { name: 'Gerar caderno' }).click();
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
  await page.locator('.item', { hasText: 'CT01' }).click();
  await page.evaluate(() => (document.querySelector('#toast')!.innerHTML = ''));
  await page.screenshot({ path: destino('2-caderno.png') });

  await page.locator('.item', { hasText: 'CT02' }).click();
  await page.screenshot({ path: destino('3-falha.png') });

  await page.getByRole('button', { name: 'Gerar comentário' }).click();
  await page.screenshot({ path: destino('4-comentario.png') });
});
