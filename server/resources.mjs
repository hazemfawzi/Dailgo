// All writes are applied inside the workspace transaction in index.mjs.
const specs={tasks:{key:'personal-os.tasks.v1'},goals:{key:'personal-os.entries.v1',kinds:['goal']},projects:{key:'personal-os.entries.v1',kinds:['project']},events:{key:'personal-os.entries.v1',kinds:['event']},routines:{key:'personal-os.entries.v1',kinds:['routine']},memories:{key:'personal-os.entries.v1',kinds:['note','preference','decision','personal']},conversations:{key:'personal-os.conversations.v1'},sessions:{key:'personal-os.sessions.v1'}};
export const stateKeys={finance:'personal-os.finance.v1',prayer:'personal-os.prayer.v1',journey:'personal-os.journey.v1',language:'personal-os.language',theme:'personal-os.dark',planning:'personal-os.planning.v1',focus:'personal-os.focus.v1',weeks:'personal-os.weeks.v1',reviews:'personal-os.reviews.v1',suggestions:'personal-os.suggestions.v1',trial:'personal-os.trial.v1'};
export function resource(name,data){
 const spec=Object.hasOwn(specs,name)?specs[name]:null;if(!spec)return null;
 const value=data[spec.key];const all=Array.isArray(value)?value:value?.entries??[];
 const matches=item=>!spec.kinds||spec.kinds.includes(item.kind);
 return {items:all.filter(matches),change(method,id,item){
  if(method!=='DELETE'&&(!item||typeof item!=='object'||Array.isArray(item)))throw Error('invalid-record');
  const current=all.find(x=>x.id===id&&matches(x));
  if(method==='POST'&&(!item||typeof item.id!=='string'||all.some(x=>x.id===item.id)))throw Error('invalid-record');
  if(method!=='POST'&&!current)throw Error('record-not-found');
  const next=method==='DELETE'?null:method==='POST'?item:{...current,...item,id:current.id,revision:current.revision};
  if(next&&!matches(next))throw Error('invalid-record-kind');
  // Clients cannot rewrite audit history through the record API.
  if(next){for(const key of ['history','createdAt','updatedAt','completedAt','revision']){if(current?.[key]!==undefined)next[key]=current[key];else delete next[key];}}
  const items=method==='POST'?[...all,next]:method==='DELETE'?all.filter(x=>x.id!==id):all.map(x=>x===current?next:x);
  const tasks=next?.kind==='project'&&current&&current.parentGoalId!==next.parentGoalId?((data['personal-os.tasks.v1']??[]).map(task=>task.projectId===next.id?{...task,goalId:next.parentGoalId,milestoneId:undefined}:task)):undefined;
  return {...data,...(tasks?{'personal-os.tasks.v1':tasks}:{}),[spec.key]:Array.isArray(value)||!spec.kinds?items:{version:2,demoVersion:1,...value,entries:items}};
 }};
}
