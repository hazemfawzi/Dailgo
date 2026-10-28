import type { Data } from './storageCore';
import { validateData } from './storageCore';
export type SyncConflict = { path: string; local: unknown; server: unknown };
const audit = new Set(['revision', 'history', 'createdAt', 'updatedAt', 'completedAt', 'progress']);
const collections = new Set([
  'personal-os.tasks.v1',
  'personal-os.entries.v1',
  'personal-os.conversations.v1',
  'personal-os.sessions.v1',
  'personal-os.trash.v1',
]);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function plain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function records(value: unknown) {
  return Array.isArray(value) && value.every((row) => plain(row) && typeof row.id === 'string');
}
export function mergeOffline(
  base: Data,
  local: Data,
  server: Data,
  choices: Record<string, 'local' | 'server'> = {},
) {
  const conflicts: SyncConflict[] = [];
  function merge(
    old: unknown,
    draft: unknown,
    remote: unknown,
    path: string,
    record = false,
  ): unknown {
    if (same(draft, old)) return remote;
    if (same(draft, remote)) return remote;
    if (records(old) && records(draft) && records(remote)) {
      const a = new Map((old as Record<string, unknown>[]).map((row) => [row.id, row])),
        b = new Map((draft as Record<string, unknown>[]).map((row) => [row.id, row])),
        c = new Map((remote as Record<string, unknown>[]).map((row) => [row.id, row]));
      const ids = new Set([...c.keys(), ...b.keys(), ...a.keys()]);
      return [...ids]
        .map((id) =>
          merge(a.get(id), b.get(id), c.get(id), path + '/' + encodeURIComponent(String(id)), true),
        )
        .filter((row) => row !== undefined);
    }
    if (plain(draft) && plain(remote) && (plain(old) || old === undefined)) {
      const result: Record<string, unknown> = {};
      for (const key of new Set([
        ...Object.keys(old ?? {}),
        ...Object.keys(draft),
        ...Object.keys(remote),
      ])) {
        if (record && audit.has(key)) {
          if (remote[key] !== undefined) result[key] = remote[key];
          continue;
        }
        const value = merge(
          plain(old) ? old[key] : undefined,
          draft[key],
          remote[key],
          path + '/' + encodeURIComponent(key),
        );
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    if (same(remote, old)) return draft;
    if (choices[path]) return choices[path] === 'local' ? draft : remote;
    conflicts.push({ path, local: draft, server: remote });
    return remote;
  }
  const data: Data = {};
  for (const key of new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(server),
  ])) {
    let value: unknown;
    if (key === 'personal-os.entries.v1' && plain(local[key]) && plain(server[key])) {
      const before = plain(base[key]) ? base[key] : {};
      value = {
        ...(server[key] as object),
        entries: merge(
          (before as Record<string, unknown>).entries ?? [],
          (local[key] as Record<string, unknown>).entries ?? [],
          (server[key] as Record<string, unknown>).entries ?? [],
          key + '/entries',
        ),
      };
    } else value = merge(base[key], local[key], server[key], key);
    if (value !== undefined) data[key] = value;
  }
  if (!conflicts.length) validateData(data);
  return { data, conflicts };
}
