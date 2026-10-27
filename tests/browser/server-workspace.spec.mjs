import { test,expect } from '@playwright/test';
const username='browser-fixture';const password='browser-fixture-test-password';
async function signIn(page){const status=await (await page.request.get('/api/account/status')).json();if(!status.configured){await page.request.post('/api/account/setup',{headers:{Origin:'http://127.0.0.1:5187'},data:{username,password}});await page.request.put('/api/workspace',{headers:{Origin:'http://127.0.0.1:5187'},data:{revision:'empty',data:{'personal-os.language':'en','personal-os.tasks.v1':[],'personal-os.entries.v1':{version:2,demoVersion:1,entries:[]}}}});await page.request.post('/api/account/logout',{headers:{Origin:'http://127.0.0.1:5187'},data:{}});}await page.goto('/');await page.getByLabel('اسم المستخدم').fill(username);await page.getByLabel('كلمة المرور (12 حرفًا على الأقل)').fill(password);await page.getByRole('button',{name:'دخول',exact:true}).click();const skip=page.getByRole('button',{name:/^(Skip setup|ابدأ بدون المعالج)$/});await expect(page.getByRole('button',{name:/^(New task|مهمة جديدة)$/}).or(skip).first()).toBeVisible();if(await skip.isVisible())await skip.click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:/^(New task|مهمة جديدة)$/})).toBeVisible();}
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
async function seedUxWorkspace(page,language='en',extra={}){
 // Unmount the application before replacing fixture data so automatic default
 // initialization cannot race the test's explicit workspace replacement.
 await page.goto('about:blank');
 const snapshot=await (await page.request.get('/api/workspace')).json();
 const tasks=[{id:'due-only',title:'Deadline only',category:'Work',done:false,archived:false,dueDate:'2026-10-27',estimate:60},{id:'other-day',title:'Deadline before execution',category:'Work',done:false,archived:false,dueDate:'2026-10-27',plannedDate:'2026-10-28',estimate:30},{id:'completed-goal-task',title:'Completed goal task',category:'Work',done:true,status:'done',archived:false,goalId:'review-goal'}];
 const data={'personal-os.language':language,'personal-os.dark':false,'personal-os.tasks.v1':tasks,'personal-os.entries.v1':{version:2,demoVersion:1,entries:[{id:'review-goal',kind:'goal',title:'Goal نتيجة API',area:'Work',detail:'Review the result',date:'2026-12-31',time:'',progress:0,archived:false,doneDates:[],successCriteria:'Verified result',milestones:[]}]},'personal-os.planning.v1':{weekStartsOn:1,capacity:240,buffer:30,timezone:'Africa/Cairo'},...extra};
 const response=await page.request.put('/api/workspace',{headers:{Origin:'http://127.0.0.1:5187'},data:{revision:snapshot.revision,data}});expect(response.status()).toBe(200);
 await page.clock.setFixedTime(new Date('2026-10-27T09:00:00Z'));
 await page.goto('/');if(extra['personal-os.journey.v1']?.onboardingComplete===false)return;await expect(page.getByRole('button',{name:language==='ar'?'مهمة جديدة':'New task',exact:true})).toBeVisible();
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
 await page.goto('/life');const card=page.locator('.kind-goal');await expect(card.locator('time')).toHaveAttribute('datetime','2026-12-31');await expect(card).toContainText('65 days left');await expect(card).toContainText('Tasks complete. Review success criteria');
 await page.getByRole('link',{name:'Goal نتيجة API',exact:true}).click();await expect(page.locator('.outcome-evidence')).toContainText('All linked tasks are complete.');
 await page.getByRole('button',{name:'Add milestone',exact:true}).click();await page.getByRole('textbox',{name:'Milestone title',exact:true}).fill('Milestone deadline');
 const milestoneDate=page.getByLabel('Target date (optional)',{exact:true});await expect(milestoneDate).not.toHaveAttribute('max');await milestoneDate.fill('2027-06-01');await expect(page.getByRole('button',{name:'Save milestone',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('This milestone is after the goal target');
 await page.getByRole('checkbox',{name:'Keep this milestone after the goal target',exact:true}).check();await expect(page.getByRole('button',{name:'Save milestone',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Save milestone',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Edit goal',exact:true}).click();await page.getByLabel('Target date (optional)',{exact:true}).fill('2026-11-01');await expect(page.getByRole('button',{name:'Save goal',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('Some milestones are after this target');await page.getByRole('button',{name:'Extend goal to the last milestone',exact:true}).click();await expect(page.getByLabel('Target date (optional)',{exact:true})).toHaveValue('2027-06-01');await expect(page.getByRole('button',{name:'Save goal',exact:true})).toBeEnabled();
});
test('a completed goal closes only after explicit outcome confirmation',async({page})=>{
 await signIn(page);await seedUxWorkspace(page);await page.goto('/life/review-goal');
 await page.getByRole('button',{name:'Confirm outcome and close goal',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Goal outcome confirmed and goal closed'})).toBeVisible();
 const workspace=(await (await page.request.get('/api/workspace')).json()).data;const goal=workspace['personal-os.entries.v1'].entries.find(x=>x.id==='review-goal');expect(goal.archived).toBe(true);expect(goal.outcomeAchieved).toBe(true);
});
test('task deletion supports restore, export and permanent removal without changing the downloaded backup',async({page})=>{
 await signIn(page);await seedUxWorkspace(page);await page.goto('/planner?tab=tasks');
 async function remove(){await page.getByRole('button',{name:'Delete: Deadline only',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return data['personal-os.trash.v1']?.some(x=>x.item.id==='due-only');}).toBe(true);}
 await remove();await page.getByRole('button',{name:'Data and backup',exact:true}).click();
 await page.locator('.trash-item').filter({hasText:'Deadline only'}).getByRole('button',{name:'Restore',exact:true}).click();
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return data['personal-os.tasks.v1'].some(x=>x.id==='due-only');}).toBe(true);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export backup',exact:true}).click()]);const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const backup=JSON.parse(Buffer.concat(chunks).toString());expect(backup.format).toBe('personal-os-backup');expect(backup.data['personal-os.tasks.v1'].some(x=>x.id==='due-only')).toBe(true);
 await page.getByRole('button',{name:'Close / إغلاق',exact:true}).click();await remove();await page.getByRole('button',{name:'Data and backup',exact:true}).click();
 await page.locator('.trash-item').filter({hasText:'Deadline only'}).getByRole('button',{name:'Delete forever',exact:true}).click();await page.getByRole('button',{name:'Confirm permanent deletion',exact:true}).click();
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return data['personal-os.trash.v1'].some(x=>x.item.id==='due-only');}).toBe(false);expect(backup.data['personal-os.tasks.v1'].some(x=>x.id==='due-only')).toBe(true);
});
test('routine check-ins persist and linked focus sessions record paused and elapsed time without duplicate logs',async({page})=>{
 await signIn(page);const routine={id:'routine-test',kind:'routine',title:'Practice routine',area:'Learning',detail:'',date:'',time:'08:00',progress:0,archived:false,doneDates:[],routineDays:[2]};
 await seedUxWorkspace(page,'en',{'personal-os.entries.v1':{version:2,demoVersion:1,entries:[routine]}});
 const routineButton=page.getByRole('button',{name:/Practice routine/});await routineButton.click();await expect(routineButton).toHaveAttribute('aria-pressed','true');
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return data['personal-os.entries.v1'].entries[0].doneDates;}).toEqual(['2026-10-27']);
 await page.getByRole('combobox',{name:'Focus task',exact:true}).selectOption('due-only');await page.getByRole('button',{name:'Start focus',exact:true}).click();
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return typeof data['personal-os.focus.v1'].ends;}).toBe('number');
 await page.clock.setFixedTime(new Date('2026-10-27T09:00:25Z'));await page.getByRole('button',{name:'Pause and record',exact:true}).click();
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return data['personal-os.sessions.v1']?.map(x=>({taskId:x.taskId,seconds:x.seconds}));}).toEqual([{taskId:'due-only',seconds:25}]);
 await page.getByRole('button',{name:'Start focus',exact:true}).click();await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return typeof data['personal-os.focus.v1'].ends;}).toBe('number');
 await page.clock.setFixedTime(new Date('2026-10-27T09:30:00Z'));
 await expect.poll(async()=>{const data=(await (await page.request.get('/api/workspace')).json()).data;return data['personal-os.sessions.v1']?.length;}).toBe(2);
 await page.reload();await expect(routineButton).toHaveAttribute('aria-pressed','true');expect((await (await page.request.get('/api/workspace')).json()).data['personal-os.sessions.v1']).toHaveLength(2);
});
test('Arabic mobile screens and task dialog fit the viewport',async({page})=>{
 await signIn(page);await seedUxWorkspace(page,'ar');await page.setViewportSize({width:390,height:844});
 for(const route of ['/','/planner?tab=tasks','/planner?tab=week&week=2026-10-27','/planner?tab=calendar&date=2026-10-27','/life','/life/review-goal','/memory','/assistant']){
  await page.goto(route);await expect(page.locator('#main-content')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  const width=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));expect(width.document,route).toBeLessThanOrEqual(width.viewport+1);
 }
 await page.goto('/');await page.getByRole('button',{name:'مهمة جديدة',exact:true}).click();const bounds=await page.getByRole('dialog').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);
});
test('password change keeps the current session and revokes the other device',async({page,browser})=>{
 await signIn(page);await seedUxWorkspace(page);const other=await browser.newContext();const device=await other.newPage();await signIn(device);const replacement='browser-fixture-replacement-password';let changed=false;
 try{
  await page.locator('.server-connection summary').click();await page.getByLabel('كلمة المرور الحالية',{exact:true}).fill(password);await page.getByLabel('كلمة المرور الجديدة',{exact:true}).fill(replacement);
  const responsePromise=page.waitForResponse(response=>response.url().endsWith('/api/account/password')&&response.request().method()==='POST');await page.getByRole('button',{name:'تغيير كلمة المرور',exact:true}).click();const response=await responsePromise;expect(response.status()).toBe(200);changed=true;
  expect((await (await page.request.get('/api/account/status')).json()).signedIn).toBe(true);expect((await device.request.get('/api/workspace')).status()).toBe(401);
  await device.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(device.getByRole('heading',{name:'تسجيل الدخول',exact:true})).toBeVisible();
 }finally{if(changed){const response=await page.request.post('/api/account/password',{headers:{Origin:'http://127.0.0.1:5187'},data:{currentPassword:replacement,newPassword:password}});expect(response.status()).toBe(200);}await other.close();}
});

const completeJourney={version:1,onboardingComplete:true,areas:['Work','Learning'],wakeTime:'07:00',eveningTime:'20:00',focusDate:'',focusIds:[]};
async function workspace(page){return (await (await page.request.get('/api/workspace')).json()).data;}
test('three-step onboarding saves reviewed preferences, one goal and three tasks once',async({page})=>{
 await signIn(page);await seedUxWorkspace(page,'en',{'personal-os.tasks.v1':[],'personal-os.entries.v1':{version:2,demoVersion:1,entries:[]},'personal-os.journey.v1':{...completeJourney,onboardingComplete:false,areas:[]}});
 await page.setViewportSize({width:390,height:844});const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await dialog.getByRole('checkbox',{name:'Work',exact:true}).check();await dialog.getByRole('checkbox',{name:'Learning',exact:true}).check();await dialog.getByLabel('Wake-up time',{exact:true}).fill('06:30');await dialog.getByRole('combobox',{name:'Week starts on',exact:true}).selectOption('6');await dialog.getByRole('checkbox',{name:'Dark theme',exact:true}).check();await dialog.getByRole('button',{name:'Next',exact:true}).click();await dialog.getByRole('combobox',{name:'Starting template',exact:true}).selectOption('language');await dialog.getByLabel('Your first goal',{exact:true}).fill('Learn conversational Arabic');await dialog.getByRole('button',{name:'Next',exact:true}).click();await expect(dialog.getByLabel('First task 1',{exact:true})).not.toHaveValue('');await dialog.getByRole('button',{name:'Create my starting plan',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect.poll(async()=>{const data=await workspace(page);return [data['personal-os.tasks.v1'].length,data['personal-os.entries.v1'].entries.length,data['personal-os.journey.v1'].wakeTime,data['personal-os.planning.v1'].weekStartsOn,data['personal-os.dark']];}).toEqual([3,1,'06:30',6,true]);await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await workspace(page))['personal-os.tasks.v1']).toHaveLength(3);
});
test('morning focus choices show capacity and preserve deadlines with explicit overdue decisions',async({page})=>{
 await signIn(page);await seedUxWorkspace(page,'en',{'personal-os.journey.v1':completeJourney,'personal-os.planning.v1':{weekStartsOn:1,capacity:60,buffer:10,timezone:'Africa/Cairo'},'personal-os.tasks.v1':[{id:'a',title:'Overdue call',category:'Work',done:false,archived:false,dueDate:'2026-10-26',estimate:40},{id:'b',title:'Study',category:'Learning',done:false,archived:false,dueDate:'2026-10-27',estimate:40},{id:'c',title:'Read',category:'Learning',done:false,archived:false,estimate:40},{id:'d',title:'Walk',category:'Health',done:false,archived:false,estimate:40}]});
 for(const title of ['Overdue call','Study','Read'])await page.getByRole('checkbox',{name:'Focus choice: '+title,exact:true}).check();await expect(page.getByRole('checkbox',{name:'Focus choice: Walk',exact:true})).toBeDisabled();await expect(page.locator('.capacity-summary')).toContainText('over capacity');await page.getByRole('button',{name:'Start my day (3/3)',exact:true}).click();await expect.poll(async()=>{const data=await workspace(page);return data['personal-os.journey.v1'].focusIds;}).toEqual(['a','b','c']);const tasks=(await workspace(page))['personal-os.tasks.v1'];expect(tasks[0].dueDate).toBe('2026-10-26');expect(tasks.slice(0,3).every(task=>task.plannedDate==='2026-10-27')).toBe(true);
 await page.reload();await expect(page.getByRole('button',{name:'Review today’s plan',exact:true})).toBeVisible();await page.getByRole('button',{name:'Review today’s plan',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Focus choice: Study',exact:true})).toBeChecked();
});
test('natural quick capture previews time and area, and shortcuts respect typing and compact task forms',async({page})=>{
 await signIn(page);await seedUxWorkspace(page,'en',{'personal-os.journey.v1':completeJourney});await page.getByRole('button',{name:'Quick capture',exact:true}).click();await page.getByLabel('What is on your mind?',{exact:true}).fill('اتصل بأحمد بكرة 4 العصر #شغل');await page.getByRole('button',{name:'Review items',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Planned day (optional, not a deadline)',{exact:true})).toHaveValue('2026-10-28');await expect(dialog.getByLabel('Execution time (optional, 24 hour)',{exact:true})).toHaveValue('16:00');await expect(dialog.getByRole('combobox',{name:'Life area',exact:true})).toHaveValue('Work');await dialog.getByRole('button',{name:'Confirm 1 items',exact:true}).click();await expect(dialog).toContainText('Saved together, once.');await page.keyboard.press('Escape');
 await page.locator('body').click({position:{x:500,y:80}});await page.keyboard.press('n');await expect(page.getByRole('dialog').getByLabel('Task title',{exact:true})).toBeVisible();await expect(page.getByRole('dialog').getByLabel('Description',{exact:true})).not.toBeVisible();await page.getByRole('dialog').getByLabel('Task title',{exact:true}).fill('f/n typed text');await expect(page.getByRole('dialog')).toHaveCount(1);await page.keyboard.press('Escape');await page.locator('body').click({position:{x:500,y:80}});await page.keyboard.press('/');await expect(page.getByLabel('Global search',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await page.locator('body').click({position:{x:500,y:80}});await page.keyboard.press('f');await expect(page.getByRole('combobox',{name:'Focus task',exact:true})).toBeFocused();
 const saved=(await workspace(page))['personal-os.tasks.v1'].find(task=>task.title.includes('بأحمد'));expect(saved).toMatchObject({plannedDate:'2026-10-28',plannedTime:'16:00',category:'Work',tags:['شغل']});
});
test('saved task completion and archive offer undo without overwriting newer edits',async({page})=>{
 await signIn(page);await seedUxWorkspace(page,'en',{'personal-os.journey.v1':completeJourney});await page.goto('/planner?tab=tasks&filter=all');await page.getByRole('button',{name:'Complete: Deadline only',exact:true}).click();await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeVisible();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>{return (await workspace(page))['personal-os.tasks.v1'].find(task=>task.id==='due-only').done;}).toBe(false);
 await page.getByRole('button',{name:'Archive: Deadline only',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>{return (await workspace(page))['personal-os.tasks.v1'].find(task=>task.id==='due-only').archived;}).toBe(false);
 await page.getByRole('button',{name:'Complete: Deadline only',exact:true}).click();await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeVisible();const snapshot=await (await page.request.get('/api/workspace')).json();const changed={...snapshot.data,'personal-os.tasks.v1':snapshot.data['personal-os.tasks.v1'].map(task=>task.id==='due-only'?{...task,title:'Newer task edit'}:task)};expect((await page.request.put('/api/workspace/commit',{headers:{Origin:'http://127.0.0.1:5187'},data:{revision:snapshot.revision,data:changed}})).status()).toBe(200);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('button',{name:'Complete: Newer task edit',exact:true})).toBeVisible();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.undo-notice')).toContainText('Could not undo');expect((await workspace(page))['personal-os.tasks.v1'].find(task=>task.id==='due-only')).toMatchObject({done:true,title:'Newer task edit'});
});
test('evening review rolls only selected tasks and weekly review saves three results with a six-area radar',async({page})=>{
 await signIn(page);await seedUxWorkspace(page,'en',{'personal-os.journey.v1':completeJourney});await page.clock.setFixedTime(new Date('2026-10-27T19:00:00Z'));await page.reload();await expect(page.getByRole('link',{name:'Open evening review',exact:true})).toBeVisible();const review=page.locator('#daily-review');await review.locator('summary').click();await review.getByRole('checkbox',{name:'Move tomorrow: Deadline only',exact:true}).check();await review.getByRole('button',{name:'Confirm selected tasks for tomorrow',exact:true}).click();await review.getByRole('button',{name:'Mood 4',exact:true}).click();await review.getByLabel('Evening note',{exact:true}).fill('Useful focused day');await review.getByRole('button',{name:'Finish evening review',exact:true}).click();await expect(page.getByRole('link',{name:'Open evening review',exact:true})).toHaveCount(0);await expect.poll(async()=>{const data=await workspace(page);return data['personal-os.reviews.v1']['2026-10-27'].note;}).toBe('Useful focused day');const data=await workspace(page);expect(data['personal-os.reviews.v1']['2026-10-27'].mood).toBe(4);expect(data['personal-os.tasks.v1'].find(task=>task.id==='due-only')).toMatchObject({plannedDate:'2026-10-28',dueDate:'2026-10-27'});
 await page.goto('/planner?tab=week&week=2026-10-27&review=1');await expect(page.getByRole('img',{name:'Life areas recorded activity radar',exact:true})).toBeVisible();expect(await page.locator('.area-activity button').count()).toBe(6);for(let i=1;i<=3;i++)await page.getByLabel('Next week result '+i,{exact:true}).fill('Next result '+i);await page.getByRole('button',{name:'Save three results for next week',exact:true}).click();await expect.poll(async()=>{return (await workspace(page))['personal-os.weeks.v1']['2026-11-02'].outcomes.map(item=>item.title);}).toEqual(['Next result 1','Next result 2','Next result 3']);
});
test('elapsed focus asks before completion, records once, and accepts an explicit answer',async({page})=>{
 await signIn(page);await seedUxWorkspace(page,'en',{'personal-os.journey.v1':completeJourney});const focus=page.locator('#daily-focus');await focus.getByRole('combobox',{name:'Focus task',exact:true}).selectOption('due-only');await focus.getByRole('button',{name:'Start focus',exact:true}).click();await expect.poll(async()=>typeof (await workspace(page))['personal-os.focus.v1'].ends).toBe('number');await page.clock.setFixedTime(new Date('2026-10-27T09:25:01Z'));await expect(focus.getByRole('group',{name:'Focus completion question',exact:true})).toBeVisible();expect((await workspace(page))['personal-os.tasks.v1'].find(task=>task.id==='due-only').done).toBe(false);await page.reload();await expect(focus.getByRole('group',{name:'Focus completion question',exact:true})).toBeVisible();expect((await workspace(page))['personal-os.sessions.v1']).toHaveLength(1);await focus.getByRole('button',{name:'Yes, mark complete',exact:true}).click();await expect(focus.getByRole('group',{name:'Focus completion question',exact:true})).toHaveCount(0);await expect.poll(async()=>{const data=await workspace(page);return [data['personal-os.tasks.v1'].find(task=>task.id==='due-only').done,data['personal-os.sessions.v1'].length,data['personal-os.sessions.v1'][0].seconds];}).toEqual([true,1,1500]);
});
test('overdue Today, Defer and Cancel decisions preserve the original due dates',async({page})=>{
 await signIn(page);const tasks=['a','b','c'].map(id=>({id,title:'Late '+id,category:'Work',done:false,archived:false,dueDate:'2026-10-26'}));await seedUxWorkspace(page,'en',{'personal-os.journey.v1':completeJourney,'personal-os.tasks.v1':tasks});await page.locator('.daily-cycle summary').click();const rows=page.locator('.overdue-choice');await rows.filter({hasText:'Late a'}).getByRole('button',{name:'Today',exact:true}).click();await rows.filter({hasText:'Late b'}).getByRole('button',{name:'Defer',exact:true}).click();await page.getByLabel('Deferred task date',{exact:true}).fill('2026-10-30');await page.getByRole('button',{name:'Confirm defer',exact:true}).click();await rows.filter({hasText:'Late c'}).getByRole('button',{name:'Cancel task',exact:true}).click();await expect.poll(async()=>{const all=(await workspace(page))['personal-os.tasks.v1'];return all.map(task=>[task.plannedDate??'',task.status??'todo',task.dueDate]);}).toEqual([['2026-10-27','todo','2026-10-26'],['2026-10-30','deferred','2026-10-26'],['','cancelled','2026-10-26']]);
});
