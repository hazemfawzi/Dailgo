import { forgetRecord } from './forget';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { SetStateAction } from 'react';
import { commit, readStore, restoreSnapshot, storageToken, DATA_KEYS,validateData } from './storageCore';
import type { Data, Store } from './storageCore';
let snapshot:Store={version:3,revision:'legacy',data:{}};
let issue='';let ready=false;
const listeners=new Set<()=>void>();
function locked<T>(fn:()=>T):Promise<T>{return navigator.locks?navigator.locks.request('personal-os-write',fn):Promise.resolve().then(fn);}
function emit(){listeners.forEach(fn=>fn());}
export function refreshStorage(){try{snapshot=readStore(localStorage);issue='';}catch{issue='corrupt';}emit();}
function init(){if(ready)return;ready=true;refreshStorage();window.addEventListener('storage',()=>refreshStorage());}
function subscribe(fn:()=>void){init();listeners.add(fn);return()=>{listeners.delete(fn);};}
export function useStorageState(){init();useSyncExternalStore(subscribe,()=>snapshot);const error=useSyncExternalStore(subscribe,()=>issue);return {data:snapshot.data,revision:snapshot.revision,error};}
export function replaceData(data:Data,expected:string){try{snapshot=commit(localStorage,expected,data);issue='';emit();return true;}catch(error){if(error instanceof Error&&['conflict','edit-conflict'].includes(error.message)){refreshStorage();issue='conflict';}else issue='failed';emit();return false;}}
export function usePersisted<T>(key:string,initial:T,restore?:(saved:unknown)=>T){
 const {data,error}=useStorageState();
 const saved=data[key];const value=saved===undefined?initial:restore?restore(saved):saved as T;
 useEffect(()=>{void locked(()=>{if(saved===undefined&&!issue){try{const latest=readStore(localStorage);if(latest.data[key]===undefined)replaceData({...latest.data,[key]:initial},latest.revision);}catch{issue='corrupt';emit();}}});},[key,saved,initial]);
 const setValue=useCallback((change:SetStateAction<T>)=>{void locked(()=>{
 if(issue==='corrupt'||issue==='failed')return;
 const observed=snapshot;
 try{const latest=readStore(localStorage);if(latest.revision!==observed.revision){snapshot=latest;issue='conflict';emit();return;}
 const current=latest.data[key]===undefined?initial:restore?restore(latest.data[key]):latest.data[key] as T;
 const next=typeof change==='function'?(change as (old:T)=>T)(current):change;
 replaceData({...latest.data,[key]:next},latest.revision);
 }catch{issue='corrupt';emit();}
 });},[key,initial,restore]);
 return [value,setValue,!!error] as const;
}
export function restoreBackupData(data:Data,token:string){return locked(()=>{try{
 snapshot=restoreSnapshot(localStorage,data,token);issue='';emit();return true;
 }catch{return false;}});}





export function transactData(update:(data:Data)=>Data){return locked(()=>{
 if(issue==='corrupt'||issue==='failed')return false;
 let latest:Store;
 try{latest=readStore(localStorage);}catch{issue='corrupt';emit();return false;}
 let next:Data;
 // A rejected domain action is not a storage outage (for example an active timer).
 try{next=update(latest.data);validateData(next);}catch{return false;}
 return replaceData(next,latest.revision);
});}
export function purgeTrashRecord(recordId:string){return locked(()=>{try{const current=readStore(localStorage);const token=storageToken(localStorage);const next=forgetRecord(current.data,recordId);snapshot=restoreSnapshot(localStorage,next,token);for(const key of DATA_KEYS)localStorage.removeItem(key);issue='';emit();return true;}catch{refreshStorage();return false;}});}

