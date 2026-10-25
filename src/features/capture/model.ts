import { localDate } from '../../lib/workspace';
import type { Area, Entry, EntryKind } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import type { Data } from '../../lib/storageCore';
import { restoreWorkspace } from '../life/demoGoals';
export type CaptureSource={text:string;fragment:string;createdAt:string;batchId:string};
export type CaptureItem={id:string;kind:'task'|EntryKind;title:string;area:Area;date:string;time:string;detail:string;fragment:string;goalId?:string;estimate?:number};
export const validDate=(text:string)=>/^\d{4}-\d{2}-\d{2}$/.test(text)&&!Number.isNaN(new Date(`${text}T12:00:00`).getTime())&&localDate(new Date(`${text}T12:00:00`))===text;
const timeValid=(text:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(text);
const markers=/^(?:(task|مهمة|ذكرني|أراجع|اراجع|راجع|جهز)|(event|موعد|عندي موعد)|(idea|فكرة|عندي فكرة)|(goal|هدف)|(decision|قرار)|(routine|روتين)|(note|remember|ملاحظة|احفظ|تذكر))\s*[:：]?\s*/i;
export function parseCapture(text:string,today=localDate()):CaptureItem[]{
 const fragments=text.split(/\n+|[;؛]+|[،,]\s*(?=(?:و\s*)?(?:مهمة|ذكرني|أراجع|اراجع|عندي موعد|موعد|فكرة|عندي فكرة|هدف|قرار|روتين|ملاحظة|احفظ|مشروع|project\b|task\b|event\b|idea\b|goal\b|decision\b|routine\b|note\b|remember\b))/i).map(s=>s.trim().replace(/^و(?=عندي|فكرة|مهمة|موعد|هدف|قرار|روتين|ملاحظة|احفظ)/,'')).filter(Boolean);
 if(fragments.length>20)throw Error('too-many');
 return fragments.map(fragment=>{
 const match=fragment.match(markers);const kind:CaptureItem['kind']=/^(?:project|مشروع)(?:\s|:)/i.test(fragment)?'project':match?.[1]?'task':match?.[2]?'event':match?.[4]?'goal':match?.[5]?'decision':match?.[6]?'routine':'note';
 // Preserve action verbs; only explicit type prefixes are removed.
 let title=fragment.replace(/^(?:project|مشروع|task|مهمة|event|موعد|عندي موعد|idea|فكرة|عندي فكرة|goal|هدف|decision|قرار|routine|روتين|note|remember|ملاحظة|احفظ|تذكر)\s*[:：]?\s*/i,'');
 const explicit=fragment.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];let date=explicit&&validDate(explicit)?explicit:'';
 if(!explicit&&/(?:\btomorrow\b|بكرة|بكره|غدًا|غدا)/i.test(fragment)){const d=new Date(`${today}T12:00:00`);d.setDate(d.getDate()+1);date=localDate(d);}else if(!explicit&&/(?:\btoday\b|النهارده|اليوم)/i.test(fragment))date=today;
 if(!['task','event','project','goal'].includes(kind))date='';
 const time=['event','routine'].includes(kind)?fragment.match(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/)?.[0]??'':'';
 if(date){if(explicit)title=title.replace(explicit,'');else title=title.replace(/\btomorrow\b|\btoday\b|بكرة|بكره|غدًا|غدا|النهارده|اليوم/ig,'');}
 if(time)title=title.replace(time,'');
 return {id:crypto.randomUUID(),kind,title:title.trim(),area:'Personal',date,time,detail:'',fragment};
 });
}
export function captureErrors(items:CaptureItem[]):boolean{return !items.length||items.some(x=>!x.title.trim()||x.title.length>160||(!!x.date&&!validDate(x.date))||((x.kind==='event')&&(!validDate(x.date)||!timeValid(x.time)))||(x.kind==='routine'&&!timeValid(x.time)));}
export function applyCapture(data:Data,items:CaptureItem[],source:{text:string;batchId:string;createdAt:string}):Data {
 if(captureErrors(items))throw Error('invalid-capture');
 const tasks=(data['personal-os.tasks.v1']??[]) as Task[];const workspace=restoreWorkspace(data['personal-os.entries.v1']);
 const ids=new Set([...tasks,...workspace.entries,...((data["personal-os.trash.v1"]??[]) as {item:{id:string}}[]).map(x=>x.item)].map(x=>x.id));const addedTasks:Task[]=[];const addedEntries:Entry[]=[];
 for(const item of items){const id=`capture-${source.batchId}-${item.id}`;if(ids.has(id))continue;ids.add(id);
 const captureSource:CaptureSource={...source,fragment:item.fragment};
 if(item.kind==='task'){
 const goal=item.goalId?workspace.entries.find(e=>e.id===item.goalId&&e.kind==='goal'&&!e.archived):undefined;
 if(item.goalId&&!goal)throw Error('unavailable-goal');
 if(item.estimate!==undefined&&(!Number.isFinite(item.estimate)||item.estimate<0||item.estimate>1440))throw Error('invalid-estimate');
 addedTasks.push({id,title:item.title.trim(),category:item.area,done:false,archived:false,status:'todo',description:item.detail,plannedDate:item.date||undefined,goalId:goal?.id,estimate:item.estimate,source:captureSource});
 }
 else addedEntries.push({id,title:item.title.trim(),kind:item.kind,area:item.area,detail:item.detail,date:['event','project','goal'].includes(item.kind)?item.date:'',time:['event','routine'].includes(item.kind)?item.time:'',progress:0,archived:false,doneDates:[],source:captureSource});
 }
 return {...data,'personal-os.tasks.v1':[...tasks,...addedTasks],'personal-os.entries.v1':{...workspace,entries:[...workspace.entries,...addedEntries]}};
}

