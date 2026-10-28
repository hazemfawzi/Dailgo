import type { Data } from './storageCore';
import type { TrashItem } from '../features/settings/Trash';
export function forgetRecord(data: Data, recordId: string): Data {
  const copy = JSON.parse(JSON.stringify(data)) as Data;
  const trash = (copy['personal-os.trash.v1'] ?? []) as TrashItem[];
  const record = trash.find((x) => x.id === recordId);
  if (!record) return copy;
  const target = record.item.id;
  const batch = (record.item.source as { batchId?: string } | undefined)?.batchId;
  function scrub(item: any) {
    if (!item || typeof item !== 'object') return item;
    const original = JSON.stringify(item);
    if (item.memoryId === target) {
      delete item.memoryId;
      delete item.history;
    }
    if (item.source && batch && item.source.batchId === batch) {
      delete item.source;
      delete item.history;
    }
    if (item.history && JSON.stringify(item.history).includes(JSON.stringify(target)))
      delete item.history;
    if (JSON.stringify(item) !== original) {
      item.revision = crypto.randomUUID();
      item.updatedAt = new Date().toISOString();
    }
    return item;
  }
  for (const key of ['personal-os.tasks.v1', 'personal-os.entries.v1']) {
    const value = copy[key] as any;
    const items = Array.isArray(value) ? value : value?.entries;
    if (items) items.forEach(scrub);
  }
  copy['personal-os.trash.v1'] = trash
    .filter((x) => x.id !== recordId)
    .map((x) => ({ ...x, item: scrub(x.item) }));
  const conversations = copy['personal-os.conversations.v1'] as any[] | undefined;
  if (conversations)
    copy['personal-os.conversations.v1'] = conversations.map((c) => {
      const remove = new Set<number>();
      c.messages.forEach((m: any, i: number) => {
        if (
          m.targetId === target ||
          m.targetIds?.includes(target) ||
          m.ai?.actions?.some(
            (action: any) =>
              action.id === target ||
              action.task?.id === target ||
              action.task?.goalId === target ||
              action.goal?.id === target,
          )
        ) {
          remove.add(i);
          if (c.messages[i - 1]?.role === 'user') remove.add(i - 1);
        }
        if (m.references?.some((r: any) => r.id === target)) remove.add(i);
      });
      return { ...c, messages: c.messages.filter((_: any, i: number) => !remove.has(i)) };
    });
  const sessions = copy['personal-os.sessions.v1'] as any[] | undefined;
  if (sessions) copy['personal-os.sessions.v1'] = sessions.filter((s) => s.taskId !== target);
  const timer = copy['personal-os.focus.v1'] as any;
  if (timer?.taskId === target) copy['personal-os.focus.v1'] = { ends: null, remaining: 1500 };
  const hidden = copy['personal-os.suggestions.v1'] as Record<string, string> | undefined;
  if (hidden) delete hidden[target];
  return copy;
}
