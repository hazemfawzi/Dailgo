import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { verifyPassword } from '../auth.mjs';
export function createAccountRoutes(context) {
  const {
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
    report,
  } = context;
  return async function accountRoutes(req, res, url) {
    const activeSession = session(req, res);
    const principal = activeSession?.principal;
    if (principal) {
      res.setHeader('X-Dailgo-Account', principal);
      if (
        req.headers['x-dailgo-account'] &&
        req.headers['x-dailgo-account'] !== principal &&
        url.pathname !== '/api/account/login'
      )
        return send(res, 401, { error: 'account-changed' });
    }
    if (
      ['password', 'logout'].some((name) => url.pathname === '/api/account/' + name) &&
      !principal
    ) {
      send(res, 401, { error: 'sign-in-required' });
      return;
    }
    if (url.pathname === '/api/account/status' && req.method === 'GET') {
      const user = configured();
      const active = activeSession;
      if (active) res.setHeader('X-Dailgo-Account', active.principal);
      return send(res, 200, {
        configured: !!user,
        setupTokenRequired: config.production,
        setupEnabled: !config.production || !!config.setupToken,
        signedIn: !!activeSession,
        username: activeSession ? identities.user(principal)?.username : undefined,
      });
    }
    if (url.pathname === '/api/account/setup' && req.method === 'POST') {
      if (configured()) return send(res, 409, { error: 'already-configured' });
      const body = await read(req, 16384);
      if (
        config.production &&
        (!config.setupToken ||
          typeof body.setupToken !== 'string' ||
          !timingSafeEqual(
            Buffer.from(hash(body.setupToken)),
            Buffer.from(hash(config.setupToken)),
          ))
      )
        return send(res, 403, { error: 'setup-token-required' });
      if (
        typeof body.username !== 'string' ||
        body.username.trim().length < 3 ||
        body.username.length > 80 ||
        typeof body.password !== 'string' ||
        body.password.length < 12 ||
        body.password.length > 200
      )
        return send(res, 400, { error: 'invalid-credentials' });
      const salt = randomBytes(16).toString('hex');
      db.prepare('INSERT INTO account VALUES(1,?,?,?)').run(
        body.username.trim(),
        salt,
        scryptSync(body.password, salt, 64).toString('hex'),
      );
      setSession(res);
      res.setHeader('X-Dailgo-Account', 'owner');
      return send(res, 201, { configured: true, signedIn: true });
    }
    if (url.pathname === '/api/account/accept-invite' && req.method === 'POST') {
      try {
        const principal = collaboration.accept(await read(req, 16384));
        setSession(res, principal);
        res.setHeader('X-Dailgo-Account', principal);
        return send(res, 201, { signedIn: true });
      } catch (error) {
        return report(error, req, res);
      }
    }
    if (url.pathname === '/api/account/login' && req.method === 'POST') {
      for (const [address, value] of attempts)
        if (value.until < Date.now()) attempts.delete(address);
      const key = config.production
        ? String(req.headers['x-real-ip'] ?? req.socket.remoteAddress)
        : req.socket.remoteAddress;
      if (!attempts.has(key) && attempts.size >= 10000)
        return send(res, 429, { error: 'try-later' });
      let rate = attempts.get(key);
      if (!rate || rate.until < Date.now()) {
        rate = { count: 0, until: Date.now() + 300000 };
        attempts.set(key, rate);
      }
      if (rate.count >= 5) return send(res, 429, { error: 'try-later' });
      rate.count++;
      const body = await read(req, 16384);
      const user =
        typeof body.username === 'string' ? identities.byUsername(body.username) : undefined;
      const valid = verifyPassword(body.password, user);
      if (!valid || body.username !== user?.username)
        return send(res, 401, { error: 'invalid-credentials' });
      attempts.delete(key);
      setSession(res, user.principal, body.remember === true);
      res.setHeader('X-Dailgo-Account', user.principal);
      return send(res, 200, { signedIn: true });
    }
    if (url.pathname === '/api/account/password' && req.method === 'POST') {
      const body = await read(req, 16384);
      const user = identities.user(principal);
      if (
        typeof body.currentPassword !== 'string' ||
        body.currentPassword.length > 200 ||
        typeof body.newPassword !== 'string' ||
        body.newPassword.length < 12 ||
        body.newPassword.length > 200 ||
        !user ||
        !timingSafeEqual(
          scryptSync(body.currentPassword, user.salt, 64),
          Buffer.from(user.password, 'hex'),
        )
      )
        return send(res, 400, { error: 'invalid-credentials' });
      const salt = randomBytes(16).toString('hex');
      db.exec('BEGIN IMMEDIATE');
      try {
        const password = scryptSync(body.newPassword, salt, 64).toString('hex');
        if (principal === 'owner') {
          db.prepare('UPDATE account SET salt=?,password=? WHERE id=1').run(salt, password);
          db.prepare('DELETE FROM sessions').run();
        } else {
          db.prepare('UPDATE members SET salt=?,password=? WHERE id=?').run(
            salt,
            password,
            principal,
          );
          db.prepare('DELETE FROM member_sessions WHERE principal=?').run(principal);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      setSession(res, principal);
      return send(res, 200, { changed: true });
    }
    if (url.pathname === '/api/account/logout' && req.method === 'POST') {
      db.prepare(
        'DELETE FROM ' + (activeSession.member ? 'member_sessions' : 'sessions') + ' WHERE token=?',
      ).run(activeSession.token);
      res.setHeader('Set-Cookie', [
        'personal_os_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0' +
          (config.cookieSecure ? '; Secure' : ''),
        'dailgo_member_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0' +
          (config.cookieSecure ? '; Secure' : ''),
      ]);
      return send(res, 200, { signedIn: false });
    }
    send(res, 404, { error: 'not-found' });
  };
}
