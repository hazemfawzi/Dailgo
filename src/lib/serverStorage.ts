import { validateData } from './storageCore';
import type { Data,Store } from './storageCore';
export class ApiError extends Error {
 constructor(public status:number){super(`Server request failed (${status})`);}
}
export async function apiRequest(path:string,method='GET',body?:unknown){
 const response=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new ApiError(response.status);
 return response.json();
}
export function serverStore(value:{revision:string;data:unknown}):Store{
 if(typeof value.revision!=='string')throw Error('Invalid server revision');
 const data=value.data??{};validateData(data);return {version:3,revision:value.revision,data};
}
export async function loadServerStore(){return serverStore(await apiRequest('workspace'));}
export async function commitServerStore(data:Data,revision:string){validateData(data);return serverStore(await apiRequest('workspace/commit','PUT',{revision,data}));}
export async function replaceServerStore(data:Data,revision:string){
 validateData(data);const result=await apiRequest('workspace','PUT',{revision,data});
 return serverStore({revision:result.revision,data});
}
