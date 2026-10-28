import type { Data } from './storageCore';
type RecordValue = { id: string; revision?: string; [key: string]: unknown };
type Row = {
  key: string;
  id: string;
  revision?: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};
export type UndoTicket = {
  id: string;
  rows: Row[];
  expires: number;
  created?: { id: string; revision?: string }[];
};
let ticket: UndoTicket | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const records = (data: Data, key: string): RecordValue[] => {
  const raw = data[key] as RecordValue[] | { entries: RecordValue[] } | undefined;
  return Array.isArray(raw) ? raw : (raw?.entries ?? []);
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function transitionTicket(before: Data, after: Data, now = Date.now()): UndoTicket | null {
  const rows: Row[] = [];
  for (const key of ['personal-os.tasks.v1', 'personal-os.entries.v1']) {
    const old = new Map(records(before, key).map((item) => [item.id, item]));
    for (const item of records(after, key)) {
      const previous = old.get(item.id);
      if (!previous) continue;
      const completed = previous.done !== true && item.done === true;
      const archived = previous.archived !== true && item.archived === true;
      const routine =
        Array.isArray(previous.doneDates) &&
        Array.isArray(item.doneDates) &&
        item.doneDates.length > previous.doneDates.length;
      if (!completed && !archived && !routine) continue;
      const fields = [...new Set([...Object.keys(previous), ...Object.keys(item)])].filter(
        (field) =>
          !['history', 'revision', 'createdAt', 'updatedAt', 'completedAt', 'progress'].includes(
            field,
          ) && !same(previous[field], item[field]),
      );
      rows.push({
        key,
        id: item.id,
        revision: item.revision,
        before: Object.fromEntries(
          fields.map((field) => [field, structuredClone(previous[field])]),
        ),
        after: Object.fromEntries(fields.map((field) => [field, structuredClone(item[field])])),
      });
    }
  }
  const completed = new Set(
    rows
      .filter((row) => row.key === 'personal-os.tasks.v1' && row.after.done === true)
      .map((row) => row.id),
  );
  const previousIds = new Set(records(before, 'personal-os.tasks.v1').map((item) => item.id));
  const created = records(after, 'personal-os.tasks.v1')
    .filter((item) => !previousIds.has(item.id) && completed.has(item.recurrenceFrom as string))
    .map((item) => ({ id: item.id, revision: item.revision }));
  return rows.length ? { id: crypto.randomUUID(), rows, expires: now + 20000, created } : null;
}
export function applyUndo(data: Data, selected: UndoTicket, now = Date.now()): Data {
  if (now > selected.expires) throw Error('undo-expired');
  for (const row of selected.rows) {
    const current = records(data, row.key).find((item) => item.id === row.id);
    if (
      !current ||
      current.revision !== row.revision ||
      !Object.entries(row.after).every(([key, value]) => same(current[key], value))
    )
      throw Error('undo-target-changed');
  }
  for (const row of selected.created ?? []) {
    const current = records(data, 'personal-os.tasks.v1').find((item) => item.id === row.id);
    if (!current || current.revision !== row.revision) throw Error('undo-target-changed');
  }
  const result = { ...data };
  for (const key of new Set(selected.rows.map((row) => row.key))) {
    const raw = data[key] as RecordValue[] | { entries: RecordValue[] };
    const items = records(data, key).map((item) => {
      const row = selected.rows.find((row) => row.key === key && row.id === item.id);
      return row ? { ...item, ...row.before } : item;
    });
    result[key] = Array.isArray(raw) ? items : { ...raw, entries: items };
  }
  if (selected.created?.length)
    result['personal-os.tasks.v1'] = records(result, 'personal-os.tasks.v1').filter(
      (item) => !selected.created!.some((row) => row.id === item.id),
    );
  return result;
}
export function offerUndo(before: Data, after: Data) {
  const next = transitionTicket(before, after);
  if (!next) return;
  ticket = next;
  clearTimeout(timer);
  timer = setTimeout(clearUndo, 20000);
  listeners.forEach((listener) => listener());
}
export function clearUndo() {
  ticket = null;
  clearTimeout(timer);
  listeners.forEach((listener) => listener());
}
export const subscribeUndo = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const currentUndo = () => ticket;
