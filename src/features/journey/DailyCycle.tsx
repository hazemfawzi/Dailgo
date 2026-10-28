import { DateTimeInput } from '../../components/DateTimeInput';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { formatNumber } from '../../i18n/format';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { transactData, useStorageState } from '../../lib/storage';
import { localDate, areaLabel } from '../../lib/workspace';
import type { Entry, Translate } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import { isActionable, isOverdue, rankTasks } from '../tasks/model';
import { routineDue } from '../planner/scheduling';
import { dayLoad, weekStart } from '../planner/weekModel';
import type { WeekPlan } from '../planner/weekModel';
import type { PlanningPreferences } from '../../lib/preferences';
import { morningCandidates, nextDay, saveMorningPlan } from './model';
import { useJourney } from './useJourney';
export function DailyCycle({
  tasks,
  entries,
  settings,
  t,
}: {
  tasks: Task[];
  entries: Entry[];
  settings: PlanningPreferences;
  t: Translate;
}) {
  const { data } = useStorageState();
  const [journey, setJourney] = useJourney();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const today = localDate(now);
  const [manual, setManual] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [chosen, setChosen] = useState<string[]>(
    journey.focusDate === today ? journey.focusIds : [],
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [defer, setDefer] = useState<string | null>(null);
  const [deferDate, setDeferDate] = useState(nextDay(today));
  useEffect(() => {
    setChosen(journey.focusDate === today ? journey.focusIds : []);
  }, [today, journey.focusDate, journey.focusIds.join(',')]);
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const show =
    manual || (!collapsed && journey.morningReviewedOn !== today && clock >= journey.wakeTime);
  const eligibleChosen = chosen.filter((id) =>
    tasks.some((task) => task.id === id && isActionable(task)),
  );
  const candidates = rankTasks(morningCandidates(tasks, today));
  const overdue = tasks.filter(
    (task) => isActionable(task) && isOverdue(task) && task.plannedDate !== today,
  );
  const routines = entries.filter(
    (entry) => entry.kind === 'routine' && !entry.archived && routineDue(entry, today),
  );
  const plans = data['personal-os.weeks.v1'] as Record<string, WeekPlan> | undefined;
  const plan = plans?.[weekStart(today, settings.weekStartsOn)];
  const projected = tasks.map((task) =>
    eligibleChosen.includes(task.id) ? { ...task, plannedDate: today } : task,
  );
  const load = dayLoad(
    projected,
    entries,
    today,
    plan?.capacities[today] ?? settings.capacity,
    plan?.buffers?.[today] ?? settings.buffer,
  );
  async function review() {
    setBusy(true);
    const ok = await transactData((current) => saveMorningPlan(current, eligibleChosen, today));
    setBusy(false);
    if (ok) {
      setManual(false);
      setNotice(t('ui.yourFocusChoicesAndExecutionDaysAre.dacba6'));
    } else setNotice(t('ui.theSelectionChangedOrCouldNotBe.bc8c05'));
  }
  async function decide(id: string, operation: 'today' | 'defer' | 'cancel') {
    if (busy) return;
    setBusy(true);
    const ok = await transactData((current) => {
      const all = (current['personal-os.tasks.v1'] ?? []) as Task[];
      const task = all.find((task) => task.id === id);
      if (!task || !isActionable(task)) throw Error('unavailable-task');
      if (operation === 'defer' && (!/^\d{4}-\d{2}-\d{2}$/.test(deferDate) || deferDate <= today))
        throw Error('invalid-day');
      return {
        ...current,
        'personal-os.tasks.v1': all.map((task) =>
          task.id === id
            ? {
                ...task,
                ...(operation === 'today'
                  ? { plannedDate: today }
                  : operation === 'defer'
                    ? { plannedDate: deferDate, reviewDate: deferDate, status: 'deferred' as const }
                    : { status: 'cancelled' as const, done: false }),
              }
            : task,
        ),
      };
    });
    setBusy(false);
    if (ok) {
      setDefer(null);
      setChosen((ids) => ids.filter((value) => value !== id || operation === 'today'));
    } else setNotice(t('ui.couldNotUpdateTheTaskReviewIt.e3c746'));
  }
  return (
    <section className="card daily-cycle">
      <div className="home-section-title">
        <div>
          <div className="eyebrow">{t('ui.yourDailyCycle.7d448b')}</div>
          <h2 dir="auto">
            {show ? t('ui.planTodayInOneMinute.68c63a') : t('ui.yourDailyPlan.4c5352')}
          </h2>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (show) {
              setManual(false);
              setCollapsed(true);
            } else setManual(true);
          }}
        >
          {show ? t('ui.collapsePlan.d6adc9') : t('ui.reviewTodaySPlan.309c01')}
        </Button>
      </div>
      {show && (
        <>
          <p dir="auto">
            {clock < '12:00'
              ? t('ui.goodMorningChooseUpToThreeSteps.cf6990')
              : t('ui.chooseUpToThreeFocusStepsFor.f92268')}
          </p>
          <p dir="auto" className="muted">
            {t('ui.selectedTasksWillBePlannedForToday.8e04e2')}
          </p>
          <p dir="auto">
            {t('ui.dueToday.6c50f4')}:{' '}
            {formatNumber(
              tasks.filter((task) => isActionable(task) && task.dueDate === today).length,
              t('en', 'ar'),
            )}{' '}
            · {t('ui.overdue.918363')}: {formatNumber(overdue.length, t('en', 'ar'))} ·{' '}
            {t('ui.routines.4daff4')}:{' '}
            {formatNumber(
              routines.filter((entry) => !entry.doneDates.includes(today)).length,
              t('en', 'ar'),
            )}
          </p>
          <div className="morning-candidates">
            {candidates.map((task) => (
              <label key={task.id}>
                <input
                  type="checkbox"
                  aria-label={`${t('ui.focusChoice.ed593b')}: ${task.title}`}
                  checked={chosen.includes(task.id)}
                  disabled={!chosen.includes(task.id) && eligibleChosen.length === 3}
                  onChange={(e) =>
                    setChosen((old) =>
                      e.target.checked ? [...old, task.id] : old.filter((id) => id !== task.id),
                    )
                  }
                />
                <span dir="auto">{task.title}</span>
                <small>
                  {areaLabel(task.category as any, t)} ·{' '}
                  {formatNumber(task.estimate ?? 0, t('en', 'ar'))} {t('ui.estimatedMin.2e09f8')}
                </small>
              </label>
            ))}
          </div>
          {!candidates.length && (
            <p dir="auto">
              {t('ui.addOneTaskToStartYourDay.13a4eb')}{' '}
              <Link to="/planner">{t('ui.openTasks.4911c1')}</Link>
            </p>
          )}
          <div
            className={load.overloaded ? 'capacity-summary overloaded' : 'capacity-summary'}
            role="status"
          >
            <strong dir="auto">
              {formatNumber(load.total, t('en', 'ar'))} /{' '}
              {formatNumber(load.capacity, t('en', 'ar'))} {t('ui.plannedMinutes.3a4007')}
            </strong>
            <progress
              value={Math.min(load.total, Math.max(load.capacity, 1))}
              max={Math.max(load.capacity, 1)}
            />
            {load.overloaded && <p dir="auto">{t('ui.theDayIsOverCapacityChooseFewer.2c6f2f')}</p>}
            {load.unknownTasks > 0 && (
              <p dir="auto">
                {formatNumber(load.unknownTasks, t('en', 'ar'))}{' '}
                {t('ui.tasksStillNeedTimeEstimates.62e042')}
              </p>
            )}
          </div>
          <div className="dialog-actions">
            <Button disabled={busy} onClick={() => void review()}>
              {t(
                `Start my day (${localizedNumber(eligibleChosen.length, t('en', 'ar'))}/${localizedNumber(3, t('en', 'ar'))})`,
                `ابدأ يومي (${localizedNumber(eligibleChosen.length, t('en', 'ar'))}/${localizedNumber(3, t('en', 'ar'))})`,
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setManual(false);
                setJourney((old) => ({ ...old, morningReviewedOn: today }));
              }}
            >
              {t('ui.laterToday.6771e5')}
            </Button>
          </div>
        </>
      )}
      {overdue.length > 0 && (
        <details>
          <summary>
            {t('ui.decideOnOverdueTasks.5a2cd5')} · {formatNumber(overdue.length, t('en', 'ar'))}
          </summary>
          {overdue.map((task) => (
            <div className="overdue-choice" key={task.id}>
              <strong dir="auto">{task.title}</strong>
              <div>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => void decide(task.id, 'today')}
                >
                  {t('ui.today.448511')}
                </Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => {
                    setDefer(task.id);
                    setDeferDate(nextDay(today));
                  }}
                >
                  {t('ui.defer.6a5938')}
                </Button>
                <Button
                  disabled={busy}
                  variant="ghost"
                  onClick={() => void decide(task.id, 'cancel')}
                >
                  {t('ui.cancelTask.a92d32')}
                </Button>
              </div>
              {defer === task.id && (
                <label>
                  {t('ui.reviewAndExecutionDate.824afb')}
                  <DateTimeInput
                    aria-label={t('ui.deferredTaskDate.3296b7')}
                    type="date"
                    min={nextDay(today)}
                    value={deferDate}
                    onInput={(e) => setDeferDate(e.currentTarget.value)}
                    onChange={(e) => setDeferDate(e.target.value)}
                  />
                  <Button disabled={busy} onClick={() => void decide(task.id, 'defer')}>
                    {t('ui.confirmDefer.e68655')}
                  </Button>
                </label>
              )}
            </div>
          ))}
        </details>
      )}
      <nav className="cycle-links" aria-label={t('ui.dailyCycleNavigation.4c2302')}>
        <a href="#daily-focus">{t('ui.startFocus.98a925')}</a>
        <a href="#daily-review">{t('ui.eveningReview.fc70ce')}</a>
        <Link to="/planner?tab=week&review=1">{t('ui.weeklyReview.d0d31a')}</Link>
        {!journey.onboardingComplete && (
          <Button
            variant="ghost"
            onClick={() => window.dispatchEvent(new Event('dailgo-onboarding'))}
          >
            {t('ui.setUpMyStartingPlan.8c1189')}
          </Button>
        )}
      </nav>
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
