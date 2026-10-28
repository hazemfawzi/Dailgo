import { localDate } from '../../lib/workspace';
import type { Translate } from '../../lib/workspace';
export const taskStates = [
  'todo',
  'doing',
  'waiting',
  'blocked',
  'deferred',
  'cancelled',
  'done',
] as const;
export type TaskStatus = (typeof taskStates)[number];
export type Task = import('../../lib/audit').AuditFields & {
  assigneeId?: string;
  recurrence?: import('./recurrence').Recurrence;
  recurrenceRoot?: string;
  recurrenceFrom?: string;
  result?: { note: string; date: string };
  projectId?: string;
  context?: string;
  reviewDate?: string;
  reason?: string;
  waitingFor?: string;
  memoryId?: string;
  source?: import('../capture/model').CaptureSource;
  id: string;
  goalId?: string;
  milestoneId?: string;
  title: string;
  category: string;
  done: boolean;
  archived: boolean;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: TaskStatus;
  dueDate?: string;
  plannedDate?: string;
  plannedTime?: string;
  estimate?: number;
  pinned?: boolean;
  tags?: string[];
  subtasks?: { id: string; title: string; done: boolean }[];
};
export const statusOf = (task: Task): TaskStatus =>
  task.done ? 'done' : task.status && task.status !== 'done' ? task.status : 'todo';
export const isActionable = (task: Task) =>
  !task.archived && ['todo', 'doing'].includes(statusOf(task));
export const statusLabel = (status: TaskStatus, t: Translate) =>
  ({
    todo: t('To do', 'لم تبدأ'),
    doing: t('In progress', 'قيد التنفيذ'),
    waiting: t('Waiting', 'في انتظار'),
    blocked: t('Blocked', 'متعطلة'),
    deferred: t('Deferred', 'مؤجلة'),
    cancelled: t('Cancelled', 'ملغاة'),
    done: t('Completed', 'مكتملة'),
  })[status];
export const priorityOf = (task: Task) => task.priority ?? 'medium';
export const priorityLabel = (value: string, t: Translate) =>
  value === 'high'
    ? t('High', 'عالية')
    : value === 'low'
      ? t('Low', 'منخفضة')
      : t('Medium', 'متوسطة');
export const isOverdue = (task: Task) =>
  !task.done &&
  !task.archived &&
  statusOf(task) !== 'cancelled' &&
  !!task.dueDate &&
  task.dueDate < localDate();
export function rankTasks(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) =>
      Number(!!b.pinned) - Number(!!a.pinned) ||
      Number(isOverdue(b)) - Number(isOverdue(a)) ||
      { high: 0, medium: 1, low: 2 }[priorityOf(a)] -
        { high: 0, medium: 1, low: 2 }[priorityOf(b)] ||
      (a.dueDate || '9999').localeCompare(b.dueDate || '9999'),
  );
}
