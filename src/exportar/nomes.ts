// Nome dos prints: CT03_P2_01.png, ou CT03_P2_01_depois.png com legenda.
// Teste sem passos: CT03_01.png.

export function nomeEvidencia(ev: { testeId: string; passo: number; seq: number; legenda: string; tipo: string }): string {
  const seq = String(ev.seq).padStart(2, '0');
  const passo = ev.passo > 0 ? `_P${ev.passo}` : '';
  const legenda = slug(ev.legenda);
  return `${ev.testeId}${passo}_${seq}${legenda ? `_${legenda}` : ''}.${extensao(ev.tipo)}`;
}

export function slug(texto: string, limite = 40): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, limite)
    .replace(/-+$/, '');
}

function extensao(tipo: string): string {
  if (tipo === 'image/jpeg') return 'jpg';
  if (tipo === 'image/webp') return 'webp';
  if (tipo === 'image/gif') return 'gif';
  return 'png';
}
