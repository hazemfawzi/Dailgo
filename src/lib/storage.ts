import {
  offlineEnabled,
  setOfflineEnabled,
  readOffline,
  saveOffline,
  activeOfflineAccount,
  selectOfflineAccount,
  clearOfflineAccount,
} from './offlineCache';
import type { Outbox } from './offlineCache';
import { mergeOffline } from './offlineMerge';
import type { SyncConflict } from './offlineMerge';
import { getServerAccount, bindServerAccount } from './serverStorage';
import { auditWorkspace } from './storageCore';
import { offerUndo, clearUndo } from './undoStore';
import { forgetRecord } from './forget';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { SetStateAction } from 'react';
import {
  commit,
  readStore,
  restoreSnapshot,
  storageToken,
  DATA_KEYS,
  validateData,
} from './storageCore';
import type { Data, Store } from './storageCore';
import {
  clearServerAccount,
  ApiError,
  loadServerStore,
  commitServerStore,
  replaceServerStore,
} from './serverStorage';
import { setServerData } from './activeWorkspace';
let snapshot: Store = { version: 3, revision: 'legacy', data: {} };
let issue = '';
let ready = false;
let remote = false;
let pendingWrites = 0;
let outbox: Outbox | undefined;
let syncConflicts: SyncConflict[] = [];
let syncVersion = 0;
let offline = false;
const listeners = new Set<() => void>();
const previews = new Map<string, { id: number; value: unknown }>();
let previewId = 0;
let previewVersion = 0;
async function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return await (navigator.locks
    ? navigator.locks.request('personal-os-write', async () => await fn())
    : queue(fn));
}
let pending: Promise<unknown> = Promise.resolve();
function queue<T>(fn: () => T | Promise<T>) {
  const next = pending.then(fn, fn);
  pending = next.catch(() => {});
  return next;
}
function emit() {
  previewVersion++;
  syncVersion++;
  if (remote) setServerData(snapshot.data);
  listeners.forEach((fn) => fn());
}
function failed(error: unknown) {
  if (
    offlineEnabled() &&
    (error instanceof TypeError ||
      (error instanceof DOMException &&
        ['AbortError', 'TimeoutError', 'NetworkError'].includes(error.name)))
  ) {
    offline = true;
    emit();
    return;
  }
  issue =
    error instanceof ApiError && error.status === 409
      ? 'conflict'
      : error instanceof ApiError && error.status === 401
        ? 'auth'
        : 'failed';
  if (issue === 'auth') window.dispatchEvent(new Event('dailgo-session-expired'));
  emit();
}
export function isServerStorage() {
  return remote;
}
export function currentStorageToken() {
  return remote ? snapshot.revision : storageToken(localStorage);
}
export async function connectServerStorage() {
  const store = await loadServerStore();
  const account = getServerAccount();
  let cached;
  if (account && offlineEnabled()) {
    selectOfflineAccount(account);
    cached = await readOffline(account);
  }
  outbox = cached?.outbox;
  offline = false;
  syncConflicts = [];
  remote = true;
  ready = true;
  snapshot = outbox?.draft ?? store;
  if (account && offlineEnabled()) await saveOffline({ account, store, outbox });
  previews.clear();
  issue = '';
  setServerData(store.data);
  emit();
}
export function disconnectServerStorage() {
  clearOfflineAccount();
  outbox = undefined;
  syncConflicts = [];
  offline = false;
  clearServerAccount();
  clearUndo();
  remote = true;
  ready = true;
  snapshot = { version: 3, revision: 'empty', data: {} };
  issue = 'auth';
  previews.clear();
  setServerData({});
  emit();
}
export async function connectOfflineStorage() {
  const cached = await readOffline();
  if (!cached) return false;
  remote = true;
  ready = true;
  offline = true;
  outbox = cached.outbox;
  snapshot = outbox?.draft ?? cached.store;
  issue = '';
  syncConflicts = [];
  bindServerAccount(cached.account);
  setServerData(snapshot.data);
  emit();
  return true;
}
export function refreshStorage() {
  if (remote) {
    if (!navigator.onLine) {
      if (offlineEnabled()) {
        offline = true;
        emit();
      }
      return;
    }
    void locked(async () => {
      try {
        if (!navigator.onLine) return;
        if (outbox) {
          await syncOfflineLocked();
          return;
        }
        snapshot = await loadServerStore();
        offline = false;
        const account = getServerAccount();
        if (account && offlineEnabled()) await saveOffline({ account, store: snapshot });
        issue = '';
        emit();
      } catch (error) {
        failed(error);
      }
    });
    return;
  }
  try {
    snapshot = readStore(localStorage);
    issue = '';
  } catch {
    issue = 'corrupt';
  }
  emit();
}
function init() {
  if (ready) return;
  ready = true;
  refreshStorage();
  window.addEventListener('storage', () => {
    if (!remote) refreshStorage();
  });
}
function subscribe(fn: () => void) {
  init();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function useStorageState() {
  init();
  useSyncExternalStore(subscribe, () => snapshot);
  const error = useSyncExternalStore(subscribe, () => issue);
  const saving = useSyncExternalStore(subscribe, () => pendingWrites > 0 || previews.size > 0);
  useSyncExternalStore(subscribe, () => syncVersion);
  return {
    data: snapshot.data,
    revision: snapshot.revision,
    error,
    saving,
    offline,
    queued: !!outbox,
    syncConflicts,
  };
}
export async function replaceData(data: Data, expected: string) {
  const before = snapshot.data;
  pendingWrites++;
  emit();
  try {
    snapshot = remote ? await writeConnected(data, expected) : commit(localStorage, expected, data);
    issue = '';
    offerUndo(before, snapshot.data);
    emit();
    return true;
  } catch (error) {
    if (remote) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          snapshot = await loadServerStore();
        } catch {
          /* Preserve the last confirmed snapshot. */
        }
      }
      failed(error);
    } else {
      if (error instanceof Error && ['conflict', 'edit-conflict'].includes(error.message)) {
        refreshStorage();
        issue = 'conflict';
      } else issue = 'failed';
      emit();
    }
    return false;
  } finally {
    pendingWrites--;
    emit();
  }
}
function currentStore() {
  return remote ? snapshot : readStore(localStorage);
}
export function usePersisted<T>(key: string, initial: T, restore?: (saved: unknown) => T) {
  const { data, error } = useStorageState();
  useSyncExternalStore(subscribe, () => previewVersion);
  const saved = data[key];
  const confirmed = saved === undefined ? initial : restore ? restore(saved) : (saved as T);
  const value = remote && previews.has(key) ? (previews.get(key)!.value as T) : confirmed;
  useEffect(() => {
    if (saved !== undefined || issue) return;
    void locked(async () => {
      if (saved === undefined && !issue) {
        try {
          const latest = currentStore();
          if (latest.data[key] === undefined)
            await replaceData({ ...latest.data, [key]: initial }, latest.revision);
        } catch (error) {
          if (remote) failed(error);
          else {
            issue = 'corrupt';
            emit();
          }
        }
      }
    });
  }, [key, saved, initial]);
  const setValue = useCallback(
    (change: SetStateAction<T>) => {
      if (issue) return;
      let id: number | undefined;
      if (remote) {
        const stored = snapshot.data[key];
        const current = previews.has(key)
          ? (previews.get(key)!.value as T)
          : stored === undefined
            ? initial
            : restore
              ? restore(stored)
              : (stored as T);
        id = ++previewId;
        previews.set(key, {
          id,
          value: typeof change === 'function' ? (change as (old: T) => T)(current) : change,
        });
        emit();
      }
      void locked(async () => {
        try {
          if (issue) return;
          const observed = snapshot;
          try {
            const latest = currentStore();
            if (latest.revision !== observed.revision) {
              snapshot = latest;
              issue = 'conflict';
              emit();
              return;
            }
            const current =
              latest.data[key] === undefined
                ? initial
                : restore
                  ? restore(latest.data[key])
                  : (latest.data[key] as T);
            const next = typeof change === 'function' ? (change as (old: T) => T)(current) : change;
            await replaceData({ ...latest.data, [key]: next }, latest.revision);
          } catch (error) {
            if (remote) failed(error);
            else {
              issue = 'corrupt';
              emit();
            }
          }
        } finally {
          if (id !== undefined && previews.get(key)?.id === id) {
            previews.delete(key);
            emit();
          }
        }
      });
    },
    [key, initial, restore],
  );
  return [value, setValue, !!error] as const;
}
export function restoreBackupData(data: Data, token: string) {
  return locked(async () => {
    try {
      if (outbox || offline || !navigator.onLine) return false;
      if (currentStorageToken() !== token) return false;
      snapshot = remote
        ? await replaceServerStore(data, token)
        : restoreSnapshot(localStorage, data, token);
      clearUndo();
      issue = '';
      emit();
      return true;
    } catch (error) {
      if (remote) failed(error);
      return false;
    }
  });
}
export function transactData(update: (data: Data) => Data) {
  return locked(async () => {
    if (issue === 'corrupt' || issue === 'failed' || issue === 'auth') return false;
    let latest: Store;
    try {
      latest = currentStore();
    } catch {
      issue = 'corrupt';
      emit();
      return false;
    }
    let next: Data;
    // Rejected domain actions do not indicate a storage outage.
    try {
      next = update(latest.data);
      validateData(next);
    } catch {
      return false;
    }
    return replaceData(next, latest.revision);
  });
}
export function purgeTrashRecord(recordId: string) {
  return locked(async () => {
    if (outbox || offline || !navigator.onLine) return false;
    try {
      const current = currentStore();
      const token = currentStorageToken();
      const next = forgetRecord(current.data, recordId);
      snapshot = remote
        ? await replaceServerStore(next, token)
        : restoreSnapshot(localStorage, next, token);
      if (!remote) for (const key of DATA_KEYS) localStorage.removeItem(key);
      issue = '';
      emit();
      return true;
    } catch (error) {
      if (remote) failed(error);
      else refreshStorage();
      return false;
    }
  });
}
// Refresh only between writes, so another device cannot replace an in-flight edit.
export function startServerRefresh() {
  const refresh = () => {
    if (remote && issue !== 'auth') {
      refreshStorage();
      window.dispatchEvent(new Event('dailgo-family-refresh'));
    }
  };
  const account = getServerAccount();
  const source =
    typeof EventSource !== 'undefined' && account
      ? new EventSource('/api/workspace/events?account=' + encodeURIComponent(account))
      : null;
  source?.addEventListener('message', (event) => {
    try {
      const value = JSON.parse((event as MessageEvent).data);
      if (value.familyId)
        window.dispatchEvent(new CustomEvent('dailgo-family-changed', { detail: value.familyId }));
      else if (value.revision !== snapshot.revision && !outbox) refresh();
    } catch {}
  });
  source?.addEventListener('session-expired', () =>
    window.dispatchEvent(new Event('dailgo-session-expired')),
  );
  let streamFailed = !source;
  source?.addEventListener('open', () => {
    streamFailed = false;
    if (outbox && navigator.onLine) refresh();
  });
  source?.addEventListener('error', () => {
    streamFailed = true;
  });
  const timer = window.setInterval(() => {
    if (streamFailed && navigator.onLine) refresh();
  }, 60000);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  const disconnected = () => {
    if (offlineEnabled()) {
      offline = true;
      emit();
    }
  };
  window.addEventListener('offline', disconnected);
  if (outbox && navigator.onLine) refresh();
  return () => {
    source?.close();
    window.clearInterval(timer);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', disconnected);
  };
}
async function writeConnected(data: Data, expected: string) {
  const account = getServerAccount();
  if (!outbox && navigator.onLine) {
    try {
      const saved = await commitServerStore(data, expected, snapshot.data);
      offline = false;
      if (account && offlineEnabled()) await saveOffline({ account, store: saved });
      return saved;
    } catch (error) {
      if (error instanceof ApiError && error.status < 500) throw error;
      if (!offlineEnabled()) throw error;
    }
  }
  if (!offlineEnabled() || !account) throw Error('offline-unavailable');
  const base = outbox?.base ?? snapshot;
  const audited = auditWorkspace(snapshot.data, data);
  validateData(audited);
  const draft: Store = { version: 3, revision: 'offline:' + crypto.randomUUID(), data: audited };
  const queued = { base, draft, createdAt: outbox?.createdAt ?? new Date().toISOString() };
  await saveOffline({ account, store: base, outbox: queued }, outbox?.draft.revision ?? null);
  outbox = queued;
  offline = true;
  syncConflicts = [];
  return draft;
}
export async function enableOfflineEditing(enabled: boolean) {
  if (!enabled && outbox) return false;
  const account = getServerAccount();
  setOfflineEnabled(enabled);
  if (enabled && account) {
    selectOfflineAccount(account);
    await saveOffline({ account, store: snapshot });
  }
  emit();
  return true;
}
export function syncOfflineChanges(choices: Record<string, 'local' | 'server'> = {}) {
  return locked(() => syncOfflineLocked(choices));
}
async function syncOfflineLocked(choices: Record<string, 'local' | 'server'> = {}) {
  if (!outbox) return true;
  const account = getServerAccount();
  if (!account || activeOfflineAccount() !== account) return false;
  try {
    const latest = await loadServerStore();
    const fresh = mergeOffline(outbox.base.data, outbox.draft.data, latest.data);
    if (
      Object.keys(choices).length &&
      fresh.conflicts.some(
        (conflict) =>
          !syncConflicts.some(
            (old) =>
              old.path === conflict.path &&
              JSON.stringify(old.server) === JSON.stringify(conflict.server),
          ),
      )
    ) {
      syncConflicts = fresh.conflicts;
      emit();
      return false;
    }
    const merged = mergeOffline(outbox.base.data, outbox.draft.data, latest.data, choices);
    syncConflicts = merged.conflicts;
    if (syncConflicts.length) {
      offline = false;
      emit();
      return false;
    }
    const saved = await commitServerStore(merged.data, latest.revision, latest.data);
    await saveOffline({ account, store: saved }, outbox.draft.revision);
    snapshot = saved;
    outbox = undefined;
    syncConflicts = [];
    offline = false;
    issue = '';
    emit();
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) failed(error);
    else {
      offline = !navigator.onLine;
      emit();
    }
    return false;
  }
}

export function waitForPendingSaves() {
  return locked(async () => !issue && !outbox && pendingWrites === 0 && previews.size === 0);
}
