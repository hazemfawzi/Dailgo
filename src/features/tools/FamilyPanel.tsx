import { diffWorkspace, applyWorkspaceDelta } from '../../lib/workspaceDelta';
import { DateTimeInput } from '../../components/DateTimeInput';
import { FamilyTransfer } from './FamilyTransfer';
import { useEffect, useRef, useState } from 'react';
import { apiRequest, ApiError } from '../../lib/serverStorage';
import type { Task } from '../tasks/model';
import type { Translate } from '../../lib/workspace';
import { Button } from '../../components/ui/button';
import { formatNumber } from '../../i18n/format';
type Space = {
  id: string;
  title: string;
  owner: string;
  role: string;
  revision: string;
  data: { 'personal-os.tasks.v1': Task[] };
  members: { principal: string; username: string; role: string }[];
};
export function FamilyPanel({ t }: { t: Translate }) {
  const generation = useRef(0);
  const [busy, updateBusy] = useState(false);
  const setBusy = (value: boolean) => {
    if (value) generation.current++;
    updateBusy(value);
  };
  const [undo, setUndo] = useState<{ space: Space; before: Task[]; expires: number } | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [notice, setNotice] = useState('');
  const [invitation, setInvitation] = useState<{ space: string; id: string; token: string } | null>(
    null,
  );
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), Math.max(0, undo.expires - Date.now()));
    return () => clearTimeout(timer);
  }, [undo]);
  async function load() {
    const observed = ++generation.current;
    try {
      const value = await apiRequest('family');
      if (observed === generation.current) {
        setSpaces(value.spaces);
        if (undo && !value.spaces.some((space: Space) => space.id === undo.space.id)) setUndo(null);
      }
    } catch {
      setNotice(t('ui.couldNotLoadSharedSpaces.431fcb'));
    }
  }
  useEffect(() => {
    if (busy) return;
    void load();
    const refresh = () => {
      if (!document.hidden && !busy) void load();
    };
    window.addEventListener('dailgo-family-changed', refresh);
    window.addEventListener('dailgo-family-refresh', refresh);
    return () => {
      window.removeEventListener('dailgo-family-changed', refresh);
      window.removeEventListener('dailgo-family-refresh', refresh);
    };
  }, [busy]);
  async function write(space: Space, tasks: Task[]) {
    setBusy(true);
    try {
      const result = await apiRequest('family/' + space.id, 'PUT', {
        revision: space.revision,
        changes: diffWorkspace(space.data, { 'personal-os.tasks.v1': tasks }),
      });
      const saved: Space = {
        ...result,
        data: applyWorkspaceDelta(space.data, result.changes) as Space['data'],
      };
      setSpaces((old) => old.map((x) => (x.id === space.id ? saved : x)));
      if (
        tasks.some((task) => {
          const old = space.data['personal-os.tasks.v1'].find((x) => x.id === task.id);
          return old && ((!old.done && task.done) || (!old.archived && task.archived));
        })
      )
        setUndo({
          space: saved,
          before: space.data['personal-os.tasks.v1'],
          expires: Date.now() + 20000,
        });
      return true;
    } catch (error) {
      setNotice(
        error instanceof ApiError && error.status === 409
          ? t('ui.someoneUpdatedThisSpaceTheLatestVersion.e19410')
          : t('ui.couldNotSaveTheSharedTask.1c74b1'),
      );
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card tools-section">
      <h2 dir="auto">{t('ui.familySpaces.f6943c')}</h2>
      <p dir="auto">{t('ui.onlyTasksYouAddHereAreShared.d45ea0')}</p>
      <form
        className="editor-form tools-inline"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = e.currentTarget;
          try {
            const space = await apiRequest('family', 'POST', {
              title: String(new FormData(form).get('title')),
            });
            setSpaces((old) => [...old, space]);
            form.reset();
          } catch {
            setNotice(t('ui.couldNotCreateTheFamilySpace.44748b'));
          }
          setBusy(false);
        }}
      >
        <label>
          {t('ui.familySpaceName.f2d464')}
          <input name="title" maxLength={100} required dir="auto" />
        </label>
        <Button disabled={busy}>{t('ui.createFamilySpace.f83cb4')}</Button>
      </form>
      {spaces.map((space) => (
        <section className="saving-goal" key={space.id}>
          <h3 dir="auto">{space.title}</h3>
          <p dir="auto">
            {formatNumber(space.members.length, t('en', 'ar'))} {t('ui.members.d4b737')}
          </p>
          <ul className="tools-records">
            {space.members.map((member) => (
              <li key={member.principal}>
                <span dir="auto">{member.username}</span>
                {member.role === 'owner'
                  ? t('ui.owner.3d1143')
                  : space.role === 'owner' && (
                      <Button
                        disabled={busy}
                        variant="ghost"
                        onClick={async () => {
                          if (!window.confirm(t('ui.removeThisMemberSAccess.6fad35'))) return;
                          try {
                            const next = await apiRequest(
                              `family/${space.id}/members/${member.principal}`,
                              'DELETE',
                              {},
                            );
                            setSpaces((old) => old.map((x) => (x.id === space.id ? next : x)));
                          } catch {
                            setNotice(t('ui.couldNotRemoveAccess.be21f5'));
                          }
                        }}
                      >
                        {t('ui.removeAccess.b9a790')}
                      </Button>
                    )}
              </li>
            ))}
          </ul>
          {space.role === 'owner' && (
            <Button
              disabled={busy}
              variant="outline"
              onClick={async () => {
                try {
                  const result = await apiRequest('family/' + space.id + '/invite', 'POST', {});
                  setInvitation({ space: space.id, ...result });
                } catch {
                  setNotice(t('ui.couldNotCreateTheInvitation.813a5c'));
                }
              }}
            >
              {t('ui.createOneUseInvitation.657e19')}
            </Button>
          )}
          {invitation?.space === space.id && (
            <aside>
              <p dir="auto">{t('ui.thisLinkGrantsAccessToThisFamily.a19321')}</p>
              <a
                className="tools-secret-link"
                href={location.origin + '/invite#' + invitation.token}
              >
                {location.origin + '/invite#' + invitation.token}
              </a>
              <Button
                variant="outline"
                onClick={() =>
                  void navigator.clipboard?.writeText(
                    location.origin + '/invite#' + invitation.token,
                  )
                }
              >
                {t('ui.copyInvitation.a2d24b')}
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await apiRequest(`family/${space.id}/invite/${invitation.id}`, 'DELETE', {});
                    setInvitation(null);
                  } catch {
                    setNotice(t('ui.couldNotRevokeTheInvitation.640c5c'));
                  }
                }}
              >
                {t('ui.revokeInvitation.70bf68')}
              </Button>
            </aside>
          )}
          <form
            className="editor-form tools-inline"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fields = new FormData(form);
              const task: Task = {
                id: crypto.randomUUID(),
                title: String(fields.get('title')).trim(),
                category: 'Family',
                done: false,
                archived: false,
                dueDate: String(fields.get('due')) || undefined,
                assigneeId: String(fields.get('assignee')) || undefined,
              };
              if (await write(space, [...space.data['personal-os.tasks.v1'], task])) form.reset();
            }}
          >
            <label>
              {t('ui.sharedTaskTitle.4cffb6')}
              <input name="title" maxLength={160} dir="auto" required />
            </label>
            <label>
              {t('ui.sharedTaskDueDate.4d081e')}
              <DateTimeInput name="due" type="date" aria-label={t('ui.sharedTaskDueDate.4d081e')} />
            </label>
            <label>
              {t('ui.assignedTo.c6e22a')}
              <select name="assignee">
                <option value="">{t('ui.anyone.107333')}</option>
                {space.members.map((member) => (
                  <option value={member.principal} key={member.principal}>
                    {member.username}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={busy}>{t('ui.addSharedTask.ca2999')}</Button>
          </form>
          <FamilyTransfer space={space} t={t} restore={(tasks) => write(space, tasks)} />
          <label>
            <input
              type="checkbox"
              checked={showArchive}
              onChange={(e) => setShowArchive(e.target.checked)}
            />
            {t('ui.showArchivedSharedTasks.8a0a89')}
          </label>
          <ul className="tools-records">
            {space.data['personal-os.tasks.v1']
              .filter((x) => (showArchive ? x.archived : !x.archived))
              .map((task) => (
                <li key={task.id}>
                  <button
                    className="task-completion-control"
                    disabled={busy}
                    aria-pressed={task.done}
                    aria-label={`${t('ui.completeSharedTask.dee46f')}: ${task.title}`}
                    onClick={() =>
                      void write(
                        space,
                        space.data['personal-os.tasks.v1'].map((x) =>
                          x.id === task.id
                            ? { ...x, done: !x.done, status: x.done ? 'todo' : 'done' }
                            : x,
                        ),
                      )
                    }
                  >
                    {task.done ? '●' : '○'}
                  </button>
                  <span dir="auto">{task.title}</span>
                  <small>
                    {space.members.find((x) => x.principal === task.assigneeId)?.username ??
                      t('ui.anyone.107333')}
                  </small>
                  <Button
                    disabled={busy}
                    variant="ghost"
                    onClick={() =>
                      void write(
                        space,
                        space.data['personal-os.tasks.v1'].map((x) =>
                          x.id === task.id ? { ...x, archived: !x.archived } : x,
                        ),
                      )
                    }
                  >
                    {task.archived
                      ? t('ui.restoreSharedTask.fedb0b')
                      : t('ui.archiveSharedTask.cf61f4')}
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {!spaces.length && <p dir="auto">{t('ui.createAFamilySpaceThenInviteSomeone.544008')}</p>}
      {undo && (
        <aside className="undo-notice" role="status">
          {t('ui.sharedChangeSaved20SecondsToUndo.e611a6')}
          <Button
            disabled={busy}
            variant="outline"
            onClick={async () => {
              if (Date.now() > undo.expires) {
                setUndo(null);
                return;
              }
              setBusy(true);
              try {
                const saved = await apiRequest('family/' + undo.space.id, 'PUT', {
                  revision: undo.space.revision,
                  data: {
                    'personal-os.tasks.v1': undo.before.map((item) => {
                      const current = undo.space.data['personal-os.tasks.v1'].find(
                        (x) => x.id === item.id,
                      );
                      return { ...item, revision: current?.revision, history: current?.history };
                    }),
                  },
                });
                setSpaces((old) => old.map((x) => (x.id === saved.id ? saved : x)));
              } catch {
                setNotice(t('ui.someoneChangedTheSharedTasksUndoWas.1f53df'));
                await load();
              }
              setUndo(null);
              setBusy(false);
            }}
          >
            {t('ui.undoSharedChange.2a184b')}
          </Button>
        </aside>
      )}
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
