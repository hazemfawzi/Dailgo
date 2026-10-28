import { randomUUID } from 'node:crypto';
import { resource, stateKeys } from '../resources.mjs';
import {
  validateData,
  auditWorkspace,
  validateGoalDateChanges,
  diffWorkspace,
  applyWorkspaceDelta,
} from '../domain.mjs';
export function createWorkspaceRoutes(context) {
  const { db, identities, collaboration, read, send } = context;
  return async function workspaceRoutes(req, res, url, principal) {
    if (url.pathname === '/api/workspace' && req.method === 'GET') {
      const value = identities.workspace(principal);
      return send(res, 200, {
        revision: value.revision,
        data: value.revision === 'empty' ? null : value.data,
      });
    }
    const recordRoute = url.pathname.match(/^\/api\/records\/([a-z]+)(?:\/([^/]+))?$/);
    const stateRoute = url.pathname.match(/^\/api\/state\/([a-z]+)$/);
    if (
      recordRoute ||
      stateRoute ||
      url.pathname === '/api/workspace/commit' ||
      url.pathname === '/api/workspace/changes'
    ) {
      const current = () => identities.workspace(principal);
      if (req.method === 'GET') {
        const store = current();
        if (recordRoute) {
          const collection = resource(recordRoute[1], store.data);
          if (!collection) return send(res, 404, { error: 'not-found' });
          const id = recordRoute[2] ? decodeURIComponent(recordRoute[2]) : null;
          const item = id ? collection.items.find((x) => x.id === id) : null;
          if (id && !item) return send(res, 404, { error: 'record-not-found' });
          return send(res, 200, {
            revision: store.revision,
            ...(id ? { item } : { items: collection.items }),
          });
        }
        if (stateRoute && Object.hasOwn(stateKeys, stateRoute[1]))
          return send(res, 200, {
            revision: store.revision,
            value: store.data[stateKeys[stateRoute[1]]] ?? null,
          });
        return send(res, 404, { error: 'not-found' });
      }
      const allowed = recordRoute ? ['POST', 'PATCH', 'DELETE'] : ['PUT'];
      if (!allowed.includes(req.method)) return send(res, 405, { error: 'method-not-allowed' });
      const body = await read(req);
      if (typeof body.revision !== 'string') throw Error('invalid-revision');
      db.exec('BEGIN IMMEDIATE');
      try {
        const store = current();
        if (body.revision !== store.revision) {
          db.exec('ROLLBACK');
          return send(res, 409, { error: 'workspace-changed' });
        }
        let data;
        if (recordRoute) {
          const collection = resource(recordRoute[1], store.data);
          if (!collection) {
            db.exec('ROLLBACK');
            return send(res, 404, { error: 'not-found' });
          }
          const id = recordRoute[2] ? decodeURIComponent(recordRoute[2]) : null;
          if ((req.method === 'POST' && id) || (req.method !== 'POST' && !id))
            throw Error('invalid-record-route');
          data = collection.change(req.method, id, body.item);
        } else if (stateRoute) {
          const key = Object.hasOwn(stateKeys, stateRoute[1]) ? stateKeys[stateRoute[1]] : null;
          if (!key) {
            db.exec('ROLLBACK');
            return send(res, 404, { error: 'not-found' });
          }
          data = { ...store.data, [key]: body.value };
        } else
          data =
            url.pathname === '/api/workspace/changes'
              ? applyWorkspaceDelta(store.data, body.changes)
              : body.data;
        validateData(data);
        validateGoalDateChanges(store.data, data);
        data = auditWorkspace(store.data, data);
        validateData(data);
        const revision = randomUUID();
        identities.save(principal, revision, data);
        db.exec('COMMIT');
        return send(
          res,
          200,
          url.pathname === '/api/workspace/changes'
            ? { version: 3, revision, changes: diffWorkspace(store.data, data) }
            : { version: 3, revision, data },
        );
      } catch (error) {
        db.exec('ROLLBACK');
        if (error.message === 'edit-conflict') return send(res, 409, { error: 'record-changed' });
        if (error.message === 'record-not-found')
          return send(res, 404, { error: 'record-not-found' });
        throw error;
      }
    }
    if (url.pathname === '/api/workspace' && req.method === 'PUT') {
      const body = await read(req);
      validateData(body.data);
      if (typeof body.revision !== 'string') throw Error('invalid-revision');
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = identities.workspace(principal);
        if ((current?.revision ?? 'empty') !== body.revision) {
          db.exec('ROLLBACK');
          return send(res, 409, { error: 'workspace-changed' });
        }
        const revision = randomUUID();
        identities.save(principal, revision, body.data);
        collaboration.forgetMissing(principal, body.data);
        db.prepare(
          "UPDATE assistant_requests SET result=NULL WHERE principal=? AND status='done'",
        ).run(principal);
        db.exec('COMMIT');
        return send(res, 200, { revision });
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }

    send(res, 404, { error: 'not-found' });
  };
}
