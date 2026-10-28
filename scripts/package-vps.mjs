import {
  mkdirSync,
  readdirSync,
  cpSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const target = resolve(
  process.argv[2] ?? '.release/vps-' + new Date().toISOString().replace(/[:.]/g, '-'),
);
mkdirSync(target, { recursive: true });
if (readdirSync(target).length)
  throw Error('Choose an empty release directory; existing files are preserved');
cpSync('dist', join(target, 'dist'), { recursive: true });
const commit = process.env.GITHUB_SHA ?? null;
if (commit !== null && !/^[0-9a-f]{40}$/.test(commit)) throw Error('Invalid GITHUB_SHA');
writeFileSync(join(target, 'dist', 'release.json'), JSON.stringify({ commit }) + '\n');
cpSync('deploy', join(target, 'deploy'), {
  recursive: true,
  filter: (path) => !path.split(/[\\/]/).includes('__pycache__') && !path.endsWith('.pyc'),
});
mkdirSync(join(target, 'server'));
for (const file of [
  'index.mjs',
  'config.mjs',
  'domain.mjs',
  'maintenance.mjs',
  'resources.mjs',
  'provision.mjs',
])
  copyFileSync(
    join('server', file === 'index.mjs' ? 'application.mjs' : file),
    join(target, 'server', file),
  );
copyFileSync('deploy/VPS.md', join(target, 'README.md'));
writeFileSync(
  join(target, 'package.json'),
  JSON.stringify(
    {
      name: 'personal-os-vps',
      private: true,
      version: '0.1.0',
      type: 'module',
      engines: { node: '24.x' },
      scripts: { start: 'node server/index.mjs' },
    },
    null,
    2,
  ),
);
const walk = (folder) =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const hashes = walk(target)
  .map(
    (path) =>
      createHash('sha256').update(readFileSync(path)).digest('hex') +
      '  ' +
      relative(target, path).replaceAll('\\', '/'),
  )
  .sort();
writeFileSync(join(target, 'SHA256SUMS'), hashes.join('\n') + '\n');
process.stdout.write(
  'VPS release prepared with bundled runtime dependencies, without accounts, databases or secrets.\n',
);
