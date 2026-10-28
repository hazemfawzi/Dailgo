import type { Data } from '../../lib/storageCore';
import type { Entry } from '../../lib/workspace';
import type { Task } from '../tasks/model';
export type RepeatSpec = {
  id: string;
  kind: 'task' | 'event';
  revision?: string;
  start: string;
  interval: 'day' | 'week' | 'month';
  count: number;
};
export function repeatDates(spec: RepeatSpec) {
  const base = new Date(spec.start + 'T12:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(spec.start) ||
    !Number.isFinite(base.getTime()) ||
    base.toISOString().slice(0, 10) !== spec.start ||
    !Number.isInteger(spec.count) ||
    spec.count < 1 ||
    spec.count > 30 ||
    !['day', 'week', 'month'].includes(spec.interval)
  )
    throw Error('invalid-repeat');
  return Array.from({ length: spec.count }, (_, i) => {
    const d = new Date(base);
    if (spec.interval === 'month') {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + i);
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(base.getUTCDate(), last));
    } else d.setUTCDate(d.getUTCDate() + i * (spec.interval === 'week' ? 7 : 1));
    return d.toISOString().slice(0, 10);
  });
}
export function repeatCopies(data: Data, spec: RepeatSpec): Data {
  const tasks = (data['personal-os.tasks.v1'] ?? []) as Task[];
  const workspace = data['personal-os.entries.v1'] as { entries: Entry[] } | undefined;
  const entries = workspace?.entries ?? [];
  const original =
    spec.kind === 'task'
      ? tasks.find((x) => x.id === spec.id)
      : entries.find((x) => x.id === spec.id && x.kind === 'event');
  if (!original || original.archived || original.revision !== spec.revision)
    throw Error('stale-template');
  const taken = new Set(
    [
      ...tasks,
      ...entries,
      ...((data['personal-os.trash.v1'] ?? []) as { item: { id: string } }[]).map((x) => x.item),
    ].map((x) => x.id),
  );
  const added = repeatDates(spec)
    .map((date) => {
      const id = `repeat-${spec.id}-${date}`;
      if (taken.has(id)) return null;
      return {
        ...original,
        id,
        revision: undefined,
        history: [],
        createdAt: undefined,
        updatedAt: undefined,
        completedAt: undefined,
        source: undefined,
        ...(spec.kind === 'task'
          ? {
              plannedDate: date,
              dueDate: undefined,
              done: false,
              status: 'todo' as const,
              result: undefined,
              reviewDate: undefined,
              subtasks: (original as Task).subtasks?.map((x) => ({
                ...x,
                id: crypto.randomUUID(),
                done: false,
              })),
            }
          : { date, doneDates: [] }),
      };
    })
    .filter(Boolean);
  return {
    ...data,
    ...(spec.kind === 'task'
      ? { 'personal-os.tasks.v1': [...tasks, ...added] }
      : { 'personal-os.entries.v1': { ...workspace, entries: [...entries, ...added] } }),
  };
}
