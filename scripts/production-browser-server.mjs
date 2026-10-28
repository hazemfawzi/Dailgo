import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = mkdtempSync(join(tmpdir(), 'dailgo-production-browser-'));
const release = join(root, 'release');
execFileSync(process.execPath, ['scripts/package-vps.mjs', release], { stdio: 'pipe' });
const { createLocalServer } = await import(
  pathToFileURL(join(release, 'server', 'index.mjs')).href
);
const { server, db } = createLocalServer(join(root, 'fixture.sqlite'), {
  config: { production: false, origin: '', port: 5188, setupToken: '', cookieSecure: false },
  assistant: { env: {} },
  notifications: { env: {} },
  calendar: { env: {} },
  billing: { env: {} },
  scheduler: false,
});
await new Promise((resolve) => server.listen(5188, '127.0.0.1', resolve));
let stopped = false;
const stop = () => {
  if (stopped) return;
  stopped = true;
  server.close(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
    process.exit(0);
  });
  server.closeIdleConnections();
};
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
