import { afterEach, expect, test, vi } from 'vitest';
import { commitServerStore } from '../../src/lib/serverStorage';
import { diffWorkspace } from '../../src/lib/workspaceDelta';
const task = (id: string, title: string) => ({
  id,
  title,
  category: 'Work',
  done: false,
  archived: false,
});
const key = 'personal-os.tasks.v1';
const base = { [key]: [task('a', 'One'), task('b', 'Two')] };
afterEach(() => vi.unstubAllGlobals());
test('an online 409 merges distinct records and sends only the local delta against the latest revision', async () => {
  const latest = { [key]: [task('a', 'One'), task('b', 'Remote edit')] };
  const merged = { [key]: [task('a', 'Local edit'), task('b', 'Remote edit')] };
  const calls: { path: string; body: any }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path, body });
      if (calls.length === 1) return Response.json({ error: 'workspace-changed' }, { status: 409 });
      if (calls.length === 2) return Response.json({ revision: 'new', data: latest });
      expect(body.revision).toBe('new');
      expect(body.changes).toHaveLength(1);
      expect(body.changes[0].id).toBe('a');
      return Response.json({ revision: 'saved', changes: diffWorkspace(latest, merged) });
    }),
  );
  const result = await commitServerStore(
    { [key]: [task('a', 'Local edit'), task('b', 'Two')] },
    'old',
    base,
  );
  expect(result.undoBase).toEqual(latest);
  expect(result.data).toEqual(merged);
  expect(calls).toHaveLength(3);
});
test('overlapping online changes remain conflicts and never trigger a write retry', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({}, { status: 409 }))
    .mockResolvedValueOnce(
      Response.json({
        revision: 'new',
        data: { [key]: [task('a', 'Remote edit'), task('b', 'Two')] },
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  await expect(
    commitServerStore({ [key]: [task('a', 'Local edit'), task('b', 'Two')] }, 'old', base),
  ).rejects.toMatchObject({ status: 409 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
test('a stale editor record revision is never upgraded by the workspace merge retry', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ error: 'record-changed' }, { status: 409 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(
    commitServerStore(
      { [key]: [task('a', 'Old editor overwrite'), task('b', 'Two')] },
      'old',
      base,
    ),
  ).rejects.toMatchObject({ status: 409, code: 'record-changed' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
