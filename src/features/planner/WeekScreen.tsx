import { DateTimeInput } from '../../components/DateTimeInput';
import {
  formatCalendarDate as localizedDate,
  formatTime as localizedTime,
} from '../../i18n/format';
import { formatClockPart, formatNumber as localizedNumber } from '../../i18n/format';
import { formatCalendarDate } from '../../i18n/format';
import { WeeklyGuided } from '../journey/WeeklyGuided';
import { storageText } from '../../i18n/messages';
import { tasksOnDate } from './taskDates';
import { ResultSummary } from '../review/ResultSummary';
import { ConflictNotice } from './ConflictNotice';
import { usePlanning } from '../../lib/preferences';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  CalendarDays,
  ArrowUpRight,
  ArrowRight,
  Clock3,
  RotateCcw,
  Target,
  NotebookPen,
  X,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { usePersisted } from '../../lib/storage';
import { localDate } from '../../lib/workspace';
import type { Entry, Translate } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import { isActionable, priorityLabel, priorityOf } from '../tasks/model';
import {
  addDays,
  weekStart,
  weekDates,
  dayLoad,
  emptyWeek,
  rolloverCandidates,
  rolloverTasks,
} from './weekModel';
import type { WeekPlan } from './weekModel';
type Props = {
  t: Translate;
  ar: boolean;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  entries: Entry[];
  edit: (task?: Task) => void;
};
export function WeekScreen({ t, ar, tasks, setTasks, entries, edit }: Props) {
  const [settings] = usePlanning();
  const [params, setParams] = useSearchParams();
  const [plans, setPlans, error] = usePersisted<Record<string, WeekPlan>>(
    'personal-os.weeks.v1',
    {},
  );
  const requestedWeek = params.get('week');
  const savedWeek =
    requestedWeek && params.get('saved') === '1' && plans[requestedWeek] ? requestedWeek : null;
  const start = savedWeek ?? weekStart(requestedWeek || localDate(), settings.weekStartsOn);
  const days = weekDates(start);
  const plan = plans[start] ?? emptyWeek();
  const [pool, setPool] = useState('unplanned');
  const [query, setQuery] = useState('');
  const [goalFilter, setGoalFilter] = useState('all');
  const [roll, setRoll] = useState<'next' | 'previous' | null>(null);
  const [moveDates, setMoveDates] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const goals = entries.filter((x) => x.kind === 'goal');
  const scheduled = tasks.filter(
    (x) =>
      !x.archived && (x.done || isActionable(x)) && !!x.plannedDate && days.includes(x.plannedDate),
  );
  const completed = scheduled.filter((x) => x.done).length;
  const events = entries.filter((x) => x.kind === 'event' && !x.archived && days.includes(x.date));
  const outcomesDone = plan.outcomes.filter((x) => x.done && x.title.trim()).length;
  const updatePlan = (change: (old: WeekPlan) => WeekPlan) =>
    setPlans((old) => ({ ...old, [start]: change(old[start] ?? emptyWeek()) }));
  const updateTask = (id: string, patch: Partial<Task>) =>
    setTasks((old) => old.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const dateLabel = (
    date: string,
    options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
  ) => formatCalendarDate(date, t('en', 'ar'), options);
  function navigateWeek(date: string) {
    const next = new URLSearchParams(params);
    next.delete('saved');
    next.set('week', weekStart(date, settings.weekStartsOn));
    next.set('tab', 'week');
    setParams(next);
    setNotice('');
  }
  function createTask(date: string) {
    edit({
      id: crypto.randomUUID(),
      title: '',
      category: 'Personal',
      done: false,
      archived: false,
      plannedDate: date,
    });
  }
  const poolTasks = tasks.filter(
    (x) =>
      isActionable(x) &&
      (pool === 'all' ||
        (pool === 'unplanned' && !x.plannedDate) ||
        (pool === 'earlier' && !!x.plannedDate && x.plannedDate < start)) &&
      (goalFilter === 'all' || x.goalId === goalFilter) &&
      `${x.title} ${x.description ?? ''} ${(x.tags ?? []).join(' ')}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  function prepareMove(direction: 'next' | 'previous') {
    const source = direction === 'previous' ? addDays(start, -7) : start;
    const destination = direction === 'previous' ? start : addDays(start, 7);
    setMoveDates(
      Object.fromEntries(
        rolloverCandidates(tasks, source).map((task) => [
          task.id,
          addDays(destination, weekDates(source).indexOf(task.plannedDate!)),
        ]),
      ),
    );
    setRoll(direction);
  }
  const from = roll === 'previous' ? addDays(start, -7) : start;
  const to = roll === 'previous' ? start : addDays(start, 7);
  const moving = rolloverCandidates(tasks, from);
  function taskCard(task: Task, inPool = false) {
    const goal = goals.find((x) => x.id === task.goalId);
    return (
      <article
        key={task.id}
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
        className={`week-task ${task.done ? 'finished' : ''}`}
      >
        <div className="week-task-title">
          <button
            className={`checkbox ${task.done ? 'checked' : ''}`}
            aria-pressed={task.done}
            aria-label={`${t('ui.complete.e721b1')}: ${task.title}`}
            onClick={() =>
              updateTask(task.id, { done: !task.done, status: task.done ? 'todo' : 'done' })
            }
          >
            {task.done && <Check size={12} />}
          </button>
          <button onClick={() => edit(task)}>{task.title}</button>
          {!inPool && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t('ui.unplan.6d79ff')}: ${task.title}`}
              onClick={() => updateTask(task.id, { plannedDate: undefined })}
            >
              <X size={13} />
            </Button>
          )}
        </div>
        <div className="task-badges">
          <span className={`priority-badge ${priorityOf(task)}`}>
            {priorityLabel(priorityOf(task), t)}
          </span>
          <span>
            <Clock3 size={11} />
            {task.estimate
              ? `${localizedNumber(task.estimate, t('en', 'ar'))} ${t('ui.min.bea689')}`
              : t('ui.noEstimate.39dc40')}
          </span>
          {task.plannedTime && (
            <span>
              <Clock3 size={11} />
              <bdi>{localizedTime(task.plannedTime, t('en', 'ar'))}</bdi>
            </span>
          )}
          {task.dueDate && (
            <span>
              {t('ui.due.6c34a1')}: {formatCalendarDate(task.dueDate, t('en', 'ar'))}
            </span>
          )}
        </div>
        {goal && (
          <Link className="week-task-goal" to={`/life/${goal.id}`}>
            <Target size={11} />
            {goal.title}
          </Link>
        )}
        <label className="week-task-schedule">
          <span>{t('ui.planFor.d9500a')}</span>
          <select
            aria-label={`${t('ui.planTask.4f896d')}: ${task.title}`}
            value={task.plannedDate ?? ''}
            onChange={(e) => updateTask(task.id, { plannedDate: e.target.value || undefined })}
          >
            <option value="">{t('ui.unscheduled.19a99e')}</option>
            {task.plannedDate && !days.includes(task.plannedDate) && (
              <option value={task.plannedDate}>
                {localizedDate(task.plannedDate, t('en', 'ar'))}
              </option>
            )}
            {days.map((date) => (
              <option key={date} value={date}>
                {dateLabel(date, { weekday: 'short', day: 'numeric', month: 'short' })}
              </option>
            ))}
          </select>
        </label>
      </article>
    );
  }
  return (
    <section className="week-workspace">
      <div className="week-header">
        <div>
          <div className="eyebrow">{t('ui.aWeekWithIntention.74f49e')}</div>
          <h2 dir="auto">{t('ui.weeklyPlan.e40088')}</h2>
          <p dir="auto">
            {dateLabel(start)} —{' '}
            {dateLabel(addDays(start, 6), { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="week-navigation">
          <Button
            variant="outline"
            size="icon"
            aria-label={t('ui.previousWeek.4ed61e')}
            onClick={() => navigateWeek(addDays(start, -7))}
          >
            <ChevronLeft size={17} />
          </Button>
          <Button variant="outline" onClick={() => navigateWeek(localDate())}>
            {t('ui.thisWeek.867cff')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t('ui.nextWeek.e639c1')}
            onClick={() => navigateWeek(addDays(start, 7))}
          >
            <ChevronRight size={17} />
          </Button>
        </div>
      </div>
      {error && (
        <p dir="auto" className="notice" role="alert">
          {storageText(t, 'weeklyFailed')}
        </p>
      )}
      <label className="date-picker">
        {t('ui.previouslySavedWeeks.9d4b38')}
        <select
          aria-label={t('ui.previouslySavedWeeks.9d4b38')}
          value={plans[start] ? start : ''}
          onChange={(e) => {
            if (e.target.value) {
              const next = new URLSearchParams(params);
              next.set('week', e.target.value);
              next.set('saved', '1');
              setParams(next);
            }
          }}
        >
          <option value="">{t('ui.currentSelection.bac067')}</option>
          {Object.keys(plans)
            .sort()
            .reverse()
            .map((date) => (
              <option key={date} value={date}>
                {localizedDate(date, t('en', 'ar'))} —{' '}
                {localizedDate(addDays(date, 6), t('en', 'ar'))}
              </option>
            ))}
        </select>
      </label>
      {savedWeek && savedWeek !== weekStart(savedWeek, settings.weekStartsOn) && (
        <p dir="auto" role="status">
          {t('ui.viewingASavedWeekWithItsOriginal.15641c')}{' '}
          <Button variant="outline" onClick={() => navigateWeek(localDate())}>
            {t('ui.openCurrentWeek.aace20')}
          </Button>
        </p>
      )}
      <div className="week-summary">
        <span>
          <Check size={15} />
          {localizedNumber(completed, t('en', 'ar'))}/
          {localizedNumber(scheduled.length, t('en', 'ar'))} {t('ui.plannedTasksDone.1cb7c3')}
        </span>
        <span>
          <CalendarDays size={15} />
          {localizedNumber(events.length, t('en', 'ar'))} {t('ui.localEvents.d92519')}
        </span>
        <span>
          <Target size={15} />
          {localizedNumber(outcomesDone, t('en', 'ar'))}/
          {localizedNumber(plan.outcomes.length, t('en', 'ar'))} {t('ui.weeklyResults.d0161e')}
        </span>
        <small>{storageText(t, 'saved')}</small>
      </div>
      <div className="weekly-outcomes">
        {plan.outcomes.map((outcome, index) => (
          <section className={`card weekly-outcome ${outcome.done ? 'achieved' : ''}`} key={index}>
            <div>
              <span className="outcome-index">{formatClockPart(index + 1, t('en', 'ar'))}</span>
              <button
                className={`checkbox ${outcome.done ? 'checked' : ''}`}
                disabled={!outcome.title.trim()}
                aria-pressed={outcome.done}
                aria-label={`${t('ui.completeWeeklyResult.0a556f')} ${localizedNumber(index + 1, t('en', 'ar'))}`}
                onClick={() =>
                  updatePlan((old) => ({
                    ...old,
                    outcomes: old.outcomes.map((x, i) =>
                      i === index ? { ...x, done: !x.done } : x,
                    ),
                  }))
                }
              >
                {outcome.done && <Check size={12} />}
              </button>
            </div>
            <label>
              <span>{t('ui.aResultWorthFinishing.eb9e80')}</span>
              <input
                dir="auto"
                aria-label={`${t('ui.weeklyResult.a4b15c')} ${localizedNumber(index + 1, t('en', 'ar'))}`}
                maxLength={160}
                placeholder={t('ui.byTheEndOfThisWeek.8861c8')}
                value={outcome.title}
                onChange={(e) => {
                  const title = e.target.value;
                  updatePlan((old) => ({
                    ...old,
                    outcomes: old.outcomes.map((x, i) =>
                      i === index ? { ...x, title, done: title.trim() ? x.done : false } : x,
                    ),
                  }));
                }}
              />
            </label>
            <select
              aria-label={`${t('ui.resultGoal.3c90e5')} ${localizedNumber(index + 1, t('en', 'ar'))}`}
              value={outcome.goalId}
              onChange={(e) => {
                const goalId = e.target.value;
                updatePlan((old) => ({
                  ...old,
                  outcomes: old.outcomes.map((x, i) => (i === index ? { ...x, goalId } : x)),
                }));
              }}
            >
              <option value="">{t('ui.linkAGoalOptional.e6932a')}</option>
              {outcome.goalId && !goals.some((x) => x.id === outcome.goalId) && (
                <option value={outcome.goalId}>{t('ui.goalRemoved.e91e3d')}</option>
              )}
              {goals.map((goal) => (
                <option value={goal.id} key={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
            <input
              dir="auto"
              aria-label={t('ui.resultCompletionCriteria.4f1eea')}
              maxLength={500}
              placeholder={t('ui.whatMakesThisResultComplete.8f42ba')}
              value={outcome.criteria ?? ''}
              onChange={(e) => {
                const criteria = e.target.value;
                updatePlan((old) => ({
                  ...old,
                  outcomes: old.outcomes.map((x, i) => (i === index ? { ...x, criteria } : x)),
                }));
              }}
            />
            <Button
              variant="ghost"
              disabled={plan.outcomes.length <= 1}
              onClick={() =>
                updatePlan((old) => ({
                  ...old,
                  outcomes: old.outcomes.filter((_, i) => i !== index),
                }))
              }
            >
              {t('ui.removeResult.a2fd4a')}
            </Button>
          </section>
        ))}
      </div>
      <Button
        variant="outline"
        disabled={plan.outcomes.length >= 7}
        onClick={() =>
          updatePlan((old) => ({
            ...old,
            outcomes: [...old.outcomes, { title: '', goalId: '', done: false }],
          }))
        }
      >
        {t('ui.addWeeklyResult.e7abfe')}
      </Button>
      <div className="week-plan-heading">
        <div>
          <h3 dir="auto">{t('ui.giveEachDayALittleBreathingRoom.6b9df0')}</h3>
          <p dir="auto">{t('ui.planningDateIsSeparateFromDueDate.1e65c2')}</p>
        </div>
        <div>
          <Button variant="outline" onClick={() => prepareMove('previous')}>
            <RotateCcw size={14} />
            {t('ui.bringPreviousUnfinished.ea637b')}
          </Button>
          <Button variant="outline" onClick={() => prepareMove('next')}>
            <ArrowRight size={14} />
            {t('ui.moveUnfinishedToNextWeek.8e856c')}
          </Button>
        </div>
      </div>
      {notice && (
        <p dir="auto" role="status" className="feedback">
          {notice}
        </p>
      )}
      <div className="week-days" role="region" aria-label={t('ui.weekDays.ab2a25')}>
        {days.map((date) => {
          const dayTasks = scheduled.filter((x) => x.plannedDate === date);
          const deadlines = tasksOnDate(tasks, date).filter(
            (x) => x.dueDate === date && x.plannedDate !== date,
          );
          const dayEvents = events
            .filter((x) => x.date === date)
            .sort((a, b) => a.time.localeCompare(b.time));
          const load = dayLoad(
            tasks,
            entries,
            date,
            plan.capacities[date] ?? settings.capacity,
            plan.buffers?.[date] ?? settings.buffer,
          );
          return (
            <section
              className={`week-day card ${date === localDate() ? 'today' : ''}`}
              key={date}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (tasks.some((x) => x.id === id && isActionable(x)))
                  updateTask(id, { plannedDate: date });
              }}
            >
              <div className="week-day-heading">
                <div>
                  <span>{dateLabel(date, { weekday: 'long' })}</span>
                  <strong dir="auto">{dateLabel(date, { day: 'numeric', month: 'short' })}</strong>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t('ui.addTaskFor.e61a7b')} ${date}`}
                  onClick={() => createTask(date)}
                >
                  <Plus size={15} />
                </Button>
              </div>
              <div className={`day-load ${load.overloaded ? 'overloaded' : ''}`}>
                <div>
                  <span>
                    {localizedNumber(load.total, t('en', 'ar'))} /{' '}
                    {localizedNumber(load.capacity, t('en', 'ar'))} {t('ui.min.bea689')}
                  </span>
                  <strong dir="auto">
                    {load.overloaded ? t('ui.crowded.9c4b48') : t('ui.plannedTime.c6220b')}
                  </strong>
                </div>
                <small>
                  {t('ui.reserve.81522c')}: {localizedNumber(load.buffer, t('en', 'ar'))}{' '}
                  {t('ui.min.bea689')}
                </small>
                <progress
                  max={Math.max(1, load.capacity)}
                  value={Math.min(load.total, Math.max(1, load.capacity))}
                />
                <details className="day-capacity-editor">
                  <summary>{t('week.capacity.edit')}</summary>
                  <label>
                    {t('week.capacity.available')}
                    <input
                      aria-label={`${t('ui.dailyCapacity.dc01b3')} ${date}`}
                      type="number"
                      min={0}
                      max={1440}
                      step={15}
                      value={load.rawCapacity}
                      onChange={(e) => {
                        const capacity = Math.max(0, Math.min(1440, Number(e.target.value)));
                        updatePlan((old) => ({
                          ...old,
                          capacities: { ...old.capacities, [date]: capacity },
                        }));
                      }}
                    />
                  </label>
                  <label>
                    {t('week.capacity.reserve')}
                    <input
                      aria-label={t('ui.dailyReserve.0a6b93') + ' ' + date}
                      type="number"
                      min={0}
                      max={1440}
                      value={load.buffer}
                      onChange={(e) => {
                        const buffer = Math.max(0, Math.min(1440, Number(e.target.value)));
                        updatePlan((old) => ({
                          ...old,
                          buffers: { ...old.buffers, [date]: buffer },
                        }));
                      }}
                    />
                  </label>
                </details>
                {load.unknownTasks > 0 && (
                  <small>
                    {localizedNumber(load.unknownTasks, t('en', 'ar'))}{' '}
                    {t('ui.tasksWithoutEstimates.3a1415')}
                  </small>
                )}
                {load.estimatedEvents > 0 && (
                  <small>{t('ui.eventDurationEstimatedAt60Min.10578b')}</small>
                )}
              </div>
              <ConflictNotice entries={entries} date={date} t={t} />
              {dayEvents.map((event) => (
                <Link
                  className="week-event"
                  key={event.id}
                  to={`/planner?tab=calendar&date=${date}`}
                >
                  <time dir="ltr">{localizedTime(event.time, t('en', 'ar'))}</time>
                  <span>{event.title}</span>
                  <ArrowUpRight size={12} />
                </Link>
              ))}
              <div className="week-due-tasks">
                {deadlines.length > 0 && (
                  <>
                    <h4 dir="auto">{t('ui.dueDatesNotExecutionTime.7807eb')}</h4>
                    {deadlines.map((task) => (
                      <button className="week-deadline" key={task.id} onClick={() => edit(task)}>
                        <span dir="auto">{task.title}</span>
                        <small>
                          {t('ui.due.6c34a1')}:{' '}
                          <time dateTime={date}>{formatCalendarDate(date, t('en', 'ar'))}</time>
                        </small>
                      </button>
                    ))}
                  </>
                )}
              </div>
              <div className="week-day-tasks">
                {dayTasks.map((task) => taskCard(task))}
                {!dayTasks.length && (
                  <p dir="auto" className="day-empty">
                    {t('ui.spaceForYourNextStep.085138')}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <section className="card week-pool">
        <div className="home-section-title">
          <div>
            <h3 dir="auto">{t('ui.chooseYourNextSteps.9ade5e')}</h3>
            <p dir="auto" className="muted">
              {t('ui.chooseADayToAddATask.4b06cf')}
            </p>
          </div>
          <Button onClick={() => createTask(days.includes(localDate()) ? localDate() : start)}>
            <Plus size={15} />
            {t('ui.newTask.02b6c9')}
          </Button>
        </div>
        <div className="collection-tools">
          <input
            dir="auto"
            className="week-search"
            aria-label={t('ui.searchPlanningTasks.a5ff8b')}
            placeholder={t('ui.findATask.3559ab')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label={t('ui.planningPool.bd68a7')}
            value={pool}
            onChange={(e) => setPool(e.target.value)}
          >
            <option value="unplanned">{t('ui.unscheduled.19a99e')}</option>
            <option value="earlier">{t('ui.plannedBeforeThisWeek.2ca100')}</option>
            <option value="all">{t('ui.allOpenTasks.a2432b')}</option>
          </select>
          <select
            aria-label={t('ui.planningGoalFilter.0084a9')}
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
          >
            <option value="all">{t('ui.allGoals.e97c2d')}</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </div>
        <div className="week-pool-grid">{poolTasks.map((task) => taskCard(task, true))}</div>
        {!poolTasks.length && (
          <p dir="auto" className="empty-state">
            {t('ui.noMatchingOpenTasksTryAnotherFilter.6682fc')}
          </p>
        )}
      </section>
      <WeeklyGuided key={start} start={start} t={t} />
      <section className="card weekly-review">
        <ResultSummary tasks={tasks} start={start} end={addDays(start, 6)} t={t} />
        <div className="home-section-title">
          <div>
            <div className="eyebrow">
              <NotebookPen size={13} />
              {t('ui.learnThenBeginAgain.db38a4')}
            </div>
            <h3 dir="auto">{t('ui.aLittleReflectionOnTheWeek.ed225f')}</h3>
          </div>
        </div>
        <div className="review-fields">
          {(['wins', 'obstacles', 'next'] as const).map((field, i) => (
            <label key={field}>
              {
                [
                  t('ui.whatWentWell.e26723'),
                  t('ui.whatGotInTheWay.178e82'),
                  t('ui.whatWillYouChangeNextWeek.59afb1'),
                ][i]
              }
              <textarea
                dir="auto"
                rows={4}
                maxLength={2000}
                value={plan.review[field]}
                onChange={(e) => {
                  const value = e.target.value;
                  updatePlan((old) => ({ ...old, review: { ...old.review, [field]: value } }));
                }}
              />
            </label>
          ))}
        </div>
        <p dir="auto" className="week-review-note">
          {t('ui.resultsAreMarkedManuallyNotesSaveAutomatically.bc8f75')}
        </p>
      </section>
      <Dialog
        open={!!roll}
        onOpenChange={() => setRoll(null)}
        title={t('ui.reviewTheWeeklyMove.c08e46')}
        description={t('ui.onlyUnfinishedNonArchivedTasksPlannedIn.77a012')}
      >
        <p className="muted" dir="ltr">
          {localizedDate(from, t('en', 'ar'))} → {localizedDate(to, t('en', 'ar'))}
        </p>
        <p dir="auto">
          {localizedNumber(moving.length, t('en', 'ar'))} {t('ui.tasksToMove.6ef1b4')}
        </p>
        <ul className="rollover-preview">
          {moving.map((task) => (
            <li key={task.id}>
              {task.title}
              <small dir="ltr">{localizedDate(task.plannedDate, t('en', 'ar'))}</small>
              <label>
                {t('ui.moveTo.96ee5b')}
                <DateTimeInput
                  aria-label={t('ui.newPlanningDay.ce8412') + ': ' + task.title}
                  type="date"
                  value={moveDates[task.id] ?? ''}
                  onChange={(e) => setMoveDates((old) => ({ ...old, [task.id]: e.target.value }))}
                />
              </label>
              <small>{t('ui.clearTheDateToKeepThisTask.0f0125')}</small>
            </li>
          ))}
        </ul>
        {Array.from(new Set(Object.values(moveDates).filter(Boolean))).map((date) => {
          const proposed = tasks.map((x) =>
            moveDates[x.id] ? { ...x, plannedDate: moveDates[x.id] } : x,
          );
          const targetPlan = days.includes(date)
            ? plan
            : plans[weekStart(date, settings.weekStartsOn)];
          const load = dayLoad(
            proposed,
            entries,
            date,
            targetPlan?.capacities[date] ?? settings.capacity,
            targetPlan?.buffers?.[date] ?? settings.buffer,
          );
          return (
            <p dir="auto" key={date} className={load.overloaded ? 'capture-hint' : 'muted'}>
              {localizedDate(date, t('en', 'ar'))} · {localizedNumber(load.total, t('en', 'ar'))}/
              {localizedNumber(load.capacity, t('en', 'ar'))} {t('ui.minAfterMove.63b6a4')}
              {load.overloaded ? ' · ' + t('ui.overCapacityAdjustDatesOrEstimates.e15c00') : ''}
            </p>
          );
        })}
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setRoll(null)}>
            {t('ui.cancel.428808')}
          </Button>
          <Button
            disabled={!Object.values(moveDates).some(Boolean)}
            onClick={() => {
              setTasks((old) =>
                old.map((x) =>
                  moving.some((m) => m.id === x.id) && moveDates[x.id]
                    ? { ...x, plannedDate: moveDates[x.id] }
                    : x,
                ),
              );
              setRoll(null);
              setNotice(t('ui.planningDatesUpdatedDeadlinesAreUnchanged.24c443'));
            }}
          >
            {t('ui.confirmMove.80c782')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
