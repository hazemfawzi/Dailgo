import type { Data } from '../../lib/storageCore';
import type { Task } from '../tasks/model';
import { isActionable } from '../tasks/model';
export type FocusSession = {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt: string;
  seconds: number;
};
export type FocusTimerState = {
  ends: number | null;
  remaining: number;
  taskId?: string;
  sessionId?: string;
  startedAt?: string;
  plannedSeconds?: number;
  pendingCompletion?: { sessionId: string; taskId: string; revision?: string };
};
export function finishFocus(
  data: Data,
  sessionId: string | undefined,
  now = Date.now(),
  askCompletion = false,
): Data {
  const live = data['personal-os.focus.v1'] as FocusTimerState | undefined;
  if (!live?.ends || !sessionId || live.sessionId !== sessionId || !live.startedAt) return data;
  const log = (data['personal-os.sessions.v1'] ?? []) as FocusSession[];
  const seconds = Math.min(
    live.plannedSeconds ?? 1500,
    Math.max(0, Math.round((now - Date.parse(live.startedAt)) / 1000)),
  );
  const record: FocusSession = {
    id: sessionId,
    taskId: live.taskId ?? '',
    startedAt: live.startedAt,
    endedAt: new Date(Math.min(now, live.ends)).toISOString(),
    seconds,
  };
  const task = ((data['personal-os.tasks.v1'] ?? []) as Task[]).find(
    (task) => task.id === live.taskId,
  );
  return {
    ...data,
    'personal-os.sessions.v1': log.some((item) => item.id === sessionId) ? log : [...log, record],
    'personal-os.focus.v1': {
      ...live,
      ends: null,
      remaining: Math.max(0, Math.ceil((live.ends - now) / 1000)),
      sessionId: undefined,
      startedAt: undefined,
      pendingCompletion:
        askCompletion && task && isActionable(task)
          ? { sessionId, taskId: task.id, revision: task.revision }
          : undefined,
    },
  };
}
export function answerFocusCompletion(data: Data, sessionId: string, complete: boolean): Data {
  const live = data['personal-os.focus.v1'] as FocusTimerState | undefined;
  const pending = live?.pendingCompletion;
  if (!pending || pending.sessionId !== sessionId) throw Error('focus-question-changed');
  const tasks = (data['personal-os.tasks.v1'] ?? []) as Task[];
  const task = tasks.find((task) => task.id === pending.taskId);
  if (
    complete &&
    (!task || (!task.done && (!isActionable(task) || task.revision !== pending.revision)))
  )
    throw Error('focus-task-changed');
  return {
    ...data,
    ...(complete
      ? {
          'personal-os.tasks.v1': tasks.map((task) =>
            task.id === pending.taskId ? { ...task, done: true, status: 'done' as const } : task,
          ),
        }
      : {}),
    'personal-os.focus.v1': { ...live, pendingCompletion: undefined },
  };
}
