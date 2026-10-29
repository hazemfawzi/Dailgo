import { test, expect } from '@playwright/test';
const username = 'browser-fixture';
const password = 'browser-fixture-test-password';
async function signIn(page) {
  const status = await (await page.request.get('/api/account/status')).json();
  if (!status.configured) {
    await page.request.post('/api/account/setup', {
      headers: { Origin: 'http://127.0.0.1:5187' },
      data: { username, password },
    });
    await page.request.put('/api/workspace', {
      headers: { Origin: 'http://127.0.0.1:5187' },
      data: {
        revision: 'empty',
        data: {
          'personal-os.language': 'en',
          'personal-os.tasks.v1': [],
          'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: [] },
        },
      },
    });
    await page.request.post('/api/account/logout', {
      headers: { Origin: 'http://127.0.0.1:5187' },
      data: {},
    });
  }
  await page.goto('/');
  await page.getByLabel('اسم المستخدم').fill(username);
  await page.getByLabel('كلمة المرور (12 حرفًا على الأقل)').fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  const skip = page.getByRole('button', { name: /^(Skip setup|ابدأ بدون المعالج)$/ });
  await expect(
    page
      .getByRole('button', { name: /^(New task|مهمة جديدة)$/ })
      .or(skip)
      .first(),
  ).toBeVisible();
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(New task|مهمة جديدة)$/ })).toBeVisible();
}
async function createTask(page, title) {
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByLabel('Task title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function openAccountMenu(page) {
  const menu = page.locator('.account-menu');
  if ((await menu.getAttribute('open')) === null) await menu.locator('> summary').click();
}
async function openHomeSection(page, key) {
  const section = page.locator('details[data-home-section="' + key + '"]');
  if ((await section.getAttribute('open')) === null) await section.locator('> summary').click();
}
async function setWeekStart(page, value) {
  await page.getByRole('button', { name: /^(Data and backup|البيانات والنسخ الاحتياطي)$/ }).click();
  await page
    .getByRole('combobox', { name: /^(Week starts on|بداية الأسبوع)$/ })
    .selectOption(value);
  await page.getByRole('button', { name: 'Close / إغلاق', exact: true }).click();
}
test('account bootstrap, explicit local migration, automatic server saves, multiple devices, conflicts and offline failures', async ({
  page,
  browser,
}) => {
  const original = {
    version: 3,
    revision: 'local-fixture',
    data: {
      'personal-os.language': 'en',
      'personal-os.tasks.v1': [
        {
          id: 'local-task',
          title: 'Legacy browser task',
          category: 'Personal',
          done: false,
          archived: false,
        },
      ],
      'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: [] },
    },
  };
  await page.addInitScript((value) => {
    if (!localStorage.getItem('personal-os.workspace.v3'))
      localStorage.setItem('personal-os.workspace.v3', JSON.stringify(value));
  }, original);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'إنشاء الحساب الشخصي' })).toBeVisible();
  await page.getByLabel('اسم المستخدم').fill(username);
  await page.getByLabel('كلمة المرور (12 حرفًا على الأقل)').fill(password);
  await page.getByRole('button', { name: 'إنشاء الحساب', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ابدأ مساحة السيرفر' })).toBeVisible();
  await page.getByRole('button', { name: 'نقل نسخة المتصفح إلى السيرفر' }).click();
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toBeVisible();
  await createTask(page, 'Automatically saved task');
  await expect
    .poll(async () => {
      const r = await page.request.get('/api/workspace');
      return (await r.json()).data['personal-os.tasks.v1'].map((x) => x.title);
    })
    .toContain('Automatically saved task');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('personal-os.workspace.v3'))),
  ).toEqual(original);
  await page.reload();
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toBeVisible();
  const second = await browser.newContext();
  const device = await second.newPage();
  await signIn(device);
  await device.goto('/planner?tab=tasks');
  await expect(device.getByText('Automatically saved task', { exact: true }).first()).toBeVisible();
  // A second device edits the same record after this editor captured its revision.
  await page.getByRole('button', { name: 'Automatically saved task', exact: true }).first().click();
  await page.getByLabel('Task title', { exact: true }).fill('Must reject stale workspace');
  await device
    .getByRole('button', { name: 'Automatically saved task', exact: true })
    .first()
    .click();
  await device.getByLabel('Task title', { exact: true }).fill('Second device task');
  await device.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(device.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not save' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect
    .poll(async () => {
      const r = await page.request.get('/api/workspace');
      return (await r.json()).data['personal-os.tasks.v1'].map((x) => x.title);
    })
    .not.toContain('Must reject stale workspace');
  // Refresh a device using the same mechanism as the window-focus listener.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.goto('/planner?tab=tasks');
  await expect(page.getByText('Second device task', { exact: true }).first()).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toBeVisible();
  await page.route('**/api/workspace/changes', (route) => route.abort());
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByLabel('Task title', { exact: true }).fill('Never saved offline');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not save' })).toBeVisible();
  const offline = await (await page.request.get('/api/workspace')).json();
  expect(offline.data['personal-os.tasks.v1'].some((x) => x.title === 'Never saved offline')).toBe(
    false,
  );
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('personal-os.workspace.v3'))),
  ).toEqual(original);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.unroute('**/api/workspace/changes');
  await openAccountMenu(page);
  await page.getByRole('button', { name: 'Reconnect and review', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Saved ✓');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
  expect((await page.request.get('/api/workspace')).status()).toBe(401);
  await second.close();
});
test('goals, assistant confirmation, planning settings and backup restoration use the server workspace', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/life');
  await page.getByRole('button', { name: 'Create an item', exact: true }).first().click();
  await page.getByLabel('Title', { exact: true }).fill('Server-backed goal');
  await page.getByRole('button', { name: 'Save item', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return data['personal-os.entries.v1'].entries.map((x) => x.title);
    })
    .toContain('Server-backed goal');
  await page.goto('/assistant');
  await page.getByLabel('Your message', { exact: true }).fill('Task: Confirmed assistant task');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm action', exact: true }).click();
  await expect(
    page.locator('.action-result').filter({ hasText: 'Confirmed and saved' }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return data['personal-os.tasks.v1'].map((x) => x.title);
    })
    .toContain('Confirmed assistant task');
  await page.getByRole('button', { name: 'Data and backup', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Planning timezone', exact: true })
    .selectOption('America/New_York');
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return data['personal-os.planning.v1'].timezone;
    })
    .toBe('America/New_York');
  const backup = (await (await page.request.get('/api/workspace')).json()).data;
  const restored = structuredClone(backup);
  restored['personal-os.tasks.v1'].push({
    id: 'backup-restored',
    title: 'Task from restored backup',
    category: 'Personal',
    done: false,
    archived: false,
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'workspace-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'personal-os-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: restored,
      }),
    ),
  });
  await page.getByRole('button', { name: 'Confirm replacement', exact: true }).click();
  await expect(page.getByText('Restored successfully.', { exact: true })).toBeVisible();
  expect(
    (await (await page.request.get('/api/workspace')).json()).data['personal-os.tasks.v1'].some(
      (x) => x.id === 'backup-restored',
    ),
  ).toBe(true);
});
test('autosave keeps fast typing intact over a slow connection and expires sessions safely', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/workspace/changes', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.continue();
  });
  await openHomeSection(page, 'review');
  const field = page.getByRole('textbox', { name: 'What moved forward?', exact: true });
  await field.fill('');
  await field.pressSequentially('Quick review', { delay: 5 });
  await expect(field).toHaveValue('Quick review');
  await expect
    .poll(
      async () => {
        const data = (await (await page.request.get('/api/workspace')).json()).data;
        return Object.values(data['personal-os.reviews.v1'] ?? {}).some(
          (x) => x.wins === 'Quick review',
        );
      },
      { timeout: 10000 },
    )
    .toBe(true);
  await page.unroute('**/api/workspace/changes');
  await page.request.post('/api/account/logout', {
    headers: { Origin: 'http://127.0.0.1:5187' },
    data: {},
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toHaveCount(0);
});
async function seedUxWorkspace(page, language = 'en', extra = {}) {
  // Unmount the application before replacing fixture data so automatic default
  // initialization cannot race the test's explicit workspace replacement.
  await page.goto('about:blank');
  const snapshot = await (await page.request.get('/api/workspace')).json();
  const tasks = [
    {
      id: 'due-only',
      title: 'Deadline only',
      category: 'Work',
      done: false,
      archived: false,
      dueDate: '2026-10-27',
      estimate: 60,
    },
    {
      id: 'other-day',
      title: 'Deadline before execution',
      category: 'Work',
      done: false,
      archived: false,
      dueDate: '2026-10-27',
      plannedDate: '2026-10-28',
      estimate: 30,
    },
    {
      id: 'completed-goal-task',
      title: 'Completed goal task',
      category: 'Work',
      done: true,
      status: 'done',
      archived: false,
      goalId: 'review-goal',
    },
  ];
  const data = {
    'personal-os.language': language,
    'personal-os.dark': false,
    'personal-os.tasks.v1': tasks,
    'personal-os.entries.v1': {
      version: 2,
      demoVersion: 1,
      entries: [
        {
          id: 'review-goal',
          kind: 'goal',
          title: 'Goal نتيجة API',
          area: 'Work',
          detail: 'Review the result',
          date: '2026-12-31',
          time: '',
          progress: 0,
          archived: false,
          doneDates: [],
          successCriteria: 'Verified result',
          milestones: [],
        },
      ],
    },
    'personal-os.planning.v1': {
      weekStartsOn: 1,
      capacity: 240,
      buffer: 30,
      timezone: 'Africa/Cairo',
    },
    ...extra,
  };
  const response = await page.request.put('/api/workspace', {
    headers: { Origin: 'http://127.0.0.1:5187' },
    data: { revision: snapshot.revision, data },
  });
  expect(response.status()).toBe(200);
  await page.clock.setFixedTime(new Date('2026-10-27T09:00:00Z'));
  await page.goto('/');
  if (extra['personal-os.journey.v1']?.onboardingComplete === false) return;
  await expect(
    page.getByRole('button', { name: language === 'ar' ? 'مهمة جديدة' : 'New task', exact: true }),
  ).toBeVisible();
}
test('Arabic connection bar stays clear of the sidebar, follows dark mode and isolates mixed-direction chat text', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'ar');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const bar = page.locator('.server-connection');
  const sidebar = page.locator('.sidebar');
  const bounds = await bar.boundingBox();
  const side = await sidebar.boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(side.x + 1);
  await expect(page.getByRole('button', { name: 'تسجيل الخروج', exact: true })).not.toBeVisible();
  const light = await page
    .locator('.topbar')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByRole('button', { name: 'تغيير المظهر', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(
    await page.locator('.topbar').evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe(light);
  await page.goto('/assistant');
  await page.getByRole('textbox', { name: 'رسالتك', exact: true }).fill('عايز أذاكر بكرة الساعة 8');
  await page.getByRole('button', { name: 'إرسال الرسالة', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'عنوان المعاينة', exact: true })).toHaveValue(
    /أذاكر/,
  );
  await expect(page.getByLabel('يوم التنفيذ (اختياري)', { exact: true })).toHaveValue('28/10/2026');
  await expect(page.locator('.message-text').first()).toHaveAttribute('dir', 'auto');
  await expect(page.locator('.conversation-row>button>span').first()).toHaveAttribute(
    'dir',
    'auto',
  );
  await expect(page.locator('.chat-messages')).not.toContainText('ذاكرتك فارغة');
  await page.getByRole('button', { name: 'تأكيد الإجراء', exact: true }).click();
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return data['personal-os.tasks.v1'].some(
        (task) => task.title.includes('أذاكر') && task.plannedDate === '2026-10-28',
      );
    })
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await bar.boundingBox();
  expect(mobile.x).toBeGreaterThanOrEqual(0);
  expect(mobile.x + mobile.width).toBeLessThanOrEqual(391);
  await expect(page.locator('.sidebar')).not.toBeVisible();
});
test('due dates appear across calendar views and selection stays separate from task completion', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page);
  await expect(page.locator('.home-agenda')).toContainText('Deadline only');
  await expect(page.locator('.home-agenda')).toContainText('Due date');
  await page.goto('/planner?tab=calendar&date=2026-10-27');
  await expect(page.locator('.dated-tasks')).toContainText('Deadline only');
  await expect(page.locator('.dated-tasks')).toContainText('Deadline before execution');
  await expect(
    page.getByRole('button', { name: '27 Oct 2026 · 2 tasks', exact: true }),
  ).toBeVisible();
  await page.goto('/planner?tab=week&week=2026-10-27');
  await expect(page.locator('.week-due-tasks').filter({ hasText: 'Deadline only' })).toBeVisible();
  await page.goto('/planner?tab=tasks');
  await expect(
    page.getByRole('checkbox', { name: 'Select task: Deadline only', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Select tasks', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select task: Deadline only', exact: true }).check();
  let tasks = (await (await page.request.get('/api/workspace')).json()).data[
    'personal-os.tasks.v1'
  ];
  expect(tasks.find((task) => task.id === 'due-only').done).toBe(false);
  await page.getByRole('button', { name: 'Complete: Deadline only', exact: true }).click();
  await expect
    .poll(async () => {
      const tasks = (await (await page.request.get('/api/workspace')).json()).data[
        'personal-os.tasks.v1'
      ];
      return tasks.find((task) => task.id === 'due-only').done;
    })
    .toBe(true);
});
test('goal cards show target dates and outcome guidance while milestone and goal editors prevent invalid date ranges', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page);
  await page.goto('/life');
  const card = page.locator('.kind-goal');
  await expect(card.locator('time')).toHaveAttribute('datetime', '2026-12-31');
  await expect(card).toContainText('65 days left');
  await expect(card).toContainText('Tasks complete. Review success criteria');
  await page.getByRole('link', { name: 'Goal نتيجة API', exact: true }).click();
  await expect(page.locator('.outcome-evidence')).toContainText('All linked tasks are complete.');
  await page.getByRole('button', { name: 'Add milestone', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Milestone title', exact: true })
    .fill('Milestone deadline');
  const milestoneDate = page.getByLabel('Target date (optional)', { exact: true });
  await expect(milestoneDate).not.toHaveAttribute('max');
  await milestoneDate.fill('2027-06-01');
  await expect(page.getByRole('button', { name: 'Save milestone', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('This milestone is after the goal target');
  await page
    .getByRole('checkbox', { name: 'Keep this milestone after the goal target', exact: true })
    .check();
  await expect(page.getByRole('button', { name: 'Save milestone', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save milestone', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit goal', exact: true }).click();
  await page.getByLabel('Target date (optional)', { exact: true }).fill('2026-11-01');
  await expect(page.getByRole('button', { name: 'Save goal', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Some milestones are after this target');
  await page
    .getByRole('button', { name: 'Extend goal to the last milestone', exact: true })
    .click();
  await expect(page.getByLabel('Target date (optional)', { exact: true })).toHaveValue(
    '2027-06-01',
  );
  await expect(page.getByRole('button', { name: 'Save goal', exact: true })).toBeEnabled();
});
test('a completed goal closes only after explicit outcome confirmation', async ({ page }) => {
  await signIn(page);
  await seedUxWorkspace(page);
  await page.goto('/life/review-goal');
  await page.getByRole('button', { name: 'Confirm outcome and close goal', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Goal outcome confirmed and goal closed' }),
  ).toBeVisible();
  const workspace = (await (await page.request.get('/api/workspace')).json()).data;
  const goal = workspace['personal-os.entries.v1'].entries.find((x) => x.id === 'review-goal');
  expect(goal.archived).toBe(true);
  expect(goal.outcomeAchieved).toBe(true);
});
test('task deletion supports restore, export and permanent removal without changing the downloaded backup', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page);
  await page.goto('/planner?tab=tasks');
  async function remove() {
    await page.getByRole('button', { name: 'Delete: Deadline only', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect
      .poll(async () => {
        const data = (await (await page.request.get('/api/workspace')).json()).data;
        return data['personal-os.trash.v1']?.some((x) => x.item.id === 'due-only');
      })
      .toBe(true);
  }
  await remove();
  await page.getByRole('button', { name: 'Data and backup', exact: true }).click();
  await page
    .locator('.trash-item')
    .filter({ hasText: 'Deadline only' })
    .getByRole('button', { name: 'Restore', exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return data['personal-os.tasks.v1'].some((x) => x.id === 'due-only');
    })
    .toBe(true);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export backup', exact: true }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.format).toBe('personal-os-backup');
  expect(backup.data['personal-os.tasks.v1'].some((x) => x.id === 'due-only')).toBe(true);
  await page.getByRole('button', { name: 'Close / إغلاق', exact: true }).click();
  await remove();
  await page.getByRole('button', { name: 'Data and backup', exact: true }).click();
  await page
    .locator('.trash-item')
    .filter({ hasText: 'Deadline only' })
    .getByRole('button', { name: 'Delete forever', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm permanent deletion', exact: true }).click();
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return data['personal-os.trash.v1'].some((x) => x.item.id === 'due-only');
    })
    .toBe(false);
  expect(backup.data['personal-os.tasks.v1'].some((x) => x.id === 'due-only')).toBe(true);
});
test('routine check-ins persist and linked focus sessions record paused and elapsed time without duplicate logs', async ({
  page,
}) => {
  await signIn(page);
  const routine = {
    id: 'routine-test',
    kind: 'routine',
    title: 'Practice routine',
    area: 'Learning',
    detail: '',
    date: '',
    time: '08:00',
    progress: 0,
    archived: false,
    doneDates: [],
    routineDays: [2],
  };
  await seedUxWorkspace(page, 'en', {
    'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: [routine] },
  });
  await openHomeSection(page, 'focus');
  const routineButton = page.getByRole('button', { name: /Practice routine/ });
  await routineButton.click();
  await expect(routineButton).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return data['personal-os.entries.v1'].entries[0].doneDates;
    })
    .toEqual(['2026-10-27']);
  await openHomeSection(page, 'focus');
  await page.getByRole('combobox', { name: 'Focus task', exact: true }).selectOption('due-only');
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return typeof data['personal-os.focus.v1'].ends;
    })
    .toBe('number');
  await page.clock.setFixedTime(new Date('2026-10-27T09:00:25Z'));
  await page.getByRole('button', { name: 'Pause and record', exact: true }).click();
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return data['personal-os.sessions.v1']?.map((x) => ({
        taskId: x.taskId,
        seconds: x.seconds,
      }));
    })
    .toEqual([{ taskId: 'due-only', seconds: 25 }]);
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return typeof data['personal-os.focus.v1'].ends;
    })
    .toBe('number');
  await page.clock.setFixedTime(new Date('2026-10-27T09:30:00Z'));
  await expect
    .poll(async () => {
      const data = (await (await page.request.get('/api/workspace')).json()).data;
      return data['personal-os.sessions.v1']?.length;
    })
    .toBe(2);
  await page.reload();
  await expect(routineButton).toHaveAttribute('aria-pressed', 'true');
  expect(
    (await (await page.request.get('/api/workspace')).json()).data['personal-os.sessions.v1'],
  ).toHaveLength(2);
});
test('Arabic mobile screens and capture dialog fit the viewport', async ({ page }) => {
  await signIn(page);
  await seedUxWorkspace(page, 'ar');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    '/',
    '/planner?tab=tasks',
    '/planner?tab=week&week=2026-10-27',
    '/planner?tab=calendar&date=2026-10-27',
    '/life',
    '/life/review-goal',
    '/memory',
    '/assistant',
    '/tools?tab=finance',
    '/tools?tab=family',
    '/tools?tab=connections',
    '/tools?tab=pro',
    '/today',
  ]) {
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const width = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(width.document, route).toBeLessThanOrEqual(width.viewport + 1);
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'تسجيل سريع', exact: true }).click();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
});
test('password change keeps the current session and revokes the other device', async ({
  page,
  browser,
}) => {
  await signIn(page);
  await seedUxWorkspace(page);
  const other = await browser.newContext();
  const device = await other.newPage();
  await signIn(device);
  const replacement = 'browser-fixture-replacement-password';
  let changed = false;
  try {
    await openAccountMenu(page);
    await page.locator('.account-panel details > summary').click();
    await page.getByLabel('Current password', { exact: true }).fill(password);
    await page.getByLabel('New password', { exact: true }).fill(replacement);
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/account/password') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    changed = true;
    expect((await (await page.request.get('/api/account/status')).json()).signedIn).toBe(true);
    expect((await device.request.get('/api/workspace')).status()).toBe(401);
    await device.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(device.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
  } finally {
    if (changed) {
      const response = await page.request.post('/api/account/password', {
        headers: { Origin: 'http://127.0.0.1:5187' },
        data: { currentPassword: replacement, newPassword: password },
      });
      expect(response.status()).toBe(200);
    }
    await other.close();
  }
});

const completeJourney = {
  version: 1,
  onboardingComplete: true,
  areas: ['Work', 'Learning'],
  wakeTime: '07:00',
  eveningTime: '20:00',
  focusDate: '',
  focusIds: [],
};
async function workspace(page) {
  return (await (await page.request.get('/api/workspace')).json()).data;
}
test('three-step onboarding saves reviewed preferences, one goal and three tasks once', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', {
    'personal-os.tasks.v1': [],
    'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: [] },
    'personal-os.journey.v1': { ...completeJourney, onboardingComplete: false, areas: [] },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole('checkbox', { name: 'Work', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'Learning', exact: true }).check();
  await dialog.getByLabel('Wake-up time', { exact: true }).fill('06:30');
  await dialog.getByRole('combobox', { name: 'Week starts on', exact: true }).selectOption('6');
  await dialog.getByRole('checkbox', { name: 'Dark theme', exact: true }).check();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog
    .getByRole('combobox', { name: 'Starting template', exact: true })
    .selectOption('language');
  await dialog.getByLabel('Your first goal', { exact: true }).fill('Learn conversational Arabic');
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.getByLabel('First task 1', { exact: true })).not.toHaveValue('');
  await dialog.getByRole('button', { name: 'Create my starting plan', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () => {
      const data = await workspace(page);
      return [
        data['personal-os.tasks.v1'].length,
        data['personal-os.entries.v1'].entries.length,
        data['personal-os.journey.v1'].wakeTime,
        data['personal-os.planning.v1'].weekStartsOn,
        data['personal-os.dark'],
      ];
    })
    .toEqual([3, 1, '06:30', 6, true]);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await workspace(page))['personal-os.tasks.v1']).toHaveLength(3);
});
test('morning focus choices show capacity and preserve deadlines with explicit overdue decisions', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', {
    'personal-os.journey.v1': completeJourney,
    'personal-os.planning.v1': {
      weekStartsOn: 1,
      capacity: 60,
      buffer: 10,
      timezone: 'Africa/Cairo',
    },
    'personal-os.tasks.v1': [
      {
        id: 'a',
        title: 'Overdue call',
        category: 'Work',
        done: false,
        archived: false,
        dueDate: '2026-10-26',
        estimate: 40,
      },
      {
        id: 'b',
        title: 'Study',
        category: 'Learning',
        done: false,
        archived: false,
        dueDate: '2026-10-27',
        estimate: 40,
      },
      { id: 'c', title: 'Read', category: 'Learning', done: false, archived: false, estimate: 40 },
      { id: 'd', title: 'Walk', category: 'Health', done: false, archived: false, estimate: 40 },
    ],
  });
  await openHomeSection(page, 'planning');
  for (const title of ['Overdue call', 'Study', 'Read'])
    await page.getByRole('checkbox', { name: 'Focus choice: ' + title, exact: true }).check();
  await expect(
    page.getByRole('checkbox', { name: 'Focus choice: Walk', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('.capacity-summary')).toContainText('over capacity');
  await page.getByRole('button', { name: 'Start my day (3/3)', exact: true }).click();
  await expect
    .poll(async () => {
      const data = await workspace(page);
      return data['personal-os.journey.v1'].focusIds;
    })
    .toEqual(['a', 'b', 'c']);
  const tasks = (await workspace(page))['personal-os.tasks.v1'];
  expect(tasks[0].dueDate).toBe('2026-10-26');
  expect(tasks.slice(0, 3).every((task) => task.plannedDate === '2026-10-27')).toBe(true);
  await page.reload();
  await openHomeSection(page, 'planning');
  await expect(
    page.getByRole('button', { name: 'Review today’s plan', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Review today’s plan', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Focus choice: Study', exact: true }),
  ).toBeChecked();
});
test('natural quick capture previews time and area, and shortcuts respect typing and compact task forms', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await page.getByRole('button', { name: 'Quick capture', exact: true }).click();
  await page
    .getByLabel('What is on your mind?', { exact: true })
    .fill('اتصل بأحمد بكرة 4 العصر #شغل');
  await page.getByRole('button', { name: 'Review items', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByLabel('Planned day (optional, not a deadline)', { exact: true }),
  ).toHaveValue('2026-10-28');
  await expect(
    dialog.getByLabel('Execution time (optional, 24 hour)', { exact: true }),
  ).toHaveValue('16:00');
  await expect(dialog.getByRole('combobox', { name: 'Life area', exact: true })).toHaveValue(
    'Work',
  );
  await dialog.getByRole('button', { name: 'Confirm 1 item', exact: true }).click();
  await expect(dialog).toContainText('Saved together, once.');
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 500, y: 80 } });
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog').getByLabel('Task title', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByLabel('Description', { exact: true }),
  ).not.toBeVisible();
  await page.getByRole('dialog').getByLabel('Task title', { exact: true }).fill('f/n typed text');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 500, y: 80 } });
  await page.keyboard.press('/');
  await expect(page.getByLabel('Global search', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 500, y: 80 } });
  await page.keyboard.press('f');
  await expect(page.getByRole('combobox', { name: 'Focus task', exact: true })).toBeFocused();
  const saved = (await workspace(page))['personal-os.tasks.v1'].find((task) =>
    task.title.includes('بأحمد'),
  );
  expect(saved).toMatchObject({
    plannedDate: '2026-10-28',
    plannedTime: '16:00',
    category: 'Work',
    tags: ['شغل'],
  });
});
test('saved task completion and archive offer undo without overwriting newer edits', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await page.goto('/planner?tab=tasks&filter=all');
  await page.getByRole('button', { name: 'Complete: Deadline only', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => {
      return (await workspace(page))['personal-os.tasks.v1'].find((task) => task.id === 'due-only')
        .done;
    })
    .toBe(false);
  await page.getByRole('button', { name: 'Archive: Deadline only', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => {
      return (await workspace(page))['personal-os.tasks.v1'].find((task) => task.id === 'due-only')
        .archived;
    })
    .toBe(false);
  await page.getByRole('button', { name: 'Complete: Deadline only', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  const snapshot = await (await page.request.get('/api/workspace')).json();
  const changed = {
    ...snapshot.data,
    'personal-os.tasks.v1': snapshot.data['personal-os.tasks.v1'].map((task) =>
      task.id === 'due-only' ? { ...task, title: 'Newer task edit' } : task,
    ),
  };
  expect(
    (
      await page.request.put('/api/workspace/commit', {
        headers: { Origin: 'http://127.0.0.1:5187' },
        data: { revision: snapshot.revision, data: changed },
      })
    ).status(),
  ).toBe(200);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByRole('button', { name: 'Complete: Newer task edit', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.undo-notice')).toContainText('Could not undo');
  expect(
    (await workspace(page))['personal-os.tasks.v1'].find((task) => task.id === 'due-only'),
  ).toMatchObject({ done: true, title: 'Newer task edit' });
});
test('evening review rolls only selected tasks and weekly review saves three results with a six-area radar', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await page.clock.setFixedTime(new Date('2026-10-27T19:00:00Z'));
  await page.reload();
  await expect(page.getByRole('link', { name: 'Open evening review', exact: true })).toBeVisible();
  await openHomeSection(page, 'review');
  const review = page.locator('#daily-review');
  await review.locator('summary').click();
  await review.getByRole('checkbox', { name: 'Move tomorrow: Deadline only', exact: true }).check();
  await review
    .getByRole('button', { name: 'Confirm selected tasks for tomorrow', exact: true })
    .click();
  await review.getByRole('button', { name: 'Mood 4', exact: true }).click();
  await review.getByLabel('Evening note', { exact: true }).fill('Useful focused day');
  await review.getByRole('button', { name: 'Finish evening review', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open evening review', exact: true })).toHaveCount(0);
  await expect
    .poll(async () => {
      const data = await workspace(page);
      return data['personal-os.reviews.v1']?.['2026-10-27']?.note;
    })
    .toBe('Useful focused day');
  const data = await workspace(page);
  expect(data['personal-os.reviews.v1']['2026-10-27'].mood).toBe(4);
  expect(data['personal-os.tasks.v1'].find((task) => task.id === 'due-only')).toMatchObject({
    plannedDate: '2026-10-28',
    dueDate: '2026-10-27',
  });
  await page.goto('/planner?tab=week&week=2026-10-27&review=1');
  await page.getByRole('button', { name: 'Next review step', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Life areas recorded activity radar', exact: true }),
  ).toBeVisible();
  expect(await page.locator('.area-activity button').count()).toBe(6);
  await page.getByRole('button', { name: 'Next review step', exact: true }).click();
  for (let i = 1; i <= 3; i++)
    await page.getByLabel('Next week result ' + i, { exact: true }).fill('Next result ' + i);
  // Keep the new week absent during the first read, as on a slower CI connection.
  // A polling assertion must tolerate its absence until the commit is acknowledged.
  await page.route('**/api/workspace/changes', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Save three results for next week', exact: true }).click();
  await expect
    .poll(async () => {
      const saved = await workspace(page);
      return saved['personal-os.weeks.v1']?.['2026-11-02']?.outcomes.map((item) => item.title);
    })
    .toEqual(['Next result 1', 'Next result 2', 'Next result 3']);
});
test('elapsed focus asks before completion, records once, and accepts an explicit answer', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await openHomeSection(page, 'focus');
  const focus = page.locator('#daily-focus');
  await focus.getByRole('combobox', { name: 'Focus task', exact: true }).selectOption('due-only');
  await focus.getByRole('button', { name: 'Start focus', exact: true }).click();
  await expect
    .poll(async () => typeof (await workspace(page))['personal-os.focus.v1'].ends)
    .toBe('number');
  await page.clock.setFixedTime(new Date('2026-10-27T09:25:01Z'));
  await expect(
    focus.getByRole('group', { name: 'Focus completion question', exact: true }),
  ).toBeVisible();
  expect(
    (await workspace(page))['personal-os.tasks.v1'].find((task) => task.id === 'due-only').done,
  ).toBe(false);
  await page.reload();
  await expect(
    focus.getByRole('group', { name: 'Focus completion question', exact: true }),
  ).toBeVisible();
  expect((await workspace(page))['personal-os.sessions.v1']).toHaveLength(1);
  await focus.getByRole('button', { name: 'Yes, mark complete', exact: true }).click();
  await expect(
    focus.getByRole('group', { name: 'Focus completion question', exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(async () => {
      const data = await workspace(page);
      return [
        data['personal-os.tasks.v1'].find((task) => task.id === 'due-only').done,
        data['personal-os.sessions.v1'].length,
        data['personal-os.sessions.v1'][0].seconds,
      ];
    })
    .toEqual([true, 1, 1500]);
});
test('overdue Today, Defer and Cancel decisions preserve the original due dates', async ({
  page,
}) => {
  await signIn(page);
  const tasks = ['a', 'b', 'c'].map((id) => ({
    id,
    title: 'Late ' + id,
    category: 'Work',
    done: false,
    archived: false,
    dueDate: '2026-10-26',
  }));
  await seedUxWorkspace(page, 'en', {
    'personal-os.journey.v1': completeJourney,
    'personal-os.tasks.v1': tasks,
  });
  await openHomeSection(page, 'planning');
  await page.locator('.daily-cycle summary').click();
  const rows = page.locator('.overdue-choice');
  await rows
    .filter({ hasText: 'Late a' })
    .getByRole('button', { name: 'Today', exact: true })
    .click();
  await rows
    .filter({ hasText: 'Late b' })
    .getByRole('button', { name: 'Defer', exact: true })
    .click();
  await page.getByLabel('Deferred task date', { exact: true }).fill('2026-10-30');
  await page.getByRole('button', { name: 'Confirm defer', exact: true }).click();
  await rows
    .filter({ hasText: 'Late c' })
    .getByRole('button', { name: 'Cancel task', exact: true })
    .click();
  await expect
    .poll(async () => {
      const all = (await workspace(page))['personal-os.tasks.v1'];
      return all.map((task) => [task.plannedDate ?? '', task.status ?? 'todo', task.dueDate]);
    })
    .toEqual([
      ['2026-10-27', 'todo', '2026-10-26'],
      ['2026-10-30', 'deferred', '2026-10-26'],
      ['', 'cancelled', '2026-10-26'],
    ]);
});

test('Arabic numbers, goal dates and week starts stay consistent across Home, calendar and weekly planning', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'ar', {
    'personal-os.journey.v1': completeJourney,
    'personal-os.planning.v1': {
      weekStartsOn: 6,
      capacity: 240,
      buffer: 30,
      timezone: 'Africa/Cairo',
    },
  });
  await expect(page.locator('.daily-cycle')).toContainText('الروتين: 0');
  await expect(page.locator('.daily-cycle')).not.toContainText(/[٠-٩۰-۹]/);
  await page.goto('/life');
  await expect(page.locator('.entry-target-date')).toContainText('فاضل 65 يوم');
  await expect(page.locator('.life-area').filter({ hasText: 'العمل' })).not.toContainText(
    '1 أهداف',
  );
  await page.goto('/life/review-goal');
  await expect(page.locator('.goal-date')).toContainText('31 ديسمبر 2026');
  await expect(page.locator('.goal-date')).not.toContainText('2026-12-31');
  await page.goto('/planner?tab=week&week=2026-10-27');
  await expect(page.locator('.week-header')).toContainText('24');
  await expect(page.locator('.week-day').first().locator('.week-day-heading')).toContainText(
    'السبت',
  );
  await expect(page.locator('.week-day').first().locator('.week-day-heading')).toContainText(
    '24 أكتوبر',
  );
  await page.goto('/planner?tab=calendar&date=2026-10-27');
  await expect(page.locator('.weekday').first()).toHaveText('سب');
});
test('Arabic slash and assistant shortcuts work while ordinary text editing remains intact', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'ar', { 'personal-os.journey.v1': completeJourney });
  await page.locator('body').click({ position: { x: 500, y: 80 } });
  await page.keyboard.press('/');
  await expect(page.getByLabel('البحث الموحد', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  const input = page.getByRole('textbox', { name: 'اسأل مساعدك', exact: true });
  await input.fill('نص / ثابت');
  await input.press('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await input.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'المساعد والتغييرات', exact: true })).toBeVisible();
  await expect(page.getByLabel('رسالتك', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'سجل التغييرات', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('التغييرات');
  await page.keyboard.press('Escape');
});
test('weekly recurring task creates one next occurrence and completion undo removes it', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task title', { exact: true }).fill('Weekly recurring review');
  await dialog.getByLabel('Due date', { exact: true }).fill('2026-10-27');
  await dialog.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('weekly');
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/planner?tab=tasks');
  await page
    .getByRole('button', { name: 'Complete: Weekly recurring review', exact: true })
    .click();
  await expect
    .poll(async () => {
      const tasks = (await workspace(page))['personal-os.tasks.v1'];
      return tasks
        .filter((x) => x.title === 'Weekly recurring review')
        .map((x) => ({ done: x.done, due: x.dueDate }));
    })
    .toEqual([
      { done: true, due: '2026-10-27' },
      { done: false, due: '2026-11-03' },
    ]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => {
      const tasks = (await workspace(page))['personal-os.tasks.v1'].filter(
        (x) => x.title === 'Weekly recurring review',
      );
      return tasks.map((x) => x.done);
    })
    .toEqual([false]);
});
test('finance records, savings, prayer preferences and insights persist through the server', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await page.goto('/tools?tab=finance');
  await page.getByLabel('Monthly budget', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await page.getByLabel('Expense title', { exact: true }).fill('Books');
  await page.getByLabel('Amount', { exact: true }).fill('10.25');
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await expect
    .poll(async () => {
      return (await workspace(page))['personal-os.finance.v1']?.expenses?.[0]?.cents;
    })
    .toBe(1025);
  await page.getByLabel('Saving goal name', { exact: true }).fill('Emergency fund');
  await page.getByLabel('Target amount', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Add savings goal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Emergency fund', exact: true })).toBeVisible();
  await page.getByLabel('Record saved amount', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Record deposit', exact: true }).click();
  await expect
    .poll(async () => {
      return (await workspace(page))['personal-os.finance.v1']?.savings?.[0]?.saved;
    })
    .toBe(2000);
  await page.goto('/tools?tab=prayer');
  await page.getByRole('checkbox', { name: 'Show prayer breaks in my day', exact: true }).check();
  await expect(page.locator('.prayer-grid>div')).toHaveCount(6);
  await expect
    .poll(async () => {
      return (await workspace(page))['personal-os.prayer.v1']?.enabled;
    })
    .toBe(true);
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: 'Show prayer breaks in my day', exact: true }),
  ).toBeChecked();
  await page.goto('/tools?tab=insights');
  await expect(page.locator('.insight-area')).toHaveCount(6);
});
test('voice dictation is reviewed through the same natural task parser', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: 'اتصل بأحمد بكرة ٤ العصر #شغل' }]] });
          this.onend?.();
        }, 10);
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    };
  });
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await page.getByRole('button', { name: 'Quick capture', exact: true }).click();
  await page.getByRole('button', { name: 'Dictate a task or note', exact: true }).click();
  await expect(page.getByLabel('What is on your mind?', { exact: true })).toHaveValue(
    'اتصل بأحمد بكرة ٤ العصر #شغل',
  );
  await page.getByRole('button', { name: 'Review items', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByLabel('Execution time (optional, 24 hour)', { exact: true }),
  ).toHaveValue('16:00');
  await expect(dialog.getByRole('combobox', { name: 'Life area', exact: true })).toHaveValue(
    'Work',
  );
  await expect(dialog.getByRole('button', { name: 'Confirm 1 item', exact: true })).toBeVisible();
});
test('family invitations create a separate personal account and share household tasks only', async ({
  page,
  browser,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await page.goto('/tools?tab=family');
  await page.getByLabel('Family space name', { exact: true }).fill('Household browser test');
  await page.getByRole('button', { name: 'Create family space', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Household browser test', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create one-use invitation', exact: true }).click();
  const invite = await page.locator('.tools-secret-link').getAttribute('href');
  const context = await browser.newContext();
  const member = await context.newPage();
  try {
    await member.goto(invite);
    await member.getByLabel('اسم المستخدم', { exact: true }).fill('member-' + Date.now());
    await member
      .getByLabel('كلمة المرور (12 حرفًا على الأقل)', { exact: true })
      .fill('browser-member-password');
    await member.getByRole('button', { name: 'إنشاء الحساب والانضمام', exact: true }).click();
    await expect(
      member.getByRole('button', { name: 'ابدأ بدون المعالج', exact: true }),
    ).toBeVisible();
    await member.getByRole('button', { name: 'ابدأ بدون المعالج', exact: true }).click();
    await expect(
      member.getByRole('heading', { name: 'Household browser test', exact: true }),
    ).toBeVisible();
    await member.getByLabel('عنوان المهمة المشتركة', { exact: true }).fill('مهمة البيت');
    await member.getByRole('button', { name: 'إضافة مهمة مشتركة', exact: true }).click();
    await expect(member.getByText('مهمة البيت', { exact: true })).toBeVisible();
    expect((await workspace(member))['personal-os.tasks.v1']).toHaveLength(0);
    expect(
      (await workspace(page))['personal-os.tasks.v1'].some((x) => x.title === 'مهمة البيت'),
    ).toBe(false);
    // SSE refreshes the shared board without a page reload.
    await expect(page.getByText('مهمة البيت', { exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: 'Complete shared task: مهمة البيت', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Undo shared change', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Undo shared change', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Complete shared task: مهمة البيت', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export shared tasks', exact: true }).click();
    const exported = await downloadEvent;
    await page.locator('input[type=file]').setInputFiles(await exported.path());
    await expect(
      page.getByRole('dialog', { name: 'Review family task copies', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Confirm shared task copies', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Complete shared task: مهمة البيت', exact: true }),
    ).toHaveCount(2);
    expect(
      (await workspace(page))['personal-os.tasks.v1'].some((x) => x.title === 'مهمة البيت'),
    ).toBe(false);
  } finally {
    await context.close();
  }
});
test('Claude tools stay as proposals until confirmation and support undo in the conversation', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({ json: { enabled: true, remaining: 20, limit: 20 } }),
  );
  await page.route('**/api/assistant/preview', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: {
        id: body.requestId,
        scope: body.scope,
        summary: 'Review the study task for tomorrow at 20:00.',
        createdAt: '2026-10-27T09:00:00Z',
        actions: [
          {
            kind: 'create_task',
            task: {
              id: 'ai:' + body.requestId + ':0',
              title: 'Study tomorrow',
              category: 'Learning',
              done: false,
              archived: false,
              plannedDate: '2026-10-28',
              plannedTime: '20:00',
              estimate: 30,
            },
          },
        ],
      },
    });
  });
  await page.getByLabel('Ask your assistant', { exact: true }).fill('عايز أذاكر بكرة الساعة 8');
  await page.getByRole('button', { name: 'Send to assistant', exact: true }).click();
  await expect(page.getByLabel('Your message', { exact: true })).toHaveValue(
    'عايز أذاكر بكرة الساعة 8',
  );
  await expect(page.locator('.chat-message.assistant')).toHaveCount(0);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Assistant settings', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Assistant mode', exact: true })).toHaveValue(
    'claude',
  );
  await page
    .getByRole('checkbox', { name: 'Allow sharing this selected context with Claude', exact: true })
    .check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByLabel('Your message', { exact: true }).fill('عايز أذاكر بكرة الساعة 8');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Confirm Claude proposal', exact: true }),
  ).toBeVisible();
  expect(
    (await workspace(page))['personal-os.tasks.v1'].some((x) => x.title === 'Study tomorrow'),
  ).toBe(false);
  await page.getByRole('button', { name: 'Confirm Claude proposal', exact: true }).click();
  await expect
    .poll(async () => {
      return (await workspace(page))['personal-os.tasks.v1'].some(
        (x) => x.title === 'Study tomorrow' && x.plannedTime === '20:00',
      );
    })
    .toBe(true);
  await page.getByRole('button', { name: 'Undo Claude changes', exact: true }).click();
  await expect
    .poll(async () => {
      return (await workspace(page))['personal-os.tasks.v1'].some(
        (x) => x.title === 'Study tomorrow',
      );
    })
    .toBe(false);
});
test('widget tokens are revocable and unconfigured external services do not offer live actions', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await page.goto('/tools?tab=widgets');
  await page.getByRole('button', { name: 'Create read-only widget token', exact: true }).click();
  const token = await page.locator('code.tools-secret-link').textContent();
  expect(token).toMatch(/^[\w-]{43}$/);
  const response = await page.request.get('/api/widgets/today', {
    headers: { Authorization: 'Bearer ' + token },
  });
  expect(response.status()).toBe(200);
  await page.getByRole('button', { name: 'Revoke widget device', exact: true }).click();
  await expect
    .poll(async () => {
      return (
        await page.request.get('/api/widgets/today', {
          headers: { Authorization: 'Bearer ' + token },
        })
      ).status();
    })
    .toBe(401);
  await page.goto('/tools?tab=connections');
  await expect(
    page.getByRole('button', { name: 'Connect Google Calendar', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Register this device for Push', exact: true }),
  ).toBeDisabled();
  await page.goto('/tools?tab=pro');
  await expect(page.getByRole('button', { name: 'Open Pro checkout', exact: true })).toBeDisabled();
});
test('switching accounts in another tab stops the old tab before it can save into the new workspace', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  const space = await page.request.post('/api/family', {
    headers: { Origin: 'http://127.0.0.1:5187' },
    data: { title: 'Account switch test' },
  });
  expect(space.status()).toBe(200);
  const spaceId = (await space.json()).id;
  const invite = await page.request.post('/api/family/' + spaceId + '/invite', {
    headers: { Origin: 'http://127.0.0.1:5187' },
    data: {},
  });
  const token = (await invite.json()).token;
  const member = 'switch-member-' + Date.now();
  const accepted = await page.request.post('/api/account/accept-invite', {
    headers: { Origin: 'http://127.0.0.1:5187' },
    data: { token, username: member, password: 'switch-member-password' },
  });
  expect(accepted.status()).toBe(201);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toHaveCount(0);
  const data = (await (await page.request.get('/api/workspace')).json()).data;
  expect(data['personal-os.tasks.v1']).toHaveLength(0);
});
test('goal templates remain available after onboarding and add only a reviewed goal and its tasks', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await page.goto('/life');
  await page.getByRole('button', { name: 'Use a goal template', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Goal template', exact: true }).selectOption('saving');
  await dialog.getByLabel('Template goal title', { exact: true }).fill('Reviewed savings template');
  await dialog.getByRole('button', { name: 'Create reviewed goal and tasks', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () => {
      const data = await workspace(page);
      return [
        data['personal-os.tasks.v1'].length,
        data['personal-os.entries.v1'].entries.filter(
          (x) => x.title === 'Reviewed savings template',
        ).length,
        data['personal-os.journey.v1'].onboardingComplete,
      ];
    })
    .toEqual([6, 1, true]);
  await page.reload();
  expect((await workspace(page))['personal-os.tasks.v1']).toHaveLength(6);
});

test('Oct 28 Arabic review: rendered digits, evening date and editable week-start preferences stay consistent', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'ar', {
    'personal-os.journey.v1': completeJourney,
    'personal-os.tasks.v1': [],
    'personal-os.planning.v1': {
      weekStartsOn: 1,
      capacity: 240,
      buffer: 30,
      timezone: 'Africa/Cairo',
    },
    'personal-os.weeks.v1': {
      '2026-10-26': {
        outcomes: [{ title: 'نتيجة محفوظة', goalId: '', done: false }],
        capacities: {},
        review: { wins: '', obstacles: '', next: '' },
      },
    },
  });
  await openHomeSection(page, 'planning');
  await expect(page.getByRole('button', { name: 'ابدأ يومي (0/3)', exact: true })).toBeVisible();
  await expect(page.locator('.home-stats .stat-card strong')).toHaveText(['0', '0', '0', '0/0']);
  await expect(page.locator('.daily-review').first()).toContainText('28 أكتوبر 2026');
  await expect(page.locator('.daily-review').first()).not.toContainText('2026-10-28');
  await page.goto('/planner?tab=week&week=2026-10-26');
  await setWeekStart(page, '6');
  await expect(page.locator('.week-day-heading').first()).toContainText('السبت');
  await expect(page.locator('.outcome-index')).toHaveText(['01', '02', '03']);
  expect((await workspace(page))['personal-os.weeks.v1']['2026-10-26'].outcomes[0].title).toBe(
    'نتيجة محفوظة',
  );
  await page.getByLabel('أسابيع محفوظة سابقًا', { exact: true }).selectOption('2026-10-26');
  await expect(page.locator('.week-day-heading').first()).toContainText('الاثنين');
  await expect(page.getByRole('status').filter({ hasText: 'بحدوده الأصلية' })).toBeVisible();
  await page.getByRole('button', { name: 'افتح الأسبوع الحالي', exact: true }).click();
  await expect(page.locator('.week-day-heading').first()).toContainText('السبت');
  await page.goto('/planner?tab=calendar&date=2026-10-27');
  await expect(page.locator('.weekday').first()).toHaveText('سب');
  await setWeekStart(page, '0');
  await expect(page.locator('.weekday').first()).toHaveText('أح');
  await page.goto('/');
  await expect(page.locator('.home-week button').first()).toContainText('الأحد');
  await page.getByRole('button', { name: 'مهمة جديدة', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'التكرار', exact: true })).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'التكرار', exact: true }).locator('option'),
  ).toHaveText(['بدون تكرار', 'يومي', 'أسبوعي', 'شهري']);
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
});

test('Oct 28 Arabic review: assistant shows inferred and editable life area and translates known legacy replies without rewriting history', async ({
  page,
}) => {
  const english = 'Review the before/after change. Only confirmation updates the existing record.';
  await signIn(page);
  await seedUxWorkspace(page, 'ar', {
    'personal-os.journey.v1': completeJourney,
    'personal-os.conversations.v1': [
      {
        id: 'legacy-review',
        title: 'اختبار API',
        archived: false,
        messages: [
          { id: 'legacy', role: 'assistant', text: english, createdAt: '2026-10-27T13:28:00Z' },
          { id: 'quoted', role: 'user', text: english },
        ],
      },
    ],
  });
  await page.goto('/assistant');
  await expect(page.locator('#assistant-message-legacy .message-text')).toHaveText(
    'راجع الفرق قبل وبعد. السجل الموجود مش هيتغير غير بعد تأكيدك.',
  );
  await expect(page.locator('#assistant-message-quoted .message-text')).toHaveText(english);
  await expect(page.locator('#assistant-message-legacy .message-time')).toContainText(
    '27 أكتوبر 2026',
  );
  await expect(page.locator('#assistant-message-legacy .message-time')).not.toContainText('/');
  await page.getByRole('button', { name: 'تسجيل سريع', exact: true }).click();
  await page.getByLabel('إيه اللي في بالك؟', { exact: true }).fill('عايز أذاكر بكرة الساعة 8');
  await page.getByRole('button', { name: 'مراجعة العناصر', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('combobox', { name: 'مجال الحياة', exact: true }),
  ).toHaveValue('Learning');
  await page.getByRole('button', { name: 'Close / إغلاق', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'المساعد الذكي غير متاح' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'إعدادات المساعد', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'المساعد الذكي غير متاح' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'تم', exact: true }).click();
  await page.getByLabel('رسالتك', { exact: true }).fill('عايز أذاكر بكرة الساعة 8');
  await page.getByRole('button', { name: 'إرسال الرسالة', exact: true }).click();
  await expect(page.getByLabel('مجال الحياة المقترح', { exact: true })).toHaveValue('Learning');
  await expect(page.getByLabel('وقت التنفيذ (اختياري)', { exact: true })).toHaveValue('20:00');
  await page.getByLabel('مجال الحياة المقترح', { exact: true }).selectOption('Personal');
  await page.getByRole('button', { name: 'تأكيد الإجراء', exact: true }).click();
  await expect
    .poll(async () => {
      const tasks = (await workspace(page))['personal-os.tasks.v1'];
      return tasks.find((task) => task.title === 'أذاكر')?.category;
    })
    .toBe('Personal');
  expect((await workspace(page))['personal-os.conversations.v1'][0].messages[0].text).toBe(english);
});

async function enableOffline(page) {
  await page.getByRole('button', { name: 'Data and backup', exact: true }).click();
  await page
    .getByRole('checkbox', {
      name: 'Keep a private copy on this device and save edits offline',
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Close / إغلاق', exact: true }).click();
}
test('offline edits persist on the device and reconnect without duplicating a task', async ({
  page,
  browser,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await enableOffline(page);
  const context = await browser.newContext();
  const remote = await context.newPage();
  try {
    await signIn(remote);
    await page.context().setOffline(true);
    await createTask(page, 'Created without connection');
    await expect(page.locator('.save-status')).toHaveText('Saved on device');
    expect(
      (await workspace(remote))['personal-os.tasks.v1'].some(
        (task) => task.title === 'Created without connection',
      ),
    ).toBe(false);
    await page.context().setOffline(false);
    await expect
      .poll(
        async () =>
          (await workspace(remote))['personal-os.tasks.v1'].filter(
            (task) => task.title === 'Created without connection',
          ).length,
      )
      .toBe(1);
    await expect(page.locator('.save-status')).toHaveText('Saved ✓');
    await page.reload();
    expect(
      (await workspace(remote))['personal-os.tasks.v1'].filter(
        (task) => task.title === 'Created without connection',
      ),
    ).toHaveLength(1);
  } finally {
    await page
      .context()
      .setOffline(false)
      .catch(() => {});
    await context.close();
  }
});
test('offline conflict review preserves the other device until an explicit choice', async ({
  page,
  browser,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', {
    'personal-os.journey.v1': completeJourney,
    'personal-os.tasks.v1': [
      {
        id: 'shared-offline',
        title: 'Shared title',
        category: 'Work',
        done: false,
        archived: false,
      },
    ],
  });
  await enableOffline(page);
  const context = await browser.newContext();
  const remote = await context.newPage();
  try {
    await signIn(remote);
    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Shared title', exact: true }).first().click();
    await page.getByLabel('Task title', { exact: true }).fill('Offline title');
    await page.getByRole('button', { name: 'Save task', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await remote.getByRole('button', { name: 'Shared title', exact: true }).first().click();
    await remote.getByLabel('Task title', { exact: true }).fill('Online title');
    await remote.getByRole('button', { name: 'Save task', exact: true }).click();
    await expect(remote.getByRole('dialog')).toHaveCount(0);
    await page.context().setOffline(false);
    await page.getByRole('button', { name: 'Data and backup', exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Conflict choice 1', exact: true }),
    ).toBeVisible();
    expect((await workspace(remote))['personal-os.tasks.v1'][0].title).toBe('Online title');
    await page
      .getByRole('combobox', { name: 'Conflict choice 1', exact: true })
      .selectOption('local');
    await page
      .getByRole('button', { name: 'Confirm reviewed synchronization', exact: true })
      .click();
    await expect
      .poll(async () => (await workspace(remote))['personal-os.tasks.v1'][0].title)
      .toBe('Offline title');
  } finally {
    await page
      .context()
      .setOffline(false)
      .catch(() => {});
    await context.close();
  }
});
test('core Home is readable and compact, with five mobile destinations', async ({ page }) => {
  await signIn(page);
  await seedUxWorkspace(page, 'ar', { 'personal-os.journey.v1': completeJourney });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('[data-home-section=planning]')).not.toHaveAttribute('open');
  await expect(page.locator('#daily-focus')).not.toBeVisible();
  await expect(page.locator('#daily-review')).not.toBeVisible();
  await expect(page.locator('.home-focus-list')).toBeVisible();
  await expect(page.locator('.home-agenda')).toBeVisible();
  expect(
    await page.locator('.home-v2').evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThan(2200);
  const tiny = await page.locator('main').evaluate((element) =>
    [...element.querySelectorAll('*')]
      .filter((item) => {
        const r = item.getBoundingClientRect();
        const style = getComputedStyle(item);
        return (
          r.width > 4 &&
          r.height > 4 &&
          style.display !== 'none' &&
          item.childNodes.length &&
          [...item.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim()) &&
          parseFloat(style.fontSize) < 13
        );
      })
      .map((item) => item.className),
  );
  expect(tiny).toEqual([]);
  await page.screenshot({ path: '/tmp/dailgo-core-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('navigation', { name: 'التنقل للجوال' }).locator('.nav-link'),
  ).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/dailgo-core-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'المزيد', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'الذاكرة', exact: true }),
  ).toBeVisible();
});

test('offline outbox remains bound to its account when another session replaces the cookie', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await enableOffline(page);
  const space = await page.request.post('/api/family', {
    headers: { Origin: 'http://127.0.0.1:5187' },
    data: { title: 'Outbox isolation' },
  });
  const id = (await space.json()).id;
  const invitation = await page.request.post('/api/family/' + id + '/invite', {
    headers: { Origin: 'http://127.0.0.1:5187' },
    data: {},
  });
  const token = (await invitation.json()).token;
  await page.context().setOffline(true);
  await createTask(page, 'Owner-only offline draft');
  const accepted = await page.request.post('/api/account/accept-invite', {
    headers: { Origin: 'http://127.0.0.1:5187' },
    data: {
      token,
      username: 'offline-member-' + Date.now(),
      password: 'member-offline-test-password',
    },
  });
  expect(accepted.status()).toBe(201);
  await page.context().setOffline(false);
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
  expect((await workspace(page))['personal-os.tasks.v1']).toHaveLength(0);
  const ownerQueue = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('dailgo-offline-v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise((resolve) => {
      const request = db.transaction('accounts').objectStore('accounts').get('owner');
      request.onsuccess = () =>
        resolve(
          request.result?.outbox?.draft.data['personal-os.tasks.v1'].some(
            (task) => task.title === 'Owner-only offline draft',
          ),
        );
    });
  });
  expect(ownerQueue).toBe(true);
});

test('a second offline tab cannot overwrite another tab’s pending edits', async ({ page }) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', { 'personal-os.journey.v1': completeJourney });
  await enableOffline(page);
  const second = await page.context().newPage();
  await second.goto('/');
  await expect(second.getByRole('button', { name: 'New task', exact: true })).toBeVisible();
  await page.context().setOffline(true);
  try {
    await createTask(page, 'First tab durable draft');
    await second.getByRole('button', { name: 'New task', exact: true }).click();
    await second
      .getByLabel('Task title', { exact: true })
      .fill('Second tab must not replace draft');
    await second.getByRole('button', { name: 'Save task', exact: true }).click();
    await expect(second.getByRole('alert').filter({ hasText: 'Could not save' })).toBeVisible();
    const titles = await page.evaluate(async () => {
      const cache = await import('/src/lib/offlineCache.ts');
      const stored = await cache.readOffline();
      return stored.outbox.draft.data['personal-os.tasks.v1'].map((task) => task.title);
    });
    expect(titles).toContain('First tab durable draft');
    expect(titles).not.toContain('Second tab must not replace draft');
  } finally {
    await second.close();
    await page
      .context()
      .setOffline(false)
      .catch(() => {});
  }
});

test('assistant settings stay out of the conversation and week capacity opens only on demand', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'ar', { 'personal-os.journey.v1': completeJourney });
  await page.goto('/assistant');
  await expect(page.getByLabel('رسالتك', { exact: true })).toBeVisible();
  expect((await page.getByLabel('رسالتك', { exact: true }).boundingBox()).y).toBeLessThan(
    (await page.locator('.suggestion-grid').boundingBox()).y,
  );
  await expect(page.getByRole('combobox', { name: 'نوع المساعد', exact: true })).toHaveCount(0);
  await expect(page.getByText('Claude مش مفعّل', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'إعدادات المساعد', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'نوع المساعد', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'تم', exact: true }).click();
  await page.goto('/planner?tab=week&week=2026-10-27');
  await expect(page.locator('.week-days input[type=number]:visible')).toHaveCount(0);
  await page.locator('.day-capacity-editor summary').first().click();
  await expect(page.locator('.week-days input[type=number]:visible')).toHaveCount(2);
});

for (const [name, path] of [
  ['home', '/'],
  ['assistant', '/assistant'],
  ['week', '/planner?tab=week&week=2026-10-27'],
]) {
  test(`Arabic dark mode fits desktop and mobile: ${name}`, async ({ page }) => {
    await signIn(page);
    await seedUxWorkspace(page, 'ar', {
      'personal-os.journey.v1': completeJourney,
      'personal-os.dark': true,
    });
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `/tmp/dailgo-polish-dark-${name}.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/dailgo-polish-dark-mobile-${name}.png`, fullPage: true });
  });
}

test('Arabic custom calendar works in a mobile task editor', async ({ page }) => {
  await signIn(page);
  await seedUxWorkspace(page, 'ar', {
    'personal-os.journey.v1': completeJourney,
    'personal-os.dark': true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: 'Deadline only', exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator('.home-new-task')).not.toBeVisible();
  await expect(page.locator('.core-home > :first-child')).toHaveClass(/home-overview/);
  await page.getByRole('button', { name: 'Deadline only', exact: true }).first().click();
  await page.getByLabel('عنوان المهمة', { exact: true }).fill('اختبار التقويم العربي');
  await page.getByRole('button', { name: 'اختار التاريخ', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'اختار التاريخ', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/dailgo-polish-calendar-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '28 أكتوبر 2026', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.arabic-date-control input').first()).toHaveValue(
    '28/10/2026',
  );
});

test('an online conflict merges independent completions and Undo preserves the other device', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'en', {
    'personal-os.journey.v1': completeJourney,
    'personal-os.tasks.v1': [
      { id: 'merge-a', title: 'Local completion', category: 'Work', done: false, archived: false },
      { id: 'merge-b', title: 'Remote completion', category: 'Work', done: false, archived: false },
    ],
  });
  let release;
  const blocked = new Promise((resolve) => (release = resolve));
  let started;
  const requestStarted = new Promise((resolve) => (started = resolve));
  let writes = 0;
  await page.route('**/api/workspace/changes', async (route) => {
    if (++writes === 1) {
      started();
      await blocked;
    }
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Complete: Local completion', exact: true }).click();
    await requestStarted;
    const snapshot = await (await page.request.get('/api/workspace')).json();
    const updated = {
      ...snapshot.data,
      'personal-os.tasks.v1': snapshot.data['personal-os.tasks.v1'].map((task) =>
        task.id === 'merge-b' ? { ...task, done: true, status: 'done' } : task,
      ),
    };
    const response = await page.request.put('/api/workspace/commit', {
      headers: { Origin: 'http://127.0.0.1:5187' },
      data: { revision: snapshot.revision, data: updated },
    });
    expect(response.status()).toBe(200);
    release();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect
      .poll(async () =>
        (await workspace(page))['personal-os.tasks.v1'].map((task) => ({
          id: task.id,
          done: task.done,
        })),
      )
      .toEqual([
        { id: 'merge-a', done: false },
        { id: 'merge-b', done: true },
      ]);
    expect(writes).toBeGreaterThanOrEqual(3);
  } finally {
    release();
    await page.unroute('**/api/workspace/changes');
  }
});

test('Home starts with the overview and review panels keep Latin digits and save notes across reloads', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'ar', {
    'personal-os.journey.v1': completeJourney,
    'personal-os.trial.v1': {
      startedOn: '2026-10-20',
      baseline: { captureSeconds: 60, reviewMinutes: 10 },
      days: {
        '2026-10-27': { captureSeconds: 30, reviewMinutes: 5, clarity: 4, duplicates: 0, lost: 0 },
      },
    },
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.core-home > :first-child')).toHaveClass(/home-overview/);
  await expect(page.locator('.home-overview')).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(/[٠-٩۰-۹]/);
  await page.screenshot({ path: '/tmp/dailgo-home-refresh-desktop.png', fullPage: true });
  await openHomeSection(page, 'review');
  await page.getByLabel('ملاحظة مسائية', { exact: true }).fill('مراجعة التصميم الجديد');
  const review = page.locator('.evening-review');
  const fieldBottom = await review
    .locator('.review-notes-panel')
    .evaluate((e) => e.getBoundingClientRect().bottom);
  const buttonTop = await review
    .getByRole('button', { name: 'إنهاء المراجعة المسائية', exact: true })
    .evaluate((e) => e.getBoundingClientRect().top);
  expect(buttonTop).toBeGreaterThan(fieldBottom);
  await review.screenshot({ path: '/tmp/dailgo-evening-review-desktop.png' });
  await openHomeSection(page, 'trial');
  const trial = page.locator('.trial-review');
  await trial.getByLabel('وقت التسجيل (ثوانٍ)', { exact: true }).fill('45');
  await trial
    .getByLabel('هل التطبيق قلّل مجهودك؟ وإيه اللي محتاج إصلاح؟', { exact: true })
    .fill('التقسيم الجديد أوضح');
  await trial.screenshot({ path: '/tmp/dailgo-trial-review-desktop.png' });
  await expect
    .poll(
      async () => (await workspace(page))['personal-os.trial.v1'].days['2026-10-27'].captureSeconds,
    )
    .toBe(45);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await trial.screenshot({ path: '/tmp/dailgo-trial-review-mobile.png' });
  await review.screenshot({ path: '/tmp/dailgo-evening-review-mobile.png' });
  await page.reload();
  await openHomeSection(page, 'review');
  await expect(page.getByLabel('ملاحظة مسائية', { exact: true })).toHaveValue(
    'مراجعة التصميم الجديد',
  );
  await openHomeSection(page, 'trial');
  await expect(
    page.locator('.trial-review').getByLabel('وقت التسجيل (ثوانٍ)', { exact: true }),
  ).toHaveValue('45');
});

test('compact status planner paginates tasks without horizontal scrolling on desktop and mobile', async ({
  page,
}) => {
  await signIn(page);
  await seedUxWorkspace(page, 'ar', {
    'personal-os.tasks.v1': Array.from({ length: 15 }, (_, index) => ({
      id: `board-${index}`,
      title: `مهمة المخطط ${index}`,
      category: 'Personal',
      done: false,
      archived: false,
      status: index === 14 ? 'doing' : 'todo',
      description: 'تفاصيل المهمة تظهر في الكارت ويمكن فتح المهمة لمراجعتها بالكامل.\n'.repeat(20),
    })),
  });
  await page.goto('/planner?tab=tasks');
  await expect(page.locator('.compact-task-list .task-item')).toHaveCount(6);
  const notes = page.locator('.compact-task-list .task-notes').first();
  await expect(notes).not.toHaveAttribute('open');
  await notes.locator('summary').click();
  await expect(notes.locator('.task-description')).toBeVisible();
  await notes.locator('summary').click();
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await expect(page.locator('.compact-task-list .task-item')).toHaveCount(6);
  await page.screenshot({ path: '/tmp/dailgo-compact-task-list.png', fullPage: true });
  await page.getByRole('button', { name: 'عرض اللوحة', exact: true }).click();
  await expect(page.locator('.status-board .task-item')).toHaveCount(6);
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await expect(page.locator('.status-board .task-item')).toHaveCount(2);
  await page.locator('.status-doing').click();
  await expect(page.locator('.status-board .task-item')).toHaveCount(1);
  await page.locator('.status-todo').click();
  await expect(page.locator('.status-board .task-item')).toHaveCount(6);
  for (const [name, width] of [
    ['desktop', 1440],
    ['mobile', 390],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.status-board')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/dailgo-status-planner-${name}.png`, fullPage: true });
  }
});
