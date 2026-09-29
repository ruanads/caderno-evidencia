import { expect, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = fileURLToPath(new URL('../../', import.meta.url));
export const exemplo = (nome: string) => `${raiz}exemplos/${nome}`;
export const pagina = pathToFileURL(`${raiz}dist/index.html`).href;

// Monta o caderno pela tela inicial, como a pessoa faria.
export async function gerarCaderno(page: Page, opcoes: { massa?: string } = {}): Promise<void> {
  await page.goto(pagina);
  await page.getByPlaceholder('Cole aqui o título da task do Azure').fill('9001 - Cupom de desconto');
  await page.locator('#arq-csv').setInputFiles(exemplo('test-cases-exemplo.csv'));
  await expect(page.getByText('3 test cases, 7 passos')).toBeVisible();
  if (opcoes.massa) await page.locator('#arq-massa').setInputFiles(exemplo(opcoes.massa));
  await page.getByRole('button', { name: 'Gerar caderno' }).click();
  await expect(page.locator('#card')).toBeVisible();
}

// Simula Win+Shift+S seguido de Ctrl+V: um evento "paste" com uma imagem PNG.
export async function colarPrint(page: Page, cor = '#1d5c8c', texto = 'print'): Promise<void> {
  await page.evaluate(async ({ cor, texto }) => {
    const tela = document.createElement('canvas');
    tela.width = 960;
    tela.height = 600;
    const g = tela.getContext('2d')!;
    g.fillStyle = '#f3f5f7';
    g.fillRect(0, 0, 960, 600);
    g.fillStyle = cor;
    g.fillRect(0, 0, 960, 56);
    g.fillStyle = '#ffffff';
    g.font = 'bold 26px sans-serif';
    g.fillText('Loja Exemplo · Carrinho', 24, 38);
    g.fillStyle = '#16212b';
    g.font = '24px sans-serif';
    g.fillText(texto, 24, 120);
    const blob = await new Promise<Blob>((ok) => tela.toBlob((b) => ok(b!), 'image/png'));
    const dados = new DataTransfer();
    dados.items.add(new File([blob], 'print.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dados, bubbles: true }));
  }, { cor, texto });
}
