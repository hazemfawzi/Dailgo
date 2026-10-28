import { test, expect } from '@playwright/test';
test('packaged production build loads, saves data, and recovers one stale lazy chunk without losing work', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-27T09:00:00Z'));
  await page.goto('/');
  await page.getByLabel('اسم المستخدم', { exact: true }).fill('packaged-fixture');
  await page
    .getByLabel('كلمة المرور (12 حرفًا على الأقل)', { exact: true })
    .fill('packaged-test-password');
  await page.getByRole('button', { name: 'إنشاء الحساب', exact: true }).click();
  await page.getByRole('button', { name: 'بدء مساحة فارغة على السيرفر', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ابدأ بدون المعالج', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ابدأ بدون المعالج', exact: true }).click();
  await page.getByRole('button', { name: 'التثبيت والعمل دون إنترنت', exact: true }).click();
  await expect(page.getByRole('dialog').locator('code')).toHaveText(/^[0-9a-f]{7}$/);
  await page.getByRole('button', { name: 'Close / إغلاق', exact: true }).click();
  await page.getByRole('button', { name: 'مهمة جديدة', exact: true }).click();
  await page.getByLabel('عنوان المهمة', { exact: true }).fill('مهمة API في حزمة النشر');
  await page.getByRole('button', { name: 'حفظ المهمة', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(async () => {
      return (await (await page.request.get('/api/workspace')).json()).data[
        'personal-os.tasks.v1'
      ]?.map((x) => x.title);
    })
    .toEqual(['مهمة API في حزمة النشر']);
  await page.goto('/tools?tab=finance');
  await expect(
    page.getByRole('heading', { name: 'الادخار والمصروف الشهري', exact: true }),
  ).toBeVisible();
  let blocked = 0;
  await page.route('**/assets/AssistantScreen-*.js', async (route) => {
    if (blocked++ === 0) await route.abort();
    else await route.continue();
  });
  const reloaded = page.waitForResponse(
    (response) =>
      response.request().isNavigationRequest() && new URL(response.url()).pathname === '/assistant',
  );
  await page.getByRole('link', { name: 'المساعد', exact: true }).first().click();
  await reloaded;
  await expect(page.getByLabel('رسالتك', { exact: true })).toBeVisible();
  expect(blocked).toBeGreaterThanOrEqual(2);
  const data = (await (await page.request.get('/api/workspace')).json()).data;
  expect(data['personal-os.tasks.v1'].map((x) => x.title)).toEqual(['مهمة API في حزمة النشر']);
  expect(errors).toEqual([]);
});

test.describe('installed offline copy', () => {
  test.use({ serviceWorkers: 'allow' });
  test('a cached production shell reopens offline and later uploads its queued edit', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('اسم المستخدم', { exact: true }).fill('packaged-fixture');
    await page
      .getByLabel('كلمة المرور (12 حرفًا على الأقل)', { exact: true })
      .fill('packaged-test-password');
    await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await expect(page.getByRole('button', { name: 'مهمة جديدة', exact: true })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.getByRole('button', { name: 'البيانات والنسخ الاحتياطي', exact: true }).click();
    await page
      .getByRole('checkbox', {
        name: 'احتفظ بنسخة على هذا الجهاز واحفظ التعديلات دون اتصال',
        exact: true,
      })
      .check();
    await page.getByRole('button', { name: 'Close / إغلاق', exact: true }).click();
    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'مهمة جديدة', exact: true }).click();
    await page.getByLabel('عنوان المهمة', { exact: true }).fill('مهمة محفوظة دون اتصال');
    await page.getByRole('button', { name: 'حفظ المهمة', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.save-status')).toHaveText('محفوظ على الجهاز');
    await page.reload();
    await expect(page.getByRole('button', { name: 'مهمة جديدة', exact: true })).toBeVisible();
    await expect(page.locator('.save-status')).toHaveText('محفوظ على الجهاز');
    await page.context().setOffline(false);
    await expect
      .poll(async () => {
        const data = (await (await page.request.get('/api/workspace')).json()).data;
        return data['personal-os.tasks.v1'].filter((task) => task.title === 'مهمة محفوظة دون اتصال')
          .length;
      })
      .toBe(1);
    await expect(page.locator('.save-status')).toHaveText('محفوظ ✓');
  });
});
