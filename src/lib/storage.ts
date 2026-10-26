import { forgetRecord } from './forget';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { SetStateAction } from 'react';
import { commit, readStore, restoreSnapshot, storageToken, DATA_KEYS,validateData } from './storageCore';
import type { Data, Store } from './storageCore';
import { ApiError,loadServerStore,commitServerStore,replaceServerStore } from './serverStorage';
import { setServerData } from './activeWorkspace';
let snapshot:Store={version:3,revision:'legacy',data:{}};
let issue='';let ready=false;let remote=false;let pendingWrites=0;
const listeners=new Set<()=>void>();
const previews=new Map<string,{id:number;value:unknown}>();let previewId=0;let previewVersion=0;
async function locked<T>(fn:()=>T|Promise<T>):Promise<T>{return await (navigator.locks?navigator.locks.request('personal-os-write',async()=>await fn()):queue(fn));}
let pending:Promise<unknown>=Promise.resolve();
function queue<T>(fn:()=>T|Promise<T>){const next=pending.then(fn,fn);pending=next.catch(()=>{});return next;}
function emit(){previewVersion++;if(remote)setServerData(snapshot.data);listeners.forEach(fn=>fn());}
function failed(error:unknown){
 issue=error instanceof ApiError&&error.status===409?'conflict':error instanceof ApiError&&error.status===401?'auth':'failed';
 if(issue==='auth')window.dispatchEvent(new Event('dailgo-session-expired'));
 emit();
}
export function isServerStorage(){return remote;}
export function currentStorageToken(){return remote?snapshot.revision:storageToken(localStorage);}
export async function connectServerStorage(){
 const store=await loadServerStore();remote=true;ready=true;snapshot=store;previews.clear();issue='';setServerData(store.data);emit();
}
export function disconnectServerStorage(){remote=true;ready=true;snapshot={version:3,revision:'empty',data:{}};issue='auth';previews.clear();setServerData({});emit();}
export function refreshStorage(){
 if(remote){void locked(async()=>{try{snapshot=await loadServerStore();issue='';emit();}catch(error){failed(error);}});return;}
 try{snapshot=readStore(localStorage);issue='';}catch{issue='corrupt';}emit();
}
function init(){if(ready)return;ready=true;refreshStorage();window.addEventListener('storage',()=>{if(!remote)refreshStorage();});}
function subscribe(fn:()=>void){init();listeners.add(fn);return()=>{listeners.delete(fn);};}
export function useStorageState(){init();useSyncExternalStore(subscribe,()=>snapshot);const error=useSyncExternalStore(subscribe,()=>issue);const saving=useSyncExternalStore(subscribe,()=>pendingWrites>0||previews.size>0);return {data:snapshot.data,revision:snapshot.revision,error,saving};}
export async function replaceData(data:Data,expected:string){
 pendingWrites++;emit();
 try{snapshot=remote?await commitServerStore(data,expected):commit(localStorage,expected,data);issue='';emit();return true;}
 catch(error){if(remote){if(error instanceof ApiError&&error.status===409){try{snapshot=await loadServerStore();}catch{/* Preserve the last confirmed snapshot. */}}failed(error);}
 else{if(error instanceof Error&&['conflict','edit-conflict'].includes(error.message)){refreshStorage();issue='conflict';}else issue='failed';emit();}return false;}finally{pendingWrites--;emit();}
}
function currentStore(){return remote?snapshot:readStore(localStorage);}
export function usePersisted<T>(key:string,initial:T,restore?:(saved:unknown)=>T){
 const {data,error}=useStorageState();
 useSyncExternalStore(subscribe,()=>previewVersion);
 const saved=data[key];const confirmed=saved===undefined?initial:restore?restore(saved):saved as T;
 const value=remote&&previews.has(key)?previews.get(key)!.value as T:confirmed;
 useEffect(()=>{void locked(async()=>{if(saved===undefined&&!issue){try{const latest=currentStore();if(latest.data[key]===undefined)await replaceData({...latest.data,[key]:initial},latest.revision);}catch(error){if(remote)failed(error);else{issue='corrupt';emit();}}}});},[key,saved,initial]);
 const setValue=useCallback((change:SetStateAction<T>)=>{
 if(issue)return;
 let id:number|undefined;
 if(remote){const stored=snapshot.data[key];const current=previews.has(key)?previews.get(key)!.value as T:stored===undefined?initial:restore?restore(stored):stored as T;id=++previewId;previews.set(key,{id,value:typeof change==='function'?(change as (old:T)=>T)(current):change});emit();}
 void locked(async()=>{
 try{
 if(issue)return;
 const observed=snapshot;
 try{const latest=currentStore();if(latest.revision!==observed.revision){snapshot=latest;issue='conflict';emit();return;}
 const current=latest.data[key]===undefined?initial:restore?restore(latest.data[key]):latest.data[key] as T;
 const next=typeof change==='function'?(change as (old:T)=>T)(current):change;
 await replaceData({...latest.data,[key]:next},latest.revision);
 }catch(error){if(remote)failed(error);else{issue='corrupt';emit();}}
 }finally{if(id!==undefined&&previews.get(key)?.id===id){previews.delete(key);emit();}}
 });},[key,initial,restore]);
 return [value,setValue,!!error] as const;
}
export function restoreBackupData(data:Data,token:string){return locked(async()=>{try{
 if(currentStorageToken()!==token)return false;
 snapshot=remote?await replaceServerStore(data,token):restoreSnapshot(localStorage,data,token);issue='';emit();return true;
 }catch(error){if(remote)failed(error);return false;}});}
export function transactData(update:(data:Data)=>Data){return locked(async()=>{
 if(issue==='corrupt'||issue==='failed'||issue==='auth')return false;
 let latest:Store;
 try{latest=currentStore();}catch{issue='corrupt';emit();return false;}
 let next:Data;
 // Rejected domain actions do not indicate a storage outage.
 try{next=update(latest.data);validateData(next);}catch{return false;}
 return replaceData(next,latest.revision);
});}
export function purgeTrashRecord(recordId:string){return locked(async()=>{try{const current=currentStore();const token=currentStorageToken();const next=forgetRecord(current.data,recordId);snapshot=remote?await replaceServerStore(next,token):restoreSnapshot(localStorage,next,token);if(!remote)for(const key of DATA_KEYS)localStorage.removeItem(key);issue='';emit();return true;}catch(error){if(remote)failed(error);else refreshStorage();return false;}});}
// Refresh only between writes, so another device cannot replace an in-flight edit.
export function startServerRefresh(){
 const refresh=()=>{if(remote&&!issue)refreshStorage();};const timer=window.setInterval(refresh,10000);window.addEventListener('focus',refresh);
 return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);};
}
