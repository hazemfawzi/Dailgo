import { DateTimeInput } from '../../components/DateTimeInput';
import { formatCalendarDate, formatNumber } from '../../i18n/format';
import { GoalDateReview } from './GoalDateReview';
import { closeGoal } from './goalModel';
import { transactData } from '../../lib/storage';
import { milestoneDateIssue } from './goalDates';
import { saveEntryDraft } from '../../lib/entryPersistence';
import { History } from '../../components/History';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Flag,
  CalendarDays,
  CheckCheck,
  ArrowRight,
  Layers,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { TaskBoard } from '../tasks/TaskBoard';
import type { Task } from '../tasks/model';
import { goalStats, replaceGoalTasks } from './goalModel';
import { areaLabel, areas } from '../../lib/workspace';
import type { Entry, EntrySetter, Translate, Area, Milestone } from '../../lib/workspace';
type Props = {
  t: Translate;
  entries: Entry[];
  setEntries: EntrySetter;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  edit: (task?: Task) => void;
  setRemove: Dispatch<SetStateAction<Task | null>>;
};
export function GoalScreen({ t, entries, setEntries, tasks, setTasks, edit, setRemove }: Props) {
  const { goalId } = useParams();
  const goal = entries.find((e) => e.id === goalId && e.kind === 'goal');
  const [phase, setPhase] = useState<Milestone | null>(null);
  const [removing, setRemoving] = useState<Milestone | null>(null);
  const [draft, setDraft] = useState<Entry | null>(null);
  const [status, setStatus] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [milestoneSaving, setMilestoneSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closedNotice, setClosedNotice] = useState('');
  useEffect(() => {
    setPhase(null);
    setRemoving(null);
    setDraft(null);
    setStatus('');
  }, [goalId]);
  if (!goal)
    return (
      <section className="card scope-page">
        <Target size={30} />
        <h1 dir="auto">{t('ui.thisGoalIsnTHere.290e23')}</h1>
        <p dir="auto">{t('ui.itMayHaveBeenRemovedYourTasks.f25ea3')}</p>
        <Button asChild>
          <Link to="/life">{t('ui.backToMyLife.f7157d')}</Link>
        </Button>
      </section>
    );
  const stats = goalStats(tasks, goal.id);
  const phases = goal.milestones ?? [];
  const scopedTasks = tasks.filter((task) => task.goalId === goal.id);
  const setGoalTasks: Dispatch<SetStateAction<Task[]>> = (change) =>
    setTasks((old) =>
      replaceGoalTasks(
        old,
        goal.id,
        typeof change === 'function' ? change(old.filter((x) => x.goalId === goal.id)) : change,
      ),
    );
  function addTask() {
    edit({
      id: crypto.randomUUID(),
      title: '',
      category: goal!.area,
      done: false,
      archived: false,
      goalId: goal!.id,
      milestoneId: status && status !== 'unassigned' ? status : undefined,
    });
  }
  return (
    <div className="goal-page">
      <Link className="goal-back" to="/life">
        <ArrowRight size={14} />
        {t('ui.myLife.907c1a')}
      </Link>
      <div className="goal-page-header">
        <span className="goal-page-icon">
          <Target size={27} />
        </span>
        <div>
          <div className="eyebrow">
            {areaLabel(goal.area, t)} ·{' '}
            {goal.archived ? t('ui.archivedGoal.c32d5b') : t('ui.yourNextChapter.8f8f18')}
          </div>
          <h1 dir="auto">{goal.title}</h1>
        </div>
        <Button variant="outline" onClick={() => setDraft({ ...goal })}>
          <Pencil size={15} />
          {t('ui.editGoal.530683')}
        </Button>
      </div>
      <section className="goal-summary card">
        <div className="goal-progress-main">
          <div>
            <strong dir="auto">{formatNumber(stats.progress, t('en', 'ar'))}%</strong>
            <span>{t('ui.fromCompletedTasks.4c83ee')}</span>
          </div>
          <progress
            value={formatNumber(stats.progress, t('en', 'ar'))}
            max={100}
            aria-label={t('ui.automaticGoalProgress.e8528f')}
          />
          <p dir="auto">{t('ui.eachNonArchivedTaskHasEqualWeight.270168')}</p>
        </div>
        <div className="goal-summary-number">
          <CheckCheck size={20} />
          <strong dir="auto">
            {formatNumber(stats.done, t('en', 'ar'))}/{formatNumber(stats.total, t('en', 'ar'))}
          </strong>
          <span>{t('ui.tasksCompleted.401b59')}</span>
        </div>
        <div className="goal-summary-number">
          <Layers size={20} />
          <strong dir="auto">{formatNumber(phases.length, t('en', 'ar'))}</strong>
          <span>{t('ui.milestones.6a1e1a')}</span>
        </div>
        <div className="goal-summary-number">
          <CalendarDays size={20} />
          <strong dir="auto" className="goal-date">
            {goal.date ? formatCalendarDate(goal.date, t('en', 'ar')) : t('ui.flexible.1ea0e9')}
          </strong>
          <span>{t('ui.targetDate.ff8c28')}</span>
        </div>
      </section>
      <div className="goal-detail-columns">
        <section className="card goal-description">
          <h3 dir="auto">{t('ui.whyThisMatters.87b77f')}</h3>
          <p dir="auto">{goal.detail || t('ui.addYourReasonYourDefinitionOfSuccess.6a8ade')}</p>
          <Button variant="ghost" onClick={() => setDraft({ ...goal })}>
            <Pencil size={14} />
            {t('ui.editNotes.99ce68')}
          </Button>
        </section>
        <section className="card milestone-panel">
          <div className="home-section-title">
            <h3 dir="auto">
              <Flag size={16} />
              {t('ui.oneMilestoneAtATime.773c44')}
            </h3>
            <Button
              variant="ghost"
              onClick={() => setPhase({ id: crypto.randomUUID(), title: '', date: '' })}
            >
              <Plus size={15} />
              {t('ui.addMilestone.ddf297')}
            </Button>
          </div>
          {phases.map((m) => {
            const progress = goalStats(tasks, goal.id, m.id);
            return (
              <div className="milestone-row" key={m.id}>
                <div>
                  <h4 dir="auto">{m.title}</h4>
                  {goal.date && m.date > goal.date && (
                    <p dir="auto" className="capture-hint">
                      {t('ui.milestoneIsAfterTheGoalTargetReview.034383')}
                    </p>
                  )}
                  <span>
                    {formatNumber(progress.done, t('en', 'ar'))}/
                    {formatNumber(progress.total, t('en', 'ar'))} {t('ui.tasks.1c126f')}
                    {m.date && ` · ${formatCalendarDate(m.date, t('en', 'ar'))}`}
                  </span>
                  <progress
                    value={progress.progress}
                    max={100}
                    aria-label={`${t('ui.milestoneProgress.a874ae')}: ${m.title}`}
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${t('ui.editMilestone.ad7dbb')}: ${m.title}`}
                  onClick={() => setPhase({ ...m })}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${t('ui.deleteMilestone.5ebb75')}: ${m.title}`}
                  onClick={() => setRemoving(m)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            );
          })}
          {!phases.length && (
            <p dir="auto" className="milestone-empty">
              {t('ui.breakTheGoalIntoAFewMeaningful.23c068')}
            </p>
          )}
        </section>
      </div>
      <section className="goal-execution-banner">
        <Target size={21} />
        <div>
          <h3 dir="auto">{t('ui.fromAnAmbitionToTheNextAction.577c88')}</h3>
          <p dir="auto">{t('ui.addATaskHereOrLinkAn.4fbd60')}</p>
        </div>
        <Button onClick={addTask}>
          <Plus size={15} />
          {t('ui.addLinkedTask.8a99bc')}
        </Button>
      </section>
      <section className="card outcome-evidence">
        <h3 dir="auto">{t('ui.outcomeBeyondTaskCompletion.42214e')}</h3>
        <p dir="auto">
          {goal.successCriteria || t('ui.addAMeasurableSuccessCriterionInEdit.182782')}
        </p>
        <strong dir="auto">
          {goal.outcomeAchieved
            ? t('ui.outcomeAchievedSelfAssessed.5d77c1')
            : t('ui.outcomeNotConfirmedYet.1925ab')}
        </strong>
        {stats.progress === 100 && !goal.outcomeAchieved && (
          <p dir="auto" className="muted">
            {t('ui.allLinkedTasksAreCompleteReviewYour.3b2134')}
          </p>
        )}
        <Button variant="outline" onClick={() => setDraft({ ...goal })}>
          {t('ui.reviewGoalOutcome.afd023')}
        </Button>
        {stats.progress === 100 && !goal.archived && (
          <>
            <p dir="auto">{t('ui.didYouAchieveTheOutcomeConfirmAnd.3df47d')}</p>
            <Button
              disabled={closing}
              onClick={async () => {
                setClosing(true);
                const ok = await transactData((data) => closeGoal(data, goal.id, goal.revision));
                setClosing(false);
                setClosedNotice(
                  ok
                    ? t('ui.goalOutcomeConfirmedAndGoalClosed.ca0c4b')
                    : t('ui.couldNotCloseTheGoalReviewThe.71ff20'),
                );
              }}
            >
              {t('ui.confirmOutcomeAndCloseGoal.7119a8')}
            </Button>
          </>
        )}
        {closedNotice && (
          <p dir="auto" role="status">
            {closedNotice}
          </p>
        )}
      </section>
      <div className="goal-task-filter">
        <label>
          {t('ui.milestoneFilter.771f01')}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('ui.allMilestones.65450c')}</option>
            <option value="unassigned">{t('ui.noMilestone.f8706d')}</option>
            {phases.map((m) => (
              <option value={m.id} key={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TaskBoard
        {...{ t, edit: (task?: Task) => (task ? edit(task) : addTask()), setRemove }}
        tasks={scopedTasks.filter(
          (task) =>
            !status || (status === 'unassigned' ? !task.milestoneId : task.milestoneId === status),
        )}
        setTasks={(change) =>
          setGoalTasks((old) => {
            const matches = (task: Task) =>
              !status ||
              (status === 'unassigned' ? !task.milestoneId : task.milestoneId === status);
            const visible = old.filter(matches);
            const next = typeof change === 'function' ? change(visible) : change;
            return [...old.filter((task) => !matches(task)), ...next];
          })
        }
      />
      <Dialog
        open={!!phase}
        onOpenChange={() => setPhase(null)}
        title={t('ui.shapeThisMilestone.934693')}
        description={t('ui.progressComesFromTasksAssignedToThis.fe9748')}
      >
        {phase && (
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!phase.title.trim() || milestoneSaving) return;
              const saved = { ...phase, title: phase.title.trim() };
              const next = {
                ...goal,
                milestones: phases.some((m) => m.id === phase.id)
                  ? phases.map((m) => (m.id === phase.id ? saved : m))
                  : [...phases, saved],
              };
              if (milestoneDateIssue(next)) return;
              setMilestoneSaving(true);
              const ok = await saveEntryDraft(next);
              setMilestoneSaving(false);
              setSaveError(!ok);
              if (ok) setPhase(null);
            }}
          >
            <label>
              {t('ui.milestoneTitle.b244a4')}
              <input
                dir="auto"
                autoFocus
                required
                maxLength={160}
                value={phase.title}
                onChange={(e) => setPhase({ ...phase, title: e.target.value })}
              />
            </label>
            <label>
              {t('ui.targetDateOptional.0eb380')}
              <DateTimeInput
                type="date"
                value={phase.date}
                onChange={(e) =>
                  setPhase({ ...phase, date: e.target.value, targetDateAcknowledgement: undefined })
                }
                aria-label={t('ui.targetDateOptional.0eb380')}
              />
            </label>
            {phase.date && goal.date && phase.date > goal.date && (
              <>
                <p dir="auto" role="alert">
                  {t('ui.thisMilestoneIsAfterTheGoalTarget.6d3fd1')}
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={phase.targetDateAcknowledgement === `${goal.date}/${phase.date}`}
                    onChange={(e) =>
                      setPhase({
                        ...phase,
                        targetDateAcknowledgement: e.target.checked
                          ? `${goal.date}/${phase.date}`
                          : undefined,
                      })
                    }
                  />
                  {t('ui.keepThisMilestoneAfterTheGoalTarget.be3aea')}
                </label>
              </>
            )}
            {saveError && (
              <p dir="auto" role="alert">
                {t('ui.couldNotSaveTheMilestoneReviewThe.32d3b7')}
              </p>
            )}
            <div className="dialog-actions">
              <Button type="button" variant="outline" onClick={() => setPhase(null)}>
                {t('ui.cancel.428808')}
              </Button>
              <Button
                disabled={
                  milestoneSaving ||
                  !phase.title.trim() ||
                  !!milestoneDateIssue({ date: goal.date, milestones: [phase] })
                }
              >
                {t('ui.saveMilestone.e818a2')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
      <Dialog
        open={!!removing}
        onOpenChange={() => setRemoving(null)}
        title={t('ui.removeThisMilestone.7b6ffc')}
        description={t('ui.tasksAreKeptUnderThisGoalWithout.1030c0')}
      >
        <p dir="auto">{removing?.title}</p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setRemoving(null)}>
            {t('ui.cancel.428808')}
          </Button>
          <Button
            onClick={() => {
              setEntries((old) =>
                old.map((x) =>
                  x.id === goal.id
                    ? { ...x, milestones: phases.filter((m) => m.id !== removing?.id) }
                    : x,
                ),
              );
              setTasks((old) =>
                old.map((x) =>
                  x.goalId === goal.id && x.milestoneId === removing?.id
                    ? { ...x, milestoneId: undefined }
                    : x,
                ),
              );
              setStatus('');
              setRemoving(null);
            }}
          >
            {t('ui.removeMilestone.4eb062')}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={!!draft}
        onOpenChange={() => setDraft(null)}
        title={t('ui.giveYourGoalAClearDirection.25c863')}
        description={t('ui.progressIsCalculatedAutomaticallyFromLinkedTasks.0990ab')}
      >
        {draft && (
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!draft.title.trim()) return;
              const ok = await saveEntryDraft(draft);
              setSaveError(!ok);
              if (ok) setDraft(null);
            }}
          >
            <label>
              {t('ui.goalTitle.4e7615')}
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
              {t('ui.notesAndSuccessCriteria.d647c0')}
              <textarea
                dir="auto"
                rows={6}
                maxLength={3000}
                value={draft.detail}
                onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
              />
            </label>
            <label>
              {t('ui.lifeArea.d4e236')}
              <select
                value={draft.area}
                onChange={(e) => setDraft({ ...draft, area: e.target.value as Area })}
              >
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {areaLabel(a, t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('ui.successCriteria.1c57ee')}
              <textarea
                dir="auto"
                rows={3}
                maxLength={2000}
                value={draft.successCriteria ?? ''}
                onChange={(e) => setDraft({ ...draft, successCriteria: e.target.value })}
              />
            </label>
            <label className="pin-option">
              <input
                type="checkbox"
                checked={!!draft.outcomeAchieved}
                onChange={(e) => setDraft({ ...draft, outcomeAchieved: e.target.checked })}
              />
              {t('ui.outcomeAchievedMyAssessment.96f290')}
            </label>
            <History item={goal} t={t} />
            {saveError && (
              <p dir="auto" role="alert">
                {t('ui.saveFailedOrGoalChangedElsewhereCopy.ffc2f7')}
              </p>
            )}
            <label>
              {t('ui.targetDateOptional.0eb380')}
              <DateTimeInput
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                aria-label={t('ui.targetDateOptional.0eb380')}
              />
            </label>
            <GoalDateReview goal={draft} onChange={setDraft} t={t} />
            <div className="dialog-actions">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                {t('ui.cancel.428808')}
              </Button>
              <Button disabled={!draft.title.trim() || !!milestoneDateIssue(draft)}>
                {t('ui.saveGoal.465173')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
