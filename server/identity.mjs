import { recordStore } from './recordStore.mjs';
import { randomBytes, scryptSync, randomUUID } from 'node:crypto';
export function identityStore(db, options = {}) {
  const listeners = new Set();
  db.exec(
    'CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password TEXT NOT NULL,created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS member_sessions(token TEXT PRIMARY KEY,principal TEXT NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS member_workspaces(principal TEXT PRIMARY KEY,revision TEXT NOT NULL,data TEXT NOT NULL);',
  );
  const records = recordStore(db, options);
  function user(principal) {
    return principal === 'owner'
      ? db.prepare("SELECT *,'owner' AS principal FROM account WHERE id=1").get()
      : db.prepare('SELECT *,id AS principal FROM members WHERE id=?').get(principal);
  }
  function byUsername(username) {
    const owner = user('owner');
    return owner?.username === username
      ? owner
      : db.prepare('SELECT *,id AS principal FROM members WHERE username=?').get(username);
  }
  function create(username, password) {
    if (
      typeof username !== 'string' ||
      username.trim().length < 3 ||
      username.length > 80 ||
      typeof password !== 'string' ||
      password.length < 12 ||
      password.length > 200 ||
      byUsername(username.trim())
    )
      throw Error('invalid-credentials');
    const id = randomUUID(),
      salt = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO members VALUES(?,?,?,?,?)').run(
      id,
      username.trim(),
      salt,
      scryptSync(password, salt, 64).toString('hex'),
      Date.now(),
    );
    return id;
  }
  function workspace(principal) {
    const stored = records.read(principal);
    if (stored) {
      const legacy =
        principal === 'owner'
          ? db.prepare('SELECT revision FROM workspace WHERE id=1').get()
          : db.prepare('SELECT revision FROM member_workspaces WHERE principal=?').get(principal);
      const mark = db
        .prepare('SELECT revision FROM workspace_legacy_marks WHERE principal=?')
        .get(principal);
      if (!legacy || legacy.revision === mark?.revision) return stored;
    }
    const row =
      principal === 'owner'
        ? db.prepare('SELECT revision,data FROM workspace WHERE id=1').get()
        : db
            .prepare('SELECT revision,data FROM member_workspaces WHERE principal=?')
            .get(principal);
    if (row) {
      const data = JSON.parse(row.data);
      records.save(principal, row.revision, data);
      records.noteLegacy(principal, row.revision);
      return { version: 3, revision: row.revision, data };
    }
    return { version: 3, revision: 'empty', data: {} };
  }
  function save(principal, revision, data) {
    records.save(principal, revision, data);
    if (listeners.size)
      queueMicrotask(() => {
        if (db.isOpen && records.read(principal)?.revision === revision)
          for (const listener of listeners) listener(principal, revision);
      });
  }
  function notify(principals, event) {
    if (listeners.size)
      queueMicrotask(() => {
        if (db.isOpen)
          for (const principal of new Set(principals))
            for (const listener of listeners) listener(principal, event);
      });
  }
  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    user,
    byUsername,
    create,
    workspace,
    save,
    onChange,
    notify,
    projectLegacy: records.projectAll,
  };
}
