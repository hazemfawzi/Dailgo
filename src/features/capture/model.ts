import { calendarDate,parseCalendarDate } from '../planner/calendarModel';
import { localDate } from '../../lib/workspace';
import type { Area, Entry, EntryKind } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import type { Data } from '../../lib/storageCore';
import { restoreWorkspace } from '../life/demoGoals';
export type CaptureSource={text:string;fragment:string;createdAt:string;batchId:string};
export type CaptureItem={id:string;kind:'task'|EntryKind;title:string;area:Area;date:string;time:string;detail:string;fragment:string;goalId?:string;estimate?:number;tags?:string[];timeAssumed?:boolean};
export const validDate=(text:string)=>!!parseCalendarDate(text);
const timeValid=(text:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(text);
const markers=/^(?:(task|مهمة|ذكرني|أراجع|اراجع|راجع|جهز)|(event|موعد|عندي موعد)|(idea|فكرة|عندي فكرة)|(goal|هدف)|(decision|قرار)|(routine|روتين)|(note|remember|ملاحظة|احفظ|تذكر))\s*[:：]?\s*/i;
export const normalizeDigits=(text:string)=>text.replace(/[٠-٩۰-۹]/g,value=>String('٠١٢٣٤٥٦٧٨٩'.includes(value)?'٠١٢٣٤٥٦٧٨٩'.indexOf(value):'۰۱۲۳۴۵۶۷۸۹'.indexOf(value)));
const desire=/^(?:عايز|عاوز|محتاج|أريد|اريد)\s+/u;
const taskVerbs=/^(?:اتصل|كلم|أرسل|ارسل|اشتري|اشتر|ذاكر|أذاكر|اذاكر|أراجع|اراجع|راجع|جهز|حضّر|حضر|اكتب|سدد|ادفع|تدرب|تمرن|احجز|تعلم|study|call|email|buy|review|pay)(?:\s|$)/iu;
export const isNaturalTask=(text:string)=>taskVerbs.test(text.trim().replace(desire,''));
const tagAreas:Record<string,Area>={'شغل':'Work','عمل':'Work','work':'Work','صحة':'Health','health':'Health','تعلم':'Learning','دراسة':'Learning','learning':'Learning','ادخار':'Finance','فلوس':'Finance','finance':'Finance','عائلة':'Family','أسرة':'Family','family':'Family','شخصي':'Personal','personal':'Personal'};
function captureTime(fragment:string){
 const part=fragment.match(/(?:الساعة\s*)?(\d{1,2})(?::([0-5]\d))?\s*(صباحًا|صباحا|صباح|مساءً|مساءا|مساء|العصر|عصرًا|عصرا|بالليل|ليلًا|ليلا|ظهرًا|ظهرا|الظهر|am|pm)(?=\s|$|[#،,؛;])/iu);
 if(part){let hour=Number(part[1]);if(hour<1||hour>12)return {time:'invalid',text:part[0]};const pm=!/^(?:صباح|am)/iu.test(part[3]);hour=hour%12+(pm?12:0);return {time:`${String(hour).padStart(2,'0')}:${part[2]??'00'}`,text:part[0]};}
 const clock=fragment.match(/\b(\d{1,2}):([0-5]\d)\b/);const unspecified=fragment.match(/الساعة\s*(\d{1,2})(?=\s|$|[#،,؛;])/u);if(!clock&&unspecified){const hour=Number(unspecified[1]);if(hour>=1&&hour<=12)return {time:`${String(hour%12+12).padStart(2,'0')}:00`,text:unspecified[0],assumed:true};}
 return clock?{time:`${clock[1].padStart(2,'0')}:${clock[2]}`,text:clock[0]}:{time:'',text:''};
}
export function parseCapture(text:string,today=localDate()):CaptureItem[]{
 const fragments=text.split(/\n+|[;؛]+|[،,]\s*(?=(?:و\s*)?(?:مهمة|ذكرني|أراجع|اراجع|عندي موعد|موعد|فكرة|عندي فكرة|هدف|قرار|روتين|ملاحظة|احفظ|مشروع|project\b|task\b|event\b|idea\b|goal\b|decision\b|routine\b|note\b|remember\b))/i).map(s=>s.trim().replace(/^و(?=عندي|فكرة|مهمة|موعد|هدف|قرار|روتين|ملاحظة|احفظ)/,'')).filter(Boolean);
 if(fragments.length>20)throw Error('too-many');
 return fragments.map(original=>{
 const fragment=normalizeDigits(original);const natural=isNaturalTask(fragment);
 const match=fragment.match(markers);const kind:CaptureItem['kind']=/^(?:project|مشروع)(?:\s|:)/i.test(fragment)?'project':match?.[1]||natural?'task':match?.[2]?'event':match?.[4]?'goal':match?.[5]?'decision':match?.[6]?'routine':'note';
 // Preserve action verbs; only explicit type prefixes are removed.
 let title=(natural?fragment.replace(desire,''):fragment).replace(/^(?:project|مشروع|task|مهمة|event|موعد|عندي موعد|idea|فكرة|عندي فكرة|goal|هدف|decision|قرار|routine|روتين|note|remember|ملاحظة|احفظ|تذكر)\s*[:：]?\s*/i,'');
 const explicit=fragment.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];let date=explicit??'';
 if(!explicit&&/(?:\btomorrow\b|بكرة|بكره|غدًا|غدا)/i.test(fragment)){const d=new Date(`${today}T12:00:00`);d.setDate(d.getDate()+1);date=calendarDate(d);}else if(!explicit&&/(?:\btoday\b|النهارده|اليوم)/i.test(fragment))date=today;
 if(!['task','event','project','goal'].includes(kind))date='';
 const parsedTime=['task','event','routine'].includes(kind)?captureTime(fragment):{time:'',text:''};const time=parsedTime.time;
 const tags=[...new Set([...fragment.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map(match=>match[1]))].slice(0,10);const area=tags.map(tag=>tagAreas[tag.toLowerCase()]).find(Boolean)??(/(?:ذاكر|أذاكر|اذاكر|دراسة|study|learn|تعلم)/iu.test(fragment)?'Learning':/(?:تمرن|تدرب|مشي|walk|exercise)/iu.test(fragment)?'Health':'Personal');
 title=title.replace(/#[\p{L}\p{N}_-]+/gu,'');
 if(date){if(explicit)title=title.replace(explicit,'');else title=title.replace(/\btomorrow\b|\btoday\b|بكرة|بكره|غدًا|غدا|النهارده|اليوم/ig,'');}
 if(parsedTime.text)title=title.replace(parsedTime.text,'');
 return {id:crypto.randomUUID(),kind,title:title.trim().replace(/\s+/g,' '),area,date,time,detail:'',fragment:original,...('assumed' in parsedTime&&parsedTime.assumed?{timeAssumed:true}:{}),...(tags.length?{tags}:{})};
 });
}
export function captureErrors(items:CaptureItem[]):boolean{return !items.length||items.some(x=>!x.title.trim()||x.title.length>160||(!!x.date&&!validDate(x.date))||((x.kind==='event')&&(!validDate(x.date)||!timeValid(x.time)))||(x.kind==='routine'&&!timeValid(x.time))||(x.kind==='task'&&!!x.time&&(!timeValid(x.time)||!validDate(x.date)))||(x.tags!==undefined&&(!Array.isArray(x.tags)||x.tags.length>10||x.tags.some(tag=>typeof tag!=='string'||tag.length>100))));}
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
 addedTasks.push({id,title:item.title.trim(),category:item.area,done:false,archived:false,status:'todo',description:item.detail,plannedDate:item.date||undefined,...(item.time?{plannedTime:item.time}:{}),...(item.tags?{tags:item.tags}:{}),goalId:goal?.id,estimate:item.estimate,source:captureSource});
 }
 else addedEntries.push({id,title:item.title.trim(),kind:item.kind,area:item.area,detail:item.detail,date:['event','project','goal'].includes(item.kind)?item.date:'',time:['event','routine'].includes(item.kind)?item.time:'',progress:0,archived:false,doneDates:[],...(item.tags?{tags:item.tags}:{}),source:captureSource});
 }
 return {...data,'personal-os.tasks.v1':[...tasks,...addedTasks],'personal-os.entries.v1':{...workspace,entries:[...workspace.entries,...addedEntries]}};
}

