import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { scryptSync, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { verifyPassword, createSessions } from '../server/auth.mjs';
import { identityStore } from '../server/identity.mjs';
import { createLocalServer } from '../server/index.mjs';
const compiled = await build({
  stdin: {
    contents:
      "export * from './src/lib/workspaceDelta'; export * from './src/lib/offlineMerge'; export {auditWorkspace} from './src/lib/audit';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const model = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64')
);
const task = (id, fields = {}) => ({
  id,
  title: id,
  category: 'Work',
  done: false,
  archived: false,
  ...fields,
});
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE account(id INTEGER PRIMARY KEY,username TEXT,salt TEXT,password TEXT);CREATE TABLE sessions(token TEXT PRIMARY KEY,expires INTEGER);CREATE TABLE workspace(id INTEGER PRIMARY KEY,revision TEXT,data TEXT);',
  );
  const salt = 'test-salt';
  db.prepare('INSERT INTO account VALUES(1,?,?,?)').run(
    'owner',
    salt,
    scryptSync('correct-test-password', salt, 64).toString('hex'),
  );
  return db;
}
async function fixture(options = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'dailgo-core-'));
  const runtime = createLocalServer(join(folder, 'workspace.sqlite'), {
    config: { production: false, origin: '', port: 5173, setupToken: '', cookieSecure: false },
    assistant: { env: {} },
    notifications: { env: {} },
    calendar: { env: {} },
    billing: { env: {} },
    ...options,
  });
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + runtime.server.address().port;
  let cookie = '';
  async function call(path, method = 'GET', body, headers = {}) {
    const response = await fetch(base + '/api/' + path, {
      method,
      headers: {
        Origin: 'http://127.0.0.1:5173',
        Cookie: cookie,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const value = await response.json();
    return { response, body: value };
  }
  const setup = await call('account/setup', 'POST', {
    username: 'core-owner',
    password: 'core-test-password',
  });
  cookie = setup.response.headers.getSetCookie()[0].split(';')[0];
  return {
    ...runtime,
    base,
    cookie,
    call,
    async close() {
      if (runtime.server.listening) await new Promise((resolve) => runtime.server.close(resolve));
      if (runtime.db.isOpen) runtime.db.close();
      rmSync(folder, { recursive: true, force: true });
    },
  };
}

test('existing and missing users both perform password derivation', () => {
  const salt = 'test-salt',
    password = 'correct-test-password',
    user = { salt, password: scryptSync(password, salt, 64).toString('hex') };
  let calls = 0;
  const derive = (...args) => {
    calls++;
    return scryptSync(...args);
  };
  assert.equal(verifyPassword(password, undefined, derive), false);
  assert.equal(verifyPassword(password, user, derive), true);
  assert.equal(verifyPassword('wrong-password', user, derive), false);
  assert.equal(calls, 3);
});
test('active sessions renew within their absolute lifetime and remember-me remains revocable', () => {
  const db = database();
  try {
    const identities = identityStore(db);
    let now = 100000;
    const sessions = createSessions(db, identities, { cookieSecure: true }, () => now);
    const headers = new Map();
    const res = { setHeader: (key, value) => headers.set(key, value) };
    sessions.create(res);
    assert.match(headers.get('Set-Cookie')[0], /Max-Age=43200/);
    const cookie = headers.get('Set-Cookie')[0].split(';')[0];
    const original = db.prepare('SELECT expires FROM sessions').get().expires;
    now += 16 * 60000;
    assert.equal(sessions.find({ headers: { cookie } }, res).principal, 'owner');
    assert.ok(db.prepare('SELECT expires FROM sessions').get().expires > original);
    sessions.create(res, 'owner', true);
    assert.match(headers.get('Set-Cookie')[0], /Max-Age=2592000/);
    const remembered = headers.get('Set-Cookie')[0].split(';')[0];
    const active = sessions.find({ headers: { cookie: remembered } }, res);
    db.prepare('DELETE FROM sessions WHERE token=?').run(active.token);
    assert.equal(sessions.find({ headers: { cookie: remembered } }, res), undefined);
  } finally {
    db.close();
  }
});
test('legacy snapshots migrate without losing order or tenant boundaries, and untouched rows are not rewritten', () => {
  const db = database();
  try {
    const ids = identityStore(db);
    const data = {
      'personal-os.tasks.v1': [task('a'), task('b')],
      'personal-os.entries.v1': {
        version: 2,
        demoVersion: 1,
        entries: [
          {
            id: 'g',
            kind: 'goal',
            title: 'Goal',
            area: 'Work',
            date: '',
            time: '',
            detail: '',
            progress: 0,
            archived: false,
            doneDates: [],
          },
          {
            id: 'n',
            kind: 'note',
            title: 'Note',
            area: 'Personal',
            date: '',
            time: '',
            detail: 'Private note',
            progress: 0,
            archived: false,
            doneDates: [],
          },
        ],
      },
    };
    db.prepare('INSERT INTO workspace VALUES(1,?,?)').run('legacy', JSON.stringify(data));
    assert.deepEqual(ids.workspace('owner').data, data);
    assert.equal(db.prepare('SELECT count(*) AS n FROM workspace_goals').get().n, 1);
    db.exec(
      'CREATE TABLE changed(id TEXT);CREATE TRIGGER track_task_update AFTER UPDATE ON workspace_tasks BEGIN INSERT INTO changed VALUES(new.id);END;',
    );
    ids.save('owner', 'updated', {
      ...data,
      'personal-os.tasks.v1': [task('a', { title: 'Changed' }), task('b')],
    });
    assert.deepEqual(
      db
        .prepare('SELECT id FROM changed')
        .all()
        .map((row) => row.id),
      ['a'],
    );
    ids.save('member', 'separate', { 'personal-os.tasks.v1': [task('member-only')] });
    assert.equal(ids.workspace('owner').data['personal-os.tasks.v1'][0].title, 'Changed');
    assert.equal(ids.workspace('member').data['personal-os.tasks.v1'][0].id, 'member-only');
    assert.equal(
      JSON.parse(db.prepare('SELECT data FROM workspace').get().data)['personal-os.tasks.v1'][0]
        .title,
      'Changed',
    );
  } finally {
    db.close();
  }
});
test('records-only mode can project a current legacy snapshot before downgrade', () => {
  const db = database();
  try {
    const ids = identityStore(db, { recordsOnly: true });
    ids.save('owner', 'new', { 'personal-os.tasks.v1': [task('a')] });
    assert.equal(db.prepare('SELECT count(*) AS n FROM workspace').get().n, 0);
    assert.equal(ids.workspace('owner').revision, 'new');
    ids.projectLegacy();
    assert.equal(db.prepare('SELECT revision FROM workspace').get().revision, 'new');
  } finally {
    db.close();
  }
});
test('partial deltas preserve ordering, entry metadata and unchanged large notes', () => {
  const before = {
    'personal-os.tasks.v1': [task('a')],
    'personal-os.entries.v1': {
      version: 2,
      demoVersion: 1,
      entries: [
        {
          id: 'n',
          kind: 'note',
          title: 'Note',
          area: 'Work',
          detail: 'private '.repeat(10000),
          date: '',
          time: '',
          progress: 0,
          archived: false,
          doneDates: [],
        },
      ],
    },
  };
  const after = { ...before, 'personal-os.tasks.v1': [task('a', { done: true })] };
  const changes = model.diffWorkspace(before, after);
  assert.equal(changes.length, 1);
  assert.ok(JSON.stringify(changes).length < 500);
  assert.deepEqual(model.applyWorkspaceDelta(before, changes), after);
  const reordered = { ...after, 'personal-os.tasks.v1': [task('b'), task('a', { done: true })] };
  assert.deepEqual(
    model.applyWorkspaceDelta(after, model.diffWorkspace(after, reordered)),
    reordered,
  );
  assert.throws(() => model.applyWorkspaceDelta(before, [{ key: 'unknown', value: 'no' }]));
});
test('offline merge combines independent fields and asks before replacing conflicting edits or deletions', () => {
  const before = { 'personal-os.tasks.v1': [task('a', { revision: 'base' })] };
  const local = { 'personal-os.tasks.v1': [task('a', { done: true, revision: 'local' })] };
  const remote = {
    'personal-os.tasks.v1': [task('a', { title: 'Changed elsewhere', revision: 'remote' })],
  };
  const merged = model.mergeOffline(before, local, remote);
  assert.equal(merged.conflicts.length, 0);
  assert.equal(merged.data['personal-os.tasks.v1'][0].done, true);
  assert.equal(merged.data['personal-os.tasks.v1'][0].title, 'Changed elsewhere');
  assert.equal(merged.data['personal-os.tasks.v1'][0].revision, 'remote');
  const conflict = model.mergeOffline(
    before,
    { 'personal-os.tasks.v1': [task('a', { title: 'My title' })] },
    remote,
  );
  assert.equal(conflict.conflicts.length, 1);
  const choice = { [conflict.conflicts[0].path]: 'local' };
  assert.equal(
    model.mergeOffline(
      before,
      { 'personal-os.tasks.v1': [task('a', { title: 'My title' })] },
      remote,
      choice,
    ).data['personal-os.tasks.v1'][0].title,
    'My title',
  );
  assert.equal(
    model.mergeOffline(before, { 'personal-os.tasks.v1': [] }, remote).conflicts.length,
    1,
  );
});
test('partial HTTP commits are audited and unexpected database failures are 500s with redacted structured logs', async () => {
  const logs = [],
    f = await fixture({ logger: (event) => logs.push(event) });
  try {
    const seed = await f.call('workspace', 'PUT', {
      revision: 'empty',
      data: { 'personal-os.tasks.v1': [task('a')] },
    });
    const update = await f.call('workspace/changes', 'PUT', {
      revision: seed.body.revision,
      changes: [{ key: 'personal-os.tasks.v1', id: 'a', value: task('a', { title: 'Updated' }) }],
    });
    assert.equal(update.response.status, 200);
    assert.ok(update.body.changes[0].value.revision);
    assert.equal(
      (await f.call('workspace/changes', 'PUT', { revision: seed.body.revision, changes: [] }))
        .response.status,
      409,
    );
    f.db.exec(
      "CREATE TRIGGER fail_private_write BEFORE UPDATE ON workspace_tasks BEGIN SELECT RAISE(ABORT,'private-content-must-not-be-logged');END;",
    );
    const current = await f.call('workspace');
    const failed = await f.call('workspace/changes', 'PUT', {
      revision: current.body.revision,
      changes: [
        {
          key: 'personal-os.tasks.v1',
          id: 'a',
          value: { ...current.body.data['personal-os.tasks.v1'][0], title: 'Cannot save' },
        },
      ],
    });
    assert.equal(failed.response.status, 500);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].event, 'request-failed');
    assert.doesNotMatch(JSON.stringify(logs), /private-content|Cannot save|core-test-password/);
    assert.equal((await f.call('workspace')).body.data['personal-os.tasks.v1'][0].title, 'Updated');
  } finally {
    await f.close();
  }
});
test('SSE emits account-scoped revision notices without workspace contents', async () => {
  const f = await fixture();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const denied = await fetch(f.base + '/api/workspace/events?account=other', {
      headers: { Cookie: f.cookie },
    });
    assert.equal(denied.status, 401);
    const response = await fetch(f.base + '/api/workspace/events?account=owner', {
      headers: { Cookie: f.cookie },
      signal: controller.signal,
    });
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    const reader = response.body.getReader();
    const initial = new TextDecoder().decode((await reader.read()).value);
    assert.match(initial, /empty/);
    const save = await f.call('workspace', 'PUT', {
      revision: 'empty',
      data: { 'personal-os.tasks.v1': [task('private-title')] },
    });
    const notice = new TextDecoder().decode((await reader.read()).value);
    assert.match(notice, new RegExp(save.body.revision));
    assert.doesNotMatch(notice, /private-title/);
    controller.abort();
    await reader.cancel().catch(() => {});
  } finally {
    clearTimeout(timer);
    controller.abort();
    await f.close();
  }
});

test('encrypted backups authenticate their contents and never replace an existing restore destination', async () => {
  const { backupDatabase } = await import('../server/maintenance.mjs');
  const { decryptBackup } = await import('../server/backupCrypto.mjs');
  const { readFileSync, existsSync } = await import('node:fs');
  const folder = mkdtempSync(join(tmpdir(), 'dailgo-encrypted-backup-'));
  const source = join(folder, 'source.sqlite');
  const db = new DatabaseSync(source);
  db.exec(
    "CREATE TABLE private_records(value TEXT);INSERT INTO private_records VALUES('private-task-title-never-plaintext-in-backup');",
  );
  db.close();
  try {
    const secret = 'a'.repeat(64);
    const encrypted = await backupDatabase(source, join(folder, 'backups'), {
      encryptionKey: secret,
    });
    assert.ok(encrypted.endsWith('.enc'));
    assert.equal(
      readFileSync(encrypted).includes(Buffer.from('private-task-title-never-plaintext-in-backup')),
      false,
    );
    const restored = join(folder, 'restored.sqlite');
    await decryptBackup(encrypted, restored, secret);
    const check = new DatabaseSync(restored);
    assert.equal(
      check.prepare('SELECT value FROM private_records').get().value,
      'private-task-title-never-plaintext-in-backup',
    );
    check.close();
    await assert.rejects(decryptBackup(encrypted, restored, secret));
    const wrong = join(folder, 'wrong.sqlite');
    await assert.rejects(decryptBackup(encrypted, wrong, 'b'.repeat(64)));
    assert.equal(existsSync(wrong), false);
    assert.equal(existsSync(restored), true);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('edits made after a rollback are imported again without replacing newer records-only data with its old projection', () => {
  const db = database();
  try {
    const ids = identityStore(db, { recordsOnly: true });
    ids.save('owner', 'v1', { 'personal-os.tasks.v1': [task('a')] });
    ids.projectLegacy();
    ids.save('owner', 'v2', { 'personal-os.tasks.v1': [task('a', { title: 'New row data' })] });
    assert.equal(ids.workspace('owner').data['personal-os.tasks.v1'][0].title, 'New row data');
    db.prepare('UPDATE workspace SET revision=?,data=? WHERE id=1').run(
      'older-version-write',
      JSON.stringify({ 'personal-os.tasks.v1': [task('a', { title: 'Edited after rollback' })] }),
    );
    assert.equal(
      ids.workspace('owner').data['personal-os.tasks.v1'][0].title,
      'Edited after rollback',
    );
    ids.save('owner', 'v3', {
      'personal-os.tasks.v1': [task('a', { title: 'Latest normalized data' })],
    });
    assert.equal(
      ids.workspace('owner').data['personal-os.tasks.v1'][0].title,
      'Latest normalized data',
    );
  } finally {
    db.close();
  }
});

test('graceful shutdown projects records-only data for the existing deployment rollback', async () => {
  const f = await fixture({ recordsOnly: true });
  try {
    const save = await f.call('workspace', 'PUT', {
      revision: 'empty',
      data: { 'personal-os.tasks.v1': [task('current-records-only')] },
    });
    assert.equal(save.response.status, 200);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM workspace').get().n, 0);
    await new Promise((resolve) => f.server.close(resolve));
    assert.equal(
      JSON.parse(f.db.prepare('SELECT data FROM workspace').get().data)['personal-os.tasks.v1'][0]
        .id,
      'current-records-only',
    );
  } finally {
    await f.close();
  }
});

test('family records use partial, audited writes in their own normalized namespace', async () => {
  const f = await fixture({ recordsOnly: true });
  try {
    const space = await f.call('family', 'POST', { title: 'Normalized family' });
    const created = space.body;
    const first = await f.call('family/' + created.id, 'PUT', {
      revision: created.revision,
      data: { 'personal-os.tasks.v1': [task('family-task', { category: 'Family' })] },
    });
    assert.equal(first.response.status, 200);
    const row = f.db
      .prepare("SELECT payload FROM workspace_tasks WHERE principal=? AND id='family-task'")
      .get('family:' + created.id);
    assert.equal(JSON.parse(row.payload).title, 'family-task');
    const changed = await f.call('family/' + created.id, 'PUT', {
      revision: first.body.revision,
      changes: [
        {
          key: 'personal-os.tasks.v1',
          id: 'family-task',
          value: { ...first.body.data['personal-os.tasks.v1'][0], done: true },
        },
      ],
    });
    assert.equal(changed.response.status, 200);
    assert.ok(changed.body.changes.some((change) => change.value?.done));
    assert.equal((await f.call('workspace')).body.data?.['personal-os.tasks.v1'], undefined);
    assert.equal(
      f.db.prepare("SELECT count(*) AS n FROM workspace_tasks WHERE principal='owner'").get().n,
      0,
    );
  } finally {
    await f.close();
  }
});
