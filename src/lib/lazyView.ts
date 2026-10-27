import { waitForPendingSaves } from './storage';
import { lazy,type ComponentType } from 'react';
export const chunkFailure=(error:unknown)=>error instanceof Error&&/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|error loading dynamically imported module/i.test(error.message);
export async function loadView<T>(load:()=>Promise<T>,storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,reload:()=>void,beforeReload:()=>Promise<boolean>=async()=>true):Promise<T>{
 const key='dailgo.chunk-reload';
 try{const result=await load();storage.removeItem(key);return result;}
 catch(error){if(chunkFailure(error)){try{if(!storage.getItem(key)&&await beforeReload()){storage.setItem(key,'attempted');reload();}}catch{/* Storage may be unavailable. Keep the manual reload action. */}}throw error;}
}
export const lazyView=(load:()=>Promise<{default:ComponentType<any>}>)=>lazy(()=>loadView(load,sessionStorage,()=>window.location.reload(),async()=>!document.querySelector('[role=dialog]')&&await waitForPendingSaves()));
