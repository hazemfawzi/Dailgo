import type { Data, Store } from './storageCore';
import { validateData } from './storageCore';
export type Outbox = { base: Store; draft: Store; createdAt: string };
export type CachedAccount = { account: string; store: Store; outbox?: Outbox };
const enabledKey = 'dailgo.offline.enabled',
  activeKey = 'dailgo.offline.account';
let opening: Promise<IDBDatabase> | undefined;
function database() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('dailgo-offline-v1', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('accounts', { keyPath: 'account' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = undefined;
      reject(request.error);
    };
  }));
}
export function offlineEnabled() {
  try {
    return localStorage.getItem(enabledKey) === 'true';
  } catch {
    return false;
  }
}
export function setOfflineEnabled(value: boolean) {
  localStorage.setItem(enabledKey, String(value));
}
export function activeOfflineAccount() {
  return localStorage.getItem(activeKey);
}
export function clearOfflineAccount() {
  localStorage.removeItem(activeKey);
}
export function selectOfflineAccount(account: string) {
  localStorage.setItem(activeKey, account);
}
export async function readOffline(
  account = activeOfflineAccount(),
): Promise<CachedAccount | undefined> {
  if (!offlineEnabled() || !account) return;
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('accounts').objectStore('accounts').get(account);
    request.onsuccess = () => {
      const value = request.result as CachedAccount | undefined;
      try {
        if (value) {
          validateData(value.store.data);
          if (value.outbox) {
            validateData(value.outbox.base.data);
            validateData(value.outbox.draft.data);
          }
        }
        resolve(value);
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
export async function saveOffline(value: CachedAccount, expectedOutbox: string | null = null) {
  if (!offlineEnabled()) return;
  validateData(value.store.data);
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite');
    const store = tx.objectStore('accounts');
    const existing = store.get(value.account);
    existing.onsuccess = () => {
      const revision = (existing.result as CachedAccount | undefined)?.outbox?.draft.revision;
      if (revision && revision !== expectedOutbox && revision !== value.outbox?.draft.revision) {
        tx.abort();
        return;
      }
      store.put(value);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function clearOffline(account: string) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite');
    tx.objectStore('accounts').delete(account);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
