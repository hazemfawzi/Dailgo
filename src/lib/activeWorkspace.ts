import type { Data } from './storageCore';
// Date helpers must read the same planning settings as the active workspace.
let serverData:Data|null=null;
export function setServerData(data:Data|null){serverData=data;}
export function getServerData(){return serverData;}
