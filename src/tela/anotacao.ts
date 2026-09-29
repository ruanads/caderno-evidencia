// Anotacao no print: retangulo e seta em vermelho, desenhados sobre a imagem
// no tamanho real dela (o canvas so e reduzido na tela, via CSS).
//
// Ao salvar, a imagem anotada vira o print; a original fica guardada em
// "original" para poder restaurar. Evidencia nao deve perder o registro bruto.

import type { Evidencia } from '../modelo.ts';
import { $, abrirModal, fecharModal } from './util.ts';

type Forma = { tipo: 'retangulo' | 'seta'; x1: number; y1: number; x2: number; y2: number };
const COR = '#e11d2e';

export function abrirAnotacao(ev: Evidencia, aoSalvar: (novo: Blob | null) => void): void {
  const modal = abrirModal(`<div class="sheet anotacao" role="dialog" aria-label="Anotar print">
    <div class="ferramentas">
      <button class="btn" data-ferramenta="retangulo" aria-pressed="true">▭ Retângulo</button>
      <button class="btn" data-ferramenta="seta" aria-pressed="false">➔ Seta</button>
      <button class="btn ghost" id="desfazer" disabled>↶ Desfazer</button>
      ${ev.original ? '<button class="btn ghost" id="restaurar">Restaurar original</button>' : ''}
      <span class="note">Arraste sobre a imagem para desenhar.</span>
    </div>
    <div class="tela-anotacao"><canvas id="tela" aria-label="Imagem para anotar"></canvas></div>
    <div class="row"><button class="btn" data-fechar>Cancelar</button><button class="btn primary" id="salvar-anotacao" disabled>Salvar anotação</button></div>
  </div>`);

  const tela = $<HTMLCanvasElement>('#tela', modal)!;
  const g = tela.getContext('2d')!;
  const formas: Forma[] = [];
  let ferramenta: Forma['tipo'] = 'retangulo';
  let atual: Forma | null = null;
  const img = new Image();

  const desenhar = () => {
    g.drawImage(img, 0, 0);
    [...formas, ...(atual ? [atual] : [])].forEach((f) => desenharForma(g, f, espessura(tela.width)));
    $<HTMLButtonElement>('#desfazer', modal)!.disabled = formas.length === 0;
    $<HTMLButtonElement>('#salvar-anotacao', modal)!.disabled = formas.length === 0;
  };

  img.onload = () => {
    tela.width = img.naturalWidth;
    tela.height = img.naturalHeight;
    desenhar();
  };
  img.src = URL.createObjectURL(ev.blob);

  // Converte a posicao do mouse (na imagem reduzida) para pixels da imagem real.
  const ponto = (e: PointerEvent) => {
    const r = tela.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * tela.width, y: ((e.clientY - r.top) / r.height) * tela.height };
  };

  tela.addEventListener('pointerdown', (e) => {
    const p = ponto(e);
    atual = { tipo: ferramenta, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    tela.setPointerCapture(e.pointerId);
  });
  tela.addEventListener('pointermove', (e) => {
    if (!atual) return;
    const p = ponto(e);
    atual.x2 = p.x;
    atual.y2 = p.y;
    desenhar();
  });
  tela.addEventListener('pointerup', () => {
    if (atual && Math.hypot(atual.x2 - atual.x1, atual.y2 - atual.y1) > 4) formas.push(atual);
    atual = null;
    desenhar();
  });

  modal.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.ferramenta) {
      ferramenta = b.dataset.ferramenta as Forma['tipo'];
      modal.querySelectorAll('[data-ferramenta]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    } else if (b.id === 'desfazer') {
      formas.pop();
      desenhar();
    } else if (b.id === 'restaurar') {
      fecharModal();
      aoSalvar(null);
    } else if (b.id === 'salvar-anotacao') {
      tela.toBlob((blob) => {
        fecharModal();
        if (blob) aoSalvar(blob);
      }, 'image/png');
    }
  });
}

// Espessura proporcional a imagem: legivel num print grande e num pequeno.
export function espessura(larguraImagem: number): number {
  return Math.max(3, Math.round(larguraImagem / 250));
}

// Os dois cantos da ponta da seta, a 30 graus da haste, voltados para tras.
export function pontaSeta(x1: number, y1: number, x2: number, y2: number, tamanho: number): [number, number][] {
  const angulo = Math.atan2(y2 - y1, x2 - x1);
  return [-1, 1].map((lado) => {
    const a = angulo + Math.PI + lado * (Math.PI / 6);
    return [x2 + tamanho * Math.cos(a), y2 + tamanho * Math.sin(a)] as [number, number];
  });
}

function desenharForma(g: CanvasRenderingContext2D, f: Forma, largura: number): void {
  g.strokeStyle = COR;
  g.fillStyle = COR;
  g.lineWidth = largura;
  g.lineJoin = 'round';
  g.lineCap = 'round';

  if (f.tipo === 'retangulo') {
    g.strokeRect(Math.min(f.x1, f.x2), Math.min(f.y1, f.y2), Math.abs(f.x2 - f.x1), Math.abs(f.y2 - f.y1));
    return;
  }
  g.beginPath();
  g.moveTo(f.x1, f.y1);
  g.lineTo(f.x2, f.y2);
  g.stroke();
  const [a, b] = pontaSeta(f.x1, f.y1, f.x2, f.y2, largura * 5);
  g.beginPath();
  g.moveTo(f.x2, f.y2);
  g.lineTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.closePath();
  g.fill();
}
