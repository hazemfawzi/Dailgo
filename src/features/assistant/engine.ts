import { parseCapture,isNaturalTask,validDate } from '../capture/model';
import { isActionable,rankTasks } from '../tasks/model';
import { mutationResponse } from './mutationModel';
import { parseCompound } from './batchModel';
import type { CaptureItem } from '../capture/model';
import { localDate, makeEntry, memoryKinds } from '../../lib/workspace';
import type { Area,Entry, Translate, EntryKind } from '../../lib/workspace';
import type { Task } from '../home/HomeScreen';
export type Proposal = { kind: 'task' | EntryKind; title: string; date: string; time: string;area?:Area;tags?:string[];timeAssumed?:boolean };
export type Message = { id:string; role:'user'|'assistant'; text:string;ai?:import('./ai/plan').AIPlan;reply?:{key:'rules-v1';en:string;ar:string}; proposal?:Proposal;mutation?:import('./mutationModel').Mutation; batch?:CaptureItem[];batchSource?:string;targetIds?:string[];undo?:{at:string;removedIds:string[];keptIds:string[];restoredIds?:string[]}; status?:'pending'|'confirmed'|'cancelled'|'reverted'; targetId?:string;scope?:string;createdAt?:string;references?:{id:string;title:string}[] };
function respondText(input:string,t:Translate,tasks:Task[],entries:Entry[]):Omit<Message,'id'|'role'> {
 const text=input.trim();
 const studyRequest=isNaturalTask(text);
 const mutation=mutationResponse(text,t,tasks,entries);if(mutation)return mutation as Omit<Message,'id'|'role'>;
 try{const batch=parseCompound(text);if(batch)return {text:t('I prepared a local multi-action preview. Review each type and detail. Nothing is executed until you confirm the whole preview.','جهزت معاينة لطلب متعدد الإجراءات بقواعد محلية. راجع نوع وتفاصيل كل عنصر. التنفيذ بيتم بعد تأكيد المعاينة كلها فقط.'),batch,batchSource:text,status:'pending'};}catch{return {text:t('Use at most 20 actions per request. Nothing was executed.','اكتب لحد 20 إجراء في الطلب الواحد. لم يتم تنفيذ شيء.')};}
 if(studyRequest){
 const title=text.replace(/^(?:عايز|عاوز|أريد|اريد|محتاج)\s+/u,'');
 const item=parseCapture('Task: '+title)[0];
 return {text:t('I prepared a task preview. Review its execution day before confirming. Review any interpreted time and area; the task does not create a notification.','جهزت معاينة لمهمة. راجع يوم التنفيذ قبل التأكيد. راجع الوقت والمجال المقترحين؛ المهمة لا ترسل إشعارًا.'),proposal:{kind:'task',title:item.title.slice(0,160),date:item.date,time:item.time,area:item.area,tags:item.tags,timeAssumed:item.timeAssumed},status:'pending'};
 }
 const commands: {pattern:RegExp;kind:Proposal['kind']}[] = [
  {pattern:/^(?:project|مشروع)\s*[:：]?\s+(.+)$/i,kind:'project'},
  {pattern:/^(?:task|add task|مهمة|أضف مهمة|اضف مهمة|ذكرني)\s*[:：]?\s+(.+)$/i,kind:'task'},
  {pattern:/^(?:remember|note|memory|تذكر|احفظ|ملاحظة)\s*[:：]?\s+(.+)$/i,kind:'note'},
  {pattern:/^(?:goal|هدف)\s*[:：]?\s+(.+)$/i,kind:'goal'},
  {pattern:/^(?:routine|روتين)\s*[:：]?\s+(.+)$/i,kind:'routine'},
  {pattern:/^(?:event|موعد)\s*[:：]?\s+(.+)$/i,kind:'event'},
 ];
 for(const command of commands){const match=text.match(command.pattern);if(match){let title=match[1].trim();const dateMatch=title.match(/\b(\d{4}-\d{2}-\d{2})\b/);const timeMatch=title.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);const date=dateMatch?.[1]??localDate();const time=timeMatch?.[0]??'09:00';if(command.kind==='task'){const item=parseCapture('Task: '+title)[0];if(!item.title.trim())return {text:t('Please include a task title.','اكتب عنوان المهمة.')};return {text:t('Review the task title and optional execution day, then confirm to save.','راجع عنوان المهمة ويوم التنفيذ الاختياري، ثم أكد الحفظ.'),proposal:{kind:'task',title:item.title.slice(0,160),date:item.date,time:item.time,area:item.area,tags:item.tags,timeAssumed:item.timeAssumed},status:'pending'};}if(command.kind==='routine'&&!timeMatch)return {text:t('Please include a 24-hour time for the routine.','حدد وقت الروتين بنظام 24 ساعة، مثل 08:00.')};if(command.kind==='routine'&&timeMatch)title=title.replace(timeMatch[0],'').trim();if(command.kind==='event'){if(!dateMatch||!timeMatch)return {text:t('What exact date and time? Use Event: title YYYY-MM-DD HH:mm.','حدد تاريخ ووقت الموعد: موعد: العنوان YYYY-MM-DD HH:mm.')};
 if(!validDate(date)||(/\b\d{1,2}:\d{2}\b/.test(title)&&!timeMatch))return {text:t('Please use a valid date and 24-hour time: Event: title YYYY-MM-DD HH:mm.','استخدم تاريخاً صحيحاً ووقتاً بنظام ٢٤ ساعة: موعد: العنوان YYYY-MM-DD HH:mm.')};
 title=title.replace(dateMatch?.[0]??'\u0000','').replace(timeMatch?.[0]??'\u0000','').trim();
 }if(!title)return {text:t('Please include a title after the command.','اكتب عنواناً بعد الأمر.')};return {text:t('I can prepare this local action. Review the details below, then confirm to save it.','جهزت الإجراء المحلي. راجع التفاصيل أدناه، ثم أكد لحفظه.'),proposal:{kind:command.kind,title:title.slice(0,160),date,time},status:'pending'};}}
 if(/\b(?:memory|memories|remember)\b/i.test(text)||/(?:^|[^\p{L}\p{N}_])(?:الذاكرة|ذاكرة|ذاكرتي|تذكر|معلوماتي)(?=$|[^\p{L}\p{N}_])/u.test(text)){const memories=entries.filter(e=>memoryKinds.includes(e.kind)&&!e.archived&&(!e.expiresOn||e.expiresOn>=localDate()));return {references:memories.map(e=>({id:e.id,title:e.title})),text:memories.length?t(`Here are your saved memories (${memories.length}):\n${memories.slice(0,8).map(e=>`• ${e.title}${e.certainty==='inferred'?' ['+t('inferred; review','استنتاج؛ راجع')+']':''}${e.detail?`: ${e.detail}`:''}${e.sourceLabel?' · '+t('source: ','المصدر: ')+e.sourceLabel:''}`).join('\n')}\n\nThis is a direct local summary, without AI interpretation.`,`هذه معلوماتك المحفوظة (${memories.length}):\n${memories.slice(0,8).map(e=>`• ${e.title}${e.certainty==='inferred'?' ['+t('inferred; review','استنتاج؛ راجع')+']':''}${e.detail?`: ${e.detail}`:''}${e.sourceLabel?' · '+t('source: ','المصدر: ')+e.sourceLabel:''}`).join('\n')}\n\nهذا عرض مباشر للبيانات المحلية بدون تحليل ذكاء اصطناعي.`):t('Your memory is empty. Try “Remember: I prefer quiet mornings”.','ذاكرتك فارغة. جرّب «احفظ: أفضل الصباح الهادئ».')};}
 if(/priorit|plan|today|مهام|أولو|اولوي|يومي|خطط/i.test(text)){const open=rankTasks(tasks.filter(isActionable));const events=entries.filter(e=>e.kind==='event'&&e.date===localDate()&&!e.archived);return {references:[...open,...events].map(e=>({id:e.id,title:e.title})),text:t(`You have ${open.length} open priorities and ${events.length} local events today.\n${open.slice(0,5).map(x=>`• ${x.title}`).join('\n')}\n\nA simple suggestion: choose one priority, give it 25 minutes, then take a short break. This is a scripted suggestion, not a personalized AI assessment.`,`لديك ${open.length} أولويات مفتوحة و${events.length} مواعيد محلية اليوم.\n${open.slice(0,5).map(x=>`• ${x.title}`).join('\n')}\n\nاقتراح بسيط: اختر أولوية واحدة وخصص لها ٢٥ دقيقة، ثم استرح قليلاً. هذا اقتراح مكتوب مسبقاً وليس تقييماً شخصياً بالذكاء الاصطناعي.`)};}
 return {text:t('I could not identify a supported action in that message. Did you mean a task, event or note? Nothing was changed. I’m a scripted assistant. Try:\n• Task: …\n• Remember: …\n• Goal: …\n• Project: …\n• Routine: …\n• Event: … YYYY-MM-DD HH:mm\n\nEvery action needs your confirmation. This local assistant does not call AI. Reminders follow your settings.','مش واضح لي إجراء مدعوم في الرسالة دي. تقصد مهمة، موعد، ولا ملاحظة؟ لم تتغير أي بيانات. المساعد يعتمد على قواعد محددة. جرّب:\n• مهمة: …\n• احفظ: …\n• هدف: …\n• مشروع: …\n• روتين: …\n• موعد: … YYYY-MM-DD HH:mm\n\nكل إجراء يحتاج تأكيدك. المساعد المحلي لا يتصل بخدمة ذكاء اصطناعي. التذكيرات حسب إعداداتك.')};
}
export function proposalEntry(proposal:Proposal,id:string):Entry {return {...makeEntry(proposal.kind==='task'?'note':proposal.kind,proposal.title),id,certainty:'explicit',sourceLabel:'Local assistant action confirmed by user',...(proposal.kind==='event'?{date:proposal.date,time:proposal.time}:{}),...(proposal.kind==='routine'?{time:proposal.time}:{})};}

export function respond(input:string,t:Translate,tasks:Task[],entries:Entry[]):Omit<Message,'id'|'role'>{
 const english=respondText(input,(en)=>en,tasks,entries);const arabic=respondText(input,(_,ar)=>ar,tasks,entries);
 return {...(t('en','ar')==='ar'?arabic:english),reply:{key:'rules-v1',en:english.text,ar:arabic.text}};
}
export function messageText(message:Pick<Message,'role'|'text'|'reply'>,t:Translate){
 if(message.role==='assistant'&&message.reply?.key==='rules-v1')return t(message.reply.en,message.reply.ar);
 if(message.role==='assistant'&&message.text==='Your memory is empty. Try “Remember: I prefer quiet mornings”.')return t(message.text,'ذاكرتك فارغة. جرّب «احفظ: أفضل الصباح الهادئ».');
 return message.text;
}
