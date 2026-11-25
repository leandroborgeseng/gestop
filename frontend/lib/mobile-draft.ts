/**
 * 303/G5 — rascunho local da vistoria em andamento (respostas, fotos e check-in), salvo a cada alteração.
 * IndexedDB (fotos em data URL não cabem no localStorage). Fechar o app, perder o GPS ou a rede não apaga nada;
 * o rascunho só é removido quando a vistoria é enviada ou entra na fila, ou por "Descartar rascunho" (com confirmação).
 * M-2: um rascunho por vistoria (programada = cronograma+data; avulsa = próprio+checklist); trocar de aba nunca apaga.
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

/** Chave do rascunho: programada por cronograma+data; avulsa por próprio+checklist. */
export function chaveRascunho(r: Pick<RascunhoVistoria, 'unidadeId' | 'checklistId' | 'programadaCtx'>) {
  return r.programadaCtx
    ? `prog:${r.programadaCtx.cronogramaId}:${r.programadaCtx.dataProgramada}`
    : `avulsa:${r.unidadeId}:${r.checklistId}`;
}

export function chaveProgramada(cronogramaId: string, data: string) {
  return `prog:${cronogramaId}:${data}`;
}

/** M-2/UM2-2: há DADOS da vistoria (respostas, fotos ou check-in)? Só então pede confirmação ao sair. */
export function rascunhoTemDados(r: Pick<RascunhoVistoria, 'responses' | 'checkin'>) {
  return Boolean(r.checkin) || Object.keys(r.responses ?? {}).length > 0;
}

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

/** Todos os rascunhos (inclui o formato antigo com chave "atual"). */
export async function listarRascunhos(): Promise<Array<RascunhoVistoria & { chave: string }>> {
  if (!disponivel()) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    const out: Array<RascunhoVistoria & { chave: string }> = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve(out.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)));
      const v = cur.value as RascunhoVistoria;
      out.push({ ...v, chave: cur.key === KEY ? chaveRascunho(v) : String(cur.key) });
      cur.continue();
    };
    req.onerror = () => reject(req.error ?? new Error('Falha ao ler os rascunhos locais.'));
  });
}

/** Rascunho mais recente (restaurado ao reabrir o app). */
export async function lerRascunho(): Promise<RascunhoVistoria | null> {
  return (await listarRascunhos())[0] ?? null;
}

export async function gravarRascunho(r: RascunhoVistoria) {
  if (!disponivel()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(r, chaveRascunho(r));
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar o rascunho local.'));
  });
}

/** Remove UM rascunho (vistoria enviada/na fila ou "Descartar rascunho" confirmado). */
export async function limparRascunho(chave: string) {
  if (!disponivel()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(chave);
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao limpar o rascunho local.'));
  });
}
