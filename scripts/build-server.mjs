import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
const dir=new URL('../server/',import.meta.url);mkdirSync(dir,{recursive:true});
await build({entryPoints:['src/lib/storageCore.ts'],bundle:true,platform:'node',format:'esm',outfile:new URL('domain.mjs',dir).pathname.replace(/^\/([A-Za-z]:)/,'$1')});


