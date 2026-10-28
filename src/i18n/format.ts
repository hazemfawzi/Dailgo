import { getPlanning } from '../lib/planningConfig';
export const localeFor=(language:string)=>language==='ar'?'ar-EG-u-nu-arab':'en-GB';
export function formatCalendarDate(value:string|undefined,language:string,options:Intl.DateTimeFormatOptions={day:'numeric',month:'short',year:'numeric'}){
 if(!value)return '';const date=new Date(value+'T12:00:00Z');
 if(!Number.isFinite(date.getTime()))return value;
 return new Intl.DateTimeFormat(localeFor(language),{...options,timeZone:'UTC'}).format(date);
}
export const formatDate=formatCalendarDate;
export function formatNumber(value:number,language:string,options:Intl.NumberFormatOptions={}){return new Intl.NumberFormat(localeFor(language),options).format(value);}
export function formatClockPart(value:number,language:string){return new Intl.NumberFormat(localeFor(language),{minimumIntegerDigits:2,useGrouping:false}).format(value);}
export function formatTime(value:string|undefined,language:string){if(!value)return '';return /^\d{2}:\d{2}$/.test(value)?value.split(':').map(part=>formatClockPart(Number(part),language)).join(':'):value;}
export function formatTimestamp(value:string,language:string){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return value;
 const parts=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:getPlanning().timezone}).formatToParts(date);
 const part=(name:string)=>parts.find(p=>p.type===name)?.value??'';
 return `${formatCalendarDate(['year','month','day'].map(part).join('-'),language)} · ${formatTime(part('hour')+':'+part('minute'),language)}`;
}
export function formatDuration(seconds:number,language:string){return `${formatNumber(Math.floor(seconds/60),language)}:${formatClockPart(seconds%60,language)}`;}
type Unit='task'|'item'|'goal'|'day'|'result'|'minute';
const units:Record<Unit,{en:[string,string];ar:Record<Intl.LDMLPluralRule,string>}>={
 task:{en:['task','tasks'],ar:{zero:'مهام',one:'مهمة',two:'مهمتان',few:'مهام',many:'مهمة',other:'مهمة'}},
 item:{en:['item','items'],ar:{zero:'عناصر',one:'عنصر',two:'عنصران',few:'عناصر',many:'عنصرًا',other:'عنصر'}},
 goal:{en:['goal','goals'],ar:{zero:'أهداف',one:'هدف',two:'هدفان',few:'أهداف',many:'هدفًا',other:'هدف'}},
 day:{en:['day','days'],ar:{zero:'أيام',one:'يوم',two:'يومان',few:'أيام',many:'يومًا',other:'يوم'}},
 result:{en:['result','results'],ar:{zero:'نتائج',one:'نتيجة',two:'نتيجتان',few:'نتائج',many:'نتيجة',other:'نتيجة'}},
 minute:{en:['minute','minutes'],ar:{zero:'دقائق',one:'دقيقة',two:'دقيقتان',few:'دقائق',many:'دقيقة',other:'دقيقة'}},
};
export function counted(value:number,unit:Unit,language:string){
 if(language!=='ar')return `${formatNumber(value,language)} ${units[unit].en[value===1?0:1]}`;
 const form=new Intl.PluralRules('ar').select(value);return form==='one'||form==='two'?units[unit].ar[form]:`${formatNumber(value,language)} ${units[unit].ar[form]}`;
}

export function activeGoals(value:number,language:string){if(language!=='ar')return `${formatNumber(value,language)} active ${value===1?'goal':'goals'} (not archived)`;const form=new Intl.PluralRules('ar').select(value);return form==='one'?'هدف نشط (غير مؤرشف)':form==='two'?'هدفان نشطان (غير مؤرشفين)':`${counted(value,'goal','ar')} ${form==='few'||form==='zero'?'نشطة':form==='many'?'نشطًا':'نشط'} (غير مؤرشف)`;}
