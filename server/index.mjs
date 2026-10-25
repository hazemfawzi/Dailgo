import { readConfig } from './config.mjs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash } from 'node:crypto';
import { mkdirSync,existsSync,readFileSync,chmodSync } from 'node:fs';
import { dirname,resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const { validateData }=await import(new URL('./domain.mjs',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const defaultDb=fileURLToPath(new URL('../.local-data/workspace.sqlite',import.meta.url));
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
export function createLocalServer(file=defaultDb,options={}){
 const config=options.config??readConfig();
 mkdirSync(dirname(file),{recursive:true,mode:0o700});const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS account(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL,data TEXT NOT NULL);');
 chmodSync(file,0o600);const attempts=new Map();
 const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
 const configured=()=>db.prepare('SELECT username FROM account WHERE id=1').get();
 const session=req=>{const token=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('personal_os_session='))?.slice('personal_os_session='.length);return token?db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(hash(token),Date.now()):undefined;};
 const setSession=res=>{const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?)').run(hash(token),Date.now()+43200000);res.setHeader('Set-Cookie',`personal_os_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=43200${config.cookieSecure?"; Secure":""}`);};
 const read=async(req,maxBytes=10*1024*1024)=>{if(!String(req.headers['content-type']??'').startsWith('application/json'))throw Error('content-type');let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>maxBytes)throw Error('too-large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));};
  const server=createServer(async(req,res)=>{try{
 if(config.production){res.setHeader('Strict-Transport-Security','max-age=31536000');if(req.headers.host!==new URL(config.origin).host||req.headers['x-forwarded-proto']!=='https')return send(res,400,{error:'https-host-required'});}
 const url=new URL(req.url??'/','http://127.0.0.1');
 if(!url.pathname.startsWith('/api/')){
 if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'method-not-allowed'});
 const requestedPath=decodeURIComponent(url.pathname);if(requestedPath.split('/').some(part=>part.startsWith('.'))||/\.(?:sqlite(?:-wal|-shm)?|env|mjs)$/i.test(requestedPath))return send(res,404,{error:'not-found'});let path=resolve(dist,'.'+requestedPath);if(path!==resolve(dist)&&!path.startsWith(resolve(dist)+sep))return send(res,404,{error:'not-found'});
 if(!existsSync(path)||!extname(path))path=resolve(dist,'index.html');if(!existsSync(path))return send(res,404,{error:'build-required'});
 const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[extname(path)]??'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':extname(path)==='.html'||path.endsWith('sw.js')?'no-cache':'public, max-age=3600','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"});return res.end(req.method==='HEAD'?undefined:readFileSync(path));
 }
 if(req.method!=='GET'){
 const origin=req.headers.origin;try{const parsed=new URL(origin);if(config.production?origin!==config.origin:!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.protocol!=='http:')throw Error();}catch{return send(res,403,{error:'origin-rejected'});}
 }
 if(url.pathname==='/api/health'&&req.method==='GET')return send(res,200,{status:config.production?'production':'local-only',ai:'not-configured',integrations:[]});
 if(url.pathname==='/api/account/status'&&req.method==='GET'){const user=configured();return send(res,200,{configured:!!user,setupTokenRequired:config.production,setupEnabled:!config.production||!!config.setupToken,signedIn:!!session(req),username:session(req)?user?.username:undefined});}
 if(url.pathname==='/api/account/setup'&&req.method==='POST'){
 if(configured())return send(res,409,{error:'already-configured'});const body=await read(req,16384);if(config.production&&(!config.setupToken||typeof body.setupToken!=='string'||!timingSafeEqual(Buffer.from(hash(body.setupToken)),Buffer.from(hash(config.setupToken)))))return send(res,403,{error:'setup-token-required'});if(typeof body.username!=='string'||body.username.trim().length<3||body.username.length>80||typeof body.password!=='string'||body.password.length<12||body.password.length>200)return send(res,400,{error:'invalid-credentials'});
 const salt=randomBytes(16).toString('hex');db.prepare('INSERT INTO account VALUES(1,?,?,?)').run(body.username.trim(),salt,scryptSync(body.password,salt,64).toString('hex'));setSession(res);return send(res,201,{configured:true,signedIn:true});
 }
 if(url.pathname==='/api/account/login'&&req.method==='POST'){
 for(const [address,value] of attempts)if(value.until<Date.now())attempts.delete(address);const key=config.production?String(req.headers['x-real-ip']??req.socket.remoteAddress):req.socket.remoteAddress;if(!attempts.has(key)&&attempts.size>=10000)return send(res,429,{error:'try-later'});let rate=attempts.get(key);if(!rate||rate.until<Date.now()){rate={count:0,until:Date.now()+300000};attempts.set(key,rate);}if(rate.count>=5)return send(res,429,{error:'try-later'});rate.count++;
 const body=await read(req,16384);const user=db.prepare('SELECT * FROM account WHERE id=1').get();if(typeof body.password!=='string'||body.password.length>200||!user||body.username!==user.username||!timingSafeEqual(scryptSync(body.password,user.salt,64),Buffer.from(user.password,'hex')))return send(res,401,{error:'invalid-credentials'});attempts.delete(key);setSession(res);return send(res,200,{signedIn:true});
 }
 if(!session(req))return send(res,401,{error:'sign-in-required'});
 if(url.pathname==='/api/account/password'&&req.method==='POST'){const body=await read(req,16384);const user=db.prepare('SELECT * FROM account WHERE id=1').get();if(typeof body.currentPassword!=='string'||body.currentPassword.length>200||typeof body.newPassword!=='string'||body.newPassword.length<12||body.newPassword.length>200||!user||!timingSafeEqual(scryptSync(body.currentPassword,user.salt,64),Buffer.from(user.password,'hex')))return send(res,400,{error:'invalid-credentials'});const salt=randomBytes(16).toString('hex');db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE account SET salt=?,password=? WHERE id=1').run(salt,scryptSync(body.newPassword,salt,64).toString('hex'));db.prepare('DELETE FROM sessions').run();db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}setSession(res);return send(res,200,{changed:true});}
 if(url.pathname==='/api/account/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(session(req).token);res.setHeader('Set-Cookie','personal_os_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'+(config.cookieSecure?'; Secure':''));return send(res,200,{signedIn:false});}
 if(url.pathname==='/api/workspace'&&req.method==='GET'){const value=db.prepare('SELECT revision,data FROM workspace WHERE id=1').get();return send(res,200,value?{revision:value.revision,data:JSON.parse(value.data)}:{revision:'empty',data:null});}
 if(url.pathname==='/api/workspace'&&req.method==='PUT'){
 const body=await read(req);validateData(body.data);if(typeof body.revision!=='string')throw Error('invalid-revision');db.exec('BEGIN IMMEDIATE');try{const current=db.prepare('SELECT revision FROM workspace WHERE id=1').get();if((current?.revision??'empty')!==body.revision){db.exec('ROLLBACK');return send(res,409,{error:'workspace-changed'});}const revision=randomUUID();db.prepare('INSERT INTO workspace VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data').run(revision,JSON.stringify(body.data));db.exec('COMMIT');return send(res,200,{revision});}catch(error){db.exec('ROLLBACK');throw error;}
 }
 return send(res,404,{error:'not-found'});
 }catch{return send(res,400,{error:'request-rejected'});}});
 return {server,db};
}
export function startServer(){if(Number(process.versions.node.split('.')[0])<24)throw Error('Node.js 24 or later is required');process.umask(0o077);const config=readConfig();const {server,db}=createLocalServer(config.dbPath||defaultDb,{config});server.listen(config.port,'127.0.0.1',()=>process.stdout.write('Application listener ready on loopback port '+config.port+'\n'));const stop=()=>{server.close(()=>{db.close();process.exit(0);});server.closeIdleConnections();setTimeout(()=>process.exit(1),25000).unref();};process.once('SIGTERM',stop);process.once('SIGINT',stop);return server;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer();




