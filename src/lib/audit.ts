import { recurringSuccessors } from '../features/tasks/recurrence';
import type { Task } from '../features/tasks/model';
export type HistoryEvent = {
  at: string;
  fields: string[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};
export type AuditFields = {
  revision?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  history?: HistoryEvent[];
};
// Values are stored with the item, so its history follows exports and restores.
export function auditItems<T extends { id: string }>(before: T[], after: T[], at: string): T[] {
  const previous = new Map(before.map((x) => [x.id, x]));
  return after.map((item) => {
    const old = previous.get(item.id) as (T & AuditFields & { done?: boolean }) | undefined;
    const next = item as T & AuditFields & { done?: boolean };
    const fields = Array.from(new Set([...Object.keys(old ?? {}), ...Object.keys(item)])).filter(
      (k) =>
        !['history', 'createdAt', 'updatedAt', 'completedAt', 'progress', 'revision'].includes(k) &&
        JSON.stringify((old as any)?.[k]) !== JSON.stringify((item as any)[k]),
    );
    if (fields.length && old && old.revision !== next.revision) throw Error('edit-conflict');
    if (!fields.length && old)
      return {
        ...next,
        revision: old.revision,
        createdAt: old.createdAt,
        updatedAt: old.updatedAt,
        history: old.history,
        completedAt: old.completedAt,
      };
    const compact = (v: any) => Object.fromEntries(fields.map((k) => [k, v?.[k] ?? null]));
    return {
      ...next,
      revision: crypto.randomUUID(),
      createdAt: old ? old.createdAt : (next.createdAt ?? at),
      updatedAt: at,
      completedAt: next.done ? (old?.done ? old.completedAt : at) : undefined,
      history: [
        ...(old?.history ?? next.history ?? []),
        {
          at,
          fields: old ? fields : ['created'],
          before: old ? compact(old) : undefined,
          after: compact(next),
        },
      ],
    };
  });
}
export function auditWorkspace(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  at = new Date().toISOString(),
) {
  const next = { ...after };
  const changed = (key: string) =>
    before[key] !== after[key] && JSON.stringify(before[key]) !== JSON.stringify(after[key]);
  if (after['personal-os.tasks.v1'] && changed('personal-os.tasks.v1')) {
    const old = (before['personal-os.tasks.v1'] ?? []) as Task[];
    const expanded = recurringSuccessors(old, after['personal-os.tasks.v1'] as Task[]);
    const restored = new Set(
      expanded
        .filter((task) => task.recurrenceFrom && !old.some((previous) => previous.id === task.id))
        .map((task) => task.id),
    );
    after = { ...after, 'personal-os.tasks.v1': expanded };
    if (after['personal-os.trash.v1'])
      after['personal-os.trash.v1'] = (after['personal-os.trash.v1'] as any[]).filter(
        (row) => row.collection !== 'personal-os.tasks.v1' || !restored.has(row.item.id),
      );
    next['personal-os.tasks.v1'] = expanded;
  }
  const trash = [...((after['personal-os.trash.v1'] ?? []) as any[])];
  for (const key of [
    'personal-os.tasks.v1',
    'personal-os.entries.v1',
    'personal-os.conversations.v1',
  ]) {
    const old = before[key] as any,
      value = after[key] as any;
    if (value === undefined || !changed(key)) continue;
    const oldItems = Array.isArray(old) ? old : (old?.entries ?? []);
    const items = Array.isArray(value) ? value : value.entries;
    const ids = new Set(items.map((item: any) => item.id));
    for (const item of oldItems)
      if (
        !ids.has(item.id) &&
        !trash.some((row) => row.collection === key && row.item.id === item.id)
      )
        trash.push({ id: crypto.randomUUID(), collection: key, deletedAt: at, item });
  }
  if (trash.length || after['personal-os.trash.v1']) next['personal-os.trash.v1'] = trash;
  for (const key of ['personal-os.tasks.v1', 'personal-os.entries.v1']) {
    const old = before[key] as any,
      value = after[key] as any;
    if (value === undefined || !changed(key)) continue;
    const oldItems = Array.isArray(old) ? old : (old?.entries ?? []);
    const items = Array.isArray(value) ? value : value.entries;
    const audited = auditItems(oldItems, items, at);
    next[key] = Array.isArray(value) ? audited : { ...value, entries: audited };
  }
  return next;
}
