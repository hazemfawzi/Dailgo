// Per-record storage. Legacy snapshots remain a rollback projection until an
// administrator explicitly enables records-only mode after a backup.
const specs = {
  'personal-os.tasks.v1': 'workspace_tasks',
  'personal-os.conversations.v1': 'workspace_conversations',
  'personal-os.sessions.v1': 'workspace_focus_sessions',
  'personal-os.trash.v1': 'workspace_trash',
};
const tables = [...Object.values(specs), 'workspace_entries', 'workspace_goals'];
export function recordStore(db, { recordsOnly = false } = {}) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS workspace_legacy_marks(principal TEXT PRIMARY KEY,revision TEXT NOT NULL);CREATE TABLE IF NOT EXISTS workspace_meta(principal TEXT PRIMARY KEY,revision TEXT NOT NULL,keys TEXT NOT NULL,entry_shape TEXT);CREATE TABLE IF NOT EXISTS workspace_values(principal TEXT NOT NULL,key TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(principal,key));',
  );
  for (const table of tables)
    db.exec(
      `CREATE TABLE IF NOT EXISTS ${table}(principal TEXT NOT NULL,id TEXT NOT NULL,position INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(principal,id));`,
    );
  db.exec(
    "CREATE INDEX IF NOT EXISTS workspace_tasks_due ON workspace_tasks(principal,json_extract(payload,'$.dueDate'));CREATE INDEX IF NOT EXISTS workspace_tasks_planned ON workspace_tasks(principal,json_extract(payload,'$.plannedDate'));CREATE INDEX IF NOT EXISTS workspace_entries_kind ON workspace_entries(principal,json_extract(payload,'$.kind'));",
  );
  function read(principal) {
    const meta = db.prepare('SELECT * FROM workspace_meta WHERE principal=?').get(principal);
    if (!meta) return null;
    const data = {};
    const values = new Map(
      db
        .prepare('SELECT key,payload FROM workspace_values WHERE principal=?')
        .all(principal)
        .map((row) => [row.key, JSON.parse(row.payload)]),
    );
    for (const key of JSON.parse(meta.keys)) {
      if (key === 'personal-os.entries.v1') {
        const rows = db
          .prepare(
            'SELECT position,payload FROM workspace_entries WHERE principal=? UNION ALL SELECT position,payload FROM workspace_goals WHERE principal=? ORDER BY position',
          )
          .all(principal, principal)
          .map((row) => JSON.parse(row.payload));
        const shape = JSON.parse(meta.entry_shape ?? 'null');
        data[key] = shape ? { ...shape, entries: rows } : rows;
      } else if (specs[key])
        data[key] = db
          .prepare('SELECT payload FROM ' + specs[key] + ' WHERE principal=? ORDER BY position')
          .all(principal)
          .map((row) => JSON.parse(row.payload));
      else data[key] = values.get(key);
    }
    return { version: 3, revision: meta.revision, data };
  }
  function saveRows(table, principal, rows) {
    const old = new Map(
      db
        .prepare('SELECT id,position,payload FROM ' + table + ' WHERE principal=?')
        .all(principal)
        .map((row) => [row.id, row]),
    );
    rows.forEach(({ item, position }) => {
      const payload = JSON.stringify(item);
      const row = old.get(item.id);
      if (row?.payload !== payload || row?.position !== position)
        db.prepare(
          'INSERT INTO ' +
            table +
            ' VALUES(?,?,?,?) ON CONFLICT(principal,id) DO UPDATE SET position=excluded.position,payload=excluded.payload',
        ).run(principal, item.id, position, payload);
      old.delete(item.id);
    });
    for (const id of old.keys())
      db.prepare('DELETE FROM ' + table + ' WHERE principal=? AND id=?').run(principal, id);
  }
  function save(principal, revision, data) {
    const own = !db.isTransaction;
    if (own) db.exec('BEGIN IMMEDIATE');
    try {
      for (const [key, table] of Object.entries(specs))
        saveRows(
          table,
          principal,
          (data[key] ?? []).map((item, position) => ({ item, position })),
        );
      const value = data['personal-os.entries.v1'],
        entries = Array.isArray(value) ? value : (value?.entries ?? []);
      const positioned = entries.map((item, position) => ({ item, position }));
      saveRows(
        'workspace_goals',
        principal,
        positioned.filter((row) => row.item.kind === 'goal'),
      );
      saveRows(
        'workspace_entries',
        principal,
        positioned.filter((row) => row.item.kind !== 'goal'),
      );
      const shape =
        value && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'entries'))
          : null;
      const existing = new Map(
        db
          .prepare('SELECT key,payload FROM workspace_values WHERE principal=?')
          .all(principal)
          .map((row) => [row.key, row.payload]),
      );
      for (const [key, item] of Object.entries(data))
        if (!specs[key] && key !== 'personal-os.entries.v1') {
          const payload = JSON.stringify(item);
          if (existing.get(key) !== payload)
            db.prepare(
              'INSERT INTO workspace_values VALUES(?,?,?) ON CONFLICT(principal,key) DO UPDATE SET payload=excluded.payload',
            ).run(principal, key, payload);
          existing.delete(key);
        }
      for (const key of existing.keys())
        db.prepare('DELETE FROM workspace_values WHERE principal=? AND key=?').run(principal, key);
      db.prepare(
        'INSERT INTO workspace_meta VALUES(?,?,?,?) ON CONFLICT(principal) DO UPDATE SET revision=excluded.revision,keys=excluded.keys,entry_shape=excluded.entry_shape',
      ).run(principal, revision, JSON.stringify(Object.keys(data)), JSON.stringify(shape));
      if (!recordsOnly) project(principal, revision, data);
      if (own) db.exec('COMMIT');
    } catch (error) {
      if (own) db.exec('ROLLBACK');
      throw error;
    }
  }
  function noteLegacy(principal, revision) {
    db.prepare(
      'INSERT INTO workspace_legacy_marks VALUES(?,?) ON CONFLICT(principal) DO UPDATE SET revision=excluded.revision',
    ).run(principal, revision);
  }
  function project(principal, revision, data) {
    if (principal.startsWith('family:'))
      db.prepare('UPDATE family_spaces SET revision=?,data=? WHERE id=?').run(
        revision,
        JSON.stringify(data),
        principal.slice(7),
      );
    else if (principal === 'owner')
      db.prepare(
        'INSERT INTO workspace VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data',
      ).run(revision, JSON.stringify(data));
    else
      db.prepare(
        'INSERT INTO member_workspaces VALUES(?,?,?) ON CONFLICT(principal) DO UPDATE SET revision=excluded.revision,data=excluded.data',
      ).run(principal, revision, JSON.stringify(data));
    noteLegacy(principal, revision);
  }
  function projectAll() {
    const own = !db.isTransaction;
    if (own) db.exec('BEGIN IMMEDIATE');
    try {
      for (const { principal } of db.prepare('SELECT principal FROM workspace_meta').all()) {
        const state = read(principal);
        project(principal, state.revision, state.data);
      }
      if (own) db.exec('COMMIT');
    } catch (error) {
      if (own) db.exec('ROLLBACK');
      throw error;
    }
  }
  return { read, save, projectAll, noteLegacy };
}
