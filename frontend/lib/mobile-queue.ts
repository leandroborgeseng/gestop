import { MobileQueuedInspection } from './types';

const DB_NAME = 'sigma-mobile';
const DB_VERSION = 1;
const STORE = 'inspection-queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientEventId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir IndexedDB.'));
  });
}

export async function readMobileQueue(): Promise<MobileQueuedInspection[]> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return readLegacyQueue();
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result as MobileQueuedInspection[]) ?? [];
      resolve(items.sort((a, b) => a.concluidaEm.localeCompare(b.concluidaEm)));
    };
    request.onerror = () => reject(request.error ?? new Error('Falha ao ler fila offline.'));
  });
}

export async function writeMobileQueue(queue: MobileQueuedInspection[]) {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    writeLegacyQueue(queue);
    return;
  }

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    for (const item of queue) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar fila offline.'));
  });
}

export async function migrateLegacyQueueIfNeeded() {
  const legacy = readLegacyQueue();
  if (legacy.length === 0) return;

  const current = await readMobileQueue();
  if (current.length === 0) {
    await writeMobileQueue(legacy);
  }
  window.localStorage.removeItem('gestop.mobile.queue');
}

function readLegacyQueue(): MobileQueuedInspection[] {
  try {
    return JSON.parse(window.localStorage.getItem('gestop.mobile.queue') ?? '[]') as MobileQueuedInspection[];
  } catch {
    return [];
  }
}

function writeLegacyQueue(queue: MobileQueuedInspection[]) {
  window.localStorage.setItem('gestop.mobile.queue', JSON.stringify(queue));
}
