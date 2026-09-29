import { expect, test, type Page } from '@playwright/test';
import { colarPrint, gerarCaderno } from './apoio.ts';

// Le a cor de um pixel da imagem do print (em coordenadas da imagem real).
async function corDoPixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.evaluate(async ([x, y]) => {
    const src = document.querySelector<HTMLImageElement>('.shot img')!.src;
    const img = await createImageBitmap(await (await fetch(src)).blob());
    const tela = new OffscreenCanvas(img.width, img.height);
    const g = tela.getContext('2d')!;
    g.drawImage(img, 0, 0);
    return [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
  }, [x, y]);
}

test('anotar print com retangulo, guardar a original e restaurar', async ({ page }) => {
  await gerarCaderno(page);
  await colarPrint(page); // 960x600, fundo claro

  await page.getByRole('button', { name: 'Anotar' }).click();
  const tela = page.getByLabel('Imagem para anotar');
  await expect(tela).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar anotação' })).toBeDisabled();

  // Arrasta de 30% a 70% da imagem: retangulo de (288,180) a (672,420)
  const caixa = (await tela.boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width * 0.3, caixa.y + caixa.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(caixa.x + caixa.width * 0.5, caixa.y + caixa.height * 0.5, { steps: 5 });
  await page.mouse.move(caixa.x + caixa.width * 0.7, caixa.y + caixa.height * 0.7, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Salvar anotação' }).click();

  await expect(page.locator('.shot .fname')).toContainText('anotado');
  const [r, g, b] = await corDoPixel(page, 288, 300); // borda esquerda do retangulo
  expect(r).toBeGreaterThan(200);
  expect(g).toBeLessThan(80);
  expect(b).toBeLessThan(80);
  expect(await corDoPixel(page, 480, 300)).toEqual([243, 245, 247]); // dentro: fundo intacto

  await page.getByRole('button', { name: 'Anotar' }).click();
  await page.getByRole('button', { name: 'Restaurar original' }).click();
  await expect(page.locator('.shot .fname')).not.toContainText('anotado');
  expect(await corDoPixel(page, 288, 300)).toEqual([243, 245, 247]);
});
