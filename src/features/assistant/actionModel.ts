import type { Data } from '../../lib/storageCore';
import type { Entry } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import type { Message } from './engine';
import { applyMutation,mutationRecord,mutationUndoable } from './mutationModel';
export type ActionConversation={id:string;title:string;archived:boolean;messages:Message[]};
export type UndoRow={id:string;title:string;collection:'personal-os.tasks.v1'|'personal-os.entries.v1';state:'safe'|'edited'|'missing'|'linked'};
export type UndoPreview={conversationId:string;messageId:string;rows:UndoRow[];token:string;mode?:'restore'|'remove'};
export function actionRecords(data:Data){return ((data['personal-os.conversations.v1']??[]) as ActionConversation[]).flatMap(c=>c.messages.filter(m=>m.role==='assistant'&&(m.proposal||m.batch||m.mutation)).map(m=>({conversation:c,message:m})));}
export function undoPreview(data:Data,conversationId:string,messageId:string):UndoPreview{
 const chats=(data['personal-os.conversations.v1']??[]) as ActionConversation[];
 const message=chats.find(c=>c.id===conversationId)?.messages.find(m=>m.id===messageId);
 if(!message||message.status!=='confirmed')throw Error('unavailable-action');
 if(message.mutation){const record=mutationRecord(data,message.mutation);const rows:UndoRow[]=[{id:message.mutation.id,title:record?.title??message.mutation.title,collection:message.mutation.collection,state:!record?'missing':mutationUndoable(data,message.mutation)?'safe':'edited'}];return {conversationId,messageId,rows,mode:'restore',token:JSON.stringify({message,record,rows})};}
 const tasks=(data['personal-os.tasks.v1']??[]) as Task[];const workspace=data['personal-os.entries.v1'] as {entries:Entry[]}|Entry[]|undefined;
 const entries=Array.isArray(workspace)?workspace:workspace?.entries??[];
 const ids=Array.from(new Set(message.targetIds??(message.targetId?[message.targetId]:[])));
 const records=ids.map(id=>tasks.find(x=>x.id===id)??entries.find(x=>x.id===id));
 const rows:UndoRow[]=ids.map((id,i)=>{const record=records[i];return {id,title:record?.title??id,collection:tasks.some(x=>x.id===id)?'personal-os.tasks.v1':'personal-os.entries.v1',state:!record?'missing':record.createdAt&&record.history?.length===1&&record.history[0].fields.length===1&&record.history[0].fields[0]==='created'?'safe':'edited'};});
 // Keep parents that have gained dependencies, including a child protected by a later edit.
 let changed=true;while(changed){changed=false;const removable=new Set(rows.filter(x=>x.state==='safe').map(x=>x.id));for(const row of rows){if(row.state!=='safe')continue;
 const linked=tasks.some(x=>!removable.has(x.id)&&[x.goalId,x.projectId,x.memoryId].includes(row.id))||entries.some(x=>!removable.has(x.id)&&x.parentGoalId===row.id);
 const timer=data['personal-os.focus.v1'] as {taskId?:string}|undefined;const sessions=(data['personal-os.sessions.v1']??[]) as {taskId:string}[];
 const weeks=Object.values(data['personal-os.weeks.v1']??{}) as {outcomes?:{goalId:string}[]}[];
 if(linked||timer?.taskId===row.id||sessions.some(x=>x.taskId===row.id)||weeks.some(w=>w.outcomes?.some(o=>o.goalId===row.id))){row.state='linked';changed=true;}
 }}
 return {conversationId,messageId,rows,token:JSON.stringify({message,records,rows})};
}
export function undoAction(data:Data,preview:UndoPreview,at=new Date().toISOString()):Data{
 const fresh=undoPreview(data,preview.conversationId,preview.messageId);
 if(fresh.token!==preview.token)throw Error('stale-undo');
 if(fresh.mode==='restore'){if(!fresh.rows.some(x=>x.state==='safe'))throw Error('nothing-to-undo');const chats=(data['personal-os.conversations.v1']??[]) as ActionConversation[];const msg=chats.find(x=>x.id===preview.conversationId)!.messages.find(x=>x.id===preview.messageId)!;const restored=applyMutation(data,msg.mutation!,true);return {...restored,'personal-os.conversations.v1':chats.map(c=>c.id===preview.conversationId?{...c,messages:c.messages.map(m=>m.id===preview.messageId?{...m,status:'reverted',undo:{at,removedIds:[],keptIds:[],restoredIds:[msg.mutation!.id]}}:m)}:c)};}
 const removedIds=fresh.rows.filter(x=>x.state==='safe').map(x=>x.id);if(!removedIds.length)throw Error('nothing-to-undo');
 const ids=new Set(removedIds);const tasks=(data['personal-os.tasks.v1']??[]) as Task[];const workspace=data['personal-os.entries.v1'] as {entries:Entry[]}|Entry[]|undefined;
 const entries=Array.isArray(workspace)?workspace:workspace?.entries??[];
 const chats=(data['personal-os.conversations.v1']??[]) as ActionConversation[];
 return {...data,'personal-os.tasks.v1':tasks.filter(x=>!ids.has(x.id)),...(workspace?{'personal-os.entries.v1':Array.isArray(workspace)?entries.filter(x=>!ids.has(x.id)):{...workspace,entries:entries.filter(x=>!ids.has(x.id))}}:{}),
 'personal-os.conversations.v1':chats.map(c=>c.id===preview.conversationId?{...c,messages:c.messages.map(m=>m.id===preview.messageId?{...m,status:'reverted',undo:{at,removedIds,keptIds:fresh.rows.filter(x=>x.state!=='safe').map(x=>x.id)}}:m)}:c)};
}
