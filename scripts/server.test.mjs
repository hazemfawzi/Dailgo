import { request as httpRequest } from 'node:http';
import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createLocalServer } from '../server/index.mjs';
const folder=fileURLToPath(new URL('../.local-data/tests/',import.meta.url));mkdirSync(folder,{recursive:true});
const {server,db}=createLocalServer(folder+randomUUID()+'.sqlite');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
const base='http://127.0.0.1:'+server.address().port;const origin='http://127.0.0.1:5173';let cookie='';
async function call(path,method='GET',body,otherOrigin=origin){const response=await fetch(base+'/api/'+path,{method,headers:{Origin:otherOrigin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {response,body:await response.json()};}
test('local server rejects unauthenticated workspace requests and cross-origin writes',async()=>{assert.equal((await call('health')).body.ai,'not-configured');assert.equal((await call('workspace')).response.status,401);assert.equal((await call('account/setup','POST',{username:'test-user',password:'technical-test-password'},'https://untrusted.example')).response.status,403);});
test('one local account uses hashed credentials and an HttpOnly session',async()=>{assert.equal((await call('account/setup','POST',{username:'test-user',password:'short'})).response.status,400);const created=await call('account/setup','POST',{username:'test-user',password:'technical-test-password'});assert.equal(created.response.status,201);const header=created.response.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);cookie=header.split(';')[0];assert.equal((await call('account/status')).body.signedIn,true);assert.notEqual(db.prepare('SELECT password FROM account').get().password,'technical-test-password');assert.equal((await call('account/setup','POST',{username:'another',password:'technical-test-password'})).response.status,409);});
test('server snapshots require valid shape and compare-and-swap revision',async()=>{const initial=await call('workspace');assert.deepEqual(initial.body,{revision:'empty',data:null});const uploaded=await call('workspace','PUT',{revision:'empty',data:{'personal-os.tasks.v1':[]}});assert.equal(uploaded.response.status,200);assert.equal((await call('workspace','PUT',{revision:'empty',data:{}})).response.status,409);const bad=await call('workspace','PUT',{revision:uploaded.body.revision,data:{unknown:'invalid'}});assert.equal(bad.response.status,400);const saved=await call('workspace');assert.equal(saved.body.revision,uploaded.body.revision);assert.deepEqual(saved.body.data,{'personal-os.tasks.v1':[]});});
test('logout invalidates sessions; valid login does not transfer or replace records',async()=>{assert.equal((await call('account/logout','POST',{})).response.status,200);assert.equal((await call('workspace')).response.status,401);assert.equal((await call('account/login','POST',{username:'test-user',password:'wrong-value'})).response.status,401);const login=await call('account/login','POST',{username:'test-user',password:'technical-test-password'});assert.equal(login.response.status,200);cookie=login.response.headers.get('set-cookie').split(';')[0];assert.deepEqual((await call('workspace')).body.data,{'personal-os.tasks.v1':[]});});
test('production app, deep routes, manifest and offline worker are served locally',async()=>{for(const path of ['/','/assistant/actions','/manifest.webmanifest','/sw.js','/icon-192.png']){const response=await fetch(base+path);assert.equal(response.status,200);assert.equal(response.headers.get('x-content-type-options'),'nosniff');}const manifest=await (await fetch(base+'/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');const sw=await (await fetch(base+'/sw.js')).text();assert.match(sw,/personal-os-shell-/);assert.match(sw,/\/api\//);});

import { readConfig } from '../server/config.mjs';
import { backupDatabase,resetPassword } from '../server/maintenance.mjs';
import { DatabaseSync } from 'node:sqlite';
const prodFile=folder+'production-'+randomUUID()+'.sqlite';const prodOrigin='https://assistant.example.test';const setupToken='fixture-setup-token-'+randomUUID();const production=createLocalServer(prodFile,{config:readConfig({NODE_ENV:'production',APP_ORIGIN:prodOrigin,PERSONAL_OS_DB:prodFile,PERSONAL_OS_SETUP_TOKEN:setupToken})});await new Promise(resolve=>production.server.listen(0,'127.0.0.1',resolve));after(async()=>{await new Promise(resolve=>production.server.close(resolve));production.db.close();});const prodBase='http://127.0.0.1:'+production.server.address().port;let prodCookie='';
async function prodCall(path,method='GET',body,headers={}){return new Promise((resolve,reject)=>{const req=httpRequest(prodBase+'/api/'+path,{method,headers:{Host:'assistant.example.test','X-Forwarded-Proto':'https',Origin:prodOrigin,...(body?{'Content-Type':'application/json'}:{}),...(prodCookie?{Cookie:prodCookie}:{}),...headers}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({response:{status:res.statusCode,headers:{get:name=>{const value=res.headers[name.toLowerCase()];return Array.isArray(value)?value[0]:value;}}},body:JSON.parse(Buffer.concat(chunks).toString())}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});}
test('production config fails closed for missing origin, insecure origin, missing private DB and placeholder token',()=>{assert.throws(()=>readConfig({NODE_ENV:'production'}));assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:'http://app.test',PERSONAL_OS_DB:prodFile}));assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:prodOrigin}));assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:prodOrigin,PERSONAL_OS_DB:prodFile,PERSONAL_OS_SETUP_TOKEN:'REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS'}));});
test('production enforces exact HTTPS proxy/host/origin and private account bootstrap',async()=>{assert.equal((await prodCall('health','GET',undefined,{'X-Forwarded-Proto':'http'})).response.status,400);assert.equal((await prodCall('health','GET',undefined,{Host:'wrong.example.test'})).response.status,400);assert.equal((await prodCall('health')).body.status,'production');const body={username:'production-test',password:'production-test-password'};assert.equal((await prodCall('account/setup','POST',body,{Origin:'https://wrong.example.test'})).response.status,403);assert.equal((await prodCall('account/setup','POST',body)).response.status,403);const created=await prodCall('account/setup','POST',{...body,setupToken});assert.equal(created.response.status,201);const cookie=created.response.headers.get('set-cookie');assert.match(cookie,/; Secure/);assert.match(cookie,/HttpOnly/);prodCookie=cookie.split(';')[0];});
test('password changes revoke other sessions and secure sessions can use validated snapshots',async()=>{const oldCookie=prodCookie;assert.equal((await prodCall('workspace','PUT',{revision:'empty',data:{'personal-os.tasks.v1':[]}})).response.status,200);const changed=await prodCall('account/password','POST',{currentPassword:'production-test-password',newPassword:'production-replacement-password'});assert.equal(changed.response.status,200);prodCookie=changed.response.headers.get('set-cookie').split(';')[0];assert.equal((await prodCall('workspace','GET',undefined,{Cookie:oldCookie})).response.status,401);assert.deepEqual((await prodCall('workspace')).body.data,{'personal-os.tasks.v1':[]});});
test('online backups capture committed WAL data; administrative password reset revokes sessions',async()=>{const backupFile=await backupDatabase(prodFile,folder+'verified-backups');const snapshot=new DatabaseSync(backupFile,{readOnly:true});assert.deepEqual(JSON.parse(snapshot.prepare('SELECT data FROM workspace WHERE id=1').get().data),{'personal-os.tasks.v1':[]});snapshot.close();resetPassword(prodFile,'administrator-test-replacement');assert.equal((await prodCall('workspace')).response.status,401);const login=await prodCall('account/login','POST',{username:'production-test',password:'administrator-test-replacement'});assert.equal(login.response.status,200);});


test('private database locations and file URLs are never public app routes',async()=>{
 assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:prodOrigin,PERSONAL_OS_DB:fileURLToPath(new URL('../dist/private.sqlite',import.meta.url))}));
 for(const path of ['/.env','/workspace.sqlite','/workspace.sqlite-wal','/server/config.mjs'])assert.equal((await fetch(base+path)).status,404);
});

// Independent account/database: resource tests never touch the user's workspace.
const apiFixture=createLocalServer(folder+'api-'+randomUUID()+'.sqlite');
await new Promise(resolve=>apiFixture.server.listen(0,'127.0.0.1',resolve));
after(async()=>{await new Promise(resolve=>apiFixture.server.close(resolve));apiFixture.db.close();});
const apiBase='http://127.0.0.1:'+apiFixture.server.address().port;let apiCookie='';let apiRevision='empty';
async function resourceCall(path,method='GET',body,authenticated=true){const response=await fetch(apiBase+'/api/'+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(authenticated&&apiCookie?{Cookie:apiCookie}:{})},body:body?JSON.stringify(body):undefined});return {response,body:await response.json()};}
test('resource APIs require authentication and create audited tasks with revision protection',async()=>{
 assert.equal((await resourceCall('records/tasks')).response.status,401);
 const setup=await resourceCall('account/setup','POST',{username:'api-fixture',password:'api-fixture-test-password'});apiCookie=setup.response.headers.get('set-cookie').split(';')[0];
 const item={id:'api-task',title:'API task',category:'Work',done:false,archived:false};
 const created=await resourceCall('records/tasks','POST',{revision:apiRevision,item});assert.equal(created.response.status,200);apiRevision=created.body.revision;
 assert.equal(created.body.data['personal-os.tasks.v1'][0].history[0].fields[0],'created');
 const stale=await resourceCall('records/tasks/api-task','PATCH',{revision:'empty',item:{title:'Stale write'}});assert.equal(stale.response.status,409);
 const changed=await resourceCall('records/tasks/api-task','PATCH',{revision:apiRevision,item:{title:'Updated task',history:[]}});assert.equal(changed.response.status,200);apiRevision=changed.body.revision;assert.equal(changed.body.data['personal-os.tasks.v1'][0].history.length,2);
 assert.equal((await resourceCall('records/tasks/api-task')).body.item.title,'Updated task');
 const invalid=await resourceCall('records/tasks','POST',{revision:apiRevision,item:{id:'invalid'}});assert.equal(invalid.response.status,400);assert.equal((await resourceCall('workspace')).body.revision,apiRevision);
});
test('goals, projects, events, routines and memories have isolated resource APIs',async()=>{
 for(const [name,kind] of [['goals','goal'],['projects','project'],['events','event'],['routines','routine'],['memories','note']]){
  const item={id:'api-'+kind,kind,title:'API '+kind,area:'Personal',detail:'',date:'',time:'',progress:0,archived:false,doneDates:[]};
  const result=await resourceCall('records/'+name,'POST',{revision:apiRevision,item});assert.equal(result.response.status,200);apiRevision=result.body.revision;
  const listed=await resourceCall('records/'+name);assert.deepEqual(listed.body.items.map(x=>x.id),[item.id]);
 }
 assert.equal((await resourceCall('records/goals/api-note')).response.status,404);
 const invalid=await resourceCall('records/goals/api-goal','PATCH',{revision:apiRevision,item:{kind:'note'}});assert.equal(invalid.response.status,400);
});
test('planning, weekly reviews, focus and sessions persist through their APIs',async()=>{
 for(const [name,value] of [['planning',{weekStartsOn:6,capacity:240,buffer:30,timezone:'Africa/Cairo'}],['weeks',{'2026-10-24':{outcomes:[],capacities:{},review:{wins:'Done',obstacles:'',next:''}}}],['reviews',{'2026-10-25':{wins:'Done',obstacles:'',next:'Next'}}],['focus',{ends:null,remaining:1500}]]){
  const result=await resourceCall('state/'+name,'PUT',{revision:apiRevision,value});assert.equal(result.response.status,200);apiRevision=result.body.revision;assert.deepEqual((await resourceCall('state/'+name)).body.value,value);
 }
 const conversation=await resourceCall('records/conversations','POST',{revision:apiRevision,item:{id:'api-conversation',title:'Hello',archived:false,messages:[]}});assert.equal(conversation.response.status,200);apiRevision=conversation.body.revision;
 const session=await resourceCall('records/sessions','POST',{revision:apiRevision,item:{id:'api-session',taskId:'api-task',startedAt:'2026-10-25T10:00:00Z',endedAt:'2026-10-25T10:05:00Z',seconds:300}});assert.equal(session.response.status,200);apiRevision=session.body.revision;
});
test('atomic commits audit on the server and reject stale record revisions without partial writes',async()=>{
 const before=(await resourceCall('workspace')).body;
 const invalid=structuredClone(before.data);invalid['personal-os.tasks.v1'][0].title='stale edit';invalid['personal-os.tasks.v1'][0].revision='stale';invalid['personal-os.reviews.v1']['2026-10-25'].wins='must not save';
 assert.equal((await resourceCall('workspace/commit','PUT',{revision:apiRevision,data:invalid})).response.status,409);
 assert.deepEqual((await resourceCall('workspace')).body,before);
 const valid=structuredClone(before.data);valid['personal-os.tasks.v1'][0].title='Atomic task';valid['personal-os.reviews.v1']['2026-10-25'].wins='Atomic review';
 const result=await resourceCall('workspace/commit','PUT',{revision:apiRevision,data:valid});assert.equal(result.response.status,200);apiRevision=result.body.revision;assert.equal(result.body.data['personal-os.tasks.v1'][0].history.length,3);assert.equal(result.body.data['personal-os.reviews.v1']['2026-10-25'].wins,'Atomic review');
});
test('deleting a record creates recoverable trash and stale devices cannot delete newer data',async()=>{
 const before=apiRevision;const deleted=await resourceCall('records/tasks/api-task','DELETE',{revision:apiRevision});assert.equal(deleted.response.status,200);apiRevision=deleted.body.revision;
 assert.equal(deleted.body.data['personal-os.tasks.v1'].length,0);assert.equal(deleted.body.data['personal-os.trash.v1'][0].item.id,'api-task');
 assert.equal((await resourceCall('records/goals/api-goal','DELETE',{revision:before})).response.status,409);
 assert.equal((await resourceCall('records/goals/api-goal')).response.status,200);
});
test('reparenting projects through the API moves linked task goals atomically',async()=>{
 const goal={id:'api-next-goal',kind:'goal',title:'Next goal',area:'Work',detail:'',date:'',time:'',progress:0,archived:false,doneDates:[]};
 let result=await resourceCall('records/goals','POST',{revision:apiRevision,item:goal});assert.equal(result.response.status,200);apiRevision=result.body.revision;
 result=await resourceCall('records/tasks','POST',{revision:apiRevision,item:{id:'project-linked-task',title:'Linked task',category:'Work',done:false,archived:false,projectId:'api-project',goalId:'api-goal',milestoneId:'old-milestone'}});assert.equal(result.response.status,200);apiRevision=result.body.revision;
 const before=apiRevision;
 result=await resourceCall('records/projects/api-project','PATCH',{revision:apiRevision,item:{parentGoalId:'api-next-goal'}});assert.equal(result.response.status,200);apiRevision=result.body.revision;
 const linked=result.body.data['personal-os.tasks.v1'].find(x=>x.id==='project-linked-task');assert.equal(linked.goalId,'api-next-goal');assert.equal(linked.milestoneId,undefined);
 assert.equal(result.body.data['personal-os.entries.v1'].entries.find(x=>x.id==='api-project').parentGoalId,'api-next-goal');
 assert.equal((await resourceCall('records/projects/api-project','PATCH',{revision:before,item:{parentGoalId:'api-goal'}})).response.status,409);
});


// Exercise the actual executable entry points through the same current symlink
// used by systemd, rather than importing their exported functions directly.
const { mkdtempSync,symlinkSync,readdirSync,rmSync }=await import('node:fs');
const { tmpdir }=await import('node:os');
const { join }=await import('node:path');
const { spawn,execFileSync }=await import('node:child_process');
const { createServer: createPortReservation }=await import('node:net');
function cliFixture(t,cleanup=true){
 const directory=mkdtempSync(join(tmpdir(),'dailgo-cli-'));
 if(cleanup)t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const release=join(directory,'releases','release with spaces');mkdirSync(release,{recursive:true});
 execFileSync(process.execPath,['scripts/package-vps.mjs',release],{stdio:'pipe'});
 const current=join(directory,'current');symlinkSync(release,current,'dir');
 const database=join(directory,'private','workspace.sqlite');mkdirSync(join(directory,'private'));
 const env={...process.env,NODE_ENV:'production',APP_ORIGIN:'https://dailgo.decoderz.dev',PERSONAL_OS_DB:database,PERSONAL_OS_SETUP_TOKEN:'fixture-setup-token-'+randomUUID()};
 return {directory,current,database,env};
}
test('packaged server starts and serves production health through the current release symlink',async t=>{
 const fixture=cliFixture(t,false);let child;let exited;
 t.after(async()=>{try{if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);try{await exited;}finally{clearTimeout(timer);}}}finally{rmSync(fixture.directory,{recursive:true,force:true});}});
 const reservation=createPortReservation();
 await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 child=spawn(process.execPath,[join(fixture.current,'server','index.mjs')],{cwd:fixture.current,env:{...fixture.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let diagnostics='';child.stderr.on('data',chunk=>{diagnostics+=chunk;});
 exited=new Promise(resolve=>child.once('exit',resolve));
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Server did not start: '+diagnostics)),5000);
  const fail=(code,signal)=>{clearTimeout(timer);reject(Error(`Server exited before readiness: code=${code}, signal=${signal}; ${diagnostics}`));};
  child.once('exit',fail);child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.stdout.on('data',chunk=>{if(String(chunk).includes('Application listener ready')){clearTimeout(timer);child.removeListener('exit',fail);resolve();}});
 });
 const response=await new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port,path:'/api/health',headers:{Host:'dailgo.decoderz.dev','X-Forwarded-Proto':'https'}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))}));});req.on('error',reject);req.end();});
 assert.equal(response.status,200);assert.equal(response.body.status,'production');
});
test('packaged maintenance command creates a verified backup through the current release symlink',t=>{
 const fixture=cliFixture(t);const database=new DatabaseSync(fixture.database);database.exec("CREATE TABLE marker(value TEXT); INSERT INTO marker VALUES('retained data')");database.close();
 const backups=join(fixture.directory,'backups');
 const output=execFileSync(process.execPath,[join(fixture.current,'server','maintenance.mjs'),'backup',backups],{cwd:fixture.current,env:fixture.env,encoding:'utf8'});
 assert.match(output,/Verified database backup created/);
 const files=readdirSync(backups);assert.equal(files.length,1);
 const snapshot=new DatabaseSync(join(backups,files[0]),{readOnly:true});try{assert.equal(snapshot.prepare('SELECT value FROM marker').get().value,'retained data');assert.equal(Object.values(snapshot.prepare('PRAGMA quick_check').get())[0],'ok');}finally{snapshot.close();}
});

test('goal API and atomic commits reject milestones beyond the target without partial writes',async()=>{
 const item={id:'dated-goal',kind:'goal',title:'Dated goal',area:'Work',detail:'',date:'2026-12-31',time:'',progress:0,archived:false,doneDates:[],milestones:[]};
 let result=await resourceCall('records/goals','POST',{revision:apiRevision,item});assert.equal(result.response.status,200);apiRevision=result.body.revision;
 const before=(await resourceCall('workspace')).body;
 result=await resourceCall('records/goals/dated-goal','PATCH',{revision:apiRevision,item:{milestones:[{id:'m',title:'Late milestone',date:'2027-06-01'}]}});assert.equal(result.response.status,400);assert.deepEqual((await resourceCall('workspace')).body,before);
 result=await resourceCall('records/goals/dated-goal','PATCH',{revision:apiRevision,item:{milestones:[{id:'m',title:'Valid milestone',date:'2026-12-01'}]}});assert.equal(result.response.status,200);apiRevision=result.body.revision;
 const valid=(await resourceCall('workspace')).body;
 result=await resourceCall('records/goals/dated-goal','PATCH',{revision:apiRevision,item:{date:'2026-11-01'}});assert.equal(result.response.status,400);
 const invalid=structuredClone(valid.data);invalid['personal-os.entries.v1'].entries.find(x=>x.id==='dated-goal').milestones[0].date='2027-06-01';
 result=await resourceCall('workspace/commit','PUT',{revision:apiRevision,data:invalid});assert.equal(result.response.status,400);assert.deepEqual((await resourceCall('workspace')).body,valid);
});
