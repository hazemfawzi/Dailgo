import { DateTimeInput } from '../../components/DateTimeInput';
import {
  formatNumber,
  formatCalendarDate as localizedDate,
  formatTime as localizedTime,
} from '../../i18n/format';
import { storageText } from '../../i18n/messages';
import { RepeatCopies } from '../planner/RepeatCopies';
import { History } from '../../components/History';
import { taskStates, statusOf, statusLabel } from './model';
import { CaptureOrigin } from '../capture/CaptureOrigin';
import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { areas, areaLabel, localDate } from '../../lib/workspace';
import type { Translate, Entry } from '../../lib/workspace';
import type { Task } from './model';
export function TaskEditor({
  task,
  onSave,
  onClose,
  t,
  goals = [],
  memories = [],
  projects = [],
}: {
  projects?: Entry[];
  memories?: Entry[];
  goals?: Entry[];
  task: Task;
  onSave: (task: Task) => void | boolean | Promise<boolean | void>;
  onClose: () => void;
  t: Translate;
}) {
  const [draft, setDraft] = useState<Task>({
    ...task,
    description: task.description ?? '',
    priority: task.priority ?? 'medium',
    dueDate: task.dueDate ?? '',
    estimate: task.estimate ?? 0,
    subtasks: task.subtasks ?? [],
    tags: task.tags ?? [],
  });
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subtask, setSubtask] = useState('');
  const [tags, setTags] = useState((task.tags ?? []).join(', '));
  function addSubtask() {
    if (!subtask.trim()) return;
    setDraft({
      ...draft,
      subtasks: [
        ...(draft.subtasks ?? []),
        { id: crypto.randomUUID(), title: subtask.trim(), done: false },
      ],
    });
    setSubtask('');
  }
  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={task.title ? t('ui.taskDetails.7ddfad') : t('ui.makeTheNextStepClear.5c5bd1')}
      description={storageText(t, 'taskEditor')}
    >
      <form
        className="editor-form task-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.title.trim() || saving) return;
          if (
            draft.recurrence &&
            ((!draft.plannedDate && !draft.dueDate) ||
              !Number.isInteger(draft.recurrence.interval) ||
              draft.recurrence.interval < 1 ||
              draft.recurrence.interval > 365)
          ) {
            setSaveError(true);
            return;
          }
          setSaving(true);
          const ok = await onSave({
            ...draft,
            title: draft.title.trim(),
            tags: tags
              .split(/[,،]/)
              .map((x) => x.trim())
              .filter(Boolean)
              .slice(0, 10),
          });
          setSaving(false);
          setSaveError(ok === false);
        }}
      >
        <label>
          {t('ui.taskTitle.f8f17b')}
          <input
            dir="auto"
            autoFocus
            required
            maxLength={160}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          {t('ui.dueDate.3146bb')}
          <DateTimeInput
            type="date"
            value={draft.dueDate}
            onInput={(e) => {
              const value = e.currentTarget.value;
              setDraft((old) => ({ ...old, dueDate: value }));
            }}
            onChange={(e) => {
              const dueDate = e.target.value;
              setDraft((old) => ({ ...old, dueDate }));
            }}
            aria-label={t('ui.dueDate.3146bb')}
          />
        </label>
        <div className="quick-dates">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft({ ...draft, dueDate: localDate() })}
          >
            {t('ui.today.7981a9')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() + 1);
              setDraft({ ...draft, dueDate: localDate(date) });
            }}
          >
            {t('ui.tomorrow.af67ab')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDraft({ ...draft, dueDate: '' })}>
            {t('ui.noDueDate.95170e')}
          </Button>
        </div>
        <label>
          {t('ui.plannedExecutionDay.40e5a8')}
          <DateTimeInput
            type="date"
            value={draft.plannedDate ?? ''}
            onInput={(e) => {
              const value = e.currentTarget.value;
              setDraft((old) => ({
                ...old,
                plannedDate: value || undefined,
                plannedTime: value ? old.plannedTime : undefined,
              }));
            }}
            onChange={(e) => {
              const value = e.target.value;
              setDraft((old) => ({
                ...old,
                plannedDate: value || undefined,
                plannedTime: value ? old.plannedTime : undefined,
              }));
            }}
            aria-label={t('ui.plannedExecutionDay.40e5a8')}
          />
          <small className="muted">{t('ui.separateFromTheDueDateUsedIn.f900d5')}</small>
        </label>
        <label>
          {t('ui.executionTimeOptional.a87ad6')}
          <DateTimeInput
            type="time"
            disabled={!draft.plannedDate}
            value={draft.plannedTime ?? ''}
            onChange={(e) => setDraft({ ...draft, plannedTime: e.target.value || undefined })}
            aria-label={t('ui.executionTimeOptional.a87ad6')}
          />
          <small className="muted">{t('ui.usedForPlanningAndForRemindersIf.b87beb')}</small>
        </label>
        <Button
          type="button"
          variant="ghost"
          disabled={!draft.plannedDate}
          onClick={() => setDraft({ ...draft, plannedDate: undefined, plannedTime: undefined })}
        >
          {t('ui.clearPlannedDay.a32e4e')}
        </Button>
        <label>
          {t('ui.lifeArea.d4e236')}
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          >
            {areas.map((a) => (
              <option key={a} value={a}>
                {areaLabel(a, t)}
              </option>
            ))}
          </select>
        </label>
        {draft.goalId && (
          <p dir="auto" className="muted">
            {t('ui.linkedGoal.2bb775')}:{' '}
            <bdi>{goals.find((goal) => goal.id === draft.goalId)?.title ?? draft.goalId}</bdi>
          </p>
        )}
        <label>
          {t('ui.repeat.3d5468')}
          <select
            aria-label={t('ui.repeat.3d5468')}
            value={draft.recurrence?.frequency ?? 'none'}
            onChange={(e) =>
              setDraft({
                ...draft,
                recurrence:
                  e.target.value === 'none'
                    ? undefined
                    : { frequency: e.target.value as 'daily' | 'weekly' | 'monthly', interval: 1 },
              })
            }
          >
            <option value="none">{t('ui.doesNotRepeat.905b48')}</option>
            <option value="daily">{t('ui.daily.6084d0')}</option>
            <option value="weekly">{t('ui.weekly.6a00fc')}</option>
            <option value="monthly">{t('ui.monthly.4c43ac')}</option>
          </select>
        </label>
        {draft.recurrence && (
          <>
            <p dir="auto" className="capture-hint">
              {t('ui.completingThisTaskCreatesTheNextOccurrence.02dc5b')}
            </p>
            <label>
              {t('ui.repeatInterval.03f93f')}
              <input
                type="number"
                min={1}
                max={365}
                value={draft.recurrence.interval}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    recurrence: { ...draft.recurrence!, interval: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label>
              {t('ui.repeatUntilOptional.1c08f9')}
              <DateTimeInput
                type="date"
                value={draft.recurrence.until ?? ''}
                onInput={(e) =>
                  setDraft({
                    ...draft,
                    recurrence: { ...draft.recurrence!, until: e.currentTarget.value || undefined },
                  })
                }
                aria-label={t('ui.repeatUntilOptional.1c08f9')}
              />
            </label>
          </>
        )}
        <details className="task-extra-details">
          <summary>{t('ui.moreDetails.813428')}</summary>
          <label>
            {t('ui.linkedGoal.2bb775')}
            <select
              value={draft.goalId ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  goalId: e.target.value || undefined,
                  projectId: undefined,
                  milestoneId: undefined,
                })
              }
            >
              <option value="">{t('ui.noLinkedGoal.3790c7')}</option>
              {draft.goalId && !goals.some((g) => g.id === draft.goalId) && (
                <option value={draft.goalId}>{t('ui.goalNoLongerAvailable.daff54')}</option>
              )}
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                  {g.archived ? t('ui.archived.96d166') : ''}
                </option>
              ))}
            </select>
          </label>
          {!!draft.goalId && (
            <label>
              {t('ui.milestone.6bd186')}
              <select
                value={draft.milestoneId ?? ''}
                onChange={(e) => setDraft({ ...draft, milestoneId: e.target.value || undefined })}
              >
                <option value="">{t('ui.noMilestone.f8706d')}</option>
                {goals
                  .find((g) => g.id === draft.goalId)
                  ?.milestones?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            {t('ui.projectOptional.ba0c0f')}
            <select
              value={draft.projectId ?? ''}
              onChange={(e) => {
                const project = projects.find((p) => p.id === e.target.value);
                setDraft({
                  ...draft,
                  projectId: project?.id,
                  goalId: project ? project.parentGoalId : draft.goalId,
                  milestoneId: undefined,
                  context: project?.context ?? draft.context,
                });
              }}
            >
              <option value="">{t('ui.noProject.c8c76a')}</option>
              {draft.projectId && !projects.some((p) => p.id === draft.projectId) && (
                <option value={draft.projectId}>{t('ui.projectNoLongerAvailable.7f22c1')}</option>
              )}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('ui.description.35a3fa')}
            <textarea
              dir="auto"
              rows={3}
              maxLength={3000}
              placeholder={t('ui.whatDoesDoneLookLike.d511f9')}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <div className="form-pair">
            <label>
              {t('ui.priority.2125f8')}
              <select
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: e.target.value as Task['priority'] })
                }
              >
                <option value="high">{t('ui.high.ae9b8c')}</option>
                <option value="medium">{t('ui.medium.c5f506')}</option>
                <option value="low">{t('ui.low.929517')}</option>
              </select>
            </label>
          </div>
          <div className="form-pair">
            <label>
              {t('ui.estimateMinutes.5958ee')}
              <input
                type="number"
                min={0}
                max={1440}
                value={draft.estimate || ''}
                onChange={(e) => setDraft({ ...draft, estimate: Number(e.target.value) })}
              />
            </label>
          </div>
          <label>
            {t('ui.tagsCommaSeparated.1ffb77')}
            <input
              dir="auto"
              maxLength={200}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('ui.projectDeepWork.ab1d0f')}
            />
          </label>
          <div className="subtasks-editor">
            <h3 dir="auto">
              {t('ui.breakItIntoSteps.cfdbb2')}
              <span className="count">
                {formatNumber(draft.subtasks?.filter((x) => x.done).length ?? 0, t('en', 'ar'))}/
                {formatNumber(draft.subtasks?.length ?? 0, t('en', 'ar'))}
              </span>
            </h3>
            {draft.subtasks?.map((sub) => (
              <div className="subtask-line" key={sub.id}>
                <button
                  type="button"
                  className={`checkbox ${sub.done ? 'checked' : ''}`}
                  aria-label={`${t('ui.completeStep.d6fbca')}: ${sub.title}`}
                  aria-pressed={sub.done}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      subtasks: draft.subtasks?.map((x) =>
                        x.id === sub.id ? { ...x, done: !x.done } : x,
                      ),
                    })
                  }
                >
                  {sub.done && <Check size={12} />}
                </button>
                <span className={sub.done ? 'done' : ''}>{sub.title}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`${t('ui.removeStep.caa804')}: ${sub.title}`}
                  onClick={() =>
                    setDraft({ ...draft, subtasks: draft.subtasks?.filter((x) => x.id !== sub.id) })
                  }
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
            <div className="subtask-add">
              <input
                dir="auto"
                aria-label={t('ui.newStep.da6bac')}
                maxLength={160}
                value={subtask}
                onChange={(e) => setSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder={t('ui.addASmallStep.4c7777')}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!subtask.trim()}
                onClick={addSubtask}
              >
                <Plus size={15} />
                {t('ui.add.552844')}
              </Button>
            </div>
          </div>
          <label className="pin-option">
            <input
              type="checkbox"
              checked={!!draft.pinned}
              onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
            />
            {t('ui.pinToMyDailyFocus.2907c8')}
          </label>
          <label>
            {t('ui.workOrProjectContextOptional.971064')}
            <input
              dir="auto"
              maxLength={300}
              value={draft.context ?? ''}
              onChange={(e) => setDraft({ ...draft, context: e.target.value })}
            />
          </label>
          <label>
            {t('ui.taskStatus.c394f5')}
            <select
              value={statusOf(draft)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  status: e.target.value as Task['status'],
                  done: e.target.value === 'done',
                })
              }
            >
              {taskStates.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s, t)}
                </option>
              ))}
            </select>
          </label>
          {['waiting', 'blocked', 'deferred', 'cancelled'].includes(statusOf(draft)) && (
            <>
              <label>
                {t('ui.reasonOptional.babe52')}
                <textarea
                  dir="auto"
                  rows={2}
                  maxLength={1000}
                  value={draft.reason ?? ''}
                  onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                />
              </label>
              <label>
                {t('ui.waitingForOptional.4e9a29')}
                <input
                  dir="auto"
                  maxLength={160}
                  value={draft.waitingFor ?? ''}
                  onChange={(e) => setDraft({ ...draft, waitingFor: e.target.value })}
                />
              </label>
              <label>
                {t('ui.reviewOnNoNotification.5d8959')}
                <DateTimeInput
                  type="date"
                  value={draft.reviewDate ?? ''}
                  onInput={(e) => {
                    const reviewDate = e.currentTarget.value;
                    setDraft((old) => ({ ...old, reviewDate }));
                  }}
                  onChange={(e) => {
                    const reviewDate = e.target.value;
                    setDraft((old) => ({ ...old, reviewDate }));
                  }}
                  aria-label={t('ui.reviewOnNoNotification.5d8959')}
                />
              </label>
            </>
          )}
          <label>
            {t('ui.relatedNoteOrDecision.7649a5')}
            <select
              value={draft.memoryId ?? ''}
              onChange={(e) => setDraft({ ...draft, memoryId: e.target.value || undefined })}
            >
              <option value="">{t('ui.none.4b278e')}</option>
              {draft.memoryId && !memories.some((m) => m.id === draft.memoryId) && (
                <option value={draft.memoryId}>{t('ui.sourceNoLongerAvailable.e6c4cd')}</option>
              )}
              {memories.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          {memories.find((m) => m.id === draft.memoryId) && (
            <p dir="auto" className="muted">
              {memories.find((m) => m.id === draft.memoryId)?.detail}
            </p>
          )}
          {draft.result && (
            <section className="result-summary">
              <h3 dir="auto">{t('ui.recordedResult.99c831')}</h3>
              <p dir="auto">{draft.result.note}</p>
              <small>{localizedDate(draft.result.date, t('en', 'ar'))}</small>
            </section>
          )}
          {task.title && <RepeatCopies id={task.id} revision={task.revision} kind="task" t={t} />}
          <CaptureOrigin source={draft.source} t={t} />
          <History item={task} t={t} />
        </details>
        {saveError && (
          <p dir="auto" role="alert">
            {t('ui.couldNotSaveOrAnotherEditorChanged.299dd2')}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('ui.cancel.428808')}
          </Button>
          <Button disabled={saving || !draft.title.trim()}>{t('ui.saveTask.72af9a')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
