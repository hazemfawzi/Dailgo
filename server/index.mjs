import { createWorkspaceEvents } from './events.mjs';
import { createSessions } from './auth.mjs';
import { reportError, RequestError } from './errors.mjs';
import { createAccountRoutes } from './routes/account.mjs';
import { createWorkspaceRoutes } from './routes/workspace.mjs';
import { createWidgets } from './widgets.mjs';
import { createNotifications } from './notifications.mjs';
import { createBilling } from './billing.mjs';
import { createCalendar } from './calendar.mjs';
import { createCollaboration } from './collaboration.mjs';
import { identityStore } from './identity.mjs';
import { createAssistantService } from './assistant.mjs';
import { resource, stateKeys } from './resources.mjs';
import { readConfig } from './config.mjs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, chmodSync, realpathSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const { validateData, auditWorkspace, validateGoalDateChanges } = await import(
  new URL('./domain.mjs', import.meta.url)
);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const defaultDb = fileURLToPath(new URL('../.local-data/workspace.sqlite', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
export function createLocalServer(file = defaultDb, options = {}) {
  const config = options.config ?? readConfig();
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec(
    'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS account(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL,data TEXT NOT NULL);',
  );
  const identities = identityStore(db, {
    recordsOnly: options.recordsOnly ?? process.env.WORKSPACE_RECORDS_ONLY === 'true',
  });
  const collaboration = createCollaboration(db, identities, {
    recordsOnly: options.recordsOnly ?? process.env.WORKSPACE_RECORDS_ONLY === 'true',
  });
  const widgets = createWidgets(db, identities);
  const assistant = createAssistantService(db, {
    ...options.assistant,
    getWorkspace: (principal) => identities.workspace(principal).data,
  });
  const billing = createBilling(db, options.billing);
  const calendar = createCalendar(db, options.calendar);
  const notifications = createNotifications(db, identities, options.notifications);
  chmodSync(file, 0o600);
  const attempts = new Map();
  const send = (res, status, body) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(body));
  };
  const configured = () => db.prepare('SELECT username FROM account WHERE id=1').get();
  const sessions = createSessions(db, identities, config, options.now);
  const session = (req, res) => sessions.find(req, res);
  const setSession = sessions.create;
  const read = async (req, maxBytes = 10 * 1024 * 1024) => {
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json'))
      throw new RequestError('content-type');
    let bytes = 0;
    const chunks = [];
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > maxBytes) throw new RequestError('too-large', 413);
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new RequestError('invalid-json');
    }
  };
  const context = {
    db,
    configured,
    identities,
    session,
    setSession,
    read,
    send,
    config,
    hash,
    attempts,
    collaboration,
    report: (error, req, res) => reportError(error, req, res, send, options.logger),
  };
  const events = createWorkspaceEvents(identities, session);
  const accountRoutes = createAccountRoutes(context);
  const workspaceRoutes = createWorkspaceRoutes(context);
  const server = createServer(async (req, res) => {
    try {
      if (config.production) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000');
        if (
          req.headers.host !== new URL(config.origin).host ||
          req.headers['x-forwarded-proto'] !== 'https'
        )
          return send(res, 400, { error: 'https-host-required' });
      }
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD')
          return send(res, 405, { error: 'method-not-allowed' });
        const requestedPath = decodeURIComponent(url.pathname);
        if (
          requestedPath.split('/').some((part) => part.startsWith('.')) ||
          /\.(?:sqlite(?:-wal|-shm)?|env|mjs)$/i.test(requestedPath)
        )
          return send(res, 404, { error: 'not-found' });
        let path = resolve(dist, '.' + requestedPath);
        if (path !== resolve(dist) && !path.startsWith(resolve(dist) + sep))
          return send(res, 404, { error: 'not-found' });
        if (!existsSync(path) && extname(path)) return send(res, 404, { error: 'asset-not-found' });
        if (!extname(path)) path = resolve(dist, 'index.html');
        if (!existsSync(path)) return send(res, 404, { error: 'build-required' });
        const type =
          {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css',
            '.png': 'image/png',
            '.svg': 'image/svg+xml',
            '.webmanifest': 'application/manifest+json',
          }[extname(path)] ?? 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': type,
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Cache-Control':
            extname(path) === '.html' || path.endsWith('sw.js') || path.endsWith('release.json')
              ? 'no-cache'
              : 'public, max-age=3600',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
        });
        return res.end(req.method === 'HEAD' ? undefined : readFileSync(path));
      }
      if (url.pathname === '/api/billing/webhook' && req.method === 'POST') {
        try {
          let bytes = 0;
          const chunks = [];
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > 262144) throw new RequestError('too-large', 413);
            chunks.push(chunk);
          }
          return send(
            res,
            200,
            await billing.webhook(Buffer.concat(chunks), req.headers['stripe-signature']),
          );
        } catch (error) {
          return reportError(error, req, res, send, options.logger);
        }
      }
      if (req.method !== 'GET') {
        const origin = req.headers.origin;
        try {
          const parsed = new URL(origin);
          if (
            config.production
              ? origin !== config.origin
              : !['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.protocol !== 'http:'
          )
            throw Error();
        } catch {
          return send(res, 403, { error: 'origin-rejected' });
        }
      }
      if (url.pathname.startsWith('/api/account/')) return await accountRoutes(req, res, url);
      if (url.pathname === '/api/health' && req.method === 'GET')
        return send(res, 200, {
          status: config.production ? 'production' : 'local-only',
          ai: assistant.status('owner').enabled ? 'available' : 'not-configured',
          integrations: [],
        });

      if (url.pathname === '/api/public/goal' && req.method === 'POST') {
        try {
          const body = await read(req, 16384);
          return send(
            res,
            200,
            body.comment === undefined
              ? collaboration.shared(body.token)
              : collaboration.comment(body.token, body.comment),
          );
        } catch (error) {
          return reportError(error, req, res, send, options.logger);
        }
      }
      if (url.pathname === '/api/public/verify-email' && req.method === 'POST') {
        try {
          return send(res, 200, notifications.verify((await read(req, 16384)).token));
        } catch (error) {
          return reportError(error, req, res, send, options.logger);
        }
      }

      if (url.pathname === '/api/widgets/today' && req.method === 'GET') {
        try {
          return send(res, 200, widgets.today(req.headers.authorization));
        } catch (error) {
          return reportError(error, req, res, send, options.logger);
        }
      }
      if (url.pathname === '/api/calendar/callback' && req.method === 'GET') {
        try {
          const cookie = (req.headers.cookie ?? '')
            .split(';')
            .map((x) => x.trim())
            .find((x) => x.startsWith('dailgo_calendar_state='))
            ?.slice('dailgo_calendar_state='.length);
          await calendar.callback(
            cookie,
            url.searchParams.get('state'),
            url.searchParams.get('code'),
          );
          res.writeHead(303, {
            Location: config.origin + '/tools?tab=connections&calendar=connected',
            'Cache-Control': 'no-store',
            'Set-Cookie':
              'dailgo_calendar_state=; HttpOnly; SameSite=Lax; Path=/api/calendar/callback; Max-Age=0' +
              (config.cookieSecure ? '; Secure' : ''),
          });
          return res.end();
        } catch (error) {
          return reportError(error, req, res, send, options.logger);
        }
      }
      const signed = session(req, res);
      if (!signed) return send(res, 401, { error: 'sign-in-required' });
      const principal = signed.principal;
      res.setHeader('X-Dailgo-Account', principal);
      if (req.headers['x-dailgo-account'] && req.headers['x-dailgo-account'] !== principal)
        return send(res, 401, { error: 'account-changed' });
      if (url.pathname === '/api/workspace/events' && req.method === 'GET')
        return events.open(req, res, principal, url.searchParams.get('account'));
      if (url.pathname === '/api/widgets' && req.method === 'GET')
        return send(res, 200, { devices: widgets.list(principal) });
      if (url.pathname === '/api/widgets' && req.method === 'POST') {
        try {
          await read(req, 1024);
          return send(res, 201, widgets.create(principal));
        } catch (error) {
          return reportError(error, req, res, send, options.logger);
        }
      }
      if (url.pathname.startsWith('/api/widgets/') && req.method === 'DELETE') {
        await read(req, 1024);
        return send(res, 200, widgets.revoke(principal, url.pathname.split('/').at(-1)));
      }
      if (
        url.pathname.startsWith('/api/notifications') ||
        url.pathname.startsWith('/api/calendar') ||
        url.pathname.startsWith('/api/billing')
      ) {
        try {
          const body = req.method === 'GET' ? {} : await read(req, 32768);
          let result;
          if (url.pathname === '/api/notifications' && req.method === 'GET')
            result = notifications.status(principal);
          else if (url.pathname === '/api/notifications' && req.method === 'PUT')
            result = notifications.settings(principal, body);
          else if (url.pathname === '/api/notifications/verify' && req.method === 'POST')
            result = await notifications.requestVerification(principal);
          else if (url.pathname === '/api/notifications/subscribe' && req.method === 'POST')
            result = notifications.subscribe(principal, body);
          else if (url.pathname === '/api/notifications/subscribe' && req.method === 'DELETE')
            result = notifications.unsubscribe(principal, body.endpoint);
          else if (url.pathname === '/api/notifications/test' && req.method === 'POST')
            result = await notifications.test(principal);
          else if (url.pathname === '/api/calendar' && req.method === 'GET')
            result = calendar.status(principal);
          else if (url.pathname === '/api/calendar/start' && req.method === 'POST') {
            result = calendar.start(principal, signed.token);
            res.setHeader(
              'Set-Cookie',
              'dailgo_calendar_state=' +
                new URL(result.url).searchParams.get('state') +
                '; HttpOnly; SameSite=Lax; Path=/api/calendar/callback; Max-Age=600' +
                (config.cookieSecure ? '; Secure' : ''),
            );
          } else if (url.pathname === '/api/calendar/events' && req.method === 'POST')
            result = await calendar.events(principal, body);
          else if (url.pathname === '/api/calendar/export' && req.method === 'POST')
            result = await calendar.exportEvent(
              principal,
              body,
              identities.workspace(principal).data,
            );
          else if (url.pathname === '/api/calendar' && req.method === 'DELETE')
            result = await calendar.disconnect(principal);
          else if (url.pathname === '/api/billing' && req.method === 'GET')
            result = await billing.status(principal);
          else if (url.pathname === '/api/billing/checkout' && req.method === 'POST')
            result = await billing.checkout(principal);
          else if (url.pathname === '/api/billing/portal' && req.method === 'POST')
            result = await billing.portal(principal);
          else return send(res, 404, { error: 'not-found' });
          return send(res, 200, result);
        } catch (error) {
          return reportError(error, req, res, send, options.logger);
        }
      }
      if (url.pathname.startsWith('/api/family') || url.pathname.startsWith('/api/shares')) {
        try {
          const body = req.method === 'GET' ? {} : await read(req, 262144);
          const route = url.pathname.split('/').filter(Boolean);
          let result;
          if (url.pathname === '/api/family' && req.method === 'GET')
            result = { spaces: collaboration.list(principal) };
          else if (url.pathname === '/api/family' && req.method === 'POST') {
            if (billing.enabled && !billing.isPro(principal))
              return send(res, 403, { error: 'pro-required' });
            result = collaboration.create(principal, body.title);
          } else if (url.pathname === '/api/family/join' && req.method === 'POST')
            result = collaboration.join(principal, body.token);
          else if (route[1] === 'family' && route.length === 3 && req.method === 'PUT')
            result = collaboration.commit(principal, route[2], body);
          else if (route[1] === 'family' && route[3] === 'invite' && req.method === 'POST') {
            if (billing.enabled && !billing.isPro(principal))
              return send(res, 403, { error: 'pro-required' });
            result = collaboration.invite(principal, route[2]);
          } else if (
            route[1] === 'family' &&
            route[3] === 'invite' &&
            route[4] &&
            req.method === 'DELETE'
          ) {
            collaboration.revokeInvite(principal, route[2], route[4]);
            result = { revoked: true };
          } else if (
            route[1] === 'family' &&
            route[3] === 'members' &&
            route[4] &&
            req.method === 'DELETE'
          )
            result = collaboration.removeMember(principal, route[2], route[4]);
          else if (url.pathname === '/api/shares' && req.method === 'GET')
            result = { shares: collaboration.shares(principal) };
          else if (url.pathname === '/api/shares' && req.method === 'POST') {
            if (billing.enabled && !billing.isPro(principal))
              return send(res, 403, { error: 'pro-required' });
            result = collaboration.share(principal, body);
          } else if (route[1] === 'shares' && route.length === 3 && req.method === 'GET')
            result = collaboration.review(principal, route[2]);
          else if (route[1] === 'shares' && route.length === 3 && req.method === 'DELETE') {
            collaboration.revoke(principal, route[2]);
            result = { revoked: true };
          } else return send(res, 404, { error: 'not-found' });
          return send(res, 200, result);
        } catch (error) {
          return reportError(error, req, res, send, options.logger);
        }
      }
      if (url.pathname === '/api/assistant/status' && req.method === 'GET')
        return send(res, 200, assistant.status(principal, billing.isPro(principal)));
      if (url.pathname === '/api/assistant/preview' && req.method === 'POST') {
        try {
          return send(
            res,
            200,
            await assistant.preview(
              principal,
              await read(req, 32768),
              identities.workspace(principal).data,
              billing.isPro(principal),
            ),
          );
        } catch (error) {
          return reportError(error, req, res, send, options.logger);
        }
      }

      return await workspaceRoutes(req, res, url, principal);
    } catch (error) {
      return reportError(error, req, res, send, options.logger);
    }
  });
  const timer = options.scheduler
    ? setInterval(
        () =>
          void notifications.tick().catch((error) =>
            (options.logger ?? ((event) => console.error(JSON.stringify(event))))({
              level: 'error',
              event: 'notification-scheduler-failed',
              errorType: error.name,
            }),
          ),
        60000,
      )
    : undefined;
  timer?.unref();
  server.once('close', () => {
    if (db.isOpen) identities.projectLegacy();
    if (timer) clearInterval(timer);
    notifications.close();
    events.close();
  });
  return { server, db, notifications };
}
export function startServer() {
  if (Number(process.versions.node.split('.')[0]) < 24)
    throw Error('Node.js 24 or later is required');
  process.umask(0o077);
  const config = readConfig();
  const { server, db } = createLocalServer(config.dbPath || defaultDb, { config, scheduler: true });
  server.listen(config.port, '127.0.0.1', () =>
    process.stdout.write('Application listener ready on loopback port ' + config.port + '\n'),
  );
  const stop = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), 25000).unref();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return server;
}
// Node resolves import.meta.url to the real release path; argv may use current/.
if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
)
  startServer();
