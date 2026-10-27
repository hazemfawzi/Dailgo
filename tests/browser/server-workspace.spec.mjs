import { test,expect } from '@playwright/test';
const username='browser-fixture';const password='browser-fixture-test-password';
async function signIn(page){const status=await (await page.request.get('/api/account/status')).json();if(!status.configured){await page.request.post('/api/account/setup',{headers:{Origin:'http://127.0.0.1:5187'},data:{username,password}});await page.request.put('/api/workspace',{headers:{Origin:'http://127.0.0.1:5187'},data:{revision:'empty',data:{'personal-os.language':'en','personal-os.tasks.v1':[],'personal-os.entries.v1':{version:2,demoVersion:1,entries:[]}}}});await page.request.post('/api/account/logout',{headers:{Origin:'http://127.0.0.1:5187'},data:{}});}await page.goto('/');await page.getByLabel('اسم المستخدم').fill(username);await page.getByLabel('كلمة المرور (12 حرفًا على الأقل)').fill(password);await page.getByRole('button',{name:'دخول',exact:true}).click();await expect(page.getByRole('button',{name:/^(New task|مهمة جديدة)$/})).toBeVisible();}
async function createTask(page,title){await page.getByRole('button',{name:'New task',exact:true}).click();await page.getByLabel('Task title',{exact:true}).fill(title);await page.getByRole('button',{name:'Save task',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
test('account bootstrap, explicit local migration, automatic server saves, multiple devices, conflicts and offline failures',async({page,browser})=>{
 const original={version:3,revision:'local-fixture',data:{'personal-os.language':'en','personal-os.tasks.v1':[{id:'local-task',title:'Legacy browser task',category:'Personal',done:false,archived:false}],'personal-os.entries.v1':{version:2,demoVersion:1,entries:[]}}};
 await page.addInitScript(value=>{if(!localStorage.getItem('personal-os.workspace.v3'))localStorage.setItem('personal-os.workspace.v3',JSON.stringify(value));},original);
 await page.goto('/');await expect(page.getByRole('heading',{name:'إنشاء الحساب الشخصي'})).toBeVisible();
 await page.getByLabel('اسم المستخدم').fill(username);await page.getByLabel('كلمة المرور (12 حرفًا على الأقل)').fill(password);await page.getByRole('button',{name:'إنشاء الحساب',exact:true}).click();
 await expect(page.getByRole('heading',{name:'ابدأ مساحة السيرفر'})).toBeVisible();await page.getByRole('button',{name:'نقل نسخة المتصفح إلى السيرفر'}).click();
 await expect(page.getByRole('button',{name:'New task',exact:true})).toBeVisible();
 await createTask(page,'Automatically saved task');
 await expect.poll(async()=>{const r=await page.request.get('/api/workspace');return (await r.json()).data['personal-os.tasks.v1'].map(x=>x.title);}).toContain('Automatically saved task');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('personal-os.workspace.v3')))).toEqual(original);
 await page.reload();await expect(page.getByRole('button',{name:'New task',exact:true})).toBeVisible();
 const second=await browser.newContext();const device=await second.newPage();await signIn(device);await device.goto('/planner?tab=tasks');
 await expect(device.getByText('Automatically saved task',{exact:true}).first()).toBeVisible();
 // A second device changes the same record after the first device opened its editor.
 await page.getByRole('button',{name:'New task',exact:true}).click();await page.getByLabel('Task title',{exact:true}).fill('Must reject stale workspace');
 await device.getByRole('button',{name:'New task',exact:true}).click();await device.getByLabel('Task title',{exact:true}).fill('Second device task');await device.getByRole('button',{name:'Save task',exact:true}).click();await expect(device.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Save task',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Could not save'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect.poll(async()=>{const r=await page.request.get('/api/workspace');return (await r.json()).data['personal-os.tasks.v1'].map(x=>x.title);}).not.toContain('Must reject stale workspace');
 // Refresh a device using the same mechanism as the window-focus listener.
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.goto('/planner?tab=tasks');await expect(page.getByText('Second device task',{exact:true}).first()).toBeVisible();
 await page.goto('/');await expect(page.getByRole('button',{name:'New task',exact:true})).toBeVisible();
 await page.route('**/api/workspace/commit',route=>route.abort());await page.getByRole('button',{name:'New task',exact:true}).click();await page.getByLabel('Task title',{exact:true}).fill('Never saved offline');await page.getByRole('button',{name:'Save task',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Could not save'})).toBeVisible();
 const offline=await (await page.request.get('/api/workspace')).json();expect(offline.data['personal-os.tasks.v1'].some(x=>x.title==='Never saved offline')).toBe(false);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('personal-os.workspace.v3')))).toEqual(original);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.unroute('**/api/workspace/commit');await page.getByRole('button',{name:'إعادة الاتصال / تحميل أحدث نسخة'}).click();
 await expect(page.getByText('متصل بحساب السيرفر · الحفظ تلقائي · تحديث الأجهزة كل 10 ثوانٍ')).toBeVisible();
 await page.getByRole('button',{name:'تسجيل الخروج',exact:true}).click();await expect(page.getByRole('heading',{name:'تسجيل الدخول',exact:true})).toBeVisible();
 expect((await page.request.get('/api/workspace')).status()).toBe(401);
 await second.close();
});
test('goals, assistant confirmation, planning settings and backup restoration use the server workspace',async({page})=>{
 await signIn(page);
 await page.goto('/life');await page.getByRole('button',{name:'Create an item',exact:true}).first().click();await page.getByLabel('Title',{exact:true}).fill('Server-backed goal');await page.getByRole('button',{name:'Save item',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return data['personal-os.entries.v1'].entries.map(x=>x.title);}).toContain('Server-backed goal');
 await page.goto('/assistant');await page.getByLabel('Your message',{exact:true}).fill('Task: Confirmed assistant task');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByRole('button',{name:'Confirm action',exact:true}).click();await expect(page.locator('.action-result').filter({hasText:'Confirmed and saved'})).toBeVisible();
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return data['personal-os.tasks.v1'].map(x=>x.title);}).toContain('Confirmed assistant task');
 await page.getByRole('button',{name:'Data and backup',exact:true}).click();await page.getByRole('combobox',{name:'Planning timezone',exact:true}).selectOption('America/New_York');
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return data['personal-os.planning.v1'].timezone;}).toBe('America/New_York');
 const backup=(await (await page.request.get('/api/workspace')).json()).data;
 const restored=structuredClone(backup);restored['personal-os.tasks.v1'].push({id:'backup-restored',title:'Task from restored backup',category:'Personal',done:false,archived:false});
 await page.locator('input[type=file]').setInputFiles({name:'workspace-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'personal-os-backup',version:1,exportedAt:new Date().toISOString(),data:restored}))});
 await page.getByRole('button',{name:'Confirm replacement',exact:true}).click();await expect(page.getByText('Restored successfully.',{exact:true})).toBeVisible();
 expect((await (await page.request.get('/api/workspace')).json()).data['personal-os.tasks.v1'].some(x=>x.id==='backup-restored')).toBe(true);
});
test('autosave keeps fast typing intact over a slow connection and expires sessions safely',async({page})=>{
 await signIn(page);
 await page.route('**/api/workspace/commit',async route=>{await new Promise(resolve=>setTimeout(resolve,120));await route.continue();});
 const field=page.getByRole('textbox',{name:'What moved forward?',exact:true});await field.fill('');await field.pressSequentially('Quick review',{delay:5});await expect(field).toHaveValue('Quick review');
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return Object.values(data['personal-os.reviews.v1']??{}).some(x=>x.wins==='Quick review');},{timeout:10000}).toBe(true);
 await page.unroute('**/api/workspace/commit');
 await page.request.post('/api/account/logout',{headers:{Origin:'http://127.0.0.1:5187'},data:{}});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('heading',{name:'تسجيل الدخول',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'New task',exact:true})).toHaveCount(0);
});
async function seedUxWorkspace(page,language='en'){
 // Unmount the application before replacing fixture data so automatic default
 // initialization cannot race the test's explicit workspace replacement.
 await page.goto('about:blank');
 const snapshot=await (await page.request.get('/api/workspace')).json();
 const tasks=[{id:'due-only',title:'Deadline only',category:'Work',done:false,archived:false,dueDate:'2026-10-27',estimate:60},{id:'other-day',title:'Deadline before execution',category:'Work',done:false,archived:false,dueDate:'2026-10-27',plannedDate:'2026-10-28',estimate:30},{id:'completed-goal-task',title:'Completed goal task',category:'Work',done:true,status:'done',archived:false,goalId:'review-goal'}];
 const data={'personal-os.language':language,'personal-os.dark':false,'personal-os.tasks.v1':tasks,'personal-os.entries.v1':{version:2,demoVersion:1,entries:[{id:'review-goal',kind:'goal',title:'Goal نتيجة API',area:'Work',detail:'Review the result',date:'2026-12-31',time:'',progress:0,archived:false,doneDates:[],successCriteria:'Verified result',milestones:[]}]},'personal-os.planning.v1':{weekStartsOn:1,capacity:240,buffer:30,timezone:'Africa/Cairo'}};
 const response=await page.request.put('/api/workspace',{headers:{Origin:'http://127.0.0.1:5187'},data:{revision:snapshot.revision,data}});expect(response.status()).toBe(200);
 await page.clock.setFixedTime(new Date('2026-10-27T09:00:00Z'));
 await page.goto('/');await expect(page.getByRole('button',{name:language==='ar'?'مهمة جديدة':'New task',exact:true})).toBeVisible();
}
test('Arabic connection bar stays clear of the sidebar, follows dark mode and isolates mixed-direction chat text',async({page})=>{
 await signIn(page);await seedUxWorkspace(page,'ar');await page.setViewportSize({width:1280,height:900});
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 const bar=page.locator('.server-connection');const sidebar=page.locator('.sidebar');
 const bounds=await bar.boundingBox();const side=await sidebar.boundingBox();expect(bounds.x+bounds.width).toBeLessThanOrEqual(side.x+1);
 const light=await bar.evaluate(element=>getComputedStyle(element).backgroundColor);
 await page.getByRole('button',{name:'تغيير المظهر',exact:true}).click();await expect(page.locator('html')).toHaveClass(/dark/);
 expect(await bar.evaluate(element=>getComputedStyle(element).backgroundColor)).not.toBe(light);
 await page.goto('/assistant');await page.getByRole('textbox',{name:'رسالتك',exact:true}).fill('عايز أذاكر بكرة الساعة 8');await page.getByRole('button',{name:'إرسال الرسالة',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'عنوان المعاينة',exact:true})).toHaveValue(/أذاكر/);await expect(page.getByLabel('يوم التنفيذ (اختياري)',{exact:true})).toHaveValue('2026-10-28');
 await expect(page.locator('.message-text').first()).toHaveAttribute('dir','auto');await expect(page.locator('.conversation-row>button>span').first()).toHaveAttribute('dir','auto');
 await expect(page.locator('.chat-messages')).not.toContainText('ذاكرتك فارغة');
 await page.getByRole('button',{name:'تأكيد الإجراء',exact:true}).click();
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return data['personal-os.tasks.v1'].some(task=>task.title.includes('أذاكر')&&task.plannedDate==='2026-10-28');}).toBe(true);
 await page.setViewportSize({width:390,height:844});const mobile=await bar.boundingBox();expect(mobile.x).toBeGreaterThanOrEqual(0);expect(mobile.x+mobile.width).toBeLessThanOrEqual(391);
 await expect(page.locator('.sidebar')).not.toBeVisible();
});
test('due dates appear across calendar views and selection stays separate from task completion',async({page})=>{
 await signIn(page);await seedUxWorkspace(page);
 await expect(page.locator('.home-agenda')).toContainText('Deadline only');await expect(page.locator('.home-agenda')).toContainText('Due date');
 await page.goto('/planner?tab=calendar&date=2026-10-27');await expect(page.locator('.dated-tasks')).toContainText('Deadline only');await expect(page.locator('.dated-tasks')).toContainText('Deadline before execution');await expect(page.getByRole('button',{name:'2026-10-27 · 2 tasks',exact:true})).toBeVisible();
 await page.goto('/planner?tab=week&week=2026-10-27');await expect(page.locator('.week-due-tasks').filter({hasText:'Deadline only'})).toBeVisible();
 await page.goto('/planner?tab=tasks');await expect(page.getByRole('checkbox',{name:'Select task: Deadline only',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Select tasks',exact:true}).click();await page.getByRole('checkbox',{name:'Select task: Deadline only',exact:true}).check();
 let tasks=(await (await page.request.get('/api/workspace')).json()).data['personal-os.tasks.v1'];expect(tasks.find(task=>task.id==='due-only').done).toBe(false);
 await page.getByRole('button',{name:'Complete: Deadline only',exact:true}).click();
 await expect.poll(async()=>{const tasks=(await (await page.request.get('/api/workspace')).json()).data['personal-os.tasks.v1'];return tasks.find(task=>task.id==='due-only').done;}).toBe(true);
});
test('goal cards show target dates and outcome guidance while milestone and goal editors prevent invalid date ranges',async({page})=>{
 await signIn(page);await seedUxWorkspace(page);
 await page.goto('/life');const card=page.locator('.kind-goal');await expect(card).toContainText('2026-12-31');await expect(card).toContainText('Tasks complete. Review success criteria');
 await page.getByRole('link',{name:'Goal نتيجة API',exact:true}).click();await expect(page.locator('.outcome-evidence')).toContainText('All linked tasks are complete.');
 await page.getByRole('button',{name:'Add milestone',exact:true}).click();await page.getByRole('textbox',{name:'Milestone title',exact:true}).fill('Milestone deadline');
 const milestoneDate=page.getByLabel('Target date (optional)',{exact:true});await expect(milestoneDate).toHaveAttribute('max','2026-12-31');await milestoneDate.fill('2027-06-01');await expect(page.getByRole('button',{name:'Save milestone',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('Milestone date must be on or before');
 await milestoneDate.fill('2026-12-01');await page.getByRole('button',{name:'Save milestone',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Edit goal',exact:true}).click();await page.getByLabel('Target date (optional)',{exact:true}).fill('2026-11-01');await expect(page.getByRole('button',{name:'Save goal',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('Review milestone dates');
});
