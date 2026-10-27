import { Button } from '../../components/ui/button';
import type { Entry,Translate } from '../../lib/workspace';
import { acknowledgeLateMilestones,milestoneDateIssue } from './goalDates';
export function GoalDateReview({goal,onChange,t}:{goal:Entry;onChange:(goal:Entry)=>void;t:Translate}){
 const issue=milestoneDateIssue(goal);const late=goal.date&&goal.milestones?.some(m=>m.date>goal.date);
 return <>{late&&<section className="goal-date-review"><p role="alert">{t('Some milestones are after this target. Extend the goal or explicitly keep those dates.','في مراحل بعد الموعد ده. مدّ موعد الهدف أو وافق صراحة على الاحتفاظ بتواريخها.')}</p><Button type="button" variant="outline" onClick={()=>onChange({...goal,date:goal.milestones!.reduce((last,m)=>m.date>last?m.date:last,goal.date)})}>{t('Extend goal to the last milestone','مدّ الهدف لآخر مرحلة')}</Button><label><input type="checkbox" checked={issue!=='after-goal'} onChange={e=>onChange(acknowledgeLateMilestones(goal,e.target.checked))}/>{t('Keep milestones after the goal target','احتفظ بالمراحل بعد موعد الهدف بموافقتي')}</label></section>}{issue==='invalid-date'&&<p role="alert">{t('Use valid calendar dates.','استخدم تواريخ صحيحة.')}</p>}</>;
}
