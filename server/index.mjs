import { createWidgets } from './widgets.mjs';
import { createNotifications } from './notifications.mjs';
import { createBilling } from './billing.mjs';
import { createCalendar } from './calendar.mjs';
import { createCollaboration } from './collaboration.mjs';
import { identityStore } from './identity.mjs';
import { createAssistantService } from './assistant.mjs';
import { resource,stateKeys } from './resources.mjs';
import { readConfig } from './config.mjs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash } from 'node:crypto';
import { mkdirSync,existsSync,readFileSync,chmodSync,realpathSync } from 'node:fs';
import { dirname,resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const { validateData,auditWorkspace,validateGoalDateChanges }=await import(new URL('./domain.mjs',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const defaultDb=fileURLToPath(new URL('../.local-data/workspace.sqlite',import.meta.url));
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
export function createLocalServer(file=defaultDb,options={}){
 const config=options.config??readConfig();
 mkdirSync(dirname(file),{recursive:true,mode:0o700});const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS account(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL,data TEXT NOT NULL);');
 const identities=identityStore(db);const collaboration=createCollaboration(db,identities);const widgets=createWidgets(db,identities);const assistant=createAssistantService(db,{...options.assistant,getWorkspace:principal=>identities.workspace(principal).data});const billing=createBilling(db,options.billing);const calendar=createCalendar(db,options.calendar);const notifications=createNotifications(db,identities,options.notifications);
 chmodSync(file,0o600);const attempts=new Map();
 const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
 const configured=()=>db.prepare('SELECT username FROM account WHERE id=1').get();
 const session=req=>{const cookies=Object.fromEntries((req.headers.cookie??'').split(';').map(x=>x.trim().split('=')));const member=cookies.dailgo_member_session;if(member){const result=db.prepare('SELECT token,principal FROM member_sessions WHERE token=? AND expires>?').get(hash(member),Date.now());if(result&&identities.user(result.principal))return {...result,member:true};}const token=cookies.personal_os_session;const owner=token?db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(hash(token),Date.now()):undefined;return owner?{...owner,principal:'owner',member:false}:undefined;};
 const setSession=(res,principal='owner')=>{const token=randomBytes(32).toString('hex');const member=principal!=='owner';const table=member?'member_sessions':'sessions';db.prepare('DELETE FROM '+table+' WHERE expires<=?').run(Date.now());if(member)db.prepare('INSERT INTO member_sessions VALUES(?,?,?)').run(hash(token),principal,Date.now()+43200000);else db.prepare('INSERT INTO sessions VALUES(?,?)').run(hash(token),Date.now()+43200000);const secure=config.cookieSecure?'; Secure':'';res.setHeader('Set-Cookie',[`${member?'dailgo_member_session':'personal_os_session'}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=43200${secure}`,`${member?'personal_os_session':'dailgo_member_session'}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`]);};
 const read=async(req,maxBytes=10*1024*1024)=>{if(!String(req.headers['content-type']??'').startsWith('application/json'))throw Error('content-type');let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>maxBytes)throw Error('too-large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));};
  const server=createServer(async(req,res)=>{try{
 if(config.production){res.setHeader('Strict-Transport-Security','max-age=31536000');if(req.headers.host!==new URL(config.origin).host||req.headers['x-forwarded-proto']!=='https')return send(res,400,{error:'https-host-required'});}
 const url=new URL(req.url??'/','http://127.0.0.1');
 if(!url.pathname.startsWith('/api/')){
 if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'method-not-allowed'});
 const requestedPath=decodeURIComponent(url.pathname);if(requestedPath.split('/').some(part=>part.startsWith('.'))||/\.(?:sqlite(?:-wal|-shm)?|env|mjs)$/i.test(requestedPath))return send(res,404,{error:'not-found'});let path=resolve(dist,'.'+requestedPath);if(path!==resolve(dist)&&!path.startsWith(resolve(dist)+sep))return send(res,404,{error:'not-found'});
 if(!existsSync(path)&&extname(path))return send(res,404,{error:'asset-not-found'});if(!extname(path))path=resolve(dist,'index.html');if(!existsSync(path))return send(res,404,{error:'build-required'});
 const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[extname(path)]??'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':extname(path)==='.html'||path.endsWith('sw.js')||path.endsWith('release.json')?'no-cache':'public, max-age=3600','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"});return res.end(req.method==='HEAD'?undefined:readFileSync(path));
 }
 if(url.pathname==='/api/billing/webhook'&&req.method==='POST'){try{let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>262144)throw Error('too-large');chunks.push(chunk);}return send(res,200,await billing.webhook(Buffer.concat(chunks),req.headers['stripe-signature']));}catch(error){return send(res,error.status??400,{error:error.message});}}
 if(req.method!=='GET'){
 const origin=req.headers.origin;try{const parsed=new URL(origin);if(config.production?origin!==config.origin:!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.protocol!=='http:')throw Error();}catch{return send(res,403,{error:'origin-rejected'});}
 }
 if(url.pathname==='/api/health'&&req.method==='GET')return send(res,200,{status:config.production?'production':'local-only',ai:assistant.status('owner').enabled?'available':'not-configured',integrations:[]});
 if(url.pathname==='/api/account/status'&&req.method==='GET'){const user=configured();const active=session(req);if(active)res.setHeader('X-Dailgo-Account',active.principal);return send(res,200,{configured:!!user,setupTokenRequired:config.production,setupEnabled:!config.production||!!config.setupToken,signedIn:!!session(req),username:session(req)?identities.user(session(req).principal)?.username:undefined});}
 if(url.pathname==='/api/account/setup'&&req.method==='POST'){
 if(configured())return send(res,409,{error:'already-configured'});const body=await read(req,16384);if(config.production&&(!config.setupToken||typeof body.setupToken!=='string'||!timingSafeEqual(Buffer.from(hash(body.setupToken)),Buffer.from(hash(config.setupToken)))))return send(res,403,{error:'setup-token-required'});if(typeof body.username!=='string'||body.username.trim().length<3||body.username.length>80||typeof body.password!=='string'||body.password.length<12||body.password.length>200)return send(res,400,{error:'invalid-credentials'});
 const salt=randomBytes(16).toString('hex');db.prepare('INSERT INTO account VALUES(1,?,?,?)').run(body.username.trim(),salt,scryptSync(body.password,salt,64).toString('hex'));setSession(res);return send(res,201,{configured:true,signedIn:true});
 }
 if(url.pathname==='/api/account/accept-invite'&&req.method==='POST'){try{const principal=collaboration.accept(await read(req,16384));setSession(res,principal);return send(res,201,{signedIn:true});}catch(error){return send(res,error.status??400,{error:error.message});}}
 if(url.pathname==='/api/public/goal'&&req.method==='POST'){try{const body=await read(req,16384);return send(res,200,body.comment===undefined?collaboration.shared(body.token):collaboration.comment(body.token,body.comment));}catch(error){return send(res,error.status??400,{error:error.message});}}
 if(url.pathname==='/api/public/verify-email'&&req.method==='POST'){try{return send(res,200,notifications.verify((await read(req,16384)).token));}catch(error){return send(res,error.status??400,{error:error.message});}}
 if(url.pathname==='/api/account/login'&&req.method==='POST'){
 for(const [address,value] of attempts)if(value.until<Date.now())attempts.delete(address);const key=config.production?String(req.headers['x-real-ip']??req.socket.remoteAddress):req.socket.remoteAddress;if(!attempts.has(key)&&attempts.size>=10000)return send(res,429,{error:'try-later'});let rate=attempts.get(key);if(!rate||rate.until<Date.now()){rate={count:0,until:Date.now()+300000};attempts.set(key,rate);}if(rate.count>=5)return send(res,429,{error:'try-later'});rate.count++;
 const body=await read(req,16384);const user=identities.byUsername(body.username);if(typeof body.password!=='string'||body.password.length>200||!user||body.username!==user.username||!timingSafeEqual(scryptSync(body.password,user.salt,64),Buffer.from(user.password,'hex')))return send(res,401,{error:'invalid-credentials'});attempts.delete(key);setSession(res,user.principal);return send(res,200,{signedIn:true});
 }
 if(url.pathname==='/api/widgets/today'&&req.method==='GET'){try{return send(res,200,widgets.today(req.headers.authorization));}catch(error){return send(res,error.status??400,{error:error.message});}}
 if(url.pathname==='/api/calendar/callback'&&req.method==='GET'){try{const cookie=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dailgo_calendar_state='))?.slice('dailgo_calendar_state='.length);await calendar.callback(cookie,url.searchParams.get('state'),url.searchParams.get('code'));res.writeHead(303,{Location:config.origin+'/tools?tab=connections&calendar=connected','Cache-Control':'no-store','Set-Cookie':'dailgo_calendar_state=; HttpOnly; SameSite=Lax; Path=/api/calendar/callback; Max-Age=0'+(config.cookieSecure?'; Secure':'')});return res.end();}catch(error){return send(res,error.status??400,{error:error.message});}}
 const signed=session(req);if(!signed)return send(res,401,{error:'sign-in-required'});const principal=signed.principal;res.setHeader('X-Dailgo-Account',principal);if(req.headers['x-dailgo-account']&&req.headers['x-dailgo-account']!==principal)return send(res,401,{error:'account-changed'});
 if(url.pathname==='/api/widgets'&&req.method==='GET')return send(res,200,{devices:widgets.list(principal)});
 if(url.pathname==='/api/widgets'&&req.method==='POST'){try{await read(req,1024);return send(res,201,widgets.create(principal));}catch(error){return send(res,error.status??400,{error:error.message});}}
 if(url.pathname.startsWith('/api/widgets/')&&req.method==='DELETE'){await read(req,1024);return send(res,200,widgets.revoke(principal,url.pathname.split('/').at(-1)));}
 if(url.pathname.startsWith('/api/notifications')||url.pathname.startsWith('/api/calendar')||url.pathname.startsWith('/api/billing')){try{
 const body=req.method==='GET'?{}:await read(req,32768);let result;
 if(url.pathname==='/api/notifications'&&req.method==='GET')result=notifications.status(principal);
 else if(url.pathname==='/api/notifications'&&req.method==='PUT')result=notifications.settings(principal,body);
 else if(url.pathname==='/api/notifications/verify'&&req.method==='POST')result=await notifications.requestVerification(principal);
 else if(url.pathname==='/api/notifications/subscribe'&&req.method==='POST')result=notifications.subscribe(principal,body);
 else if(url.pathname==='/api/notifications/subscribe'&&req.method==='DELETE')result=notifications.unsubscribe(principal,body.endpoint);
 else if(url.pathname==='/api/notifications/test'&&req.method==='POST')result=await notifications.test(principal);
 else if(url.pathname==='/api/calendar'&&req.method==='GET')result=calendar.status(principal);
 else if(url.pathname==='/api/calendar/start'&&req.method==='POST'){result=calendar.start(principal,signed.token);res.setHeader('Set-Cookie','dailgo_calendar_state='+new URL(result.url).searchParams.get('state')+'; HttpOnly; SameSite=Lax; Path=/api/calendar/callback; Max-Age=600'+(config.cookieSecure?'; Secure':''));}

 else if(url.pathname==='/api/calendar/events'&&req.method==='POST')result=await calendar.events(principal,body);
 else if(url.pathname==='/api/calendar/export'&&req.method==='POST')result=await calendar.exportEvent(principal,body,identities.workspace(principal).data);
 else if(url.pathname==='/api/calendar'&&req.method==='DELETE')result=await calendar.disconnect(principal);
 else if(url.pathname==='/api/billing'&&req.method==='GET')result=await billing.status(principal);
 else if(url.pathname==='/api/billing/checkout'&&req.method==='POST')result=await billing.checkout(principal);
 else if(url.pathname==='/api/billing/portal'&&req.method==='POST')result=await billing.portal(principal);
 else return send(res,404,{error:'not-found'});return send(res,200,result);
 }catch(error){return send(res,error.status??400,{error:error.message});}}
 if(url.pathname.startsWith('/api/family')||url.pathname.startsWith('/api/shares')){try{
 const body=req.method==='GET'?{}:await read(req,262144);const route=url.pathname.split('/').filter(Boolean);let result;
 if(url.pathname==='/api/family'&&req.method==='GET')result={spaces:collaboration.list(principal)};
 else if(url.pathname==='/api/family'&&req.method==='POST'){if(billing.enabled&&!billing.isPro(principal))return send(res,403,{error:'pro-required'});result=collaboration.create(principal,body.title);}
 else if(url.pathname==='/api/family/join'&&req.method==='POST')result=collaboration.join(principal,body.token);
 else if(route[1]==='family'&&route.length===3&&req.method==='PUT')result=collaboration.commit(principal,route[2],body);
 else if(route[1]==='family'&&route[3]==='invite'&&req.method==='POST'){if(billing.enabled&&!billing.isPro(principal))return send(res,403,{error:'pro-required'});result=collaboration.invite(principal,route[2]);}
 else if(route[1]==='family'&&route[3]==='invite'&&route[4]&&req.method==='DELETE'){collaboration.revokeInvite(principal,route[2],route[4]);result={revoked:true};}
 else if(route[1]==='family'&&route[3]==='members'&&route[4]&&req.method==='DELETE')result=collaboration.removeMember(principal,route[2],route[4]);
 else if(url.pathname==='/api/shares'&&req.method==='GET')result={shares:collaboration.shares(principal)};
 else if(url.pathname==='/api/shares'&&req.method==='POST'){if(billing.enabled&&!billing.isPro(principal))return send(res,403,{error:'pro-required'});result=collaboration.share(principal,body);}
 else if(route[1]==='shares'&&route.length===3&&req.method==='GET')result=collaboration.review(principal,route[2]);
 else if(route[1]==='shares'&&route.length===3&&req.method==='DELETE'){collaboration.revoke(principal,route[2]);result={revoked:true};}
 else return send(res,404,{error:'not-found'});return send(res,200,result);
 }catch(error){return send(res,error.status??400,{error:error.message});}}
 if(url.pathname==='/api/assistant/status'&&req.method==='GET')return send(res,200,assistant.status(principal,billing.isPro(principal)));
 if(url.pathname==='/api/assistant/preview'&&req.method==='POST'){try{return send(res,200,await assistant.preview(principal,await read(req,32768),identities.workspace(principal).data,billing.isPro(principal)));}catch(error){return send(res,error.status??400,{error:error.message});}}
 if(url.pathname==='/api/account/password'&&req.method==='POST'){const body=await read(req,16384);const user=identities.user(principal);if(typeof body.currentPassword!=='string'||body.currentPassword.length>200||typeof body.newPassword!=='string'||body.newPassword.length<12||body.newPassword.length>200||!user||!timingSafeEqual(scryptSync(body.currentPassword,user.salt,64),Buffer.from(user.password,'hex')))return send(res,400,{error:'invalid-credentials'});const salt=randomBytes(16).toString('hex');db.exec('BEGIN IMMEDIATE');try{const password=scryptSync(body.newPassword,salt,64).toString('hex');if(principal==='owner'){db.prepare('UPDATE account SET salt=?,password=? WHERE id=1').run(salt,password);db.prepare('DELETE FROM sessions').run();}else {db.prepare('UPDATE members SET salt=?,password=? WHERE id=?').run(salt,password,principal);db.prepare('DELETE FROM member_sessions WHERE principal=?').run(principal);}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}setSession(res,principal);return send(res,200,{changed:true});}
 if(url.pathname==='/api/account/logout'&&req.method==='POST'){db.prepare('DELETE FROM '+(signed.member?'member_sessions':'sessions')+' WHERE token=?').run(signed.token);res.setHeader('Set-Cookie',['personal_os_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'+(config.cookieSecure?'; Secure':''),'dailgo_member_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'+(config.cookieSecure?'; Secure':'')]);return send(res,200,{signedIn:false});}
 if(url.pathname==='/api/workspace'&&req.method==='GET'){const value=identities.workspace(principal);return send(res,200,{revision:value.revision,data:value.revision==='empty'?null:value.data});}
 const recordRoute=url.pathname.match(/^\/api\/records\/([a-z]+)(?:\/([^/]+))?$/);
 const stateRoute=url.pathname.match(/^\/api\/state\/([a-z]+)$/);
 if(recordRoute||stateRoute||url.pathname==='/api/workspace/commit'){
  const current=()=>identities.workspace(principal);
  if(req.method==='GET'){
   const store=current();
   if(recordRoute){const collection=resource(recordRoute[1],store.data);if(!collection)return send(res,404,{error:'not-found'});const id=recordRoute[2]?decodeURIComponent(recordRoute[2]):null;const item=id?collection.items.find(x=>x.id===id):null;if(id&&!item)return send(res,404,{error:'record-not-found'});return send(res,200,{revision:store.revision,...(id?{item}:{items:collection.items})});}
   if(stateRoute&&Object.hasOwn(stateKeys,stateRoute[1]))return send(res,200,{revision:store.revision,value:store.data[stateKeys[stateRoute[1]]]??null});
   return send(res,404,{error:'not-found'});
  }
  const allowed=recordRoute?['POST','PATCH','DELETE']:['PUT'];if(!allowed.includes(req.method))return send(res,405,{error:'method-not-allowed'});
  const body=await read(req);if(typeof body.revision!=='string')throw Error('invalid-revision');
  db.exec('BEGIN IMMEDIATE');try{
   const store=current();if(body.revision!==store.revision){db.exec('ROLLBACK');return send(res,409,{error:'workspace-changed'});}
   let data;
   if(recordRoute){const collection=resource(recordRoute[1],store.data);if(!collection){db.exec('ROLLBACK');return send(res,404,{error:'not-found'});}const id=recordRoute[2]?decodeURIComponent(recordRoute[2]):null;if(req.method==='POST'&&id||req.method!=='POST'&&!id)throw Error('invalid-record-route');data=collection.change(req.method,id,body.item);}
   else if(stateRoute){const key=Object.hasOwn(stateKeys,stateRoute[1])?stateKeys[stateRoute[1]]:null;if(!key){db.exec('ROLLBACK');return send(res,404,{error:'not-found'});}data={...store.data,[key]:body.value};}
   else data=body.data;
   validateData(data);validateGoalDateChanges(store.data,data);data=auditWorkspace(store.data,data);validateData(data);const revision=randomUUID();
   identities.save(principal,revision,data);db.exec('COMMIT');return send(res,200,{version:3,revision,data});
  }catch(error){db.exec('ROLLBACK');if(error.message==='edit-conflict')return send(res,409,{error:'record-changed'});if(error.message==='record-not-found')return send(res,404,{error:'record-not-found'});throw error;}
 }
 if(url.pathname==='/api/workspace'&&req.method==='PUT'){
 const body=await read(req);validateData(body.data);if(typeof body.revision!=='string')throw Error('invalid-revision');db.exec('BEGIN IMMEDIATE');try{const current=identities.workspace(principal);if((current?.revision??'empty')!==body.revision){db.exec('ROLLBACK');return send(res,409,{error:'workspace-changed'});}const revision=randomUUID();identities.save(principal,revision,body.data);collaboration.forgetMissing(principal,body.data);db.prepare("UPDATE assistant_requests SET result=NULL WHERE principal=? AND status='done'").run(principal);db.exec('COMMIT');return send(res,200,{revision});}catch(error){db.exec('ROLLBACK');throw error;}
 }
 return send(res,404,{error:'not-found'});
 }catch{return send(res,400,{error:'request-rejected'});}});
 const timer=options.scheduler?setInterval(()=>void notifications.tick().catch(()=>{}),60000):undefined;timer?.unref();server.once('close',()=>{if(timer)clearInterval(timer);notifications.close();});return {server,db,notifications};
}
export function startServer(){if(Number(process.versions.node.split('.')[0])<24)throw Error('Node.js 24 or later is required');process.umask(0o077);const config=readConfig();const {server,db}=createLocalServer(config.dbPath||defaultDb,{config,scheduler:true});server.listen(config.port,'127.0.0.1',()=>process.stdout.write('Application listener ready on loopback port '+config.port+'\n'));const stop=()=>{server.close(()=>{db.close();process.exit(0);});server.closeIdleConnections();setTimeout(()=>process.exit(1),25000).unref();};process.once('SIGTERM',stop);process.once('SIGINT',stop);return server;}
// Node resolves import.meta.url to the real release path; argv may use current/.
if(process.argv[1]&&existsSync(process.argv[1])&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url)))startServer();




