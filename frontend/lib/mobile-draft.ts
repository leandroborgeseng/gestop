/**
 * 303/G5 — rascunho local da vistoria em andamento (respostas, fotos e check-in), salvo a cada alteração.
 * IndexedDB (fotos em data URL não cabem no localStorage). Fechar o app, perder o GPS ou a rede não apaga nada;
 * o rascunho só é removido quando a vistoria é enviada ou entra na fila.
 */
import { CheckinGps } from './checkin-gps';

const DB_NAME = 'sigma-mobile-draft';
const DB_VERSION = 1;
const STORE = 'rascunho';
const KEY = 'atual';

export type RascunhoVistoria = {
  versao: 1;
  escopoKey: string;
  unidadeId: string;
  checklistId: string;
  programadaCtx: { cronogramaId: string; dataProgramada: string; checklistNome: string; programacaoAtualizadaEm?: string } | null;
  responses: Record<string, unknown>;
  checkin: CheckinGps | null;
  atualizadoEm: string;
};

/** Há algo que valha guardar? (sem próprio escolhido não há rascunho). */
export function rascunhoTemConteudo(r: Pick<RascunhoVistoria, 'unidadeId' | 'checklistId' | 'responses' | 'checkin'>) {
  return Boolean(r.unidadeId && (r.checklistId || r.checkin || Object.keys(r.responses).length));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Falha ao abrir o rascunho local.'));
  });
}

function disponivel() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export async function lerRascunho(): Promise<RascunhoVistoria | null> {
  if (!disponivel()) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as RascunhoVistoria | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('Falha ao ler o rascunho local.'));
  });
}

export async function gravarRascunho(r: RascunhoVistoria) {
  if (!disponivel()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(r, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar o rascunho local.'));
  });
}

export async function limparRascunho() {
  if (!disponivel()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao limpar o rascunho local.'));
  });
}
