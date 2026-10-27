import type { Entry } from '../../lib/workspace';
import type { Data } from '../../lib/storageCore';
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function milestoneDateIssue(goal:Pick<Entry,'date'|'milestones'>):'invalid-date'|'after-goal'|null{
 if(goal.date&&!validDate(goal.date)||goal.milestones?.some(m=>m.date&&!validDate(m.date)))return 'invalid-date';
 return goal.date&&goal.milestones?.some(m=>m.date&&m.date>goal.date&&m.targetDateAcknowledgement!==`${goal.date}/${m.date}`)?'after-goal':null;
}
export function validateGoalDateChanges(before:Data,after:Data){
 const entries=(data:Data):Entry[]=>{const raw=data['personal-os.entries.v1'] as Entry[]|{entries:Entry[]}|undefined;return Array.isArray(raw)?raw:raw?.entries??[];};
 const previous=new Map(entries(before).map(goal=>[goal.id,goal]));
 for(const goal of entries(after)){
  if(goal.kind!=='goal')continue;
  const old=previous.get(goal.id);
  if(!old||old.date!==goal.date||JSON.stringify(old.milestones)!==JSON.stringify(goal.milestones)){
   const issue=milestoneDateIssue(goal);if(issue)throw Error('milestone-'+issue);
  }
 }
}

export function goalDaysRemaining(target:string,today:string){
 if(!validDate(target)||!validDate(today))return null;
 return Math.round((Date.parse(target+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
}
export function acknowledgeLateMilestones(goal:Entry,acknowledge:boolean):Entry{
 return {...goal,milestones:goal.milestones?.map(m=>({...m,targetDateAcknowledgement:acknowledge&&goal.date&&m.date>goal.date?`${goal.date}/${m.date}`:undefined}))};
}
