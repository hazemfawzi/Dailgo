import { recordStore } from './recordStore.mjs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { validateData, auditWorkspace, applyWorkspaceDelta, diffWorkspace } from './domain.mjs';
const hash = (token) => createHash('sha256').update(token).digest('hex');
const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
export function createCollaboration(db, identities, options = {}) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS family_spaces(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,revision TEXT NOT NULL,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS family_members(space TEXT NOT NULL,principal TEXT NOT NULL,role TEXT NOT NULL,PRIMARY KEY(space,principal)); CREATE TABLE IF NOT EXISTS family_invites(id TEXT PRIMARY KEY,space TEXT NOT NULL,token TEXT NOT NULL UNIQUE,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS goal_shares(id TEXT PRIMARY KEY,owner TEXT NOT NULL,goal TEXT NOT NULL,token TEXT NOT NULL UNIQUE,expires INTEGER NOT NULL,notes INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS goal_comments(id TEXT PRIMARY KEY,share TEXT NOT NULL,text TEXT NOT NULL,created INTEGER NOT NULL);',
  );
  const boards = recordStore(db, options);
  function currentSpace(row) {
    const principal = 'family:' + row.id;
    const stored = boards.read(principal);
    const mark = db
      .prepare('SELECT revision FROM workspace_legacy_marks WHERE principal=?')
      .get(principal);
    const legacy = db.prepare('SELECT revision,data FROM family_spaces WHERE id=?').get(row.id);
    if (stored && legacy.revision === mark?.revision)
      return { ...row, revision: stored.revision, data: JSON.stringify(stored.data) };
    const data = JSON.parse(legacy.data);
    boards.save(principal, legacy.revision, data);
    boards.noteLegacy(principal, legacy.revision);
    return { ...row, revision: legacy.revision, data: legacy.data };
  }
  function announce(id, revision, extra = []) {
    identities.notify(
      [
        ...db
          .prepare('SELECT principal FROM family_members WHERE space=?')
          .all(id)
          .map((row) => row.principal),
        ...extra,
      ],
      { familyId: id, revision },
    );
  }
  const requireMember = (principal, id) => {
    const space = db
      .prepare(
        'SELECT s.*,m.role FROM family_spaces s JOIN family_members m ON m.space=s.id WHERE s.id=? AND m.principal=?',
      )
      .get(id, principal);
    if (!space) fail('space-not-found', 404);
    return currentSpace(space);
  };
  const safeSpace = (row) => ({
    id: row.id,
    title: row.title,
    owner: row.owner,
    role: row.role,
    revision: row.revision,
    data: JSON.parse(row.data),
    members: db
      .prepare('SELECT principal,role FROM family_members WHERE space=?')
      .all(row.id)
      .map((x) => ({ ...x, username: identities.user(x.principal)?.username ?? 'Unavailable' })),
  });
  function list(principal) {
    return db
      .prepare(
        'SELECT s.*,m.role FROM family_spaces s JOIN family_members m ON m.space=s.id WHERE m.principal=?',
      )
      .all(principal)
      .map((row) => safeSpace(currentSpace(row)));
  }
  function create(principal, title) {
    if (typeof title !== 'string' || !title.trim() || title.length > 100)
      fail('invalid-space-name');
    if (list(principal).length >= 10) fail('space-limit');
    const id = randomUUID(),
      revision = randomUUID();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO family_spaces VALUES(?,?,?,?,?)').run(
        id,
        principal,
        title.trim(),
        revision,
        JSON.stringify({ 'personal-os.tasks.v1': [] }),
      );
      db.prepare('INSERT INTO family_members VALUES(?,?,?)').run(id, principal, 'owner');
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    announce(id, revision);
    return safeSpace(requireMember(principal, id));
  }
  function invite(principal, id) {
    const space = requireMember(principal, id);
    if (space.owner !== principal) fail('owner-required', 403);
    if (db.prepare('SELECT count(*) AS n FROM family_members WHERE space=?').get(id).n >= 20)
      fail('member-limit');
    const token = randomBytes(32).toString('base64url'),
      inviteId = randomUUID(),
      expires = Date.now() + 7 * 86400000;
    db.prepare('DELETE FROM family_invites WHERE space=? AND expires<?').run(id, Date.now());
    db.prepare('INSERT INTO family_invites VALUES(?,?,?,?,0)').run(
      inviteId,
      id,
      hash(token),
      expires,
    );
    return { id: inviteId, token, expires };
  }
  const findInvite = (token) => {
    if (typeof token !== 'string' || token.length !== 43) fail('invalid-invite', 404);
    const row = db
      .prepare('SELECT * FROM family_invites WHERE token=? AND used=0 AND expires>?')
      .get(hash(token), Date.now());
    if (!row) fail('invalid-invite', 404);
    return row;
  };
  function join(principal, token) {
    const row = findInvite(token);
    if (db.prepare('SELECT count(*) AS n FROM family_members WHERE space=?').get(row.space).n >= 20)
      fail('member-limit');
    db.prepare(
      'INSERT INTO family_members VALUES(?,?,?) ON CONFLICT(space,principal) DO NOTHING',
    ).run(row.space, principal, 'member');
    db.prepare('UPDATE family_invites SET used=1 WHERE id=?').run(row.id);
    announce(
      row.space,
      currentSpace(db.prepare('SELECT * FROM family_spaces WHERE id=?').get(row.space)).revision,
    );
    return safeSpace(requireMember(principal, row.space));
  }
  function accept(body) {
    findInvite(body.token);
    db.exec('BEGIN IMMEDIATE');
    try {
      const principal = identities.create(body.username, body.password);
      join(principal, body.token);
      identities.save(principal, randomUUID(), {
        'personal-os.language': 'ar',
        'personal-os.tasks.v1': [],
        'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: [] },
      });
      db.exec('COMMIT');
      return principal;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  function commit(principal, id, body) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const old = requireMember(principal, id);
      if (old.revision !== body.revision) fail('space-changed', 409);
      const incoming = body.changes
        ? applyWorkspaceDelta(JSON.parse(old.data), body.changes)
        : body.data;
      if (!incoming || Object.keys(incoming).some((key) => key !== 'personal-os.tasks.v1'))
        fail('invalid-shared-data');
      validateData(incoming);
      const tasks = incoming['personal-os.tasks.v1'];
      if (
        !Array.isArray(tasks) ||
        tasks.length > 2000 ||
        tasks.some(
          (task) =>
            task.category !== 'Family' ||
            task.goalId ||
            task.projectId ||
            task.memoryId ||
            task.source ||
            (task.assigneeId &&
              !db
                .prepare('SELECT 1 FROM family_members WHERE space=? AND principal=?')
                .get(id, task.assigneeId)),
        )
      )
        fail('invalid-family-task');
      const data = auditWorkspace(JSON.parse(old.data), incoming);
      delete data['personal-os.trash.v1'];
      validateData(data);
      const revision = randomUUID();
      boards.save('family:' + id, revision, data);
      announce(id, revision);
      db.exec('COMMIT');
      const saved = safeSpace(requireMember(principal, id));
      return body.changes
        ? { ...saved, data: undefined, changes: diffWorkspace(JSON.parse(old.data), saved.data) }
        : saved;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  function removeMember(principal, id, member) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const space = requireMember(principal, id);
      if (space.owner !== principal || member === space.owner) fail('owner-required', 403);
      const before = JSON.parse(space.data);
      const data = auditWorkspace(before, {
        ...before,
        'personal-os.tasks.v1': before['personal-os.tasks.v1'].map((task) =>
          task.assigneeId === member ? { ...task, assigneeId: undefined } : task,
        ),
      });
      db.prepare('DELETE FROM family_members WHERE space=? AND principal=?').run(id, member);
      const revision = randomUUID();
      boards.save('family:' + id, revision, data);
      announce(id, revision, [member]);
      db.exec('COMMIT');
      return safeSpace(requireMember(principal, id));
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  function share(principal, body) {
    const raw = identities.workspace(principal).data['personal-os.entries.v1'];
    const goal = (Array.isArray(raw) ? raw : (raw?.entries ?? [])).find(
      (x) => x.id === body.goalId && x.kind === 'goal' && !x.archived,
    );
    if (!goal) fail('goal-not-found', 404);
    if (
      db
        .prepare('SELECT count(*) AS n FROM goal_shares WHERE owner=? AND expires>?')
        .get(principal, Date.now()).n >= 100
    )
      fail('share-limit');
    const id = randomUUID(),
      token = randomBytes(32).toString('base64url'),
      expires = Date.now() + 7 * 86400000;
    db.prepare('INSERT INTO goal_shares VALUES(?,?,?,?,?,?)').run(
      id,
      principal,
      goal.id,
      hash(token),
      expires,
      body.includeNotes === true ? 1 : 0,
    );
    return { id, token, expires };
  }
  function shared(token) {
    if (typeof token !== 'string' || token.length !== 43) fail('share-not-found', 404);
    const row = db
      .prepare('SELECT * FROM goal_shares WHERE token=? AND expires>?')
      .get(hash(token), Date.now());
    if (!row) fail('share-not-found', 404);
    const data = identities.workspace(row.owner).data;
    const raw = data['personal-os.entries.v1'];
    const goal = (Array.isArray(raw) ? raw : (raw?.entries ?? [])).find(
      (x) => x.id === row.goal && x.kind === 'goal' && !x.archived,
    );
    if (!goal) fail('share-not-found', 404);
    const tasks = (data['personal-os.tasks.v1'] ?? []).filter(
      (x) => x.goalId === goal.id && !x.archived,
    );
    return {
      id: row.id,
      goal: {
        title: goal.title,
        area: goal.area,
        date: goal.date,
        detail: row.notes ? goal.detail : undefined,
        criteria: row.notes ? goal.successCriteria : undefined,
        milestones: goal.milestones?.map((m) => ({ title: m.title, date: m.date })),
        done: tasks.filter((x) => x.done).length,
        total: tasks.length,
      },
      expires: row.expires,
      comments: db
        .prepare(
          'SELECT id,text,created FROM goal_comments WHERE share=? ORDER BY created DESC LIMIT 50',
        )
        .all(row.id),
    };
  }
  function comment(token, text) {
    const result = shared(token);
    if (typeof text !== 'string' || !text.trim() || text.length > 1000) fail('invalid-comment');
    if (db.prepare('SELECT count(*) AS n FROM goal_comments WHERE share=?').get(result.id).n >= 200)
      fail('comment-limit', 429);
    if (
      db
        .prepare('SELECT count(*) AS n FROM goal_comments WHERE share=? AND created>?')
        .get(result.id, Date.now() - 3600000).n >= 20
    )
      fail('comment-limit', 429);
    db.prepare('INSERT INTO goal_comments VALUES(?,?,?,?)').run(
      randomUUID(),
      result.id,
      text.trim(),
      Date.now(),
    );
    return shared(token);
  }
  function review(principal, id) {
    const row = db.prepare('SELECT id FROM goal_shares WHERE owner=? AND id=?').get(principal, id);
    if (!row) fail('share-not-found', 404);
    return {
      comments: db
        .prepare(
          'SELECT id,text,created FROM goal_comments WHERE share=? ORDER BY created DESC LIMIT 200',
        )
        .all(id),
    };
  }
  function forgetMissing(principal, data) {
    const raw = data['personal-os.entries.v1'];
    const live = (Array.isArray(raw) ? raw : (raw?.entries ?? []))
      .filter((x) => x.kind === 'goal')
      .map((x) => x.id);
    const recoverable = (data['personal-os.trash.v1'] ?? [])
      .filter((row) => row.collection === 'personal-os.entries.v1' && row.item.kind === 'goal')
      .map((row) => row.item.id);
    const ids = new Set([...live, ...recoverable]);
    for (const row of db.prepare('SELECT id,goal FROM goal_shares WHERE owner=?').all(principal))
      if (!ids.has(row.goal)) {
        db.prepare('DELETE FROM goal_comments WHERE share=?').run(row.id);
        db.prepare('DELETE FROM goal_shares WHERE owner=? AND id=?').run(principal, row.id);
      }
  }
  function shares(principal) {
    return db.prepare('SELECT id,goal,expires,notes FROM goal_shares WHERE owner=?').all(principal);
  }
  function revoke(principal, id) {
    const removed = db.prepare('DELETE FROM goal_shares WHERE owner=? AND id=?').run(principal, id);
    if (removed.changes) db.prepare('DELETE FROM goal_comments WHERE share=?').run(id);
  }
  function revokeInvite(principal, id, inviteId) {
    const space = requireMember(principal, id);
    if (space.owner !== principal) fail('owner-required', 403);
    db.prepare('DELETE FROM family_invites WHERE space=? AND id=?').run(id, inviteId);
  }
  return {
    list,
    create,
    invite,
    join,
    accept,
    commit,
    removeMember,
    share,
    shared,
    comment,
    review,
    shares,
    revoke,
    revokeInvite,
    forgetMissing,
  };
}
