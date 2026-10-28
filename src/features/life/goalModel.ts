import type { Data } from '../../lib/storageCore';
import type { Entry } from '../../lib/workspace';
import { statusOf } from '../tasks/model';
import type { Task } from '../tasks/model';
export function goalStats(tasks: Task[], goalId: string, milestoneId?: string) {
  const linked = tasks.filter(
    (x) =>
      x.goalId === goalId &&
      !x.archived &&
      statusOf(x) !== 'cancelled' &&
      (!milestoneId || x.milestoneId === milestoneId),
  );
  const done = linked.filter((x) => x.done).length;
  return {
    total: linked.length,
    done,
    open: linked.length - done,
    progress: linked.length ? Math.round((done / linked.length) * 100) : 0,
  };
}
export function replaceGoalTasks(all: Task[], goalId: string, next: Task[]) {
  const incoming = new Map(next.map((task) => [task.id, { ...task, goalId }]));
  const output = all.flatMap((task) => {
    if (task.goalId !== goalId) return [task];
    const replacement = incoming.get(task.id);
    incoming.delete(task.id);
    return replacement ? [replacement] : [];
  });
  return [...output, ...incoming.values()];
}

export function closeGoal(data: Data, id: string, revision?: string): Data {
  const raw = data['personal-os.entries.v1'] as Entry[] | { entries: Entry[] };
  const entries = Array.isArray(raw) ? raw : (raw?.entries ?? []);
  const goal = entries.find((entry) => entry.id === id && entry.kind === 'goal');
  if (
    !goal ||
    goal.archived ||
    goal.revision !== revision ||
    goalStats((data['personal-os.tasks.v1'] ?? []) as Task[], id).progress !== 100
  )
    throw Error('goal-not-ready');
  const next = entries.map((entry) =>
    entry.id === id ? { ...entry, outcomeAchieved: true, archived: true } : entry,
  );
  return {
    ...data,
    'personal-os.entries.v1': Array.isArray(raw) ? next : { ...raw, entries: next },
  };
}
