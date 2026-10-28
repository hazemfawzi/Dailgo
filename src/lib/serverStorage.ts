import { getServerData } from './activeWorkspace';
import { diffWorkspace, applyWorkspaceDelta } from './workspaceDelta';
import { validateData } from './storageCore';
import type { Data, Store } from './storageCore';
let expectedAccount: string | null = null;
export function bindServerAccount(account: string) {
  expectedAccount = account;
}
export function getServerAccount() {
  return expectedAccount;
}
export function clearServerAccount() {
  expectedAccount = null;
}
export class ApiError extends Error {
  constructor(public status: number) {
    super(`Server request failed (${status})`);
  }
}
export async function apiRequest(path: string, method = 'GET', body?: unknown) {
  const disconnected = new AbortController();
  const abortOffline = () =>
    disconnected.abort(new DOMException('Connection lost', 'NetworkError'));
  window.addEventListener('offline', abortOffline, { once: true });
  let response: Response;
  try {
    response = await fetch('/api/' + path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(expectedAccount ? { 'X-Dailgo-Account': expectedAccount } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.any([AbortSignal.timeout(15000), disconnected.signal]),
    });
  } finally {
    window.removeEventListener('offline', abortOffline);
  }
  const actual = response.headers.get('X-Dailgo-Account');
  if (actual && expectedAccount && actual !== expectedAccount) {
    window.dispatchEvent(new Event('dailgo-session-expired'));
    throw new ApiError(401);
  }
  if (actual) expectedAccount = actual;
  if (!response.ok) {
    if (
      response.status === 401 &&
      expectedAccount &&
      !path.startsWith('public/') &&
      path !== 'widgets/today' &&
      path !== 'account/login'
    )
      window.dispatchEvent(new Event('dailgo-session-expired'));
    throw new ApiError(response.status);
  }
  return response.json();
}
export function serverStore(value: { revision: string; data: unknown }): Store {
  if (typeof value.revision !== 'string') throw Error('Invalid server revision');
  const data = value.data ?? {};
  validateData(data);
  return { version: 3, revision: value.revision, data };
}
export async function loadServerStore() {
  return serverStore(await apiRequest('workspace'));
}
export async function commitServerStore(
  data: Data,
  revision: string,
  base = getServerData() ?? {},
) {
  validateData(data);
  const result = await apiRequest('workspace/changes', 'PUT', {
    revision,
    changes: diffWorkspace(base, data),
  });
  return serverStore({
    revision: result.revision,
    data: applyWorkspaceDelta(base, result.changes),
  });
}
export async function replaceServerStore(data: Data, revision: string) {
  validateData(data);
  const result = await apiRequest('workspace', 'PUT', { revision, data });
  return serverStore({ revision: result.revision, data });
}
