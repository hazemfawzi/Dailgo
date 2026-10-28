import { applyCapture, parseCapture } from '../capture/model';
import type { CaptureItem } from '../capture/model';
import type { Data } from '../../lib/storageCore';
import type { Message } from './engine';
import { areas } from '../../lib/workspace';
import type { Entry } from '../../lib/workspace';
import type { Task } from '../tasks/model';

export function parseCompound(input: string): CaptureItem[] | undefined {
  // Delimit only explicit action prefixes. This is a rule parser, not language understanding.
  const normalized = input
    .replace(
      /(?:\s+و|[،,]\s*و?)(?=(?:أضف\s+|اضف\s+)?(?:مهمة|موعد|ملاحظة|هدف|مشروع|قرار|روتين)\s*[:：]?\s)/g,
      '\n',
    )
    .replace(
      /\s+and\s+(?=(?:add\s+)?(?:task|event|note|goal|project|routine|decision)\s*:?\s)/gi,
      '\n',
    )
    .replace(
      /(^|[\n;؛])\s*(?:أضف|اضف|add)\s+(?=مهمة|موعد|ملاحظة|هدف|مشروع|قرار|روتين|task\b|event\b|note\b|goal\b|project\b|routine\b|decision\b)/gi,
      '$1',
    );
  const items = parseCapture(normalized);
  return items.length > 1 ? items : undefined;
}
export function confirmBatch(data: Data, conversationId: string, message: Message): Data {
  const chats = (data['personal-os.conversations.v1'] ?? []) as {
    id: string;
    archived: boolean;
    messages: Message[];
  }[];
  const conversation = chats.find((c) => c.id === conversationId);
  const stored = conversation?.messages.find((m) => m.id === message.id);
  if (!conversation || conversation.archived || !stored) throw Error('unavailable-conversation');
  if (stored.status === 'confirmed') return data;
  if (
    stored.status !== 'pending' ||
    !stored.batch?.length ||
    JSON.stringify(stored.batch) !== JSON.stringify(message.batch) ||
    stored.scope !== message.scope
  )
    throw Error('stale-preview');
  const batchId = `assistant-${stored.id}`;
  const result = applyCapture(data, stored.batch, {
    text: stored.batchSource ?? '',
    batchId,
    createdAt: stored.createdAt ?? new Date().toISOString(),
  });
  const targetIds = stored.batch.map((x) => `capture-${batchId}-${x.id}`);
  const ids = new Set(targetIds);
  const context = stored.scope?.startsWith('context:') ? stored.scope.slice(8) : undefined;
  const workspace = result['personal-os.entries.v1'] as { entries: Entry[] };
  return {
    ...result,
    'personal-os.tasks.v1': (result['personal-os.tasks.v1'] as Task[]).map((x) =>
      ids.has(x.id) ? { ...x, context } : x,
    ),
    'personal-os.entries.v1': {
      ...workspace,
      entries: workspace.entries.map((x) => (ids.has(x.id) ? { ...x, context } : x)),
    },
    'personal-os.conversations.v1': chats.map((c) =>
      c.id === conversationId
        ? {
            ...c,
            messages: c.messages.map((m) =>
              m.id === stored.id ? { ...m, status: 'confirmed', targetIds } : m,
            ),
          }
        : c,
    ),
  };
}
export function scopeBatch(items: CaptureItem[], scope: string) {
  return items.map((x) => ({ ...x, area: areas.find((a) => a === scope) ?? x.area }));
}
