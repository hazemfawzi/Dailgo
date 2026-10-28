import type { Task } from './model';
import { calendarDate, parseCalendarDate } from '../planner/calendarModel';
export type Recurrence = {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  until?: string;
  anchorDay?: number;
};
export function validRecurrence(value: any): value is Recurrence {
  return (
    !!value &&
    typeof value === 'object' &&
    ['daily', 'weekly', 'monthly'].includes(value.frequency) &&
    Number.isInteger(value.interval) &&
    value.interval >= 1 &&
    value.interval <= 365 &&
    (value.until === undefined || !!parseCalendarDate(value.until)) &&
    (value.anchorDay === undefined ||
      (Number.isInteger(value.anchorDay) && value.anchorDay >= 1 && value.anchorDay <= 31))
  );
}
export function nextOccurrence(day: string, rule: Recurrence) {
  const date = parseCalendarDate(day);
  if (!date || !validRecurrence(rule)) throw Error('invalid-recurrence');
  if (rule.frequency === 'monthly') {
    const target = new Date(date.getFullYear(), date.getMonth() + rule.interval, 1, 12);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(rule.anchorDay ?? date.getDate(), last));
    return calendarDate(target);
  }
  date.setDate(date.getDate() + rule.interval * (rule.frequency === 'weekly' ? 7 : 1));
  return calendarDate(date);
}
export function recurringSuccessors(before: Task[], after: Task[]): Task[] {
  const old = new Map(before.map((task) => [task.id, task]));
  const next = [...after];
  for (const task of after) {
    if (!task.done || task.archived || old.get(task.id)?.done !== false || !task.recurrence)
      continue;
    const anchor = task.plannedDate || task.dueDate;
    if (!anchor || !parseCalendarDate(anchor)) throw Error('recurrence-needs-date');
    const rule = {
      ...task.recurrence,
      anchorDay: task.recurrence.anchorDay ?? parseCalendarDate(anchor)!.getDate(),
    };
    const day = nextOccurrence(anchor, rule);
    if (rule.until && day > rule.until) continue;
    const id = `repeat:${task.recurrenceRoot ?? task.id}:${day}`;
    if (next.some((item) => item.id === id)) continue;
    const offset = Math.round(
      (Date.parse(day + 'T12:00:00Z') - Date.parse(anchor + 'T12:00:00Z')) / 86400000,
    );
    const shift = (value: string | undefined) => {
      if (!value) return undefined;
      const date = parseCalendarDate(value);
      if (!date) throw Error('invalid-recurrence-date');
      date.setDate(date.getDate() + offset);
      return calendarDate(date);
    };
    const { revision, history, createdAt, updatedAt, completedAt, result, ...fields } = task;
    next.push({
      ...fields,
      id,
      done: false,
      status: 'todo',
      archived: false,
      pinned: false,
      plannedDate: shift(task.plannedDate),
      dueDate: shift(task.dueDate),
      recurrence: rule,
      recurrenceRoot: task.recurrenceRoot ?? task.id,
      recurrenceFrom: task.id,
      subtasks: task.subtasks?.map((item) => ({ ...item, done: false })),
    });
  }
  return next;
}
