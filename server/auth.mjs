import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
const dummySalt = randomBytes(16).toString('hex');
const dummyPassword = scryptSync('not-an-account-password', dummySalt, 64);
export function verifyPassword(password, user, derive = scryptSync) {
  if (typeof password !== 'string' || password.length > 200) return false;
  const candidate = derive(password, user?.salt ?? dummySalt, 64);
  const matches = timingSafeEqual(
    candidate,
    user ? Buffer.from(user.password, 'hex') : dummyPassword,
  );
  return !!user && matches;
}
const hash = (value) => createHash('sha256').update(value).digest('hex');
export function createSessions(db, identities, config, now = Date.now) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS session_policies(token TEXT PRIMARY KEY,ttl INTEGER NOT NULL,absolute_expires INTEGER NOT NULL,renew_after INTEGER NOT NULL)',
  );
  const cookie = (token, member, seconds) =>
    `${member ? 'dailgo_member_session' : 'personal_os_session'}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${seconds}${config.cookieSecure ? '; Secure' : ''}`;
  function find(req, res) {
    const cookies = Object.fromEntries(
      (req.headers.cookie ?? '').split(';').map((x) => x.trim().split('=')),
    );
    for (const member of [true, false]) {
      const raw = cookies[member ? 'dailgo_member_session' : 'personal_os_session'];
      if (!raw) continue;
      const table = member ? 'member_sessions' : 'sessions';
      const row = db
        .prepare('SELECT * FROM ' + table + ' WHERE token=? AND expires>?')
        .get(hash(raw), now());
      if (!row) continue;
      const principal = member ? row.principal : 'owner';
      if (!identities.user(principal)) continue;
      const policy = db.prepare('SELECT * FROM session_policies WHERE token=?').get(row.token);
      if (policy && policy.absolute_expires <= now()) {
        db.prepare('DELETE FROM ' + table + ' WHERE token=?').run(row.token);
        continue;
      }
      if (res && policy && policy.renew_after <= now()) {
        const expires = Math.min(now() + policy.ttl, policy.absolute_expires);
        db.prepare('UPDATE ' + table + ' SET expires=? WHERE token=?').run(expires, row.token);
        db.prepare('UPDATE session_policies SET renew_after=? WHERE token=?').run(
          now() + 15 * 60000,
          row.token,
        );
        res.setHeader('Set-Cookie', cookie(raw, member, Math.floor((expires - now()) / 1000)));
      }
      return { ...row, principal, member };
    }
  }
  function create(res, principal = 'owner', remember = false) {
    const token = randomBytes(32).toString('hex'),
      member = principal !== 'owner',
      table = member ? 'member_sessions' : 'sessions',
      ttl = (remember ? 30 * 86400 : 43200) * 1000;
    db.prepare('DELETE FROM ' + table + ' WHERE expires<=?').run(now());
    if (member)
      db.prepare('INSERT INTO member_sessions VALUES(?,?,?)').run(
        hash(token),
        principal,
        now() + ttl,
      );
    else db.prepare('INSERT INTO sessions VALUES(?,?)').run(hash(token), now() + ttl);
    db.prepare('INSERT INTO session_policies VALUES(?,?,?,?)').run(
      hash(token),
      ttl,
      now() + (remember ? 90 : 7) * 86400000,
      now() + 15 * 60000,
    );
    res.setHeader('Set-Cookie', [cookie(token, member, ttl / 1000), cookie('', !member, 0)]);
  }
  return { find, create };
}
