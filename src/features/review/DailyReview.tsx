import { DateTimeInput } from '../../components/DateTimeInput';
import { formatCalendarDate, formatNumber as localizedNumber } from '../../i18n/format';
import { canRolloverTask, rolloverDay, journeyState, JOURNEY_KEY } from '../journey/model';
import { transactData } from '../../lib/storage';
import { storageText } from '../../i18n/messages';
import { ResultSummary } from './ResultSummary';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { usePersisted } from '../../lib/storage';
import { localDate } from '../../lib/workspace';
import { addDays } from '../planner/weekModel';
import { statusOf, statusLabel } from '../tasks/model';
import type { Task } from '../tasks/model';
import type { Translate } from '../../lib/workspace';
import type { Dispatch, SetStateAction } from 'react';
type Review = { wins: string; obstacles: string; next: string; mood?: number; note?: string };
export function DailyReview({
  t,
  tasks,
  setTasks,
  edit,
}: {
  t: Translate;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  edit: (task: Task) => void;
}) {
  const [day, setDay] = useState(localDate());
  const [reviews, setReviews, error] = usePersisted<Record<string, Review>>(
    'personal-os.reviews.v1',
    {},
  );
  const review = reviews[day] ?? { wins: '', obstacles: '', next: '' };
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = tasks.filter(
    (x) =>
      !x.archived &&
      !x.done &&
      statusOf(x) !== 'cancelled' &&
      ((x.plannedDate && x.plannedDate <= day) ||
        (x.reviewDate && x.reviewDate <= day) ||
        (x.dueDate && x.dueDate <= day)),
  );
  const completed = tasks.filter(
    (x) => x.completedAt && localDate(new Date(x.completedAt)) === day,
  );
  function update(id: string, patch: Partial<Task>) {
    setTasks((old) => old.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  return (
    <section id="daily-review" tabIndex={-1} className="card daily-review evening-review">
      <div className="home-section-title">
        <h3 dir="auto">{t('ui.eveningReviewTwoMinutes.5e8cf6')}</h3>
        <DateTimeInput
          aria-label={t('ui.reviewDay.a7ccf6')}
          type="date"
          max={localDate()}
          value={day}
          onChange={(e) => {
            if (e.target.value) setDay(e.target.value);
          }}
        />
      </div>
      <p dir="auto" className="muted">
        {localizedNumber(completed.length, t('en', 'ar'))}{' '}
        {t('ui.completedOnThisDateRecordedCompletionsOnly.0192cb')}
      </p>
      <ResultSummary tasks={tasks} start={day} end={day} t={t} />
      <details>
        <summary>
          {t('ui.reviewUnfinishedSteps.0deede')} · {localizedNumber(pending.length, t('en', 'ar'))}
        </summary>
        {pending.map((task) => (
          <div className="review-task" key={task.id}>
            <strong dir="auto">{task.title}</strong>
            {canRolloverTask(task, day) && (
              <label>
                <input
                  type="checkbox"
                  aria-label={`${t('ui.moveTomorrow.e5dfff')}: ${task.title}`}
                  checked={selected.includes(task.id)}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked ? [...old, task.id] : old.filter((id) => id !== task.id),
                    )
                  }
                />
                {t('ui.includeInTomorrowPreview.e6fa53')}
              </label>
            )}
            <small>
              {statusLabel(statusOf(task), t)}
              {task.reason ? ` · ${task.reason}` : ''}
            </small>
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => edit(task)}>
                {t('ui.reviewMakeSmaller.b4bb88')}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  update(task.id, {
                    plannedDate: addDays(day, 1),
                    status: 'todo',
                    done: false,
                    reviewDate: undefined,
                  })
                }
              >
                {t('ui.planTomorrow.73248a')}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  update(task.id, { status: 'deferred', reviewDate: addDays(day, 1), done: false })
                }
              >
                {t('ui.deferForReview.eb9019')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => update(task.id, { status: 'cancelled', done: false })}
              >
                {t('ui.cancelTask.0a5a17')}
              </Button>
            </div>
          </div>
        ))}
        {!pending.length && <p dir="auto">{t('ui.nothingNeedsADecisionForThisDay.95ba1e')}</p>}
      </details>
      <section className="rollover-day">
        <p dir="auto">{t('ui.selectedTasksMoveToTomorrowOnlyAfter.6824d4')}</p>
        <p dir="auto">
          {localizedNumber(selected.length, t('en', 'ar'))} {t('ui.selectedTasks.ff0f93')} ·{' '}
          <bdi>{formatCalendarDate(addDays(day, 1), t('en', 'ar'))}</bdi>
        </p>
        <Button
          disabled={busy || !selected.length}
          onClick={async () => {
            setBusy(true);
            const ok = await transactData((data) => rolloverDay(data, selected, day));
            setBusy(false);
            if (ok) setSelected([]);
            setNotice(
              ok
                ? t('ui.selectedExecutionDaysMovedToTomorrow.c53eca')
                : t('ui.tasksChangedOrCouldNotBeMoved.755aef'),
            );
          }}
        >
          {t('ui.confirmSelectedTasksForTomorrow.6f1ed7')}
        </Button>
      </section>
      <fieldset className="mood-picker">
        <legend>{t('ui.howDidTodayFeel.b22629')}</legend>
        {['😞', '😕', '😐', '🙂', '😄'].map((emoji, index) => (
          <button
            type="button"
            aria-label={`${t('ui.mood.a0c2c0')} ${localizedNumber(index + 1, t('en', 'ar'))}`}
            aria-pressed={review.mood === index + 1}
            key={emoji}
            onClick={() =>
              setReviews((old) => ({ ...old, [day]: { ...(old[day] ?? review), mood: index + 1 } }))
            }
          >
            {emoji}
          </button>
        ))}
      </fieldset>
      <div className="review-notes-panel">
        <label className="review-field review-evening-note">
          {t('ui.oneLineEveningNote.0f9fdf')}
          <input
            dir="auto"
            aria-label={t('ui.eveningNote.3fd2ea')}
            maxLength={1000}
            value={review.note ?? ''}
            onChange={(e) => {
              const note = e.target.value;
              setReviews((old) => ({ ...old, [day]: { ...(old[day] ?? review), note } }));
            }}
          />
        </label>
        <div className="review-fields">
          {(['wins', 'obstacles', 'next'] as const).map((field, i) => (
            <label className="review-field" key={field}>
              {
                [
                  t('ui.whatMovedForward.b334a6'),
                  t('ui.whatChangedOrGotInTheWay.3388e5'),
                  t('ui.whatWillYouAdjust.f8275f'),
                ][i]
              }
              <textarea
                dir="auto"
                maxLength={2000}
                rows={3}
                value={review[field]}
                onChange={(e) => {
                  const value = e.target.value;
                  setReviews((old) => ({
                    ...old,
                    [day]: { ...(old[day] ?? review), [field]: value },
                  }));
                }}
              />
            </label>
          ))}
        </div>
      </div>
      <footer className="review-save-footer">
        <p className="muted" role={error ? 'alert' : undefined}>
          {error ? t('ui.couldNotSaveTheReview.2ead08') : storageText(t, 'review')}
        </p>
        <Button
          disabled={busy}
          onClick={async () => {
            const ok = await transactData((data) => ({
              ...data,
              [JOURNEY_KEY]: { ...journeyState(data), eveningReviewedOn: day },
            }));
            setNotice(
              ok
                ? t('ui.eveningReviewFinishedYouCanRevisitIt.afe61c')
                : t('ui.couldNotSaveTheReviewStatus.16d241'),
            );
          }}
        >
          {t('ui.finishEveningReview.b1e4d9')}
        </Button>
        {notice && (
          <p dir="auto" role="status">
            {notice}
          </p>
        )}
      </footer>
    </section>
  );
}
