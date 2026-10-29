import { provisionKeys } from '../server/provision.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { createLocalServer } from '../server/index.mjs';
import { identityStore } from '../server/identity.mjs';
import { createAssistantService, assistantContext } from '../server/assistant.mjs';
import { createNotifications, validPushSubscription } from '../server/notifications.mjs';
import { createCalendar } from '../server/calendar.mjs';
import { createBilling } from '../server/billing.mjs';
import { secretBox } from '../server/secret.mjs';
const result = await build({
  stdin: {
    contents:
      "export * as rec from './src/features/tasks/recurrence'; export { restoreWorkspace } from './src/features/life/demoGoals'; export { planningFor } from './src/lib/planningConfig'; export * as fmt from './src/i18n/format'; export * as tools from './src/features/tools/model'; export * as ai from './src/features/assistant/ai/plan'; export * as undo from './src/lib/undoStore'; export { loadView } from './src/lib/lazyView'; export { shortcutAction } from './src/lib/shortcuts'; export { titleKey } from './src/lib/text'; export { auditWorkspace,validateData,makeBackup,parseBackup } from './src/lib/storageCore'; export { respond,messageText,createTranslator } from './src/features/assistant/engine';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const domain = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);
const task = (id, fields = {}) => ({
  id,
  title: id,
  category: 'Work',
  done: false,
  archived: false,
  ...fields,
});
const goal = (id, fields = {}) => ({
  id,
  title: id,
  kind: 'goal',
  area: 'Work',
  detail: 'Private goal notes',
  date: '2026-12-31',
  time: '',
  progress: 0,
  doneDates: [],
  archived: false,
  ...fields,
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const origin = 'http://127.0.0.1:5173';
async function fixture(options = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'dailgo-features-'));
  const runtime = createLocalServer(join(folder, 'test.sqlite'), {
    assistant: { env: {} },
    notifications: { env: {} },
    calendar: { env: {} },
    billing: { env: {} },
    scheduler: false,
    ...options,
  });
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + runtime.server.address().port;
  async function call(path, method = 'GET', body, cookie = '', headers = {}) {
    const response = await fetch(base + '/api/' + path, {
      method,
      headers: {
        Origin: origin,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = await response.json();
    return {
      status: response.status,
      body: value,
      cookie:
        response.headers
          .getSetCookie()
          .find((x) => !x.includes('Max-Age=0'))
          ?.split(';')[0] ?? '',
      headers: response.headers,
    };
  }
  const owner = await call('account/setup', 'POST', {
    username: 'owner-test',
    password: 'feature-test-password',
  });
  assert.equal(owner.status, 201);
  const cookie = owner.cookie;
  return {
    ...runtime,
    base,
    call,
    cookie,
    identities: identityStore(runtime.db),
    async close() {
      await new Promise((resolve) => runtime.server.close(resolve));
      runtime.db.close();
      rmSync(folder, { recursive: true, force: true });
    },
  };
}
function unitDB() {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE account(id INTEGER PRIMARY KEY,username TEXT,salt TEXT,password TEXT);CREATE TABLE sessions(token TEXT PRIMARY KEY,expires INTEGER);CREATE TABLE workspace(id INTEGER PRIMARY KEY,revision TEXT,data TEXT);',
  );
  return { db, identities: identityStore(db) };
}

test('Arabic display formatting uses one numeral system and correct singular, dual and plural forms', () => {
  assert.equal(domain.fmt.formatNumber(65, 'ar'), '65');
  assert.equal(domain.fmt.formatTime('20:08', 'ar'), '20:08');
  assert.doesNotMatch(domain.fmt.formatCalendarDate('2026-12-31', 'ar'), /[٠-٩۰-۹]/);
  assert.equal(domain.fmt.counted(1, 'item', 'ar'), 'عنصر');
  assert.equal(domain.fmt.counted(2, 'item', 'ar'), 'عنصران');
  assert.equal(domain.fmt.counted(3, 'goal', 'ar'), '3 أهداف');
  assert.equal(domain.fmt.activeGoals(1, 'ar'), 'هدف نشط (غير مؤرشف)');
  assert.equal(domain.fmt.counted(1, 'item', 'en'), '1 item');
  const reply = domain.respond('Show my memories', domain.createTranslator('en'), [], []);
  assert.match(reply.text, /Your memory is empty/);
  assert.match(
    domain.messageText({ role: 'assistant', ...reply }, domain.createTranslator('ar')),
    /ذاكرتك فارغة/,
  );
  assert.equal(
    domain.messageText(
      { role: 'user', text: 'Move task: API => 2026-10-30' },
      domain.createTranslator('ar'),
    ),
    'Move task: API => 2026-10-30',
  );
});
test('keyboard shortcuts preserve editing while Ctrl/Cmd+K opens the assistant and slash opens search', () => {
  const event = {
    key: '/',
    code: 'Slash',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
  };
  assert.equal(domain.shortcutAction(event, false, false), 'search');
  assert.equal(domain.shortcutAction(event, true, false), null);
  assert.equal(
    domain.shortcutAction({ ...event, key: 'k', code: 'KeyK', ctrlKey: true }, true, false),
    'assistant',
  );
  assert.equal(domain.shortcutAction({ ...event, isComposing: true }, false, false), null);
  assert.equal(domain.shortcutAction(event, false, true), null);
  assert.equal(domain.titleKey('مهمة اختبار ١'), domain.titleKey('مهمة اختبار1'));
});
test('failed chunks reload at most once and ordinary render errors do not reload', async () => {
  let reloads = 0;
  const map = new Map();
  const storage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
  const missing = () =>
    Promise.reject(Error('Failed to fetch dynamically imported module: /assets/old.js'));
  await assert.rejects(domain.loadView(missing, storage, () => reloads++));
  await assert.rejects(domain.loadView(missing, storage, () => reloads++));
  assert.equal(reloads, 1);
  await assert.rejects(
    domain.loadView(
      () => Promise.reject(Error('ordinary error')),
      storage,
      () => reloads++,
    ),
  );
  assert.equal(reloads, 1);
  assert.equal(
    await domain.loadView(
      async () => 42,
      storage,
      () => reloads++,
    ),
    42,
  );
  assert.equal(map.size, 0);
});
test('recurring tasks handle month ends, deadlines, retries, end dates and protected undo', () => {
  const rule = { frequency: 'monthly', interval: 1, anchorDay: 31 };
  assert.equal(domain.rec.nextOccurrence('2027-01-31', rule), '2027-02-28');
  assert.equal(domain.rec.nextOccurrence('2027-02-28', rule), '2027-03-31');
  assert.equal(
    domain.rec.nextOccurrence('2026-12-30', { frequency: 'weekly', interval: 2 }),
    '2027-01-13',
  );
  assert.equal(domain.rec.validRecurrence({ frequency: 'daily', interval: 0 }), false);
  const before = domain.auditWorkspace(
    {},
    {
      'personal-os.tasks.v1': [
        task('repeat', {
          plannedDate: '2026-10-27',
          dueDate: '2026-10-28',
          recurrence: { frequency: 'daily', interval: 1 },
          subtasks: [{ id: 'step', title: 'Step', done: false }],
        }),
      ],
    },
  );
  const completed = domain.auditWorkspace(before, {
    ...before,
    'personal-os.tasks.v1': before['personal-os.tasks.v1'].map((x) => ({
      ...x,
      done: true,
      status: 'done',
    })),
  });
  assert.equal(completed['personal-os.tasks.v1'].length, 2);
  const next = completed['personal-os.tasks.v1'][1];
  assert.equal(next.plannedDate, '2026-10-28');
  assert.equal(next.dueDate, '2026-10-29');
  assert.equal(next.subtasks[0].done, false);
  assert.equal(domain.auditWorkspace(completed, completed)['personal-os.tasks.v1'].length, 2);
  const ticket = domain.undo.transitionTicket(before, completed, 1000);
  const undone = domain.auditWorkspace(completed, domain.undo.applyUndo(completed, ticket, 2000));
  assert.equal(undone['personal-os.tasks.v1'].length, 1);
  assert.equal(undone['personal-os.tasks.v1'][0].done, false);
  const redone = domain.auditWorkspace(undone, {
    ...undone,
    'personal-os.tasks.v1': undone['personal-os.tasks.v1'].map((x) => ({
      ...x,
      done: true,
      status: 'done',
    })),
  });
  assert.equal(redone['personal-os.tasks.v1'].length, 2);
  assert.equal(
    (redone['personal-os.trash.v1'] ?? []).some((x) => x.item.id === next.id),
    false,
  );
  const edited = domain.auditWorkspace(completed, {
    ...completed,
    'personal-os.tasks.v1': completed['personal-os.tasks.v1'].map((x) =>
      x.id === next.id ? { ...x, title: 'Edited next occurrence' } : x,
    ),
  });
  assert.throws(() => domain.undo.applyUndo(edited, ticket, 2000), /undo-target-changed/);
  const ended = [
    task('ended', {
      done: true,
      plannedDate: '2026-10-27',
      recurrence: { frequency: 'daily', interval: 1, until: '2026-10-27' },
    }),
  ];
  assert.equal(domain.rec.recurringSuccessors([{ ...ended[0], done: false }], ended).length, 1);
});
test('finance, prayer and habit data reject invalid values and round-trip through personal backups', () => {
  const finance = {
    ...domain.tools.emptyFinance,
    expenses: [{ id: 'e', title: 'Books', date: '2026-10-27', currency: 'EGP', cents: 1099 }],
    savings: [{ id: 's', title: 'Emergency fund', currency: 'EGP', target: 100000, saved: 12000 }],
  };
  assert.equal(domain.tools.validFinance(finance), true);
  assert.equal(
    domain.tools.validFinance({ ...finance, expenses: [{ ...finance.expenses[0], cents: -1 }] }),
    false,
  );
  assert.equal(
    domain.tools.validFinance({ ...finance, expenses: [{ ...finance.expenses[0], cents: 1.5 }] }),
    false,
  );
  assert.equal(domain.tools.cents('10.99'), 1099);
  assert.equal(domain.tools.validPrayer({ ...domain.tools.defaultPrayer, latitude: 91 }), false);
  assert.equal(
    domain.tools.routineStreak(['2026-10-19', '2026-10-21', '2026-10-26'], [1, 3], '2026-10-27'),
    3,
  );
  const data = {
    'personal-os.finance.v1': finance,
    'personal-os.prayer.v1': domain.tools.defaultPrayer,
  };
  domain.validateData(data);
  assert.deepEqual(domain.parseBackup(JSON.stringify(domain.makeBackup(data))), data);
});
test('Claude proposals apply atomically, reject stale tasks, preserve later dependencies and support guarded undo', () => {
  const initial = domain.auditWorkspace(
    {},
    {
      'personal-os.tasks.v1': [task('task')],
      'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: [] },
    },
  );
  const plan = domain.ai.makeAIPlan(initial, 'request-123', 'Work', 'Reviewed', [
    {
      name: 'create_goal',
      input: {
        title: 'Launch',
        area: 'Work',
        target_date: '2026-12-31',
        milestones: [{ title: 'First draft', date: '2026-11-01' }],
        tasks: [{ title: 'Write draft', estimate_minutes: 30, milestone_index: 0 }],
      },
    },
    { name: 'update_task', input: { task_id: 'task', planned_date: '2026-10-28' } },
  ]);
  assert.equal(plan.actions.length, 3);
  const changed = domain.auditWorkspace(initial, domain.ai.applyAIPlan(initial, plan));
  domain.validateData(changed);
  assert.equal(changed['personal-os.tasks.v1'].length, 2);
  const reverted = domain.ai.undoAIPlan(changed, plan);
  assert.equal(reverted['personal-os.tasks.v1'].length, 1);
  assert.equal(reverted['personal-os.entries.v1'].entries.length, 0);
  assert.equal(reverted['personal-os.tasks.v1'][0].plannedDate, undefined);
  const later = domain.auditWorkspace(initial, {
    ...initial,
    'personal-os.tasks.v1': initial['personal-os.tasks.v1'].map((x) => ({
      ...x,
      title: 'Later edit',
    })),
  });
  assert.throws(() => domain.ai.applyAIPlan(later, plan), /ai-target-changed/);
  const linked = {
    ...changed,
    'personal-os.tasks.v1': [
      ...changed['personal-os.tasks.v1'],
      task('child', { goalId: plan.actions[0].goal.id }),
    ],
  };
  assert.throws(() => domain.ai.undoAIPlan(linked, plan), /ai-undo-linked/);
  assert.throws(
    () =>
      domain.ai.makeAIPlan(initial, 'bad-request', 'Work', 'Bad', [
        { name: 'delete_everything', input: {} },
      ]),
    /unsupported-tool/,
  );
});

test('invited accounts, cookies, passwords and personal workspaces remain isolated from owner data', async () => {
  const f = await fixture();
  try {
    const saved = await f.call(
      'workspace',
      'PUT',
      { revision: 'empty', data: { 'personal-os.tasks.v1': [task('owner-private')] } },
      f.cookie,
    );
    assert.equal(saved.status, 200);
    const space = await f.call('family', 'POST', { title: 'Home' }, f.cookie);
    const invite = await f.call(`family/${space.body.id}/invite`, 'POST', {}, f.cookie);
    const member = await f.call('account/accept-invite', 'POST', {
      token: invite.body.token,
      username: 'family-member',
      password: 'member-test-password',
    });
    assert.equal(member.status, 201);
    assert.match(member.cookie, /^dailgo_member_session=/);
    assert.equal(
      (await f.call('workspace', 'GET', undefined, member.cookie)).body.data['personal-os.tasks.v1']
        .length,
      0,
    );
    assert.equal(
      (await f.call('records/tasks', 'GET', undefined, member.cookie)).body.items.length,
      0,
    );
    assert.equal(
      (
        await f.call('workspace/commit', 'PUT', { revision: 'empty', data: {} }, member.cookie, {
          'X-Dailgo-Account': 'owner',
        })
      ).status,
      401,
    );
    assert.equal(
      (await f.call('workspace', 'GET', undefined, f.cookie)).body.data['personal-os.tasks.v1'][0]
        .id,
      'owner-private',
    );
    assert.notEqual(
      (
        await f.call('account/accept-invite', 'POST', {
          token: invite.body.token,
          username: 'second-member',
          password: 'member-test-password',
        })
      ).status,
      201,
    );
    const members = (await f.call('family', 'GET', undefined, member.cookie)).body.spaces;
    assert.equal(members.length, 1);
    assert.equal(
      (
        await f.call(
          'family/guessed-space',
          'PUT',
          { revision: space.body.revision, data: { 'personal-os.tasks.v1': [] } },
          member.cookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await f.call(
          'account/password',
          'POST',
          { currentPassword: 'member-test-password', newPassword: 'member-replacement-password' },
          member.cookie,
        )
      ).status,
      200,
    );
    assert.equal((await f.call('workspace', 'GET', undefined, f.cookie)).status, 200);
    assert.equal((await f.call('workspace', 'GET', undefined, member.cookie)).status, 401);
  } finally {
    await f.close();
  }
});
test('family writes enforce membership, revision checks and assignment without exposing private tasks', async () => {
  const f = await fixture();
  try {
    const space = (await f.call('family', 'POST', { title: 'Household' }, f.cookie)).body;
    const invitation = (await f.call(`family/${space.id}/invite`, 'POST', {}, f.cookie)).body;
    const member = await f.call('account/accept-invite', 'POST', {
      token: invitation.token,
      username: 'family-test',
      password: 'member-test-password',
    });
    const current = (await f.call('family', 'GET', undefined, member.cookie)).body.spaces[0];
    const memberId = current.members.find((x) => x.role === 'member').principal;
    const data = {
      'personal-os.tasks.v1': [task('shared', { category: 'Family', assigneeId: memberId })],
    };
    const saved = await f.call(
      `family/${space.id}`,
      'PUT',
      { revision: current.revision, data },
      member.cookie,
    );
    assert.equal(saved.status, 200);
    assert.equal(
      (await f.call(`family/${space.id}`, 'PUT', { revision: current.revision, data }, f.cookie))
        .status,
      409,
    );
    assert.equal(
      (
        await f.call(
          `family/${space.id}`,
          'PUT',
          { revision: saved.body.revision, data: { 'personal-os.tasks.v1': [task('wrong-area')] } },
          member.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (await f.call(`family/${space.id}/invite`, 'POST', {}, member.cookie)).status,
      403,
    );
    assert.equal(
      (await f.call(`family/${space.id}/members/${memberId}`, 'DELETE', {}, f.cookie)).status,
      200,
    );
    const latest = (await f.call('family', 'GET', undefined, f.cookie)).body.spaces[0];
    assert.equal(latest.data['personal-os.tasks.v1'][0].assigneeId, undefined);
    assert.equal((await f.call('family', 'GET', undefined, member.cookie)).body.spaces.length, 0);
    assert.equal(
      (
        await f.call(
          `family/${space.id}`,
          'PUT',
          { revision: saved.body.revision, data },
          member.cookie,
        )
      ).status,
      404,
    );
  } finally {
    await f.close();
  }
});
test('goal links expose only reviewed fields, support comments and stop working after revocation', async () => {
  const f = await fixture();
  try {
    await f.call(
      'workspace',
      'PUT',
      {
        revision: 'empty',
        data: {
          'personal-os.tasks.v1': [task('secret-task-title', { goalId: 'g' })],
          'personal-os.entries.v1': {
            version: 2,
            demoVersion: 1,
            entries: [goal('g'), goal('other-private-goal')],
          },
        },
      },
      f.cookie,
    );
    const link = (await f.call('shares', 'POST', { goalId: 'g' }, f.cookie)).body;
    const shared = await f.call('public/goal', 'POST', { token: link.token });
    assert.equal(shared.status, 200);
    assert.equal(shared.body.goal.total, 1);
    assert.equal(shared.body.goal.detail, undefined);
    assert.doesNotMatch(
      JSON.stringify(shared.body),
      /secret-task-title|other-private-goal|Private goal notes/,
    );
    assert.equal(
      (await f.call('public/goal', 'POST', { token: link.token, comment: 'Keep going' })).body
        .comments[0].text,
      'Keep going',
    );
    await f.call('shares/' + link.id, 'DELETE', {}, f.cookie);
    assert.equal((await f.call('public/goal', 'POST', { token: link.token })).status, 404);
  } finally {
    await f.close();
  }
});
test('read-only widget tokens cannot edit, cross accounts or survive expiry and revocation', async () => {
  const f = await fixture();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Africa/Cairo',
    }).formatToParts(new Date());
    const day = ['year', 'month', 'day']
      .map((key) => parts.find((x) => x.type === key).value)
      .join('-');
    await f.call(
      'workspace',
      'PUT',
      {
        revision: 'empty',
        data: {
          'personal-os.tasks.v1': [
            task('today', { plannedDate: day }),
            task('done', { plannedDate: day, done: true }),
            task('later', { plannedDate: '2099-01-01' }),
          ],
          'personal-os.planning.v1': {
            weekStartsOn: 6,
            capacity: 240,
            buffer: 30,
            timezone: 'Africa/Cairo',
          },
        },
      },
      f.cookie,
    );
    const device = (await f.call('widgets', 'POST', {}, f.cookie)).body;
    const headers = { Authorization: 'Bearer ' + device.token };
    const result = await f.call('widgets/today', 'GET', undefined, '', headers);
    assert.equal(result.status, 200);
    assert.deepEqual(
      result.body.tasks.map((x) => x.id),
      ['today'],
    );
    assert.equal(
      (await f.call('workspace/commit', 'PUT', { revision: 'anything', data: {} }, '', headers))
        .status,
      401,
    );
    await f.call('widgets/' + device.id, 'DELETE', {}, f.cookie);
    assert.equal((await f.call('widgets/today', 'GET', undefined, '', headers)).status, 401);
    const expired = (await f.call('widgets', 'POST', {}, f.cookie)).body;
    f.db.prepare('UPDATE widget_tokens SET expires=0 WHERE id=?').run(expired.id);
    assert.equal(
      (
        await f.call('widgets/today', 'GET', undefined, '', {
          Authorization: 'Bearer ' + expired.token,
        })
      ).status,
      401,
    );
  } finally {
    await f.close();
  }
});

test('Claude sends only selected context, caches request IDs and enforces cost bounds without writes', async () => {
  const { db, identities } = unitDB();
  try {
    let calls = 0,
      captured;
    const key = 'synthetic-anthropic-key';
    const service = createAssistantService(db, {
      env: {
        ANTHROPIC_API_KEY: key,
        ANTHROPIC_MODEL: 'configured-test-model',
        ASSISTANT_FREE_DAILY_LIMIT: '2',
      },
      fetch: async (url, options) => {
        calls++;
        captured = JSON.parse(options.body);
        assert.equal(options.headers['x-api-key'], key);
        return json({
          stop_reason: 'tool_use',
          content: [
            { type: 'text', text: 'Review this task' },
            {
              type: 'tool_use',
              name: 'create_task',
              input: {
                title: 'Review API',
                area: 'Work',
                planned_date: '2026-10-28',
                estimate_minutes: 30,
              },
            },
          ],
        });
      },
    });
    const data = {
      'personal-os.tasks.v1': [task('work'), task('private-health', { category: 'Health' })],
      'personal-os.entries.v1': {
        entries: [
          { ...goal('work-memory'), kind: 'note', area: 'Work', detail: 'Prefer mornings' },
          {
            ...goal('private-memory'),
            kind: 'note',
            area: 'Health',
            detail: 'Private health detail',
          },
        ],
      },
    };
    const body = {
      requestId: randomUUID(),
      message: 'Plan work',
      language: 'ar',
      scope: 'Work',
      history: [{ role: 'user', text: 'client-forged-private-content' }],
    };
    const plan = await service.preview('owner', body, data);
    assert.equal(plan.actions[0].task.title, 'Review API');
    assert.doesNotMatch(
      JSON.stringify(captured),
      /private-health|Private health detail|client-forged-private-content/,
    );
    assert.match(JSON.stringify(captured), /Prefer mornings/);
    assert.doesNotMatch(JSON.stringify(plan), new RegExp(key));
    assert.deepEqual(await service.preview('owner', body, data), plan);
    assert.equal(calls, 1);
    await assert.rejects(
      service.preview('owner', { ...body, message: 'Changed' }, data),
      (error) => error.status === 409,
    );
    await service.preview('owner', { ...body, requestId: randomUUID() }, data);
    await assert.rejects(
      service.preview('owner', { ...body, requestId: randomUUID() }, data),
      (error) => error.status === 429,
    );
    assert.equal(db.prepare('SELECT count(*) AS n FROM workspace').get().n, 0);
  } finally {
    db.close();
  }
});
test('Claude rejects unsupported tools and stale context, and failed provider attempts still count toward budget', async () => {
  const { db } = unitDB();
  try {
    let data = { 'personal-os.tasks.v1': [task('work')] };
    const service = createAssistantService(db, {
      env: { ANTHROPIC_API_KEY: 'fake', ANTHROPIC_MODEL: 'fake', ASSISTANT_FREE_DAILY_LIMIT: '2' },
      getWorkspace: () => data,
      fetch: async () => {
        data = {
          'personal-os.tasks.v1': [
            task('work', { title: 'Changed while provider was responding' }),
          ],
        };
        return json({
          content: [
            {
              type: 'tool_use',
              name: 'update_task',
              input: { task_id: 'work', title: 'Old proposal' },
            },
          ],
        });
      },
    });
    await assert.rejects(
      service.preview(
        'owner',
        { requestId: randomUUID(), message: 'Rename task', language: 'en', scope: 'Work' },
        data,
      ),
      (error) => error.status === 502,
    );
    assert.equal(service.status('owner').used, 1);
    assert.equal(data['personal-os.tasks.v1'][0].title, 'Changed while provider was responding');
    const invalid = createAssistantService(db, {
      env: { ANTHROPIC_API_KEY: 'fake', ANTHROPIC_MODEL: 'fake' },
      fetch: async () =>
        json({
          content: [{ type: 'tool_use', name: 'run_shell', input: { command: 'anything' } }],
        }),
    });
    await assert.rejects(
      invalid.preview(
        'other',
        { requestId: randomUUID(), message: 'Do something', language: 'en', scope: 'all' },
        {},
      ),
      (error) => error.status === 502,
    );
  } finally {
    db.close();
  }
});
test('notification verification, subscription validation and scheduled delivery are scoped and idempotent', async () => {
  const { db, identities } = unitDB();
  try {
    const mail = [],
      push = [];
    const env = {
      SMTP_HOST: 'smtp.test.invalid',
      SMTP_FROM: 'dailgo@example.test',
      APP_ORIGIN: 'https://example.test',
      VAPID_PUBLIC_KEY: 'synthetic-public',
      VAPID_PRIVATE_KEY: 'synthetic-private',
      VAPID_SUBJECT: 'mailto:owner@example.test',
    };
    const service = createNotifications(db, identities, {
      env,
      sendMail: async (x) => mail.push(x),
      sendPush: async (x) => push.push(x),
    });
    service.settings('owner', {
      email: 'owner@example.test',
      emailEnabled: true,
      pushEnabled: true,
      morning: false,
      evening: false,
      tasks: true,
    });
    await service.requestVerification('owner');
    assert.equal(mail.length, 1);
    const token = mail[0].text.match(/verify-email#([\w-]+)/)[1];
    assert.equal(service.verify(token).verified, true);
    assert.throws(() => service.verify(token));
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/example',
      keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) },
    };
    assert.equal(validPushSubscription(subscription), true);
    assert.equal(
      validPushSubscription({ ...subscription, endpoint: 'https://127.0.0.1/private' }),
      false,
    );
    service.subscribe('owner', subscription);
    service.unsubscribe('other', subscription.endpoint);
    assert.equal(service.status('owner').subscriptions, 1);
    identities.save('owner', 'test', {
      'personal-os.tasks.v1': [
        task('t', { plannedDate: '2026-10-27', plannedTime: '10:00' }),
        task('completed', { plannedDate: '2026-10-27', done: true }),
      ],
      'personal-os.planning.v1': { timezone: 'Africa/Cairo' },
    });
    await service.tick(new Date('2026-10-27T09:00:00Z'));
    await service.tick(new Date('2026-10-27T09:01:00Z'));
    assert.equal(push.length, 1);
    assert.equal(mail.length, 2);
    assert.doesNotMatch(mail[1].text, /\bt\b/);
    service.settings('owner', { email: 'new@example.test' });
    assert.equal(service.status('owner').settings.verified, false);
  } finally {
    db.close();
  }
});
test('encrypted integration credentials reject tampering and wrong keys', () => {
  const a = secretBox('a'.repeat(64)),
    b = secretBox('b'.repeat(64));
  const sealed = a.seal({ refresh_token: 'synthetic-refresh' });
  assert.doesNotMatch(sealed, /synthetic-refresh/);
  assert.deepEqual(a.open(sealed), { refresh_token: 'synthetic-refresh' });
  assert.throws(() => b.open(sealed));
  assert.throws(() => a.open(sealed.slice(0, -4) + 'AAAA'));
  assert.equal(secretBox('bad').ready, false);
});
test('Google consent requires its one-time browser proof and a live initiating session; export IDs stay stable', async () => {
  const { db, identities } = unitDB();
  try {
    db.prepare('INSERT INTO sessions VALUES(?,?)').run('login-hash', Date.now() + 3600000);
    let created = 0,
      mode = 'normal';
    const fetchMock = async (url, options) => {
      if (url === 'https://oauth2.googleapis.com/token')
        return json({
          access_token: 'fake-access',
          refresh_token: 'fake-refresh',
          expires_in: 3600,
        });
      if (url === 'https://oauth2.googleapis.com/revoke') return new Response('', { status: 200 });
      if (url.includes('/events/') && options.method === 'PUT') {
        if (mode === 'fail') return json({}, 503);
        return created ? json({ id: 'stable-event-id' }) : json({}, 404);
      }
      if (url.endsWith('/events') && options.method === 'POST') {
        created++;
        return json({ id: JSON.parse(options.body).id });
      }
      if (url.includes('/events?')) return json({ items: [] });
      throw Error('unexpected-test-request');
    };
    const service = createCalendar(db, {
      env: {
        GOOGLE_CLIENT_ID: 'fake-client',
        GOOGLE_CLIENT_SECRET: 'fake-secret',
        APP_ORIGIN: 'https://example.test',
        INTEGRATION_ENCRYPTION_KEY: 'a'.repeat(64),
      },
      fetch: fetchMock,
    });
    const flow = service.start('owner', 'login-hash');
    const state = new URL(flow.url).searchParams.get('state');
    await assert.rejects(service.callback('X'.repeat(43), state, 'fake-code'));
    await service.callback(state, state, 'fake-code');
    assert.equal(service.status('owner').connected, true);
    assert.doesNotMatch(
      db.prepare('SELECT credentials FROM google_connections').get().credentials,
      /fake-refresh|fake-access/,
    );
    await assert.rejects(service.callback(state, state, 'fake-code'));
    const entry = {
      ...goal('event'),
      kind: 'event',
      date: '2026-10-27',
      time: '14:00',
      revision: 'current',
    };
    const data = {
      'personal-os.entries.v1': { entries: [entry] },
      'personal-os.planning.v1': { timezone: 'Africa/Cairo' },
    };
    await service.exportEvent('owner', { entryId: 'event', entryRevision: 'current' }, data);
    await service.exportEvent('owner', { entryId: 'event', entryRevision: 'current' }, data);
    assert.equal(created, 1);
    mode = 'fail';
    await assert.rejects(
      service.exportEvent('owner', { entryId: 'event', entryRevision: 'current' }, data),
    );
    assert.equal(created, 1);
    await assert.rejects(service.events('owner', { from: '2026-02-30', to: '2026-03-02' }));
    await service.disconnect('owner');
    assert.equal(service.status('owner').connected, false);
  } finally {
    db.close();
  }
});
test('Stripe entitlement requires a signed, current provider subscription and rejects forged or duplicate events', async () => {
  const { db } = unitDB();
  try {
    let checks = 0;
    const env = {
      BILLING_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'fake-secret',
      STRIPE_WEBHOOK_SECRET: 'fake-signing',
      STRIPE_PRICE_ID: 'price_test',
      APP_ORIGIN: 'https://example.test',
    };
    const service = createBilling(db, {
      env,
      fetch: async (url) => {
        checks++;
        assert.match(url, /subscriptions/);
        return json({
          id: 'sub_test',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 3600,
          items: { data: [{ price: { id: 'price_test' } }] },
        });
      },
    });
    db.prepare('INSERT INTO billing_customers VALUES(?,?)').run('owner', 'cus_test');
    const event = {
      id: 'evt_test',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_test', customer: 'cus_test' } },
    };
    const raw = Buffer.from(JSON.stringify(event)),
      stamp = Math.floor(Date.now() / 1000);
    const signature =
      't=' +
      stamp +
      ',v1=' +
      createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
        .update(stamp + '.')
        .update(raw)
        .digest('hex');
    await assert.rejects(service.webhook(raw, 't=' + stamp + ',v1=' + '0'.repeat(64)));
    assert.equal(service.isPro('owner'), false);
    await service.webhook(raw, signature);
    assert.equal(service.isPro('owner'), true);
    assert.equal(service.isPro('other'), false);
    await service.webhook(raw, signature);
    assert.equal(checks, 1);
    db.prepare('UPDATE billing_subscriptions SET until=0').run();
    assert.equal(service.isPro('owner'), false);
  } finally {
    db.close();
  }
});

test('integration key provisioning preserves existing secrets and supports private dry runs', () => {
  const folder = mkdtempSync(join(tmpdir(), 'dailgo-keys-test-'));
  const file = join(folder, 'service.env');
  try {
    writeFileSync(
      file,
      'APP_ORIGIN=https://example.test\nPERSONAL_OS_SETUP_TOKEN=synthetic-existing-secret\nBILLING_ENABLED=false\n',
      { mode: 0o600 },
    );
    const dry = provisionKeys(file, { dryRun: true });
    assert.equal(dry.changed, false);
    assert.equal(readdirSync(folder).length, 1);
    assert.doesNotMatch(readFileSync(file, 'utf8'), /VAPID_PRIVATE_KEY/);
    const changed = provisionKeys(file);
    assert.equal(changed.changed, true);
    const text = readFileSync(file, 'utf8');
    assert.match(text, /PERSONAL_OS_SETUP_TOKEN=synthetic-existing-secret/);
    assert.match(text, /BILLING_ENABLED=false/);
    assert.equal(provisionKeys(file).changed, false);
    assert.equal(readFileSync(file, 'utf8'), text);
    chmodSync(file, 0o644);
    assert.throws(() => provisionKeys(file), /0600/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('Claude total server budget and context size remain bounded across invited accounts', async () => {
  const { db } = unitDB();
  try {
    const service = createAssistantService(db, {
      env: {
        ANTHROPIC_API_KEY: 'synthetic',
        ANTHROPIC_MODEL: 'synthetic',
        ASSISTANT_SERVER_DAILY_LIMIT: '1',
      },
      fetch: async () => json({ content: [{ type: 'text', text: 'No changes proposed' }] }),
    });
    const request = {
      requestId: randomUUID(),
      message: 'Review my day',
      language: 'en',
      scope: 'all',
    };
    await service.preview('owner', request, {});
    await assert.rejects(
      service.preview('member', { ...request, requestId: randomUUID() }, {}),
      (error) => error.status === 429,
    );
    const entries = Array.from({ length: 50 }, (_, i) => ({
      ...goal('memory-' + i),
      kind: 'note',
      detail: 'Long scoped memory '.repeat(100),
    }));
    const context = assistantContext(
      { 'personal-os.entries.v1': { entries } },
      'Work',
      new Date(),
      4000,
    );
    assert.ok(JSON.stringify(context).length <= 4000);
    assert.equal(context.truncated, true);
  } finally {
    db.close();
  }
});

test('Claude decomposes an existing goal without replacing earlier milestones or orphaning newer tasks', () => {
  const initial = domain.auditWorkspace(
    {},
    {
      'personal-os.tasks.v1': [task('existing', { goalId: 'g', milestoneId: 'old-phase' })],
      'personal-os.entries.v1': {
        version: 2,
        demoVersion: 1,
        entries: [
          goal('g', {
            milestones: [{ id: 'old-phase', title: 'Existing phase', date: '2026-10-30' }],
          }),
        ],
      },
    },
  );
  const plan = domain.ai.makeAIPlan(initial, 'decompose-request', 'Work', 'Review phases', [
    {
      name: 'decompose_goal',
      input: {
        goal_id: 'g',
        milestones: [{ title: 'New phase', date: '2026-11-30' }],
        tasks: [{ title: 'First linked step', milestone_index: 0, estimate_minutes: 15 }],
      },
    },
  ]);
  assert.equal(plan.actions[0].kind, 'update_goal');
  const changed = domain.auditWorkspace(initial, domain.ai.applyAIPlan(initial, plan));
  assert.equal(changed['personal-os.entries.v1'].entries[0].milestones.length, 2);
  assert.equal(changed['personal-os.tasks.v1'][0].milestoneId, 'old-phase');
  const phase = changed['personal-os.entries.v1'].entries[0].milestones[1].id;
  assert.equal(changed['personal-os.tasks.v1'][1].milestoneId, phase);
  const undone = domain.ai.undoAIPlan(changed, plan);
  assert.equal(undone['personal-os.entries.v1'].entries[0].milestones.length, 1);
  const linked = {
    ...changed,
    'personal-os.tasks.v1': [
      ...changed['personal-os.tasks.v1'],
      task('later', { goalId: 'g', milestoneId: phase }),
    ],
  };
  assert.throws(() => domain.ai.undoAIPlan(linked, plan), /linked-phase/);
});

test('reading a missing or legacy workspace never inserts samples or archives the user’s goals', () => {
  assert.equal(domain.restoreWorkspace(null).entries.length, 0);
  const existing = goal('seed-goal-learning', { title: 'Build a consistent reading habit' });
  assert.deepEqual(domain.restoreWorkspace([existing]).entries, [existing]);
});

test('owner reviews partner comments and replacing the workspace forgets removed goal shares', async () => {
  const f = await fixture();
  try {
    const data = {
      'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: [goal('reviewed-goal')] },
    };
    const saved = await f.call('workspace', 'PUT', { revision: 'empty', data }, f.cookie);
    assert.equal(saved.status, 200);
    const share = (await f.call('shares', 'POST', { goalId: 'reviewed-goal' }, f.cookie)).body;
    assert.equal(
      (
        await f.call('public/goal', 'POST', {
          token: share.token,
          comment: 'Reviewed encouragement',
        })
      ).status,
      200,
    );
    const review = await f.call('shares/' + share.id, 'GET', undefined, f.cookie);
    assert.equal(review.status, 200);
    assert.equal(review.body.comments[0].text, 'Reviewed encouragement');
    assert.equal((await f.call('shares/' + share.id)).status, 401);
    assert.equal(
      (
        await f.call(
          'workspace',
          'PUT',
          {
            revision: saved.body.revision,
            data: { 'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: [] } },
          },
          f.cookie,
        )
      ).status,
      200,
    );
    assert.equal((await f.call('public/goal', 'POST', { token: share.token })).status, 404);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM goal_comments').get().n, 0);
  } finally {
    await f.close();
  }
});

test('Arabic planning defaults to Saturday without overwriting an explicitly saved week start', () => {
  assert.equal(domain.planningFor({}).weekStartsOn, 6);
  assert.equal(domain.planningFor({ 'personal-os.language': 'ar' }).weekStartsOn, 6);
  assert.equal(domain.planningFor({ 'personal-os.language': 'en' }).weekStartsOn, 1);
  assert.equal(
    domain.planningFor({
      'personal-os.language': 'ar',
      'personal-os.planning.v1': { weekStartsOn: 1, timezone: 'Africa/Cairo' },
    }).weekStartsOn,
    1,
  );
  assert.equal(domain.fmt.formatClockPart(1, 'ar'), '01');
});
