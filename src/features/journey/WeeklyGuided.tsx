import { formatNumber as localizedNumber } from '../../i18n/format';
import { formatCalendarDate, formatNumber } from '../../i18n/format';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStorageState, transactData } from '../../lib/storage';
import { Button } from '../../components/ui/button';
import { areaLabel } from '../../lib/workspace';
import type { Area, Translate } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import { goalStats } from '../life/goalModel';
import { nextDay, saveWeeklyResults, weeklyActivity, workspaceEntries } from './model';
export function WeeklyGuided({ start, t }: { start: string; t: Translate }) {
  const { data } = useStorageState();
  const [step, setStep] = useState(0);
  const [params] = useSearchParams();
  const section = useRef<HTMLElement>(null);
  const next = nextDay(start, 7);
  const plans = data['personal-os.weeks.v1'] as Record<string, any> | undefined;
  const old = plans?.[next];
  const expected = useRef(JSON.stringify(old ?? null));
  const goals = workspaceEntries(data).filter((goal) => goal.kind === 'goal');
  const tasks = (data['personal-os.tasks.v1'] ?? []) as Task[];
  const [outcomes, setOutcomes] = useState<{ title: string; goalId: string; criteria: string }[]>(
    () =>
      Array.from({ length: 3 }, (_, i) => ({
        title: old?.outcomes?.[i]?.title ?? '',
        goalId: old?.outcomes?.[i]?.goalId ?? '',
        criteria: old?.outcomes?.[i]?.criteria ?? '',
      })),
  );
  const [area, setArea] = useState<Area | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (params.get('review') === '1') {
      const frame = requestAnimationFrame(() =>
        section.current?.scrollIntoView({ block: 'start' }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [start, params.get('review')]);
  const activity = weeklyActivity(data, start);
  const maximum = Math.max(1, ...activity.map((item) => item.count));
  const point = (index: number, radius: number) => {
    const angle = ((index * 60 - 90) * Math.PI) / 180;
    return [160 + Math.cos(angle) * radius, 130 + Math.sin(angle) * radius];
  };
  const points = activity
    .map((item, i) => point(i, (80 * item.count) / maximum).join(','))
    .join(' ');
  const minimum = Math.min(...activity.map((item) => item.count));
  return (
    <section id="weekly-review" ref={section} className="card guided-weekly">
      <h3 dir="auto">{t('ui.weeklyReviewConnectYourDaysToYour.8ff9bc')}</h3>
      <p dir="auto">{t('ui.reviewProgressNoticeWhereActivityWasRecorded.ca1002')}</p>
      <ol className="week-review-steps" aria-label={t('ui.weeklyReviewSteps.b1476f')}>
        {[t('ui.goalProgress.945265'), t('ui.lifeBalance.a56682'), t('ui.nextWeek.a3ae34')].map(
          (label, index) => (
            <li key={index}>
              <Button
                variant="outline"
                aria-current={step === index ? 'step' : undefined}
                onClick={() => setStep(index)}
              >
                {label}
              </Button>
            </li>
          ),
        )}
      </ol>
      <figure className="life-wheel" hidden={step !== 1}>
        <svg
          viewBox="0 0 320 260"
          role="img"
          aria-label={t('ui.lifeAreasRecordedActivityRadar.345b82')}
        >
          <title>{t('ui.recordedActivityAcrossSixLifeAreas.48a827')}</title>
          {[40, 80].map((radius) => (
            <polygon
              key={radius}
              points={activity.map((_, i) => point(i, radius).join(',')).join(' ')}
              fill="none"
              stroke="var(--border)"
            />
          ))}
          {activity.map((item, i) => {
            const end = point(i, 80);
            const label = point(i, 111);
            return (
              <g key={item.area}>
                <line x1={160} y1={130} x2={end[0]} y2={end[1]} stroke="var(--border)" />
                <text
                  x={label[0]}
                  y={label[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--text)"
                  fontSize={13}
                >
                  {areaLabel(item.area, t)}
                </text>
              </g>
            );
          })}
          <polygon points={points} fill="var(--soft)" stroke="var(--purple)" strokeWidth={2} />
          {activity.map((item, i) => {
            const dot = point(i, (80 * item.count) / maximum);
            return (
              <circle key={item.area} cx={dot[0]} cy={dot[1]} r={4} fill="var(--purple)">
                <title>
                  {areaLabel(item.area, t)}: {localizedNumber(item.count, t('en', 'ar'))}
                </title>
              </circle>
            );
          })}
        </svg>
        <figcaption>{t('ui.countsOfRecordedTaskCompletionsRoutineCheck.da910b')}</figcaption>
      </figure>
      <div className="area-activity" hidden={step !== 1}>
        {activity.map((item) => (
          <button
            key={item.area}
            aria-pressed={area === item.area}
            onClick={() => setArea(area === item.area ? null : item.area)}
          >
            {areaLabel(item.area, t)} · {formatNumber(item.count, t('en', 'ar'))}
          </button>
        ))}
      </div>
      <p dir="auto" className="muted" hidden={step !== 1}>
        {t('ui.leastRecordedActivityThisWeek.4ec8e3')}:{' '}
        {activity
          .filter((item) => item.count === minimum)
          .map((item) => areaLabel(item.area, t))
          .join('، ')}
        . {t('ui.activityOutsideThisAppIsNotMeasured.d62289')}
      </p>
      <div className="weekly-goal-progress" hidden={step !== 0}>
        {goals
          .filter((goal) => !area || goal.area === area)
          .map((goal) => {
            const stats = goalStats(tasks, goal.id);
            return (
              <Link key={goal.id} to={`/life/${goal.id}`}>
                <strong dir="auto">{goal.title}</strong>
                <span>
                  {formatNumber(stats.done, t('en', 'ar'))}/
                  {formatNumber(stats.total, t('en', 'ar'))} ·{' '}
                  {formatNumber(stats.progress, t('en', 'ar'))}%
                  {goal.archived ? ' · ' + t('ui.archived.799523') : ''}
                </span>
                <progress value={stats.progress} max={100} />
              </Link>
            );
          })}
        {!goals.length && (
          <p dir="auto">
            {t('ui.addOneGoalToConnectNextWeek.51c05f')}{' '}
            <Link to="/life">{t('ui.createAGoal.4b05b9')}</Link>
          </p>
        )}
      </div>
      <div hidden={step !== 2}>
        <h4 dir="auto">
          {t('ui.chooseThreeResultsForNextWeek.e02712')} ·{' '}
          <bdi>{formatCalendarDate(next, t('en', 'ar'))}</bdi>
        </h4>
        {outcomes.map((outcome, index) => (
          <div className="next-week-outcome editor-form" key={index}>
            <label>
              {t(
                `Next week result ${localizedNumber(index + 1, t('en', 'ar'))}`,
                `نتيجة الأسبوع القادم ${localizedNumber(index + 1, t('en', 'ar'))}`,
              )}
              <input
                dir="auto"
                maxLength={160}
                value={outcome.title}
                onChange={(e) =>
                  setOutcomes((old) =>
                    old.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                  )
                }
              />
            </label>
            <label>
              {t('ui.linkedGoal.2bb775')}
              <select
                value={outcome.goalId}
                onChange={(e) =>
                  setOutcomes((old) =>
                    old.map((item, i) =>
                      i === index ? { ...item, goalId: e.target.value } : item,
                    ),
                  )
                }
              >
                <option value="">{t('ui.noGoal.4e6d38')}</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('ui.completionCriterion.246c1d')}
              <input
                dir="auto"
                maxLength={500}
                value={outcome.criteria}
                onChange={(e) =>
                  setOutcomes((old) =>
                    old.map((item, i) =>
                      i === index ? { ...item, criteria: e.target.value } : item,
                    ),
                  )
                }
              />
            </label>
          </div>
        ))}
        <p dir="auto" className="muted">
          {t('ui.thisUpdatesTheFirstThreeResultsFor.849513')}
        </p>
        <Button
          disabled={busy || outcomes.some((item) => !item.title.trim())}
          onClick={async () => {
            setBusy(true);
            let savedNext: unknown;
            const ok = await transactData((current) => {
              const changed = saveWeeklyResults(current, start, outcomes, expected.current);
              savedNext = (changed['personal-os.weeks.v1'] as Record<string, unknown>)[next];
              return changed;
            });
            setBusy(false);
            if (ok) expected.current = JSON.stringify(savedNext);
            setNotice(
              ok
                ? t('ui.nextWeekSResultsAreSavedOpen.b336cd')
                : t('ui.theNextWeekPlanChangedOrCould.776384'),
            );
          }}
        >
          {t('ui.saveThreeResultsForNextWeek.5025b0')}
        </Button>
      </div>
      <div className="dialog-actions">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            {t('ui.back.436170')}
          </Button>
        )}
        {step < 2 && (
          <Button onClick={() => setStep(step + 1)}>{t('ui.nextReviewStep.60ee5d')}</Button>
        )}
      </div>
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
