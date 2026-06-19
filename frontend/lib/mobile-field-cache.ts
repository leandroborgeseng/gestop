import { MobileFieldPackage } from './types';

const DB_NAME = 'sigma-mobile-cache';
const DB_VERSION = 1;
const STORE = 'field-package';
const PACKAGE_KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir cache offline.'));
  });
}

export async function readCachedFieldPackage(): Promise<MobileFieldPackage | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(PACKAGE_KEY);
    request.onsuccess = () => resolve((request.result as MobileFieldPackage | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Falha ao ler pacote offline.'));
  });
}

export async function writeCachedFieldPackage(payload: MobileFieldPackage) {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(payload, PACKAGE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar pacote offline.'));
  });
}

export async function clearCachedFieldPackage() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(PACKAGE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao limpar pacote offline.'));
  });
}
