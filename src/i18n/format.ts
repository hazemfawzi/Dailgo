import { getPlanning } from '../lib/planningConfig';
export function formatCalendarDate(value:string,language:string){
 const date=new Date(value+'T12:00:00Z');
 if(!Number.isFinite(date.getTime()))return value;
 return new Intl.DateTimeFormat(language==='ar'?'ar-EG':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date);
}
export function formatNumber(value:number,language:string){return new Intl.NumberFormat(language==='ar'?'ar-EG':'en-GB').format(value);}
export function formatClockPart(value:number,language:string){return new Intl.NumberFormat(language==='ar'?'ar-EG':'en-GB',{minimumIntegerDigits:2,useGrouping:false}).format(value);}
export function formatTimestamp(value:string,language:string){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return value;
 return new Intl.DateTimeFormat(language==='ar'?'ar-EG':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:getPlanning().timezone}).format(date);
}
export function formatDuration(seconds:number,language:string){return `${formatNumber(Math.floor(seconds/60),language)}:${formatClockPart(seconds%60,language)}`;}
