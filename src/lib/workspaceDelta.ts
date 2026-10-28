import { DATA_KEYS, validateData } from './storageCore';
import type { Data } from './storageCore';
const collections = new Set([
  'personal-os.tasks.v1',
  'personal-os.entries.v1',
  'personal-os.conversations.v1',
  'personal-os.sessions.v1',
  'personal-os.trash.v1',
]);
export type Delta = { key: string; id?: string; value?: unknown; remove?: boolean };
function rows(value: unknown): Record<string, unknown>[] | null {
  return Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { entries?: unknown }).entries)
      ? (value as { entries: Record<string, unknown>[] }).entries
      : null;
}
export function diffWorkspace(before: Data, after: Data): Delta[] {
  const changes: Delta[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    const old = rows(before[key]),
      next = rows(after[key]);
    const sameShape = Array.isArray(before[key]) === Array.isArray(after[key]);
    if (collections.has(key) && old && next && sameShape) {
      const oldMap = new Map(old.map((row) => [row.id, row]));
      const nextIds = new Set(next.map((row) => row.id));
      // Changes of order are rare and are explicit collection replacements.
      const retained = old.filter((row) => nextIds.has(row.id)).map((row) => row.id);
      const nextRetained = next.filter((row) => oldMap.has(row.id)).map((row) => row.id);
      if (
        JSON.stringify(retained) !== JSON.stringify(nextRetained) ||
        JSON.stringify([
          ...retained,
          ...next.filter((row) => !oldMap.has(row.id)).map((row) => row.id),
        ]) !== JSON.stringify(next.map((row) => row.id)) ||
        (!Array.isArray(after[key]) &&
          JSON.stringify(
            Object.fromEntries(
              Object.entries(before[key] as object).filter(([key]) => key !== 'entries'),
            ),
          ) !==
            JSON.stringify(
              Object.fromEntries(
                Object.entries(after[key] as object).filter(([key]) => key !== 'entries'),
              ),
            ))
      ) {
        changes.push({ key, value: after[key] });
        continue;
      }
      for (const row of old)
        if (!nextIds.has(row.id)) changes.push({ key, id: String(row.id), remove: true });
      for (const row of next)
        if (JSON.stringify(row) !== JSON.stringify(oldMap.get(row.id)))
          changes.push({ key, id: String(row.id), value: row });
    } else
      changes.push(Object.hasOwn(after, key) ? { key, value: after[key] } : { key, remove: true });
  }
  return changes;
}
export function applyWorkspaceDelta(before: Data, changes: Delta[]): Data {
  if (!Array.isArray(changes) || changes.length > 10000) throw Error('invalid-changes');
  const next = structuredClone(before);
  for (const change of changes) {
    if (
      !change ||
      !(DATA_KEYS as readonly string[]).includes(change.key) ||
      (change.remove !== undefined && typeof change.remove !== 'boolean')
    )
      throw Error('invalid-change');
    if (change.id !== undefined) {
      if (typeof change.id !== 'string' || !collections.has(change.key))
        throw Error('invalid-record-change');
      const current = rows(next[change.key]);
      if (!current) throw Error('invalid-collection');
      if (
        !change.remove &&
        (!change.value ||
          typeof change.value !== 'object' ||
          (change.value as { id?: unknown }).id !== change.id)
      )
        throw Error('invalid-record-change');
      const result = change.remove
        ? current.filter((row) => row.id !== change.id)
        : current.some((row) => row.id === change.id)
          ? current.map((row) => (row.id === change.id ? change.value : row))
          : [...current, change.value];
      next[change.key] = Array.isArray(next[change.key])
        ? result
        : { ...(next[change.key] as object), entries: result };
    } else if (change.remove) delete next[change.key];
    else next[change.key] = change.value;
  }
  validateData(next);
  return next;
}
