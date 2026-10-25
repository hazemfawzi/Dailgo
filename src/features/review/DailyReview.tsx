import { ResultSummary } from './ResultSummary';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { usePersisted } from '../../lib/storage';
import { localDate } from '../../lib/workspace';
import { addDays } from '../planner/weekModel';
import { statusOf,statusLabel } from '../tasks/model';
import type { Task } from '../tasks/model';
import type { Translate } from '../../lib/workspace';
import type { Dispatch,SetStateAction } from 'react';
type Review={wins:string;obstacles:string;next:string};
export function DailyReview({t,tasks,setTasks,edit}:{t:Translate;tasks:Task[];setTasks:Dispatch<SetStateAction<Task[]>>;edit:(task:Task)=>void}){
 const [day,setDay]=useState(localDate());const [reviews,setReviews,error]=usePersisted<Record<string,Review>>('personal-os.reviews.v1',{});const review=reviews[day]??{wins:'',obstacles:'',next:''};
 const pending=tasks.filter(x=>!x.archived&&!x.done&&statusOf(x)!=='cancelled'&&((x.plannedDate&&x.plannedDate<=day)||(x.reviewDate&&x.reviewDate<=day)));const completed=tasks.filter(x=>x.completedAt&&localDate(new Date(x.completedAt))===day);
 function update(id:string,patch:Partial<Task>){setTasks(old=>old.map(x=>x.id===id?{...x,...patch}:x));}
 return <section className="card daily-review"><div className="home-section-title"><h3>{t('A calm daily review','مراجعة هادية لليوم')}</h3><input aria-label={t('Review day','يوم المراجعة')} type="date" max={localDate()} value={day} onChange={e=>{if(e.target.value)setDay(e.target.value);}}/></div><p className="muted">{completed.length} {t('completed on this date (recorded completions only).','اكتملت في اليوم ده (من سجل الإنجاز المتاح).')}</p><ResultSummary tasks={tasks} start={day} end={day} t={t}/><details><summary>{t('Review unfinished steps','راجع الخطوات اللي لسه')} · {pending.length}</summary>{pending.map(task=><div className="review-task" key={task.id}><strong>{task.title}</strong><small>{statusLabel(statusOf(task),t)}{task.reason?` · ${task.reason}`:''}</small><div className="dialog-actions"><Button variant="outline" onClick={()=>edit(task)}>{t('Review / make smaller','مراجعة / تقسيم المهمة')}</Button><Button variant="ghost" onClick={()=>update(task.id,{plannedDate:addDays(day,1),status:'todo',done:false,reviewDate:undefined})}>{t('Plan tomorrow','خطط لبكرة')}</Button><Button variant="ghost" onClick={()=>update(task.id,{status:'deferred',reviewDate:addDays(day,1),done:false})}>{t('Defer for review','أجّل للمراجعة')}</Button><Button variant="ghost" onClick={()=>update(task.id,{status:'cancelled',done:false})}>{t('Cancel task','إلغاء المهمة')}</Button></div></div>)}{!pending.length&&<p>{t('Nothing needs a decision for this day.','مفيش خطوات محتاجة قرار لليوم ده.')}</p>}</details><div className="review-fields">{(['wins','obstacles','next'] as const).map((field,i)=><label key={field}>{[t('What moved forward?','إيه اللي اتقدم؟'),t('What changed or got in the way?','إيه اللي اتغير أو عطّلك؟'),t('What will you adjust?','إيه اللي هتعدّله؟')][i]}<textarea maxLength={2000} rows={3} value={review[field]} onChange={e=>{const value=e.target.value;setReviews(old=>({...old,[day]:{...(old[day]??review),[field]:value}}));}}/></label>)}</div><p className="muted" role={error?'alert':undefined}>{error?t('Could not save the review.','تعذر حفظ المراجعة.'):t('Notes save locally. Unfinished tasks never move automatically.','الملاحظات بتتحفظ محليًا. المهام غير المكتملة مش بتترحّل تلقائيًا.')}</p></section>;
}

