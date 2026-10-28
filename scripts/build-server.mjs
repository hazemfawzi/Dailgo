import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
const dir = new URL('../server/', import.meta.url);
mkdirSync(dir, { recursive: true });
await build({
  entryPoints: ['src/lib/storageCore.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: new URL('domain.mjs', dir).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
});

await build({
  entryPoints: ['server/index.mjs'],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  outfile: new URL('application.mjs', dir).pathname,
  banner: {
    js: "import { createRequire } from 'node:module';const require=createRequire(import.meta.url);",
  },
});
