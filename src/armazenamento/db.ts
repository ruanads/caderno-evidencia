// Persistencia no IndexedDB do navegador. Os dados ficam SO neste navegador,
// neste computador: nada e enviado para a rede.
//
// Versao 2: varios cadernos (um por task), guardados para o reteste.
//   "cadernos"   um registro por caderno
//   "evidencias" um registro por print (indice por caderno), para nao regravar
//                todas as imagens a cada tecla digitada
//   "kv"         preferencias pequenas (ultimo caderno aberto)
// A versao 1 tinha um caderno so em kv["caderno"]; a migracao o transforma no
// primeiro caderno da lista e liga os prints a ele.

import type { Caderno, Evidencia } from '../modelo.ts';

const NOME = 'caderno-evidencias';
const VERSAO = 2;
let conexao: IDBDatabase | null = null;

export async function abrir(): Promise<boolean> {
  try {
    conexao = await new Promise<IDBDatabase>((resolve, reject) => {
      const pedido = indexedDB.open(NOME, VERSAO);
      pedido.onupgradeneeded = (ev) => migrar(pedido.result, pedido.transaction!, ev.oldVersion);
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
    });
    return true;
  } catch {
    conexao = null; // navegador sem IndexedDB (ex.: janela anonima restrita): funciona, mas nao salva
    return false;
  }
}

function migrar(db: IDBDatabase, tx: IDBTransaction, versaoAntiga: number): void {
  if (versaoAntiga < 1) {
    db.createObjectStore('kv');
    db.createObjectStore('evidencias', { keyPath: 'id' });
  }
  if (versaoAntiga < 2) {
    const cadernos = db.createObjectStore('cadernos', { keyPath: 'id' });
    const evidencias = tx.objectStore('evidencias');
    evidencias.createIndex('cadernoId', 'cadernoId');

    const kv = tx.objectStore('kv');
    const antigo = kv.get('caderno');
    antigo.onsuccess = () => {
      const c = antigo.result as Omit<Caderno, 'id' | 'criadoEm' | 'atualizadoEm' | 'rodada'> | undefined;
      if (!c) return;
      const id = crypto.randomUUID();
      const agora = Date.now();
      cadernos.put({ ...c, id, criadoEm: agora, atualizadoEm: agora, rodada: 1 });
      kv.delete('caderno');
      kv.put(id, 'ultimo');
      const cursor = evidencias.openCursor();
      cursor.onsuccess = () => {
        const atual = cursor.result;
        if (!atual) return;
        atual.update({ ...atual.value, cadernoId: id, rodada: 1 });
        atual.continue();
      };
    };
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

export const listarCadernos = async () => (await operacao<Caderno[]>('cadernos', 'readonly', (s) => s.getAll())) ?? [];
export const lerCaderno = (id: string) => operacao<Caderno>('cadernos', 'readonly', (s) => s.get(id));
export const gravarCaderno = (c: Caderno) => operacao('cadernos', 'readwrite', (s) => s.put(c));
export const lerUltimo = () => operacao<string>('kv', 'readonly', (s) => s.get('ultimo'));
export const gravarUltimo = (id: string) => operacao('kv', 'readwrite', (s) => s.put(id, 'ultimo'));

export const lerEvidencias = async (cadernoId: string) =>
  (await operacao<Evidencia[]>('evidencias', 'readonly', (s) => s.index('cadernoId').getAll(cadernoId))) ?? [];
export const gravarEvidencia = (e: Evidencia) => operacao('evidencias', 'readwrite', (s) => s.put(e));
export const apagarEvidencia = (id: string) => operacao('evidencias', 'readwrite', (s) => s.delete(id));

export async function apagarCaderno(id: string): Promise<void> {
  for (const ev of await lerEvidencias(id)) await apagarEvidencia(ev.id);
  await operacao('cadernos', 'readwrite', (s) => s.delete(id));
}
