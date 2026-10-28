import type { Data } from '../../lib/storageCore';
import { memoryKinds } from '../../lib/workspace';
import type { Entry } from '../../lib/workspace';
import type { Task } from '../tasks/model';
const key = (x: Entry) =>
  [
    x.kind,
    x.area,
    x.context ?? '',
    x.title
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  ].join('|');
export function duplicateMemories(entries: Entry[]) {
  const active = entries.filter((x) => memoryKinds.includes(x.kind) && !x.archived);
  return active.flatMap((a, i) =>
    active
      .slice(i + 1)
      .filter((b) => key(a) === key(b))
      .map((b) => ({ a, b })),
  );
}
export function mergeMemories(data: Data, a: Entry, b: Entry, detail: string): Data {
  const workspace = data['personal-os.entries.v1'] as { entries: Entry[] };
  const target = workspace?.entries.find((x) => x.id === a.id);
  const source = workspace?.entries.find((x) => x.id === b.id);
  if (
    !target ||
    !source ||
    target.id === source.id ||
    target.archived ||
    source.archived ||
    target.revision !== a.revision ||
    source.revision !== b.revision ||
    key(target) !== key(source) ||
    !memoryKinds.includes(target.kind) ||
    detail.length > 6000
  )
    throw Error('stale-merge');
  return {
    ...data,
    'personal-os.entries.v1': {
      ...workspace,
      entries: workspace.entries.map((x) =>
        x.id === target.id
          ? {
              ...x,
              detail,
              tags: Array.from(new Set([...(target.tags ?? []), ...(source.tags ?? [])])),
              links: Array.from(new Set([...(target.links ?? []), ...(source.links ?? [])])),
            }
          : x.id === source.id
            ? { ...x, archived: true }
            : x,
      ),
    },
    'personal-os.tasks.v1': ((data['personal-os.tasks.v1'] ?? []) as Task[]).map((x) =>
      x.memoryId === source.id ? { ...x, memoryId: target.id } : x,
    ),
  };
}
