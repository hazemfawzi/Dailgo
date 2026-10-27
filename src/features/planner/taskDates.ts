import { statusOf } from '../tasks/model';
import type { Task } from '../tasks/model';
export function tasksOnDate(tasks:Task[],date:string){
 return tasks.filter(task=>!task.archived&&statusOf(task)!=='cancelled'&&(task.plannedDate===date||task.dueDate===date));
}
export function taskDateLabels(task:Task,date:string){
 return {planned:task.plannedDate===date,due:task.dueDate===date};
}
