import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { createLocalServer } from '../server/index.mjs';
const directory=mkdtempSync(join(tmpdir(),'dailgo-browser-'));
const backend=createLocalServer(join(directory,'test.sqlite'));
await new Promise(resolve=>backend.server.listen(0,'127.0.0.1',resolve));
const vite=await createServer({server:{host:'127.0.0.1',port:5187,strictPort:true,proxy:{'/api':`http://127.0.0.1:${backend.server.address().port}`}}});
await vite.listen();
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await vite.close();await new Promise(resolve=>backend.server.close(resolve));backend.db.close();rmSync(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
