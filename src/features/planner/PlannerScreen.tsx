import { WeekStartSetting } from '../settings/PlanningSettings';
import { storageText } from '../../i18n/messages';
import { formatNumber,formatCalendarDate } from '../../i18n/format';
import { DatedTasks } from './DatedTasks';
import { tasksOnDate } from './taskDates';
import { calendarDate,calendarMonth,parseCalendarDate } from './calendarModel';
import { ConflictNotice } from './ConflictNotice';
import { usePlanning } from '../../lib/preferences';
import { useEffect,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WeekScreen } from './WeekScreen';
import { TaskBoard } from '../tasks/TaskBoard';
import { CalendarDays, CalendarRange, ListTodo, Repeat2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../components/ui/button';
import { EntryCollection } from '../../components/EntryCollection';
import { localDate } from '../../lib/workspace';
import type { Entry, EntrySetter, Translate } from '../../lib/workspace';
import type { Task } from '../home/HomeScreen';
type Props = {t:Translate;ar:boolean;entries:Entry[];setEntries:EntrySetter;tasks:Task[];setTasks:Dispatch<SetStateAction<Task[]>>;edit:(task?:Task)=>void;setRemove:Dispatch<SetStateAction<Task|null>>};
export function PlannerScreen({t,ar,entries,setEntries,tasks,setTasks,edit,setRemove}:Props) {
 const [params,setParams]=useSearchParams(); const tab=['tasks','week','calendar','routines'].includes(params.get('tab')||'')?params.get('tab')!:'tasks'; const setTab=(value:string)=>{const next=new URLSearchParams(params);next.set('tab',value);setParams(next);}; const [day,setDay]=useState(()=>parseCalendarDate(params.get('date')||'')?params.get('date')!:localDate()); const [month,setMonth]=useState(()=>calendarMonth(day));
 const requestedDate=params.get('date');
 useEffect(()=>{if(requestedDate){const date=parseCalendarDate(requestedDate);if(date){setDay(requestedDate);setMonth(calendarMonth(requestedDate));}}},[requestedDate]);
 const tabs=[{id:'tasks',icon:ListTodo,label:t('Tasks','المهام')},{id:'week',icon:CalendarRange,label:t('Week plan','خطة الأسبوع')},{id:'calendar',icon:CalendarDays,label:t('Calendar','التقويم')},{id:'routines',icon:Repeat2,label:t('Routines','الروتين')}];
 const [settings]=usePlanning();const start=(month.getDay()-settings.weekStartsOn+7)%7; const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 return <><div className="page-heading"><div><div className="eyebrow">{t('ONE STEP AT A TIME','خطوة بخطوة')}</div><h1 dir="auto">{t('Tasks and planning','المهام والتخطيط')}</h1><p dir="auto">{t('Plan your tasks, appointments and daily routines.','خطط مهامك ومواعيدك وروتينك اليومي.')}</p></div></div><div className="segmented-tabs" role="tablist" aria-label={t('Planner views','طرق عرض المخطط')}>{tabs.map(item=><button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab===item.id} aria-controls={`panel-${item.id}`} tabIndex={tab===item.id?0:-1} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const direction=e.key==='ArrowRight'?1:-1;const next=tabs[(tabs.findIndex(x=>x.id===tab)+direction+tabs.length)%tabs.length];setTab(next.id);document.getElementById(`tab-${next.id}`)?.focus();}}} onClick={()=>setTab(item.id)}><item.icon size={16}/>{item.label}</button>)}</div>
 {(tab==='week'||tab==='calendar')&&<div className="editor-form"><WeekStartSetting t={t}/></div>}
 <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
 {tab==='week'&&<WeekScreen {...{t,ar,tasks,setTasks,entries,edit}}/>}
 {tab==='tasks'&&<TaskBoard {...{t,tasks,setTasks,edit,setRemove}}/>}
 {tab==='calendar'&&<><div className="context-banner"><CalendarDays size={18}/><p dir="auto">{t('Appointments are saved to your workspace. Optional Google transfers and reminders are managed in Life tools.','المواعيد بتتحفظ في مساحتك. الربط الاختياري مع Google والتذكيرات من أدوات حياتك.')}</p></div><section className="card calendar-card"><div className="calendar-heading"><h3 dir="auto">{formatCalendarDate(calendarDate(month),t('en','ar'),{month:'long',year:'numeric'})}</h3><div><Button variant="ghost" size="icon" aria-label={t('Previous month','الشهر السابق')} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={18}/></Button><Button variant="outline" onClick={()=>{const today=localDate();setDay(today);setMonth(calendarMonth(today));}}>{t('Today','اليوم')}</Button><Button variant="ghost" size="icon" aria-label={t('Next month','الشهر التالي')} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={18}/></Button></div></div><div className="calendar-grid">{Array.from({length:7},(_,i)=>(ar?['أح','إث','ثل','أر','خم','جم','سب']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[(i+settings.weekStartsOn)%7]).map(d=><span className="weekday" key={d}>{d}</span>)}{Array.from({length:start},(_,i)=><span key={`blank-${i}`}/>)}{Array.from({length:days},(_,i)=>{const value=calendarDate(new Date(month.getFullYear(),month.getMonth(),i+1,12));const count=entries.filter(e=>e.kind==='event'&&!e.archived&&e.date===value).length;const taskCount=tasksOnDate(tasks,value).length;return <button key={value} className={`${day===value?'selected':''} ${value===localDate()?'today':''}`} aria-label={`${formatCalendarDate(value,t('en','ar'))}${count?` · ${formatNumber(count,t('en','ar'))} ${t('events','مواعيد')}`:''}${taskCount?` · ${formatNumber(taskCount,t('en','ar'))} ${t('tasks','مهام')}`:''}`} aria-pressed={day===value} onClick={()=>setDay(value)}>{formatNumber(i+1,t('en','ar'))}{(count>0||taskCount>0)&&<span className="calendar-dot"/>}</button>})}</div></section><label className="date-picker">{t('Selected day','اليوم المحدد')}<input type="date" value={day} onChange={e=>{if(parseCalendarDate(e.target.value)){setDay(e.target.value);setMonth(calendarMonth(e.target.value));}}}/></label><ConflictNotice entries={entries} date={day} t={t}/><DatedTasks tasks={tasks} date={day} t={t} edit={edit}/><EntryCollection key={day} {...{entries,setEntries,t}} kinds={['event']} date={day} title={t('Plans for this day','خطط هذا اليوم')} empty={t('No appointments for this day. Add one to reserve its time.','مفيش مواعيد لليوم ده. أضف موعد عشان تحجز وقته.')}/></>}
 {tab==='routines'&&<><div className="context-banner"><Repeat2 size={18}/><p dir="auto">{storageText(t,'routines')}</p></div><EntryCollection {...{entries,setEntries,t}} kinds={['routine']} title={t('Small rituals, lasting change.','عادات صغيرة، أثر مستمر.')} empty={t('Start a routine you can return to.','ابدأ روتيناً يمكنك الاستمرار عليه.')}/></>}
 </div></>;
}
