import { DateTimeInput } from '../../components/DateTimeInput';
import {
  formatCalendarDate as localizedDate,
  formatTime as localizedTime,
} from '../../i18n/format';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { storageText } from '../../i18n/messages';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Play, Check, NotebookPen, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { transactData } from '../../lib/storage';
import { localDate } from '../../lib/workspace';
import type { Entry, Translate } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import { isActionable, statusOf, statusLabel } from '../tasks/model';
import { addDays } from '../planner/weekModel';
import { dayTasks, saveTaskResult, startDayTask } from './dayModel';

export function MyDay({
  tasks,
  entries,
  t,
  edit,
}: {
  tasks: Task[];
  entries: Entry[];
  t: Translate;
  edit: (task: Task) => void;
}) {
  const [params, setParams] = useSearchParams();
  const today = localDate();
  const requested = params.get('day');
  const day =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && !Number.isNaN(Date.parse(requested))
      ? requested
      : today;
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultTask, setResultTask] = useState<Task | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [complete, setComplete] = useState(false);
  const planned = dayTasks(tasks, day);
  const shown = expanded ? planned : planned.slice(0, 3);
  const done = planned.filter((x) => x.done).length;
  const minutes = planned.reduce((sum, x) => sum + (x.estimate ?? 0), 0);
  const unknown = planned.filter((x) => x.estimate === undefined || x.estimate === 0).length;
  const next = tasks
    .filter((x) => isActionable(x) && x.plannedDate && x.plannedDate > day)
    .map((x) => x.plannedDate!)
    .sort()[0];
  function selectDay(value: string) {
    if (!value) return;
    const nextParams = new URLSearchParams(params);
    nextParams.set('day', value);
    setParams(nextParams, { replace: true });
    setExpanded(false);
    setNotice('');
  }
  function openResult(task: Task) {
    setResultTask(task);
    setNote(task.result?.note ?? '');
    setDate(task.result?.date ?? today);
    setComplete(false);
    setNotice('');
  }
  async function start(task: Task) {
    setBusy(true);
    const ok = await transactData((data) => startDayTask(data, task.id, today));
    setBusy(false);
    setNotice(
      ok
        ? t('ui.focusStartedPauseAndRecordItIn.b267b9')
        : t('ui.couldNotStartRecordAnyActiveFocus.b8a6c9'),
    );
  }
  async function save() {
    if (!resultTask) return;
    setBusy(true);
    const ok = await transactData((data) =>
      saveTaskResult(data, resultTask, note, date, complete, today),
    );
    setBusy(false);
    if (ok) {
      setResultTask(null);
      setNotice(storageText(t, 'resultSaved'));
    } else setNotice(t('ui.couldNotSaveReopenTheLatestTask.3c9796'));
  }
  return (
    <section className="card my-day">
      <div className="home-section-title">
        <div>
          <div className="eyebrow">{t('ui.fromPlanToPractice.5cb7de')}</div>
          <h2 dir="auto">{day === today ? t('ui.myDay.e6e785') : t('ui.dayPlan.36095d')}</h2>
          <p dir="auto" className="muted">
            {day > today
              ? t('ui.previewOfAFutureDayExecutionAnd.4c51ae')
              : t('ui.smallStepsWithARecordOfWhat.1c84c8')}
          </p>
        </div>
        <Link to={`/planner?tab=week&week=${day}`}>{t('ui.weekPlan.10c604')}</Link>
      </div>
      <div className="my-day-navigation">
        <Button
          variant="outline"
          size="icon"
          aria-label={t('ui.previousDay.3434e3')}
          onClick={() => selectDay(addDays(day, -1))}
        >
          <ArrowRight size={16} />
        </Button>
        <DateTimeInput
          aria-label={t('ui.myDayDate.8e21e7')}
          type="date"
          value={day}
          onChange={(e) => selectDay(e.target.value)}
          onInput={(e) => selectDay(e.currentTarget.value)}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label={t('ui.nextDay.ac4ded')}
          onClick={() => selectDay(addDays(day, 1))}
        >
          <ArrowLeft size={16} />
        </Button>
        {day !== today && (
          <Button variant="ghost" onClick={() => selectDay(today)}>
            {t('ui.today.448511')}
          </Button>
        )}
      </div>
      <div className="my-day-totals">
        <span>
          {localizedNumber(done, t('en', 'ar'))}/{localizedNumber(planned.length, t('en', 'ar'))}{' '}
          {t('ui.completed.ff1564')}
        </span>
        <span>
          {localizedNumber(minutes, t('en', 'ar'))} {t('ui.plannedMinutes.3a4007')}
          {unknown > 0
            ? ` · ${localizedNumber(unknown, t('en', 'ar'))} ${t('ui.withoutEstimates.a3bb53')}`
            : ''}
        </span>
        <span>
          {localizedNumber(planned.filter((x) => x.result?.note).length, t('en', 'ar'))}{' '}
          {t('ui.recordedResults.b39cf4')}
        </span>
      </div>
      <div className="my-day-list">
        {shown.map((task) => {
          const goal = entries.find((x) => x.id === task.goalId);
          return (
            <article className={task.done ? 'day-step finished' : 'day-step'} key={task.id}>
              <div className="day-step-heading">
                <div>
                  <strong dir="auto">{task.title}</strong>
                  {goal && <Link to={`/life/${goal.id}`}>{goal.title}</Link>}
                </div>
                <span>{statusLabel(statusOf(task), t)}</span>
              </div>
              <small className="muted">
                {task.estimate
                  ? `${localizedNumber(task.estimate, t('en', 'ar'))} ${t('ui.minSuggested.67a0f7')}`
                  : t('ui.noTimeEstimate.974a26')}
              </small>
              {task.result && (
                <blockquote>
                  <p dir="auto">{task.result.note}</p>
                  <small>{localizedDate(task.result.date, t('en', 'ar'))}</small>
                </blockquote>
              )}
              <div className="day-step-actions">
                <Button
                  variant="outline"
                  disabled={busy || day !== today || !isActionable(task)}
                  onClick={() => void start(task)}
                >
                  <Play size={14} />
                  {t('ui.startFocus.d7ee4c')}
                </Button>
                <Button
                  variant={task.done ? 'ghost' : 'default'}
                  disabled={busy || day > today}
                  onClick={() => openResult(task)}
                >
                  <NotebookPen size={14} />
                  {task.result ? t('ui.editResult.c0594b') : t('ui.recordResult.488dee')}
                </Button>
                <Button variant="ghost" onClick={() => edit(task)}>
                  {t('ui.editReplan.d7d39f')}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!planned.length && (
        <div className="home-empty">
          <p dir="auto">{t('ui.noTasksPlannedForThisDay.d98af2')}</p>
          {next && (
            <Button variant="outline" onClick={() => selectDay(next)}>
              {t('ui.viewNextPlannedDay.9a05a4')} · {localizedDate(next, t('en', 'ar'))}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() =>
              edit({
                id: crypto.randomUUID(),
                title: '',
                category: 'Personal',
                done: false,
                archived: false,
                plannedDate: day,
              })
            }
          >
            {t('ui.planAStep.382972')}
          </Button>
        </div>
      )}
      {planned.length > 3 && (
        <Button variant="ghost" onClick={() => setExpanded(!expanded)}>
          {expanded
            ? t('ui.showThree.2efbab')
            : t(
                `Show all ${localizedNumber(planned.length, t('en', 'ar'))} tasks`,
                `اعرض كل المهام (${localizedNumber(planned.length, t('en', 'ar'))})`,
              )}
        </Button>
      )}
      {notice && !resultTask && (
        <p dir="auto" role="status">
          {notice}{' '}
          <a className="text-button" href="#daily-focus">
            {t('ui.openFocusTimer.62eb1f')}
          </a>
        </p>
      )}
      <Dialog
        open={!!resultTask}
        onOpenChange={(open) => {
          if (!open && !busy) setResultTask(null);
        }}
        title={t('ui.whatMovedForward.cadc5a')}
        description={resultTask?.title ?? ''}
      >
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            {t('ui.actualResult.245175')}
            <textarea
              dir="auto"
              autoFocus
              rows={5}
              maxLength={3000}
              placeholder={t('ui.whatDidYouLearnMemorizeReviewOr.4b9e01')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label>
            {t('ui.resultDate.b3e31f')}
            <DateTimeInput
              type="date"
              required
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onInput={(e) => setDate(e.currentTarget.value)}
              aria-label={t('ui.resultDate.b3e31f')}
            />
          </label>
          {!resultTask?.done && (
            <label className="pin-option">
              <input
                type="checkbox"
                checked={complete}
                onChange={(e) => setComplete(e.target.checked)}
              />
              <Check size={14} />
              {t('ui.alsoMarkTheTaskComplete.a03f1e')}
            </label>
          )}
          <p dir="auto" className="muted">
            {t('ui.aResultNoteDoesNotCompleteA.c858c9')}
          </p>
          {notice && (
            <p dir="auto" role="alert">
              {notice}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setResultTask(null)}
            >
              {t('ui.cancel.428808')}
            </Button>
            <Button disabled={busy || !date}>{t('ui.saveResult.9ae5d5')}</Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
