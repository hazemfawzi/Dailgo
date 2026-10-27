import type { Data } from '../../lib/storageCore';
import { areas,localDate } from '../../lib/workspace';
import type { Area,Entry } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import { isActionable,statusOf } from '../tasks/model';
import { calendarDate,parseCalendarDate } from '../planner/calendarModel';
export const JOURNEY_KEY='personal-os.journey.v1';
export type Journey={version:1;onboardingComplete:boolean;areas:Area[];wakeTime:string;eveningTime:string;focusDate:string;focusIds:string[];morningReviewedOn?:string;eveningReviewedOn?:string;weeklyReviewedOn?:string};
export const defaultJourney:Journey={version:1,onboardingComplete:false,areas:[],wakeTime:'07:00',eveningTime:'20:00',focusDate:'',focusIds:[]};
const time=(value:unknown)=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const date=(value:unknown)=>typeof value==='string'&&!!parseCalendarDate(value);
export function validJourney(value:any):value is Journey{return !!value&&typeof value==='object'&&!Array.isArray(value)&&value.version===1&&typeof value.onboardingComplete==='boolean'&&Array.isArray(value.areas)&&value.areas.length<=2&&new Set(value.areas).size===value.areas.length&&value.areas.every((area:any)=>areas.includes(area))&&time(value.wakeTime)&&time(value.eveningTime)&&(value.focusDate===''||date(value.focusDate))&&Array.isArray(value.focusIds)&&value.focusIds.length<=3&&new Set(value.focusIds).size===value.focusIds.length&&value.focusIds.every((id:any)=>typeof id==='string')&&['morningReviewedOn','eveningReviewedOn','weeklyReviewedOn'].every(key=>value[key]===undefined||date(value[key]));}
export function journeyState(data:Data):Journey{return (data[JOURNEY_KEY] as Journey|undefined)??defaultJourney;}
export function workspaceEntries(data:Data):Entry[]{const raw=data['personal-os.entries.v1'] as Entry[]|{entries:Entry[]}|undefined;return Array.isArray(raw)?raw:raw?.entries??[];}
export function nextDay(day:string,amount=1){const parsed=parseCalendarDate(day);if(!parsed)throw Error('invalid-day');parsed.setDate(parsed.getDate()+amount);return calendarDate(parsed);}
export const goalTemplates=[
 {id:'custom',area:'Work' as Area,en:'My own goal',ar:'هدف من اختياري',titles:['Define a clear success criterion','Choose a first small step','Review the first attempt'],arabic:['حدد معيار نجاح واضح','اختار أول خطوة صغيرة','راجع نتيجة المحاولة الأولى']},
 {id:'health',area:'Health' as Area,en:'Lose 5 kg — editable goal',ar:'خسارة ٥ كجم — هدف قابل للتعديل',titles:['Choose a suitable way to track progress','Try one manageable movement habit','Review what worked this week'],arabic:['اختار طريقة مناسبة لمتابعة التقدم','جرّب عادة حركة بسيطة تناسبك','راجع اللي ناسبك الأسبوع ده']},
 {id:'language',area:'Learning' as Area,en:'Learn a language',ar:'تعلم لغة',titles:['Choose a language and a small learning target','Practice the first lesson for 15 minutes','Review five useful expressions'],arabic:['اختار اللغة وهدف تعلم صغير','تدرّب على أول درس لمدة ١٥ دقيقة','راجع خمس تعبيرات مفيدة']},
 {id:'saving',area:'Finance' as Area,en:'Save a chosen amount',ar:'ادخار مبلغ من اختيارك',titles:['Choose the amount and target date','List current income and essential spending','Choose a manageable first saving step'],arabic:['حدد المبلغ والموعد المستهدف','سجل الدخل والمصروفات الأساسية','اختار أول خطوة ادخار مناسبة']},
];
export type OnboardingSpec={areas:Area[];language:'ar'|'en';dark:boolean;wakeTime:string;eveningTime:string;weekStartsOn:number;title:string;goalArea:Area;date:string;criteria:string;tasks:{title:string;estimate:number}[];templateId:string};
export function completeOnboarding(data:Data,spec:OnboardingSpec,batch:string,now=new Date().toISOString()):Data{
 if(journeyState(data).onboardingComplete)return data;
 const preferences:Journey={...journeyState(data),onboardingComplete:true,areas:spec.areas,wakeTime:spec.wakeTime,eveningTime:spec.eveningTime};
 if(!validJourney(preferences)||spec.areas.length!==2||!['ar','en'].includes(spec.language)||typeof spec.dark!=='boolean'||![0,1,6].includes(spec.weekStartsOn)||!areas.includes(spec.goalArea)||!spec.title.trim()||spec.title.trim().length>160||spec.date&&!date(spec.date)||spec.tasks.length!==3||spec.tasks.some(task=>!task.title.trim()||task.title.length>160||!Number.isFinite(task.estimate)||task.estimate<1||task.estimate>1440)||!goalTemplates.some(template=>template.id===spec.templateId))throw Error('invalid-onboarding');
 const entries=workspaceEntries(data);const tasks=(data['personal-os.tasks.v1']??[]) as Task[];const goalId='onboarding-goal-'+batch;
 if([...entries,...tasks].some(item=>item.id===goalId))throw Error('duplicate-onboarding');
 const goal:Entry={id:goalId,kind:'goal',title:spec.title.trim(),area:spec.goalArea,date:spec.date,time:'',detail:'',progress:0,archived:false,doneDates:[],successCriteria:spec.criteria.trim(),sourceLabel:spec.language==='ar'?'خطة بداية راجعتها وأكدتها':'User-reviewed starting plan',milestones:[{id:goalId+'-first',title:spec.language==='ar'?'الخطوة الأولى':'First step',date:''},{id:goalId+'-review',title:spec.language==='ar'?'مراجعة التقدم':'Progress review',date:''}]};
 const added:Task[]=spec.tasks.map((task,index)=>({id:`onboarding-task-${batch}-${index}`,title:task.title.trim(),category:spec.goalArea,done:false,archived:false,status:'todo',estimate:task.estimate,goalId,milestoneId:goal.milestones![index===0?0:1].id,source:{text:spec.title,fragment:task.title,createdAt:now,batchId:batch}}));
 const planning=(data['personal-os.planning.v1']??{capacity:240,buffer:30,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}) as Record<string,unknown>;
 return {...data,[JOURNEY_KEY]:preferences,'personal-os.language':spec.language,'personal-os.dark':spec.dark,'personal-os.planning.v1':{...planning,weekStartsOn:spec.weekStartsOn},'personal-os.entries.v1':{version:2,demoVersion:1,entries:[...entries,goal]},'personal-os.tasks.v1':[...tasks,...added]};
}
export function saveMorningPlan(data:Data,ids:string[],today=localDate()):Data{
 const tasks=(data['personal-os.tasks.v1']??[]) as Task[];
 if(!date(today)||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!tasks.some(task=>task.id===id&&isActionable(task))))throw Error('invalid-focus-selection');
 return {...data,[JOURNEY_KEY]:{...journeyState(data),focusDate:today,focusIds:ids,morningReviewedOn:today},'personal-os.tasks.v1':tasks.map(task=>ids.includes(task.id)?{...task,plannedDate:today}:task)};
}
export function rolloverDay(data:Data,ids:string[],from:string,to=nextDay(from)):Data{
 if(!date(from)||!date(to)||to<=from||new Set(ids).size!==ids.length)throw Error('invalid-rollover');
 const tasks=(data['personal-os.tasks.v1']??[]) as Task[];
 if(ids.some(id=>!tasks.some(task=>task.id===id&&canRolloverTask(task,from))))throw Error('unavailable-rollover-task');
 return {...data,'personal-os.tasks.v1':tasks.map(task=>ids.includes(task.id)?{...task,plannedDate:to}:task)};
}
export function weeklyActivity(data:Data,start:string,end=nextDay(start,6)){
 const tasks=(data['personal-os.tasks.v1']??[]) as Task[];const entries=workspaceEntries(data);const sessions=(data['personal-os.sessions.v1']??[]) as {taskId:string;seconds:number;endedAt:string}[];const zone=(data['personal-os.planning.v1'] as {timezone?:string}|undefined)?.timezone||'UTC';
 const inWeek=(stamp:string|undefined)=>{if(!stamp||!Number.isFinite(Date.parse(stamp)))return false;const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(stamp));const key=['year','month','day'].map(type=>parts.find(part=>part.type===type)?.value).join('-');return key>=start&&key<=end;};
 return areas.map(area=>({area,count:tasks.filter(task=>task.category===area&&task.done&&inWeek(task.completedAt)).length+entries.filter(entry=>entry.kind==='routine'&&entry.area===area).reduce((sum,entry)=>sum+entry.doneDates.filter(day=>day>=start&&day<=end).length,0)+sessions.filter(session=>session.seconds>0&&inWeek(session.endedAt)&&tasks.some(task=>task.id===session.taskId&&task.category===area)).length}));
}
export function morningCandidates(tasks:Task[],today:string){return tasks.filter(task=>isActionable(task)&&(!task.plannedDate||task.plannedDate<=today||task.dueDate&&task.dueDate<=today));}
export function canRolloverTask(task:Task,day:string){return !task.done&&!task.archived&&statusOf(task)!=='cancelled'&&!!(task.plannedDate?task.plannedDate<=day:task.dueDate&&task.dueDate<=day);}
export function saveWeeklyResults(data:Data,start:string,titles:{title:string;goalId:string;criteria:string}[],expectedNextPlan:string):Data{
 const next=nextDay(start,7);const plans=(data['personal-os.weeks.v1']??{}) as Record<string,any>;const old=plans[next];
 if(JSON.stringify(old??null)!==expectedNextPlan||titles.length!==3||titles.some(item=>!item.title.trim()||item.title.length>160||item.criteria.length>500||item.goalId&&!workspaceEntries(data).some(goal=>goal.id===item.goalId&&goal.kind==='goal')))throw Error('weekly-preview-changed');
 const outcomes=titles.map((item,index)=>({...item,title:item.title.trim(),done:old?.outcomes?.[index]?.title===item.title.trim()?!!old.outcomes[index].done:false}));
 return {...data,[JOURNEY_KEY]:{...journeyState(data),weeklyReviewedOn:start},'personal-os.weeks.v1':{...plans,[next]:{...(old??{capacities:{},review:{wins:'',obstacles:'',next:''}}),outcomes:[...outcomes,...(old?.outcomes?.slice(3)??[])]}}};
}

export function addGoalTemplate(data:Data,spec:{templateId:string;title:string;goalArea:Area;date:string;criteria:string;tasks:{title:string;estimate:number}[];language:'ar'|'en'},batch:string):Data{
 if(workspaceEntries(data).some(entry=>entry.id==='onboarding-goal-'+batch))return data;
 const created=completeOnboarding({...data,[JOURNEY_KEY]:defaultJourney},{...spec,areas:[spec.goalArea,spec.goalArea==='Learning'?'Work':'Learning'],dark:data['personal-os.dark']===true,wakeTime:'07:00',eveningTime:'20:00',weekStartsOn:spec.language==='ar'?6:1},batch);
 return {...data,'personal-os.tasks.v1':created['personal-os.tasks.v1'],'personal-os.entries.v1':created['personal-os.entries.v1']};
}
