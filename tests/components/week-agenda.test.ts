import { expect, test } from 'vitest';
import { orderDayTasks } from '../../src/features/planner/weekModel';
import type { Task } from '../../src/features/tasks/model';
test('weekly presentation sorts execution times without changing records or equal-time order', () => {
  const tasks = [
    { id: 'english', plannedTime: '08:00' },
    { id: 'no-time' },
    { id: 'quran', plannedTime: '04:30', dueDate: '2026-11-03' },
    { id: 'ai', plannedTime: '05:15' },
    { id: 'same-time', plannedTime: '05:15', done: true },
  ].map((task) => ({ title: task.id, category: 'Learning', done: false, ...task })) as Task[];
  const before = structuredClone(tasks);
  expect(orderDayTasks(tasks).map((task) => task.id)).toEqual([
    'quran',
    'ai',
    'same-time',
    'english',
    'no-time',
  ]);
  expect(tasks).toEqual(before);
  expect(orderDayTasks(tasks)[0]).toBe(tasks[2]);
});
