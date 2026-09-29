// Pecas pequenas usadas pelas telas: escapar HTML, aviso, janela modal, baixar e copiar.

export const $ = <T extends Element = HTMLElement>(seletor: string, raiz: ParentNode = document) => raiz.querySelector<T>(seletor);

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

let tempoAviso = 0;
export function aviso(mensagem: string): void {
  const raiz = $('#toast')!;
  raiz.innerHTML = `<div class="toast" role="status">${esc(mensagem)}</div>`;
  clearTimeout(tempoAviso);
  tempoAviso = window.setTimeout(() => (raiz.innerHTML = ''), 2800);
}

export function abrirModal(html: string): HTMLElement {
  const raiz = $('#modal')!;
  raiz.innerHTML = `<div class="modal" data-fundo>${html}</div>`;
  const modal = $('.modal', raiz)!;
  modal.addEventListener('click', (e) => {
    const alvo = e.target as HTMLElement;
    if (alvo.hasAttribute('data-fundo') || alvo.closest('[data-fechar]')) fecharModal();
  });
  return modal;
}

export function fecharModal(): void {
  $('#modal')!.innerHTML = '';
}

export function baixar(dados: BlobPart, nome: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([dados], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copiarTexto(texto: string, campo?: HTMLTextAreaElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    aviso('Texto copiado.');
  } catch {
    // Alguns navegadores bloqueiam a area de transferencia em file://
    campo?.focus();
    campo?.select();
    aviso('Texto selecionado: aperte Ctrl+C.');
  }
}

// Botao destrutivo: o primeiro clique "arma", o segundo confirma.
export function confirmarNoSegundoClique(botao: HTMLElement, textoConfirmar = 'Confirmar?'): boolean {
  if (botao.classList.contains('arm')) return true;
  const original = botao.textContent;
  botao.classList.add('arm');
  botao.textContent = textoConfirmar;
  setTimeout(() => {
    botao.classList.remove('arm');
    botao.textContent = original;
  }, 3000);
  return false;
}

// Nao usar arquivo.text(): ele remove o BOM em silencio, e a exportacao
// precisa saber se o CSV original tinha BOM para devolver o arquivo identico.
export async function lerArquivo(arquivo: File): Promise<string> {
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(await arquivo.arrayBuffer());
}
