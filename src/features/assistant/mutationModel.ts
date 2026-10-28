import { titleKey, titleDistance } from '../../lib/text';
import { isActionable } from '../tasks/model';
import type { Data } from '../../lib/storageCore';
import type { Entry, Translate } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import type { Message } from './engine';
export type Mutation = {
  collection: 'personal-os.tasks.v1' | 'personal-os.entries.v1';
  id: string;
  kind: 'task' | Entry['kind'];
  title: string;
  revision?: string;
  historyLength: number;
  before: Record<string, string | boolean | null>;
  patch: Record<string, string | boolean | null>;
};
export function validMutation(value: any): value is Mutation {
  if (
    !value ||
    ![
      'task',
      'project',
      'goal',
      'event',
      'routine',
      'note',
      'preference',
      'decision',
      'personal',
    ].includes(value.kind) ||
    (value.revision !== undefined && typeof value.revision !== 'string') ||
    (value.collection === 'personal-os.tasks.v1') !== (value.kind === 'task') ||
    !['personal-os.tasks.v1', 'personal-os.entries.v1'].includes(value.collection) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    !Number.isInteger(value.historyLength) ||
    value.historyLength < 0 ||
    !value.before ||
    !value.patch ||
    Object.keys(value.patch).length !== 1 ||
    Object.keys(value.before).length !== 1
  )
    return false;
  const field = Object.keys(value.patch)[0];
  if (
    !(field in value.before) ||
    !['title', 'detail', 'plannedDate', 'dueDate', 'archived'].includes(field) ||
    (['plannedDate', 'dueDate'].includes(field) && value.kind !== 'task') ||
    (field === 'detail' && !['note', 'preference', 'decision', 'personal'].includes(value.kind))
  )
    return false;
  const patch = value.patch[field];
  const before = value.before[field];
  return (
    (before === null || typeof before === 'string' || typeof before === 'boolean') &&
    (field === 'archived'
      ? typeof patch === 'boolean'
      : typeof patch === 'string' &&
        (field === 'title'
          ? patch.trim().length > 0 && patch.length <= 160
          : field === 'detail'
            ? patch.length <= 2500
            : /^\d{4}-\d{2}-\d{2}$/.test(patch) &&
              Number.isFinite(Date.parse(patch)) &&
              new Date(patch + 'T12:00:00Z').toISOString().slice(0, 10) === patch))
  );
}
export function mutationResponse(
  input: string,
  t: Translate,
  tasks: Task[],
  entries: Entry[],
): Partial<Message> | undefined {
  const patterns: [RegExp, 'rename' | 'move' | 'due' | 'archive' | 'restore' | 'details'][] = [
    [/^(?:rename task|عدّل عنوان المهمة|عدل عنوان المهمة)\s*:\s*(.+?)\s*=>\s*(.+)$/i, 'rename'],
    [
      /^(?:plan task|move task|خطط المهمة|انقل المهمة)\s*:\s*(.+?)\s*=>\s*(\d{4}-\d{2}-\d{2})$/i,
      'move',
    ],
    [
      /^(?:due task|حدد استحقاق المهمة|حدّد استحقاق المهمة)\s*:\s*(.+?)\s*=>\s*(\d{4}-\d{2}-\d{2})$/i,
      'due',
    ],
    [/^(?:edit note|عدّل الملاحظة|عدل الملاحظة)\s*:\s*(.+?)\s*=>\s*(.+)$/i, 'details'],
    [/^(?:archive|أرشف|ارشف)\s*:\s*(.+)$/i, 'archive'],
    [/^(?:restore|استعد)\s*:\s*(.+)$/i, 'restore'],
  ];
  for (const [pattern, operation] of patterns) {
    const match = input.trim().match(pattern);
    if (!match) continue;
    const list = [...tasks.map((x) => ({ ...x, kind: 'task' as const })), ...entries];
    const found = list.filter(
      (x) =>
        titleKey(x.title) === titleKey(match[1]) &&
        (operation === 'restore' ? x.archived : !x.archived) &&
        (!['rename', 'move', 'due'].includes(operation) || x.kind === 'task') &&
        (operation !== 'details' ||
          ['note', 'preference', 'decision', 'personal'].includes(x.kind)),
    );
    if (!found.length && titleKey(match[1]).length <= 160) {
      const needle = titleKey(match[1]);
      const candidates = list
        .filter(
          (x) =>
            !x.archived &&
            Math.abs(titleKey(x.title).length - needle.length) <=
              Math.max(2, Math.floor(needle.length / 4)),
        )
        .slice(0, 300)
        .map((x) => ({ record: x, distance: titleDistance(x.title, match[1]) }))
        .filter((x) => x.distance <= Math.max(2, Math.floor(titleKey(match[1]).length / 4)))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);
      if (candidates.length)
        return {
          text: t(
            'Did you mean ' +
              candidates.map((x) => '“' + x.record.title + '”').join(', ') +
              '? Copy the intended title and retry; nothing changed.',
            'تقصد ' +
              candidates.map((x) => '«' + x.record.title + '»').join('، ') +
              '؟ اختار العنوان المقصود وأعد الطلب؛ لم يتغير شيء.',
          ),
        };
    }
    if (found.length !== 1)
      return {
        text: t(
          found.length
            ? 'More than one exact match. Rename an item in its editor first, then retry.'
            : 'No exact title match in this scope. Copy the full title and retry.',
          found.length
            ? 'أكتر من تطابق بنفس العنوان. ميّز عنوان أحد العناصر من محرره الأول، وبعدها أعد الطلب.'
            : 'مفيش تطابق تام في النطاق ده. انسخ العنوان كامل وأعد الطلب.',
        ),
      };
    const record = found[0];
    if (['move', 'due'].includes(operation) && !isActionable(record as Task))
      return {
        text: t('ui.onlyOpenActionableTasksCanBePlanned.597943'),
      };
    const field =
      operation === 'rename'
        ? 'title'
        : operation === 'move'
          ? 'plannedDate'
          : operation === 'due'
            ? 'dueDate'
            : operation === 'details'
              ? 'detail'
              : 'archived';
    const value =
      operation === 'archive' ? true : operation === 'restore' ? false : match[2].trim();
    if (
      typeof value === 'string' &&
      ((field === 'title' && (!value || value.length > 160)) ||
        (field === 'detail' && value.length > 2500) ||
        (['plannedDate', 'dueDate'].includes(field) &&
          (Number.isNaN(Date.parse(value)) ||
            new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) !== value)))
    )
      return {
        text: t('ui.invalidReplacementValueReviewTheTitleDate.7db912'),
      };
    if (((record as unknown as Record<string, unknown>)[field] ?? null) === value)
      return {
        text: t('ui.thisRecordAlreadyHasThatValueNo.0e87b3'),
      };
    return {
      text:
        operation === 'due'
          ? t('ui.thisChangesTheDueDateOnlyThe.8fc76f')
          : operation === 'move'
            ? t('ui.thisChangesTheExecutionDayOnlyThe.623d13')
            : t('ui.reviewTheBeforeAfterChangeOnlyConfirmation.fb3803'),
      status: 'pending',
      mutation: {
        collection: record.kind === 'task' ? 'personal-os.tasks.v1' : 'personal-os.entries.v1',
        id: record.id,
        kind: record.kind,
        title: record.title,
        revision: record.revision,
        historyLength: record.history?.length ?? 0,
        before: { [field]: (record as unknown as Record<string, string | boolean>)[field] ?? null },
        patch: { [field]: value },
      },
    };
  }
  return undefined;
}
export function mutationRecord(data: Data, m: Mutation) {
  const raw = data[m.collection] as (Task | Entry)[] | { entries: Entry[] } | undefined;
  return (Array.isArray(raw) ? raw : (raw?.entries ?? [])).find((x) => x.id === m.id);
}
export function applyMutation(data: Data, m: Mutation, inverse = false): Data {
  if (!validMutation(m)) throw Error('invalid-mutation');
  const record = mutationRecord(data, m);
  if (!record) throw Error('missing-target');
  const patch = inverse ? m.before : m.patch;
  const raw = data[m.collection] as (Task | Entry)[] | { entries: Entry[] };
  const values = Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [k, v === null ? undefined : v]),
  );
  const items = (Array.isArray(raw) ? raw : raw.entries).map((x) =>
    x.id === m.id ? { ...x, ...values } : x,
  );
  return { ...data, [m.collection]: Array.isArray(raw) ? items : { ...raw, entries: items } };
}
export function mutationUndoable(data: Data, m: Mutation) {
  const record = mutationRecord(data, m);
  return (
    !!record &&
    record.history?.length === m.historyLength + 1 &&
    Object.entries(m.patch).every(
      ([k, v]) => ((record as unknown as Record<string, unknown>)[k] ?? null) === v,
    ) &&
    Object.keys(m.patch).every((k) => record.history!.at(-1)?.fields.includes(k))
  );
}
export function confirmMutation(data: Data, conversationId: string, message: Message): Data {
  const chats = (data['personal-os.conversations.v1'] ?? []) as {
    id: string;
    archived: boolean;
    messages: Message[];
  }[];
  const chat = chats.find((x) => x.id === conversationId);
  const stored = chat?.messages.find((x) => x.id === message.id);
  if (!chat || chat.archived || !stored) throw Error('missing-action');
  if (stored.status === 'confirmed') return data;
  const m = stored.mutation;
  if (stored.status !== 'pending' || !m || JSON.stringify(m) !== JSON.stringify(message.mutation))
    throw Error('stale-action');
  const record = mutationRecord(data, m);
  if (
    !record ||
    record.revision !== m.revision ||
    !Object.entries(m.before).every(
      ([k, v]) => ((record as unknown as Record<string, unknown>)[k] ?? null) === v,
    )
  )
    throw Error('stale-target');
  if (('plannedDate' in m.patch || 'dueDate' in m.patch) && !isActionable(record as Task))
    throw Error('unavailable-task');
  const result = applyMutation(data, m);
  return {
    ...result,
    'personal-os.conversations.v1': chats.map((x) =>
      x.id === conversationId
        ? {
            ...x,
            messages: x.messages.map((msg) =>
              msg.id === stored.id ? { ...msg, status: 'confirmed', targetId: m.id } : msg,
            ),
          }
        : x,
    ),
  };
}
