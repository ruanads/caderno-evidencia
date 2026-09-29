// Persistencia no IndexedDB do navegador. Os dados ficam SO neste navegador,
// neste computador: nada e enviado para a rede.
//
// Dois "stores": "kv" guarda o caderno (um objeto so) e "evidencias" guarda um
// registro por print, para nao regravar todas as imagens a cada tecla digitada.

import type { Caderno, Evidencia } from '../modelo.ts';

const NOME = 'caderno-evidencias';
const VERSAO = 1;
let conexao: IDBDatabase | null = null;

export async function abrir(): Promise<boolean> {
  try {
    conexao = await new Promise<IDBDatabase>((resolve, reject) => {
      const pedido = indexedDB.open(NOME, VERSAO);
      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        db.createObjectStore('kv');
        db.createObjectStore('evidencias', { keyPath: 'id' });
      };
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
    });
    return true;
  } catch {
    conexao = null; // navegador sem IndexedDB (ex.: janela anonima restrita): funciona, mas nao salva
    return false;
  }
}

function operacao<T>(store: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | null> {
  if (!conexao) return Promise.resolve(null);
  return new Promise((resolve) => {
    const tx = conexao!.transaction(store, modo);
    const pedido = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(pedido ? (pedido.result as T) : null);
    tx.onerror = () => resolve(null);
  });
}

export const lerCaderno = () => operacao<Caderno>('kv', 'readonly', (s) => s.get('caderno'));
export const gravarCaderno = (c: Caderno) => operacao('kv', 'readwrite', (s) => s.put(c, 'caderno'));
export const lerEvidencias = async () => (await operacao<Evidencia[]>('evidencias', 'readonly', (s) => s.getAll())) ?? [];
export const gravarEvidencia = (e: Evidencia) => operacao('evidencias', 'readwrite', (s) => s.put(e));
export const apagarEvidencia = (id: string) => operacao('evidencias', 'readwrite', (s) => s.delete(id));

export async function apagarTudo(): Promise<void> {
  await operacao('kv', 'readwrite', (s) => s.clear());
  await operacao('evidencias', 'readwrite', (s) => s.clear());
}
