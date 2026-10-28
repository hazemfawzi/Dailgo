import { getPlanning } from '../../lib/preferences';
import { occupiedEventMinutes } from './scheduling';
import { isActionable } from '../tasks/model';
import { localDate } from '../../lib/workspace';
import type { Entry } from '../../lib/workspace';
import type { Task } from '../tasks/model';
export function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function weekStart(key = localDate(), startsOn = getPlanning().weekStartsOn) {
  const date = new Date(`${key}T12:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` !==
      key
  )
    return weekStart(localDate(), startsOn);
  return addDays(key, -((date.getDay() - startsOn + 7) % 7));
}
export const weekDates = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));
export function dayLoad(
  tasks: Task[],
  entries: Entry[],
  date: string,
  capacity: number,
  buffer = 0,
) {
  const planned = tasks.filter(
    (x) => !x.archived && (x.done || isActionable(x)) && x.plannedDate === date,
  );
  const events = entries.filter((x) => x.kind === 'event' && !x.archived && x.date === date);
  const taskMinutes = planned.reduce((sum, x) => sum + (x.estimate || 0), 0);
  const eventMinutes = occupiedEventMinutes(entries, date);
  return {
    taskMinutes,
    eventMinutes,
    total: taskMinutes + eventMinutes,
    capacity: Math.max(0, capacity - buffer),
    rawCapacity: capacity,
    buffer,
    overloaded: taskMinutes + eventMinutes > Math.max(0, capacity - buffer),
    unknownTasks: planned.filter((x) => !x.estimate).length,
    estimatedEvents: events.filter((x) => x.durationMinutes === undefined).length,
  };
}
export function rolloverCandidates(tasks: Task[], start: string) {
  const end = addDays(start, 6);
  return tasks.filter(
    (x) => isActionable(x) && x.plannedDate && x.plannedDate >= start && x.plannedDate <= end,
  );
}
export function rolloverTasks(tasks: Task[], from: string, to: string) {
  const ids = new Set(rolloverCandidates(tasks, from).map((x) => x.id));
  const dates = weekDates(from);
  return tasks.map((x) =>
    ids.has(x.id) ? { ...x, plannedDate: addDays(to, dates.indexOf(x.plannedDate!)) } : x,
  );
}
export type Outcome = { criteria?: string; title: string; goalId: string; done: boolean };
export type WeekPlan = {
  outcomes: Outcome[];
  capacities: Record<string, number>;
  buffers?: Record<string, number>;
  review: { wins: string; obstacles: string; next: string };
};
export const emptyWeek = (): WeekPlan => ({
  outcomes: Array.from({ length: 3 }, () => ({ title: '', goalId: '', done: false })),
  capacities: {},
  review: { wins: '', obstacles: '', next: '' },
});
