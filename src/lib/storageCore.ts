import { validMutation } from '../features/assistant/mutationModel';
import { auditWorkspace } from './audit';
export const DATA_KEYS = ['personal-os.language','personal-os.dark','personal-os.tasks.v1','personal-os.entries.v1','personal-os.conversations.v1','personal-os.focus.v1','personal-os.weeks.v1','personal-os.reviews.v1','personal-os.planning.v1','personal-os.sessions.v1','personal-os.suggestions.v1','personal-os.trash.v1','personal-os.trial.v1'] as const;
export const STORE_KEY='personal-os.workspace.v3';
export type Data=Record<string,unknown>;
const obj=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const str=(x:unknown)=>typeof x==='string';
const records=(x:unknown,check:(v:any)=>boolean)=>Array.isArray(x)&&x.every(v=>obj(v)&&check(v))&&new Set(x.map(v=>v.id)).size===x.length;
const sourceValid=(v:any)=>v===undefined||obj(v)&&str(v.text)&&str(v.fragment)&&str(v.createdAt)&&str(v.batchId);
const metadataValid=(v:any)=>(v.history===undefined||Array.isArray(v.history)&&v.history.every((h:any)=>obj(h)&&str(h.at)&&Array.isArray(h.fields)&&h.fields.every(str)))&&['parentGoalId','revision','createdAt','updatedAt','completedAt','reviewDate','reason','waitingFor','memoryId','sourceLabel','context','expiresOn','alternatives','rationale','successCriteria'].every(k=>v[k]===undefined||str(v[k]))&&(v.certainty===undefined||['explicit','inferred','unspecified'].includes(v.certainty))&&(v.outcomeAchieved===undefined||typeof v.outcomeAchieved==='boolean');
const entry=(v:any)=>(v.tags===undefined||Array.isArray(v.tags)&&v.tags.length<=100&&v.tags.every((x:any)=>str(x)&&x.length<=300))&&(v.links===undefined||Array.isArray(v.links)&&v.links.length<=100&&v.links.every((x:any)=>str(x)&&x.length<=2000&&(()=>{try{return ['http:','https:'].includes(new URL(x).protocol);}catch{return false;}})()))&&(v.attachments===undefined||Array.isArray(v.attachments)&&v.attachments.length<=3&&v.attachments.every((x:any)=>obj(x)&&str(x.name)&&x.name.length<=255&&['image/png','image/jpeg','application/pdf','text/plain'].includes(x.mime)&&str(x.data)&&x.data.length<=270000&&x.data.startsWith('data:'+x.mime+';base64,')&&/^[A-Za-z0-9+/]*={0,2}$/.test(x.data.split(',')[1])))&&metadataValid(v)&&sourceValid(v.source)&&(v.durationMinutes===undefined||Number.isFinite(v.durationMinutes)&&v.durationMinutes>0&&v.durationMinutes<=1440)&&(v.routineDays===undefined||Array.isArray(v.routineDays)&&v.routineDays.every((d:any)=>Number.isInteger(d)&&d>=0&&d<=6))&&str(v.id)&&str(v.title)&&['project','goal','event','routine','note','preference','decision','personal'].includes(v.kind)&&['Work','Family','Health','Learning','Finance','Personal'].includes(v.area)&&str(v.detail)&&str(v.date)&&str(v.time)&&Number.isFinite(v.progress)&&typeof v.archived==='boolean'&&Array.isArray(v.doneDates)&&v.doneDates.every(str)&&(v.milestones===undefined||records(v.milestones,m=>str(m.id)&&str(m.title)&&str(m.date)));
export function validateData(data:unknown):asserts data is Data {
 if(!obj(data)||Object.keys(data).some(k=>!DATA_KEYS.includes(k as any)))throw Error('Invalid data keys');
 for(const [key,value] of Object.entries(data)){
 let valid=false;
 switch(key){
  case 'personal-os.trash.v1':valid=records(value,v=>str(v.id)&&str(v.deletedAt)&&['personal-os.tasks.v1','personal-os.entries.v1','personal-os.conversations.v1'].includes(v.collection)&&obj(v.item)&&(()=>{try{validateData({[v.collection]:[v.item]});return true;}catch{return false;}})());break;
 case 'personal-os.trial.v1':{const measurement=(m:any)=>obj(m)&&['captureSeconds','reviewMinutes','clarity','duplicates','lost'].every(k=>m[k]===undefined||Number.isFinite(m[k])&&m[k]>=0)&&(m.notes===undefined||str(m.notes));valid=obj(value)&&str(value.startedOn)&&measurement(value.baseline)&&obj(value.days)&&Object.values(value.days).every(measurement);break;}
 case 'personal-os.reviews.v1':valid=obj(value)&&Object.values(value).every(v=>obj(v)&&str(v.wins)&&str(v.obstacles)&&str(v.next));break;
 case 'personal-os.planning.v1':valid=obj(value)&&[0,1,6].includes(value.weekStartsOn)&&Number.isFinite(value.capacity)&&value.capacity>=0&&value.capacity<=1440&&Number.isFinite(value.buffer)&&value.buffer>=0&&value.buffer<=1440&&str(value.timezone)&&(()=>{try{new Intl.DateTimeFormat('en',{timeZone:value.timezone});return true;}catch{return false;}})();break;
 case 'personal-os.sessions.v1':valid=records(value,s=>str(s.id)&&str(s.taskId)&&str(s.startedAt)&&str(s.endedAt)&&Number.isFinite(s.seconds)&&s.seconds>=0);break;
 case 'personal-os.suggestions.v1':valid=obj(value)&&Object.values(value).every(str);break;
 case 'personal-os.language':valid=value==='en'||value==='ar';break;
 case 'personal-os.dark':valid=typeof value==='boolean';break;
 case 'personal-os.tasks.v1':valid=records(value,v=>(v.result===undefined||obj(v.result)&&str(v.result.note)&&v.result.note.length<=3000&&str(v.result.date)&&/^\d{4}-\d{2}-\d{2}$/.test(v.result.date))&&metadataValid(v)&&sourceValid(v.source)&&str(v.id)&&str(v.title)&&['Work','Family','Health','Learning','Finance','Personal'].includes(v.category)&&typeof v.done==='boolean'&&typeof v.archived==='boolean'&&(!v.status||['todo','doing','waiting','blocked','deferred','cancelled','done'].includes(v.status))&&(!v.priority||['low','medium','high'].includes(v.priority))&&(v.subtasks===undefined||records(v.subtasks,s=>str(s.id)&&str(s.title)&&typeof s.done==='boolean'))&&(v.tags===undefined||Array.isArray(v.tags)&&v.tags.every(str))&&['goalId','projectId','milestoneId','description','dueDate','plannedDate'].every(k=>v[k]===undefined||str(v[k]))&&(v.estimate===undefined||Number.isFinite(v.estimate)&&v.estimate>=0));break;
 case 'personal-os.entries.v1':valid=Array.isArray(value)?records(value,entry):obj(value)&&value.version===2&&value.demoVersion===1&&records(value.entries,entry);break;
 case 'personal-os.conversations.v1':valid=records(value,c=>str(c.id)&&str(c.title)&&typeof c.archived==='boolean'&&records(c.messages,m=>str(m.id)&&['user','assistant'].includes(m.role)&&str(m.text)&&(m.mutation===undefined||validMutation(m.mutation))&&(m.undo===undefined||obj(m.undo)&&str(m.undo.at)&&Array.isArray(m.undo.removedIds)&&m.undo.removedIds.every(str)&&Array.isArray(m.undo.keptIds)&&m.undo.keptIds.every(str)&&(m.undo.restoredIds===undefined||Array.isArray(m.undo.restoredIds)&&m.undo.restoredIds.every(str)))&&(m.batchSource===undefined||str(m.batchSource))&&(m.targetIds===undefined||Array.isArray(m.targetIds)&&m.targetIds.every(str))&&(m.batch===undefined||Array.isArray(m.batch)&&m.batch.length<=20&&records(m.batch,b=>str(b.id)&&str(b.title)&&b.title.length<=4000&&['task','project','goal','event','routine','note','preference','decision','personal'].includes(b.kind)&&['Work','Family','Health','Learning','Finance','Personal'].includes(b.area)&&['date','time','detail','fragment'].every(k=>str(b[k]))&&(b.goalId===undefined||str(b.goalId))&&(b.estimate===undefined||Number.isFinite(b.estimate)&&b.estimate>=0&&b.estimate<=1440)))&&(m.proposal===undefined||obj(m.proposal)&&['task','project','goal','event','routine','note','preference','decision','personal'].includes(m.proposal.kind)&&str(m.proposal.title)&&str(m.proposal.date)&&str(m.proposal.time))));break;
 case 'personal-os.focus.v1':valid=obj(value)&&(value.ends===null||Number.isFinite(value.ends))&&Number.isFinite(value.remaining)&&value.remaining>=0;break;
 case 'personal-os.weeks.v1':valid=obj(value)&&Object.entries(value).every(([date,w])=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&obj(w)&&Array.isArray(w.outcomes)&&w.outcomes.every((o:any)=>obj(o)&&str(o.title)&&str(o.goalId)&&typeof o.done==='boolean'&&(o.criteria===undefined||str(o.criteria)))&&obj(w.capacities)&&Object.values(w.capacities).every(n=>Number.isFinite(n)&&Number(n)>=0)&&(w.buffers===undefined||obj(w.buffers)&&Object.values(w.buffers).every(n=>Number.isFinite(n)&&Number(n)>=0))&&obj(w.review)&&['wins','obstacles','next'].every(k=>str(w.review[k])));break;
 }
 if(!valid)throw Error(`Invalid data: ${key}`);
 }
}
export type Store={version:3;revision:string;data:Data};
export function readStore(storage:Pick<Storage,'getItem'>):Store {
 const raw=storage.getItem(STORE_KEY);
 if(raw!==null){const parsed=JSON.parse(raw);if(!obj(parsed)||parsed.version!==3||!str(parsed.revision))throw Error('Unsupported workspace');validateData(parsed.data);return parsed as Store;}
 const data:Data={};for(const key of DATA_KEYS){const raw=storage.getItem(key);if(raw!==null)data[key]=JSON.parse(raw);}validateData(data);return {version:3,revision:'legacy',data};
}
export function commit(storage:Pick<Storage,'getItem'|'setItem'>,expected:string,data:Data):Store {
 const current=readStore(storage);if(current.revision!==expected)throw Error('conflict');validateData(data);
 const next:Store={version:3,revision:crypto.randomUUID(),data:auditWorkspace(current.data,data)};validateData(next.data);storage.setItem(STORE_KEY,JSON.stringify(next));return next;
}
export function makeBackup(data:Data){validateData(data);return {format:'personal-os-backup',version:1,exportedAt:new Date().toISOString(),data};}
export function parseBackup(text:string):Data {const b=JSON.parse(text);if(!obj(b)||b.format!=='personal-os-backup'||b.version!==1||!str(b.exportedAt))throw Error('Unsupported backup');validateData(b.data);return b.data;}
export function storageToken(storage:Pick<Storage,'getItem'>){return JSON.stringify([STORE_KEY,...DATA_KEYS].map(k=>storage.getItem(k)));}
export function restoreSnapshot(storage:Pick<Storage,'getItem'|'setItem'>,data:Data,token:string):Store {
 if(storageToken(storage)!==token)throw Error('conflict');validateData(data);
 const next:Store={version:3,revision:crypto.randomUUID(),data};validateData(next.data);storage.setItem(STORE_KEY,JSON.stringify(next));return next;
}










export { auditWorkspace };
