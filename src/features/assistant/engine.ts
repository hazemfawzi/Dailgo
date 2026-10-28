import { createTranslator } from '../../i18n/translate';
export { createTranslator } from '../../i18n/translate';
import { parseCapture, isNaturalTask, validDate } from '../capture/model';
import { isActionable, rankTasks } from '../tasks/model';
import { mutationResponse } from './mutationModel';
import { parseCompound } from './batchModel';
import type { CaptureItem } from '../capture/model';
import { localDate, makeEntry, memoryKinds } from '../../lib/workspace';
import type { Area, Entry, Translate, EntryKind } from '../../lib/workspace';
import type { Task } from '../home/HomeScreen';
export type Proposal = {
  kind: 'task' | EntryKind;
  title: string;
  date: string;
  time: string;
  area?: Area;
  tags?: string[];
  timeAssumed?: boolean;
};
export type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ai?: import('./ai/plan').AIPlan;
  reply?: { key: 'rules-v1'; en: string; ar: string };
  proposal?: Proposal;
  mutation?: import('./mutationModel').Mutation;
  batch?: CaptureItem[];
  batchSource?: string;
  targetIds?: string[];
  undo?: { at: string; removedIds: string[]; keptIds: string[]; restoredIds?: string[] };
  status?: 'pending' | 'confirmed' | 'cancelled' | 'reverted';
  targetId?: string;
  scope?: string;
  createdAt?: string;
  references?: { id: string; title: string }[];
};
function respondText(
  input: string,
  t: Translate,
  tasks: Task[],
  entries: Entry[],
): Omit<Message, 'id' | 'role'> {
  const text = input.trim();
  const studyRequest = isNaturalTask(text);
  const mutation = mutationResponse(text, t, tasks, entries);
  if (mutation) return mutation as Omit<Message, 'id' | 'role'>;
  try {
    const batch = parseCompound(text);
    if (batch)
      return {
        text: t('ui.iPreparedALocalMultiActionPreview.aa90e5'),
        batch,
        batchSource: text,
        status: 'pending',
      };
  } catch {
    return {
      text: t('ui.useAtMost20ActionsPerRequest.2b8a2c'),
    };
  }
  if (studyRequest) {
    const title = text.replace(/^(?:عايز|عاوز|أريد|اريد|محتاج)\s+/u, '');
    const item = parseCapture('Task: ' + title)[0];
    return {
      text: t('ui.iPreparedATaskPreviewReviewIts.109622'),
      proposal: {
        kind: 'task',
        title: item.title.slice(0, 160),
        date: item.date,
        time: item.time,
        area: item.area,
        tags: item.tags,
        timeAssumed: item.timeAssumed,
      },
      status: 'pending',
    };
  }
  const commands: { pattern: RegExp; kind: Proposal['kind'] }[] = [
    { pattern: /^(?:project|مشروع)\s*[:：]?\s+(.+)$/i, kind: 'project' },
    { pattern: /^(?:task|add task|مهمة|أضف مهمة|اضف مهمة|ذكرني)\s*[:：]?\s+(.+)$/i, kind: 'task' },
    { pattern: /^(?:remember|note|memory|تذكر|احفظ|ملاحظة)\s*[:：]?\s+(.+)$/i, kind: 'note' },
    { pattern: /^(?:goal|هدف)\s*[:：]?\s+(.+)$/i, kind: 'goal' },
    { pattern: /^(?:routine|روتين)\s*[:：]?\s+(.+)$/i, kind: 'routine' },
    { pattern: /^(?:event|موعد)\s*[:：]?\s+(.+)$/i, kind: 'event' },
  ];
  for (const command of commands) {
    const match = text.match(command.pattern);
    if (match) {
      let title = match[1].trim();
      const dateMatch = title.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      const timeMatch = title.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
      const date = dateMatch?.[1] ?? localDate();
      const time = timeMatch?.[0] ?? '09:00';
      if (command.kind === 'task') {
        const item = parseCapture('Task: ' + title)[0];
        if (!item.title.trim()) return { text: t('ui.pleaseIncludeATaskTitle.8b3bd4') };
        return {
          text: t('ui.reviewTheTaskTitleAndOptionalExecution.abdb75'),
          proposal: {
            kind: 'task',
            title: item.title.slice(0, 160),
            date: item.date,
            time: item.time,
            area: item.area,
            tags: item.tags,
            timeAssumed: item.timeAssumed,
          },
          status: 'pending',
        };
      }
      if (command.kind === 'routine' && !timeMatch)
        return {
          text: t('ui.pleaseIncludeA24HourTimeFor.ce43d3'),
        };
      if (command.kind === 'routine' && timeMatch) title = title.replace(timeMatch[0], '').trim();
      if (command.kind === 'event') {
        if (!dateMatch || !timeMatch)
          return {
            text: t('ui.whatExactDateAndTimeUseEvent.88c568'),
          };
        if (!validDate(date) || (/\b\d{1,2}:\d{2}\b/.test(title) && !timeMatch))
          return {
            text: t('ui.pleaseUseAValidDateAnd24.c1bb1c'),
          };
        title = title
          .replace(dateMatch?.[0] ?? '\u0000', '')
          .replace(timeMatch?.[0] ?? '\u0000', '')
          .trim();
      }
      if (!title) return { text: t('ui.pleaseIncludeATitleAfterTheCommand.92b54f') };
      return {
        text: t('ui.iCanPrepareThisLocalActionReview.c32eb0'),
        proposal: { kind: command.kind, title: title.slice(0, 160), date, time },
        status: 'pending',
      };
    }
  }
  if (
    /\b(?:memory|memories|remember)\b/i.test(text) ||
    /(?:^|[^\p{L}\p{N}_])(?:الذاكرة|ذاكرة|ذاكرتي|تذكر|معلوماتي)(?=$|[^\p{L}\p{N}_])/u.test(text)
  ) {
    const memories = entries.filter(
      (e) =>
        memoryKinds.includes(e.kind) && !e.archived && (!e.expiresOn || e.expiresOn >= localDate()),
    );
    return {
      references: memories.map((e) => ({ id: e.id, title: e.title })),
      text: memories.length
        ? t(
            `Here are your saved memories (${memories.length}):\n${memories
              .slice(0, 8)
              .map(
                (e) =>
                  `• ${e.title}${e.certainty === 'inferred' ? ' [' + t('ui.inferredReview.d5e193') + ']' : ''}${e.detail ? `: ${e.detail}` : ''}${e.sourceLabel ? ' · ' + t('ui.source.380763') + e.sourceLabel : ''}`,
              )
              .join('\n')}\n\nThis is a direct local summary, without AI interpretation.`,
            `هذه معلوماتك المحفوظة (${memories.length}):\n${memories
              .slice(0, 8)
              .map(
                (e) =>
                  `• ${e.title}${e.certainty === 'inferred' ? ' [' + t('ui.inferredReview.d5e193') + ']' : ''}${e.detail ? `: ${e.detail}` : ''}${e.sourceLabel ? ' · ' + t('ui.source.380763') + e.sourceLabel : ''}`,
              )
              .join('\n')}\n\nهذا عرض مباشر للبيانات المحلية بدون تحليل ذكاء اصطناعي.`,
          )
        : t('ui.yourMemoryIsEmptyTryRememberI.3232dc'),
    };
  }
  if (/priorit|plan|today|مهام|أولو|اولوي|يومي|خطط/i.test(text)) {
    const open = rankTasks(tasks.filter(isActionable));
    const events = entries.filter(
      (e) => e.kind === 'event' && e.date === localDate() && !e.archived,
    );
    return {
      references: [...open, ...events].map((e) => ({ id: e.id, title: e.title })),
      text: t('ui.youHaveOpenPrioritiesAndLocalEvents.933afd', {
        en0: open.length,
        en1: events.length,
        en2: open
          .slice(0, 5)
          .map((x) => `• ${x.title}`)
          .join('\n'),
        ar0: open.length,
        ar1: events.length,
        ar2: open
          .slice(0, 5)
          .map((x) => `• ${x.title}`)
          .join('\n'),
      }),
    };
  }
  return {
    text: t('ui.iCouldNotIdentifyASupportedAction.1f6bbe'),
  };
}
export function proposalEntry(proposal: Proposal, id: string): Entry {
  return {
    ...makeEntry(proposal.kind === 'task' ? 'note' : proposal.kind, proposal.title),
    id,
    certainty: 'explicit',
    sourceLabel: 'Local assistant action confirmed by user',
    ...(proposal.kind === 'event' ? { date: proposal.date, time: proposal.time } : {}),
    ...(proposal.kind === 'routine' ? { time: proposal.time } : {}),
  };
}

export function respond(
  input: string,
  t: Translate,
  tasks: Task[],
  entries: Entry[],
): Omit<Message, 'id' | 'role'> {
  const english = respondText(input, createTranslator('en'), tasks, entries);
  const arabic = respondText(input, createTranslator('ar'), tasks, entries);
  return {
    ...(t('en', 'ar') === 'ar' ? arabic : english),
    reply: { key: 'rules-v1', en: english.text, ar: arabic.text },
  };
}
const legacyReplies: Record<string, string> = {
  'Your memory is empty. Try “Remember: I prefer quiet mornings”.':
    'ذاكرتك فارغة. جرّب «احفظ: أفضل الصباح الهادئ».',
  'Review the before/after change. Only confirmation updates the existing record.':
    'راجع الفرق قبل وبعد. السجل الموجود مش هيتغير غير بعد تأكيدك.',
  'This changes the due date only. The execution day stays unchanged. Review and confirm.':
    'ده بيغيّر موعد التسليم فقط. يوم التنفيذ هيفضل زي ما هو. راجع وأكد.',
  'This changes the execution day only. The due date stays unchanged. Review and confirm.':
    'ده بيغيّر يوم التنفيذ فقط. موعد التسليم هيفضل زي ما هو. راجع وأكد.',
  'Review the task title and optional execution day, then confirm to save.':
    'راجع عنوان المهمة ويوم التنفيذ الاختياري، ثم أكد الحفظ.',
  'I can prepare this local action. Review the details below, then confirm to save it.':
    'جهزت الإجراء المحلي. راجع التفاصيل أدناه، ثم أكد لحفظه.',
};
export function proposalArea(proposal: Proposal, scope = 'all'): Area {
  if (['Work', 'Family', 'Health', 'Learning', 'Finance', 'Personal'].includes(scope))
    return scope as Area;
  return (
    proposal.area ??
    (proposal.kind === 'task' ? parseCapture('Task: ' + proposal.title)[0]?.area : undefined) ??
    'Personal'
  );
}
export function messageText(message: Pick<Message, 'role' | 'text' | 'reply'>, t: Translate) {
  if (message.role === 'assistant' && message.reply?.key === 'rules-v1')
    return t(message.reply.en, message.reply.ar);
  if (message.role === 'assistant' && Object.hasOwn(legacyReplies, message.text))
    return t(message.text, legacyReplies[message.text]);
  return message.text;
}
