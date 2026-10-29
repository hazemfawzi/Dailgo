import { lazyView } from '../../lib/lazyView';
import { Suspense } from 'react';
import { defaultPrayer, routineStreak } from '../tools/model';
const PrayerBreaks = lazyView(() =>
  import('../tools/PrayerPanel').then((module) => ({ default: module.PrayerPanel })),
);
import {
  formatCalendarDate as localizedDate,
  formatTime as localizedTime,
} from '../../i18n/format';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { formatNumber, formatCalendarDate, counted, formatClockPart } from '../../i18n/format';
import { DailyCycle } from '../journey/DailyCycle';
import { useJourney } from '../journey/useJourney';
import { storageText } from '../../i18n/messages';
import { tasksOnDate, taskDateLabels } from '../planner/taskDates';
import { calendarDate } from '../planner/calendarModel';
import { MyDay } from './MyDay';
import { TrialReview } from '../review/TrialReview';
import { FocusTimer } from './FocusTimer';
import { DailyReview } from '../review/DailyReview';
import { NeedsAttention, SuggestionNote, useSuggestionDismissals } from './Suggestions';
import { usePlanning } from '../../lib/preferences';
import { routineDue } from '../planner/scheduling';
import { ConflictNotice } from '../planner/ConflictNotice';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowUp,
  ArrowUpRight,
  Plus,
  Check,
  Clock3,
  CalendarDays,
  ArrowRight,
  Target,
  Repeat2,
  Play,
  Pause,
  RotateCcw,
  Flag,
  CheckCheck,
  Sunrise,
  Pin,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../components/ui/button';
import { usePersisted } from '../../lib/storage';
import { localDate, areaLabel } from '../../lib/workspace';
import type { Area, Entry, EntrySetter, Translate } from '../../lib/workspace';
import { isActionable, rankTasks, isOverdue, priorityOf, priorityLabel } from '../tasks/model';
import type { Task } from '../tasks/model';
export type { Task } from '../tasks/model';
export type SampleEvent = {
  time: string;
  end: string;
  title: string;
  detail: string;
  color: string;
};
type Props = {
  t: Translate;
  ar: boolean;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  entries: Entry[];
  setEntries: EntrySetter;
  edit: (task?: Task) => void;
  propose: (text: string) => void;
};
export function HomeScreen({ t, ar, tasks, setTasks, entries, setEntries, edit, propose }: Props) {
  const [prayer] = usePersisted('personal-os.prayer.v1', defaultPrayer);
  const [journey] = useJourney();
  const [dismissed, setDismissed] = useSuggestionDismissals();
  const [settings] = usePlanning();
  const [prompt, setPrompt] = useState('');
  const today = localDate();
  const [selectedDay, setSelectedDay] = useState(today);
  const active = tasks.filter((x) => !x.archived && x.status !== 'cancelled');
  const open = active.filter(isActionable);
  const done = active.filter((x) => x.done).length;
  const due = open.filter((x) => x.dueDate === today);
  const overdue = open.filter(isOverdue);
  const selectedFocus =
    journey.focusDate === today
      ? journey.focusIds
          .map((id) => open.find((task) => task.id === id))
          .filter((task): task is Task => !!task)
      : [];
  const focus = (
    journey.focusDate === today
      ? selectedFocus
      : rankTasks(open.filter((x) => dismissed[x.id] !== today))
  ).slice(0, 3);
  const routines = entries.filter(
    (x) => x.kind === 'routine' && !x.archived && routineDue(x, today),
  );
  const routineDone = routines.filter((x) => x.doneDates.includes(today)).length;
  const goals = entries.filter((x) => x.kind === 'goal' && !x.archived).slice(0, 2);
  const events = entries
    .filter((x) => x.kind === 'event' && !x.archived && x.date === selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));
  const plannedTasks = tasksOnDate(tasks, selectedDay);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - ((date.getDay() - settings.weekStartsOn + 7) % 7) + i);
    return date;
  });
  const percent = active.length ? Math.round((done / active.length) * 100) : 0;
  const stats = [
    {
      label: t('ui.openTasks.db9693'),
      value: open.length,
      sub: t('ui.yourNextSteps.17745e'),
      icon: CheckCheck,
      path: '/planner',
    },
    {
      label: t('ui.dueToday.6c50f4'),
      value: due.length,
      sub: t('ui.aLittleAttentionToday.87731e'),
      icon: CalendarDays,
      path: '/planner?filter=today',
    },
    {
      label: t('ui.overdue.2463f8'),
      value: overdue.length,
      sub: t('ui.aChanceToReplan.c7fcee'),
      icon: Flag,
      path: '/planner?filter=overdue',
    },
    {
      label: t('ui.dailyRituals.855025'),
      value: `${formatNumber(routineDone, t('en', 'ar'))}/${formatNumber(routines.length, t('en', 'ar'))}`,
      sub: t('ui.smallThingsAddUp.717410'),
      icon: Repeat2,
      path: '/planner?tab=routines',
    },
  ];
  return (
    <div className="home-v2 core-home">
      <div className="home-heading">
        <div>
          <div className="eyebrow">
            <Sunrise size={15} />
            {formatCalendarDate(today, t('en', 'ar'), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>
          <h1 dir="auto">{t('ui.todaySPlan.1d53ee')}</h1>
          <p dir="auto">{t('ui.everythingThatMattersBroughtALittleCloser.2d87cb')}</p>
        </div>
        <div className="home-heading-actions">
          <Button asChild variant="outline">
            <Link to="/planner?tab=week">
              <CalendarDays size={16} />
              {t('ui.planMyWeek.d6ffa7')}
            </Link>
          </Button>
          <Button className="home-new-task" onClick={() => edit()}>
            <Plus size={17} />
            {t('ui.newTask.02b6c9')}
          </Button>
        </div>
      </div>
      <section className="home-assistant-bar">
        <span className="assistant-icon">
          <Sparkles size={21} />
        </span>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            propose(prompt);
            setPrompt('');
          }}
        >
          <input
            dir="auto"
            aria-label={t('ui.askYourAssistant.d22cbb')}
            maxLength={1000}
            placeholder={t('ui.sayWhatIsOnYourMind.ad06c6')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Button size="icon" disabled={!prompt.trim()} aria-label={t('ui.sendToAssistant.2849f7')}>
            <ArrowUp size={18} />
          </Button>
        </form>
        <div className="home-assistant-shortcuts">
          <button onClick={() => propose(t('ui.showMyMemories.962543'))}>
            {t('ui.recallAMemory.c3ea12')}
            <ArrowUpRight size={12} />
          </button>
          <button onClick={() => propose(t('ui.taskTakeAShortBreak.35be98'))}>
            {t('ui.makeRoomForABreak.c17aaa')}
            <ArrowUpRight size={12} />
          </button>
        </div>
      </section>
      {new Intl.DateTimeFormat('en-GB', {
        timeZone: settings.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date()) >= journey.eveningTime &&
        journey.eveningReviewedOn !== today && (
          <aside className="evening-reminder" role="status">
            <strong>{t('ui.twoMinutesForYourEveningReview.dbcb89')}</strong>
            <a href="#daily-review">{t('ui.openEveningReview.9ee03c')}</a>
          </aside>
        )}
      {prayer.enabled && (
        <Suspense fallback={null}>
          <PrayerBreaks t={t} compact />
        </Suspense>
      )}
      <div className="home-content-grid">
        <div className="home-main-column">
          <section className="card home-focus-list">
            <div className="home-section-title">
              <div>
                <div className="eyebrow">{t('ui.lessButMeaningful.da1b68')}</div>
                <h3 dir="auto">{t('ui.yourNextThreeSteps.66ff72')}</h3>
              </div>
              <Link to="/planner">
                {t('ui.allTasks.25807e')}
                <ArrowUpRight size={15} />
              </Link>
            </div>
            {focus.map((task, i) => (
              <div className="home-focus-task" key={task.id}>
                <span className="focus-index">{formatClockPart(i + 1, t('en', 'ar'))}</span>
                <button
                  className="checkbox"
                  aria-label={`${t('ui.complete.e721b1')}: ${task.title}`}
                  onClick={() =>
                    setTasks((old) =>
                      old.map((x) => (x.id === task.id ? { ...x, done: true, status: 'done' } : x)),
                    )
                  }
                >
                  <Check size={12} />
                </button>
                <div>
                  <button className="task-title-button" onClick={() => edit(task)}>
                    {task.title}
                  </button>
                  <details className="task-reason">
                    <summary>{t('ui.whyThisStep.ddeffe')}</summary>{' '}
                    <SuggestionNote
                      task={task}
                      t={t}
                      onDismiss={() => setDismissed((old) => ({ ...old, [task.id]: today }))}
                    />
                  </details>
                  <div className="task-badges">
                    <span>{areaLabel(task.category as Area, t)}</span>
                    <span className={`priority-badge ${priorityOf(task)}`}>
                      {priorityLabel(priorityOf(task), t)}
                    </span>
                    {task.dueDate && (
                      <span className={isOverdue(task) ? 'overdue-text' : ''}>
                        {formatCalendarDate(task.dueDate, t('en', 'ar'))}
                      </span>
                    )}
                    {!!task.estimate && (
                      <span>
                        <Clock3 size={11} />
                        {localizedNumber(task.estimate, t('en', 'ar'))} {t('ui.min.bea689')}
                      </span>
                    )}
                    {task.pinned && <Pin size={11} />}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${t('ui.edit.c554f4')}: ${task.title}`}
                  onClick={() => edit(task)}
                >
                  <ArrowUpRight size={16} />
                </Button>
              </div>
            ))}
            {!focus.length && (
              <div className="home-empty">
                <CheckCheck size={27} />
                <p dir="auto">
                  {journey.focusDate === today && open.length
                    ? t('ui.noFocusTasksSelectedReviewYourMorning.5b581f')
                    : t('ui.noOpenTasksYetAddOneClear.ec45f0')}
                </p>
              </div>
            )}
            <button className="home-add-task" onClick={() => edit()}>
              <Plus size={16} />
              {t('ui.addYourNextStep.292149')}
            </button>
          </section>
          <section className="card home-agenda">
            <div className="home-section-title">
              <div>
                <div className="eyebrow">{t('ui.aLittleRhythm.587182')}</div>
                <h3 dir="auto">{t('ui.appointmentsAndPlannedTasks.8ddd6c')}</h3>
              </div>
              <Link to={`/planner?tab=calendar&date=${selectedDay}`}>
                {t('ui.calendar.33a4a9')}
                <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="home-week">
              {week.map((date) => {
                const value = calendarDate(date);
                return (
                  <button
                    key={value}
                    aria-pressed={selectedDay === value}
                    className={selectedDay === value ? 'selected' : ''}
                    onClick={() => setSelectedDay(value)}
                  >
                    <small>{formatCalendarDate(value, t('en', 'ar'), { weekday: 'short' })}</small>
                    <strong dir="auto">{formatNumber(date.getDate(), t('en', 'ar'))}</strong>
                    <span
                      className={
                        entries.some(
                          (x) => x.kind === 'event' && !x.archived && x.date === value,
                        ) || tasksOnDate(tasks, value).length > 0
                          ? 'has-event'
                          : ''
                      }
                    />
                  </button>
                );
              })}
            </div>
            <ConflictNotice entries={entries} date={selectedDay} t={t} />
            <div className="home-agenda-events">
              {events.map((event) => (
                <Link to={`/planner?tab=calendar&date=${selectedDay}`} key={event.id}>
                  <time dir="ltr">{localizedTime(event.time, t('en', 'ar'))}</time>
                  <span className="agenda-stem" />
                  <div>
                    <strong dir="auto">{event.title}</strong>
                    <small>{areaLabel(event.area, t)}</small>
                  </div>
                  <ArrowUpRight size={14} />
                </Link>
              ))}
              {plannedTasks.map((task) => (
                <Link
                  className="home-planned-task"
                  to={`/planner?tab=week&week=${selectedDay}`}
                  key={task.id}
                >
                  {taskDateLabels(task, selectedDay).planned && task.plannedTime && (
                    <time dir="ltr">{localizedTime(task.plannedTime, t('en', 'ar'))}</time>
                  )}
                  <span className="agenda-stem" />
                  <div>
                    <strong dir="auto">{task.title}</strong>
                    <small>
                      {taskDateLabels(task, selectedDay).planned
                        ? t('ui.executionDay.51f86f')
                        : t('ui.dueDate.3146bb')}
                      {taskDateLabels(task, selectedDay).planned &&
                      taskDateLabels(task, selectedDay).due
                        ? ' · ' + t('ui.dueDate.3146bb')
                        : ''}
                      {task.estimate
                        ? ` · ${formatNumber(task.estimate, t('en', 'ar'))} ${t('ui.min.bea689')}`
                        : ''}{' '}
                      · {task.done ? t('ui.completed.bba94f') : t('ui.open.ec80f4')}
                    </small>
                  </div>
                  <ArrowUpRight size={14} />
                </Link>
              ))}
              {!events.length && !plannedTasks.length && (
                <div className="home-empty">
                  <CalendarDays size={25} />
                  <p dir="auto">{t('ui.noAppointmentsOrTasksPlannedForThis.946595')}</p>
                  <Link to={`/planner?tab=calendar&date=${selectedDay}`}>
                    {t('ui.planSomethingMeaningful.35adca')}
                    <Plus size={14} />
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      <details className="home-secondary" data-home-section="planning">
        <summary>{t('home.planning.title')}</summary>{' '}
        <DailyCycle tasks={tasks} entries={entries} settings={settings} t={t} />
        <MyDay tasks={tasks} entries={entries} t={t} edit={edit} />
      </details>
      <details className="home-secondary" data-home-section="focus">
        <summary>{t('home.focus.title')}</summary>{' '}
        <div className="home-side-column">
          <FocusTimer t={t} tasks={tasks} />
          <NeedsAttention tasks={tasks} t={t} edit={edit} />
          <section className="card home-routines">
            <div className="home-section-title">
              <h3 dir="auto">{t('ui.dailyRoutines.7c227d')}</h3>
              <Repeat2 size={17} />
            </div>
            {routines.slice(0, 4).map((routine) => (
              <button
                className="home-routine"
                key={routine.id}
                aria-pressed={routine.doneDates.includes(today)}
                onClick={() =>
                  setEntries((old) =>
                    old.map((x) =>
                      x.id === routine.id
                        ? {
                            ...x,
                            doneDates: x.doneDates.includes(today)
                              ? x.doneDates.filter((d) => d !== today)
                              : [...x.doneDates, today],
                          }
                        : x,
                    ),
                  )
                }
              >
                <span className={`checkbox ${routine.doneDates.includes(today) ? 'checked' : ''}`}>
                  {routine.doneDates.includes(today) && <Check size={12} />}
                </span>
                <span>{routine.title}</span>
                <small>
                  {localizedTime(routine.time, t('en', 'ar'))} · 🔥{' '}
                  {counted(
                    routineStreak(routine.doneDates, routine.routineDays, today),
                    'day',
                    t('en', 'ar'),
                  )}
                </small>
              </button>
            ))}
            {!routines.length && (
              <p dir="auto" className="muted">
                {t('ui.buildASmallHabitYouCanReturn.4d558a')}
              </p>
            )}
            <Link className="home-section-link" to="/planner?tab=routines">
              {t('ui.manageRoutines.1a5ed2')}
              <ArrowRight size={14} />
            </Link>
          </section>
          <section className="card home-goals">
            <div className="home-section-title">
              <h3 dir="auto">{t('ui.theBiggerPicture.f2039f')}</h3>
              <Target size={17} />
            </div>
            {goals.map((goal) => (
              <Link className="home-goal" key={goal.id} to={`/life/${goal.id}`}>
                <div>
                  <strong dir="auto">{goal.title}</strong>
                  <span>{localizedNumber(goal.progress, t('en', 'ar'))}%</span>
                </div>
                <progress value={goal.progress} max={100} />
              </Link>
            ))}
            {!goals.length && (
              <p dir="auto" className="muted">
                {t('ui.giveYourNextAmbitionAHome.d80a96')}
              </p>
            )}
            <Link className="home-section-link" to="/life">
              {t('ui.exploreMyLife.4ae1e8')}
              <ArrowRight size={14} />
            </Link>
          </section>
        </div>
      </details>
      <details className="home-secondary home-overview">
        <summary>{t('home.overview.title')}</summary>
        <section className="daily-hero">
          <div className="hero-content">
            <span className="hero-kicker">
              <span />
              {t('ui.yourDailyPerspective.f59752')}
            </span>
            <h2 dir="auto">
              {overdue.length
                ? t('ui.aFreshStartIsAlwaysAnOption.203482')
                : t('ui.makeSpaceForWhatMovesYouForward.7d6ad4')}
            </h2>
            <p dir="auto">
              {t(
                `${localizedNumber(open.length, t('en', 'ar'))} open tasks, ${localizedNumber(due.length, t('en', 'ar'))} due today. Choose one meaningful step and give it your attention.`,
                `${localizedNumber(open.length, t('en', 'ar'))} مهام مفتوحة، منها ${localizedNumber(due.length, t('en', 'ar'))} تسليمها اليوم. اختار خطوة مهمة واديها تركيزك.`,
              )}
            </p>
            <Button onClick={() => propose(t('ui.planMyDay.fec857'))}>
              <Sparkles size={16} />
              {t('ui.planMyDayWithMe.9669ca')}
              <ArrowUpRight size={15} />
            </Button>
            <span className="hero-disclaimer">
              {t('ui.ruleBasedAssistantReviewBeforeConfirming.9b6935')}
            </span>
          </div>
          <div className="hero-progress">
            <div
              className="progress-orbit"
              style={{ background: `conic-gradient(#c9dfb8 ${percent}%,#ffffff17 0)` }}
            >
              <div>
                <span>
                  {formatNumber(percent, t('en', 'ar'))}
                  <small>%</small>
                </span>
                <p dir="auto">{t('ui.ofActiveTasksDone.fcfc42')}</p>
              </div>
            </div>
            <span>
              <CheckCheck size={14} />
              {formatNumber(done, t('en', 'ar'))} {t('ui.completed.ff1564')} ·{' '}
              {formatNumber(active.length, t('en', 'ar'))} {t('ui.total.c1e5a5')}
            </span>
          </div>
        </section>
      </details>
      <details className="home-secondary">
        <summary>{t('home.progress.title')}</summary>
        <div className="home-stats">
          {stats.map((stat) => (
            <Link className="card stat-card" to={stat.path} key={stat.path}>
              <div>
                <span>{stat.label}</span>
                <stat.icon size={17} />
              </div>
              <strong dir="auto">
                {typeof stat.value === 'number'
                  ? formatNumber(stat.value, t('en', 'ar'))
                  : stat.value}
              </strong>
              <small>
                {stat.sub}
                <ArrowUpRight size={13} />
              </small>
            </Link>
          ))}
        </div>
      </details>
      <details className="home-secondary" data-home-section="review">
        <summary>
          <span>{t('home.review.title')}</span>
          <small>
            {t(journey.eveningReviewedOn === today ? 'home.review.done' : 'home.review.pending')}
          </small>
        </summary>
        <DailyReview t={t} tasks={tasks} setTasks={setTasks} edit={edit} />
      </details>
      <details className="home-secondary" data-home-section="trial">
        <summary>{t('home.trial.title')}</summary>
        <TrialReview t={t} />
      </details>
      <footer className="home-footer">
        <span>{t('ui.shortcutsNNewTaskSearchFFocus.ca546e')}</span>
        <span>{storageText(t, 'saved')}</span>
      </footer>
    </div>
  );
}
