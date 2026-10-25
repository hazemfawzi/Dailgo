import type { Data } from '../../lib/storageCore';
import type { Task } from '../tasks/model';
import { isActionable, statusOf } from '../tasks/model';

export function dayTasks(tasks:Task[],date:string){
 return tasks.filter(x=>!x.archived&&statusOf(x)!=='cancelled'&&x.plannedDate===date);
}
export function startDayTask(data:Data,id:string,today:string,now=Date.now()):Data{
 const tasks=(data['personal-os.tasks.v1']??[]) as Task[];
 const task=tasks.find(x=>x.id===id);
 if(!task||!isActionable(task)||task.plannedDate!==today)throw Error('unavailable-task');
 const timer=data['personal-os.focus.v1'] as {ends?:number|null;sessionId?:string}|undefined;
 // An unfinished session must be recorded through the timer before switching tasks.
 if(timer?.ends)throw Error('active-focus');
 const seconds=Math.max(60,Math.min(1500,(task.estimate||25)*60));
 return {...data,'personal-os.tasks.v1':tasks.map(x=>x.id===id?{...x,status:'doing',done:false}:x),
  'personal-os.focus.v1':{taskId:id,ends:now+seconds*1000,remaining:seconds,plannedSeconds:seconds,sessionId:crypto.randomUUID(),startedAt:new Date(now).toISOString()}};
}
export function saveTaskResult(data:Data,task:Task,note:string,date:string,complete:boolean,today:string):Data{
 const tasks=(data['personal-os.tasks.v1']??[]) as Task[];
 const current=tasks.find(x=>x.id===task.id);
 if(!current||current.archived||current.revision!==task.revision)throw Error('edit-conflict');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>today||note.trim().length>3000)throw Error('invalid-result');
 return {...data,'personal-os.tasks.v1':tasks.map(x=>x.id===task.id?{...x,result:note.trim()?{note:note.trim(),date}:undefined,...(complete?{done:true,status:'done' as const}:{})}:x)};
}
