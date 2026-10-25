import { statusOf } from '../tasks/model';
import type { Task } from '../tasks/model';
export function projectStats(tasks:Task[],id:string){const items=tasks.filter(x=>x.projectId===id&&!x.archived&&statusOf(x)!=='cancelled');const done=items.filter(x=>x.done).length;return {total:items.length,done,progress:items.length?Math.round(done/items.length*100):0};}
export function replaceProjectTasks(all:Task[],id:string,next:Task[]){const incoming=new Map(next.map(x=>[x.id,{...x,projectId:id}]));return [...all.flatMap(x=>{if(x.projectId!==id)return [x];const value=incoming.get(x.id);incoming.delete(x.id);return value?[value]:[];}),...incoming.values()];}
