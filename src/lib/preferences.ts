import { getServerData } from './activeWorkspace';
import { usePersisted } from './storage';
export type PlanningPreferences={weekStartsOn:number;capacity:number;buffer:number;timezone:string};
export const defaultPlanning:PlanningPreferences={weekStartsOn:1,capacity:240,buffer:30,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'};
export function getPlanning():PlanningPreferences {try{const active=getServerData();if(active)return active['personal-os.planning.v1'] as PlanningPreferences??defaultPlanning;if(typeof localStorage==='undefined')return defaultPlanning;const raw=localStorage.getItem('personal-os.workspace.v3');const data=raw?JSON.parse(raw).data:undefined;return data?.['personal-os.planning.v1']??defaultPlanning;}catch{return defaultPlanning;}}
export const usePlanning=()=>usePersisted<PlanningPreferences>('personal-os.planning.v1',defaultPlanning);
