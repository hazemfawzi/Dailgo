import { test,expect } from '@playwright/test';
const username='browser-fixture';const password='browser-fixture-test-password';
async function signIn(page){const status=await (await page.request.get('/api/account/status')).json();if(!status.configured){await page.request.post('/api/account/setup',{headers:{Origin:'http://127.0.0.1:5187'},data:{username,password}});await page.request.put('/api/workspace',{headers:{Origin:'http://127.0.0.1:5187'},data:{revision:'empty',data:{'personal-os.language':'en','personal-os.tasks.v1':[],'personal-os.entries.v1':{version:2,demoVersion:1,entries:[]}}}});await page.request.post('/api/account/logout',{headers:{Origin:'http://127.0.0.1:5187'},data:{}});}await page.goto('/');await page.getByLabel('اسم المستخدم').fill(username);await page.getByLabel('كلمة المرور (12 حرفًا على الأقل)').fill(password);await page.getByRole('button',{name:'دخول',exact:true}).click();await expect(page.getByRole('button',{name:'New task',exact:true})).toBeVisible();}
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
