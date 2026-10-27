import { milestoneDateIssue } from '../features/life/goalDates';
import { transactData } from './storage';
import { restoreWorkspace } from '../features/life/demoGoals';
import type { Task } from '../features/tasks/model';
import type { Entry } from './workspace';
export function saveEntryDraft(draft:Entry){draft={...draft,links:draft.links?.map(x=>x.trim()).filter(Boolean),tags:draft.tags?.map(x=>x.trim()).filter(Boolean)};return transactData(data=>{if(draft.kind==='goal'&&milestoneDateIssue(draft))throw Error('invalid-milestone-date');const workspace=restoreWorkspace(data['personal-os.entries.v1']);const existing=workspace.entries.find(x=>x.id===draft.id);if(draft.revision&&!existing)throw Error("edit-conflict");const relatedTasks=draft.kind==='project'&&existing?.parentGoalId!==draft.parentGoalId?((data['personal-os.tasks.v1']??[]) as Task[]).map(x=>x.projectId===draft.id?{...x,goalId:draft.parentGoalId,milestoneId:undefined}:x):undefined;return {...data,...(relatedTasks?{'personal-os.tasks.v1':relatedTasks}:{}),'personal-os.entries.v1':{...workspace,entries:workspace.entries.some(x=>x.id===draft.id)?workspace.entries.map(x=>x.id===draft.id?{...draft,title:draft.title.trim()}:x):[...workspace.entries,{...draft,title:draft.title.trim()}]}};});}


