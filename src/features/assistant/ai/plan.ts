import type { Data } from '../../../lib/storageCore';
import { areas, makeEntry } from '../../../lib/workspace';
import type { Entry } from '../../../lib/workspace';
import type { Task } from '../../tasks/model';
import { workspaceEntries } from '../../journey/model';
import { validDate } from '../../capture/model';
import { milestoneDateIssue } from '../../life/goalDates';
import { isActionable } from '../../tasks/model';
export type AIAction =
  | { kind: 'create_task'; task: Task }
  | { kind: 'create_goal'; goal: Entry }
  | {
      kind: 'update_task';
      id: string;
      revision?: string;
      historyLength: number;
      before: Task;
      patch: Partial<Pick<Task, 'title' | 'plannedDate' | 'dueDate' | 'plannedTime' | 'estimate'>>;
    };
export type GoalUpdate = {
  kind: 'update_goal';
  id: string;
  revision?: string;
  historyLength: number;
  before: Entry;
  patch: Pick<Entry, 'date' | 'milestones'>;
};
export type AIPlan = {
  id: string;
  scope: string;
  summary: string;
  createdAt: string;
  contextTruncated?: boolean;
  actions: (AIAction | GoalUpdate)[];
};
export const inScope = (
  record: { category?: string; area?: string; context?: string },
  scope: string,
) =>
  scope === 'all' ||
  (scope.startsWith('context:')
    ? record.context === scope.slice(8)
    : (record.category ?? record.area) === scope);
export function validScope(scope: unknown): scope is string {
  return (
    typeof scope === 'string' &&
    (scope === 'all' ||
      areas.includes(scope as any) ||
      (scope.startsWith('context:') && scope.length > 8 && scope.length <= 308))
  );
}
const day = (value: unknown) => typeof value === 'string' && (!value || validDate(value));
const clock = (value: unknown) =>
  value === undefined || (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
const title = (value: unknown) =>
  typeof value === 'string' && !!value.trim() && value.length <= 160;
export function validAIPlan(value: any): value is AIPlan {
  if (
    !value ||
    typeof value.id !== 'string' ||
    !validScope(value.scope) ||
    typeof value.summary !== 'string' ||
    value.summary.length > 20000 ||
    typeof value.createdAt !== 'string' ||
    !Array.isArray(value.actions) ||
    value.actions.length > 40
  )
    return false;
  return value.actions.every(
    (a: any) =>
      a &&
      ((a.kind === 'create_task' &&
        a.task &&
        title(a.task.title) &&
        typeof a.task.id === 'string' &&
        areas.includes(a.task.category) &&
        a.task.done === false &&
        a.task.archived === false &&
        (!a.task.plannedDate || day(a.task.plannedDate)) &&
        (!a.task.dueDate || day(a.task.dueDate)) &&
        clock(a.task.plannedTime) &&
        (!a.task.plannedTime || !!a.task.plannedDate) &&
        (a.task.estimate === undefined ||
          (Number.isFinite(a.task.estimate) && a.task.estimate >= 0 && a.task.estimate <= 1440))) ||
        (a.kind === 'create_goal' &&
          a.goal &&
          title(a.goal.title) &&
          typeof a.goal.id === 'string' &&
          a.goal.kind === 'goal' &&
          areas.includes(a.goal.area) &&
          day(a.goal.date) &&
          (!a.goal.milestones ||
            (a.goal.milestones.length <= 12 &&
              a.goal.milestones.every(
                (m: any) =>
                  title(m.title) &&
                  typeof m.id === 'string' &&
                  day(m.date) &&
                  (!a.goal.date || !m.date || m.date <= a.goal.date),
              )))) ||
        (a.kind === 'update_goal' &&
          typeof a.id === 'string' &&
          (a.revision === undefined || typeof a.revision === 'string') &&
          Number.isInteger(a.historyLength) &&
          a.historyLength >= 0 &&
          a.before?.id === a.id &&
          a.before.kind === 'goal' &&
          a.before.revision === a.revision &&
          a.patch &&
          Object.keys(a.patch).every((key) => ['date', 'milestones'].includes(key)) &&
          day(a.patch.date) &&
          Array.isArray(a.patch.milestones) &&
          a.patch.milestones.length <= 24 &&
          a.patch.milestones.every(
            (m: any) => title(m.title) && typeof m.id === 'string' && day(m.date),
          ) &&
          !milestoneDateIssue({ ...a.before, ...a.patch })) ||
        (a.kind === 'update_task' &&
          typeof a.id === 'string' &&
          (a.revision === undefined || typeof a.revision === 'string') &&
          Number.isInteger(a.historyLength) &&
          a.historyLength >= 0 &&
          a.before?.id === a.id &&
          a.before.revision === a.revision &&
          a.patch &&
          typeof a.patch === 'object' &&
          Object.keys(a.patch).length > 0 &&
          Object.keys(a.patch).every((key) =>
            ['title', 'plannedDate', 'dueDate', 'plannedTime', 'estimate'].includes(key),
          ) &&
          (a.patch.title === undefined || title(a.patch.title)) &&
          ['plannedDate', 'dueDate'].every(
            (key) => a.patch[key] === undefined || day(a.patch[key]),
          ) &&
          clock(a.patch.plannedTime) &&
          (a.patch.estimate === undefined ||
            (Number.isFinite(a.patch.estimate) &&
              a.patch.estimate >= 0 &&
              a.patch.estimate <= 1440)))),
  );
}
export function makeAIPlan(
  data: Data,
  id: string,
  scope: string,
  summary: string,
  tools: { name: string; input: any }[],
  now = new Date().toISOString(),
): AIPlan {
  if (!validScope(scope) || tools.length > 20) throw Error('invalid-ai-plan');
  const actions: (AIAction | GoalUpdate)[] = [];
  const tasks = (data['personal-os.tasks.v1'] ?? []) as Task[];
  const goals = workspaceEntries(data).filter(
    (x) => x.kind === 'goal' && !x.archived && inScope(x, scope),
  );
  const area = (value: any) =>
    scope !== 'all' && !scope.startsWith('context:')
      ? scope
      : areas.includes(value)
        ? value
        : 'Personal';
  const context = scope.startsWith('context:') ? scope.slice(8) : undefined;
  const taskAction = (input: any, goalId?: string, milestoneId?: string) => {
    const task: Task = {
      id: `ai:${id}:${actions.length}`,
      title: input.title,
      category: area(input.area),
      context,
      done: false,
      archived: false,
      status: 'todo',
      plannedDate: input.planned_date || undefined,
      dueDate: input.due_date || undefined,
      plannedTime: input.planned_time || undefined,
      estimate: input.estimate_minutes,
      goalId: goalId ?? input.goal_id,
      milestoneId,
      description:
        typeof input.description === 'string' ? input.description.slice(0, 3000) : undefined,
    };
    if (
      task.goalId &&
      !actions.some((a) => a.kind === 'create_goal' && a.goal.id === task.goalId) &&
      !goals.some((g) => g.id === task.goalId)
    )
      throw Error('goal-outside-scope');
    actions.push({ kind: 'create_task', task });
  };
  const update = (input: any) => {
    const record = tasks.find(
      (task) => task.id === input.task_id && inScope(task, scope) && isActionable(task),
    );
    if (!record || actions.some((a) => a.kind === 'update_task' && a.id === record.id))
      throw Error('task-unavailable');
    const patch: Partial<Task> = {};
    for (const [source, target] of [
      ['title', 'title'],
      ['planned_date', 'plannedDate'],
      ['due_date', 'dueDate'],
      ['planned_time', 'plannedTime'],
      ['estimate_minutes', 'estimate'],
    ] as const)
      if (input[source] !== undefined) (patch as any)[target] = input[source];
    const { history, ...before } = record;
    actions.push({
      kind: 'update_task',
      id: record.id,
      revision: record.revision,
      historyLength: history?.length ?? 0,
      before,
      patch,
    });
  };
  for (const tool of tools) {
    const input = tool.input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('invalid-tool');
    if (tool.name === 'create_task') taskAction(input);
    else if (tool.name === 'update_task') update(input);
    else if (tool.name === 'plan_day') {
      if (!Array.isArray(input.assignments) || input.assignments.length > 25)
        throw Error('invalid-plan');
      input.assignments.forEach(update);
    } else if (tool.name === 'decompose_goal') {
      const goal = goals.find((x) => x.id === input.goal_id);
      if (
        !goal ||
        actions.some((a) => a.kind === 'update_goal' && a.id === goal.id) ||
        !Array.isArray(input.milestones) ||
        input.milestones.length > 12
      )
        throw Error('goal-unavailable');
      const phases = input.milestones.map((m: any, i: number) => ({
        id: `ai:${id}:phase:${actions.length}:${i}`,
        title: m.title,
        date: m.date ?? '',
      }));
      const { history, attachments, ...before } = goal;
      actions.push({
        kind: 'update_goal',
        id: goal.id,
        revision: goal.revision,
        historyLength: history?.length ?? 0,
        before,
        patch: {
          date: input.target_date ?? goal.date,
          milestones: [...(goal.milestones ?? []), ...phases],
        },
      });
      if (input.tasks !== undefined) {
        if (!Array.isArray(input.tasks) || input.tasks.length > 20)
          throw Error('invalid-goal-tasks');
        input.tasks.forEach((task: any) => {
          if (
            task.milestone_index !== undefined &&
            (!Number.isInteger(task.milestone_index) ||
              task.milestone_index < 0 ||
              task.milestone_index >= phases.length)
          )
            throw Error('invalid-milestone');
          taskAction(
            { ...task, area: goal.area },
            goal.id,
            task.milestone_index === undefined ? undefined : phases[task.milestone_index].id,
          );
        });
      }
    } else if (tool.name === 'create_goal') {
      const goalId = `ai:${id}:${actions.length}`;
      const goal: Entry = {
        ...makeEntry('goal', input.title, area(input.area) as any),
        id: goalId,
        context,
        date: input.target_date ?? '',
        detail: typeof input.reason === 'string' ? input.reason.slice(0, 3000) : '',
        successCriteria:
          typeof input.success_criteria === 'string' ? input.success_criteria.slice(0, 2000) : '',
        milestones: Array.isArray(input.milestones)
          ? input.milestones.map((m: any, i: number) => ({
              id: goalId + ':m' + i,
              title: m.title,
              date: m.date ?? '',
            }))
          : [],
      };
      actions.push({ kind: 'create_goal', goal });
      if (input.tasks !== undefined) {
        if (!Array.isArray(input.tasks) || input.tasks.length > 20)
          throw Error('invalid-goal-tasks');
        input.tasks.forEach((task: any) => {
          if (
            task.milestone_index !== undefined &&
            (!Number.isInteger(task.milestone_index) ||
              task.milestone_index < 0 ||
              task.milestone_index >= (goal.milestones?.length ?? 0))
          )
            throw Error('invalid-milestone');
          taskAction(
            { ...task, area: goal.area },
            goalId,
            task.milestone_index === undefined
              ? undefined
              : goal.milestones?.[task.milestone_index]?.id,
          );
        });
      }
    } else throw Error('unsupported-tool');
  }
  const plan: AIPlan = { id, scope, summary, createdAt: now, actions };
  if (!validAIPlan(plan)) throw Error('invalid-ai-plan');
  return plan;
}
export function applyAIPlan(data: Data, plan: AIPlan): Data {
  if (!validAIPlan(plan)) throw Error('invalid-ai-plan');
  let tasks = [...((data['personal-os.tasks.v1'] ?? []) as Task[])];
  let entries = [...workspaceEntries(data)];
  for (const action of plan.actions) {
    if (action.kind === 'create_task') {
      if (tasks.some((x) => x.id === action.task.id)) throw Error('ai-already-applied');
      tasks.push(action.task);
    } else if (action.kind === 'create_goal') {
      if (entries.some((x) => x.id === action.goal.id)) throw Error('ai-already-applied');
      entries.push(action.goal);
    } else if (action.kind === 'update_goal') {
      const old = entries.find(
        (goal) => goal.id === action.id && goal.kind === 'goal' && !goal.archived,
      );
      if (
        !old ||
        old.revision !== action.revision ||
        !inScope(old, plan.scope) ||
        JSON.stringify(old.milestones) !== JSON.stringify(action.before.milestones) ||
        old.date !== action.before.date
      )
        throw Error('ai-target-changed');
      entries = entries.map((goal) => (goal.id === old.id ? { ...goal, ...action.patch } : goal));
    } else {
      const old = tasks.find((x) => x.id === action.id);
      if (
        !old ||
        old.revision !== action.revision ||
        JSON.stringify({ ...old, history: undefined }) !== JSON.stringify(action.before) ||
        !isActionable(old) ||
        !inScope(old, plan.scope)
      )
        throw Error('ai-target-changed');
      const changed = { ...old, ...action.patch };
      if (changed.plannedTime && !changed.plannedDate) throw Error('ai-time-needs-date');
      tasks = tasks.map((x) => (x.id === old.id ? changed : x));
    }
  }
  return {
    ...data,
    'personal-os.tasks.v1': tasks,
    'personal-os.entries.v1': { version: 2, demoVersion: 1, entries },
  };
}
export function undoAIPlan(data: Data, plan: AIPlan): Data {
  if (!validAIPlan(plan)) throw Error('invalid-ai-plan');
  let tasks = [...((data['personal-os.tasks.v1'] ?? []) as Task[])];
  let entries = [...workspaceEntries(data)];
  const created = new Set(
    plan.actions.flatMap((action) =>
      action.kind === 'create_task'
        ? [action.task.id]
        : action.kind === 'create_goal'
          ? [action.goal.id]
          : [],
    ),
  );
  const focus = data['personal-os.focus.v1'] as { taskId?: string } | undefined;
  const sessions = (data['personal-os.sessions.v1'] ?? []) as { taskId: string }[];
  const weeks = Object.values(data['personal-os.weeks.v1'] ?? {}) as {
    outcomes?: { goalId: string }[];
  }[];
  const finance = data['personal-os.finance.v1'] as { savings?: { goalId?: string }[] } | undefined;
  if (
    tasks.some(
      (task) =>
        !created.has(task.id) &&
        [task.goalId, task.projectId, task.memoryId].some((id) => id && created.has(id)),
    ) ||
    entries.some(
      (entry) => !created.has(entry.id) && entry.parentGoalId && created.has(entry.parentGoalId),
    ) ||
    (focus?.taskId && created.has(focus.taskId)) ||
    sessions.some((session) => created.has(session.taskId)) ||
    weeks.some((week) => week.outcomes?.some((outcome) => created.has(outcome.goalId))) ||
    finance?.savings?.some((goal) => goal.goalId && created.has(goal.goalId))
  )
    throw Error('ai-undo-linked-record');
  for (const action of [...plan.actions].reverse()) {
    const original =
      action.kind === 'update_task' || action.kind === 'update_goal'
        ? action.before
        : action.kind === 'create_task'
          ? action.task
          : action.goal;
    const list = action.kind === 'create_goal' || action.kind === 'update_goal' ? entries : tasks;
    const current = list.find((x) => x.id === original.id);
    const expectedHistory =
      (action.kind === 'update_task' || action.kind === 'update_goal'
        ? action.historyLength
        : (original.history?.length ?? 0)) + 1;
    const expected =
      action.kind === 'update_task' || action.kind === 'update_goal'
        ? { ...action.before, ...action.patch }
        : original;
    const fields = Object.keys(expected).filter(
      (key) =>
        !['revision', 'history', 'createdAt', 'updatedAt', 'completedAt', 'progress'].includes(key),
    );
    if (
      !current ||
      current.history?.length !== expectedHistory ||
      !fields.every(
        (key) => JSON.stringify((current as any)[key]) === JSON.stringify((expected as any)[key]),
      )
    )
      throw Error('ai-undo-target-changed');
    if (action.kind === 'update_goal') {
      const oldPhases = new Set(action.before.milestones?.map((x) => x.id) ?? []);
      const removed = new Set(
        action.patch.milestones?.filter((x) => !oldPhases.has(x.id)).map((x) => x.id) ?? [],
      );
      if (
        tasks.some(
          (task) => !created.has(task.id) && task.milestoneId && removed.has(task.milestoneId),
        )
      )
        throw Error('ai-undo-linked-phase');
      entries = entries.map((goal) =>
        goal.id === action.id
          ? { ...goal, date: action.before.date, milestones: action.before.milestones }
          : goal,
      );
    } else if (action.kind === 'update_task')
      tasks = tasks.map((x) =>
        x.id === current.id
          ? { ...action.before, revision: current.revision, history: current.history }
          : x,
      );
    else if (action.kind === 'create_task') tasks = tasks.filter((x) => x.id !== current.id);
    else entries = entries.filter((x) => x.id !== current.id);
  }
  return {
    ...data,
    'personal-os.tasks.v1': tasks,
    'personal-os.entries.v1': { version: 2, demoVersion: 1, entries },
  };
}

export function aiRecord(action: AIAction | GoalUpdate) {
  return action.kind === 'update_task' || action.kind === 'update_goal'
    ? action.before
    : action.kind === 'create_task'
      ? action.task
      : action.goal;
}
export const aiTargetId = (action: AIAction | GoalUpdate) => aiRecord(action).id;
