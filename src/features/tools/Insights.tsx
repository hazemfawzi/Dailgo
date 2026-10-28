import { apiRequest } from '../../lib/serverStorage';
import { useEffect, useState } from 'react';
import { useStorageState } from '../../lib/storage';
import { localDate, areas, areaLabel } from '../../lib/workspace';
import type { Translate } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import { formatNumber, formatCalendarDate, counted } from '../../i18n/format';
import { nextDay, weeklyActivity, workspaceEntries } from '../journey/model';
import { routineStreak } from './model';
export function Insights({ t }: { t: Translate }) {
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    void apiRequest('billing')
      .then((value) => setAdvanced(value.pro || value.betaAccess))
      .catch(() => {});
  }, []);
  const { data } = useStorageState();
  const [days, setDays] = useState(7);
  const end = localDate();
  const start = nextDay(end, 1 - days);
  const tasks = (data['personal-os.tasks.v1'] ?? []) as Task[];
  const sessions = (data['personal-os.sessions.v1'] ?? []) as {
    endedAt: string;
    seconds: number;
  }[];
  const completions = tasks.filter(
    (x) =>
      x.done &&
      x.completedAt &&
      localDate(new Date(x.completedAt)) >= start &&
      localDate(new Date(x.completedAt)) <= end,
  );
  const seconds = sessions
    .filter((x) => localDate(new Date(x.endedAt)) >= start && localDate(new Date(x.endedAt)) <= end)
    .reduce((sum, x) => sum + x.seconds, 0);
  const activity = weeklyActivity(data, start, end);
  const max = Math.max(1, ...activity.map((x) => x.count));
  const entries = workspaceEntries(data);
  return (
    <section className="card tools-section">
      <h2 dir="auto">{t('ui.progressAndFocusInsights.6c9274')}</h2>
      <label>
        {t('ui.statisticsRange.82301b')}
        <select
          aria-label={t('ui.statisticsRange.82301b')}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>{t('ui.last7Days.169e54')}</option>
          <option value={30} disabled={!advanced}>
            {t('ui.last30Days.4b8266')}
          </option>
        </select>
      </label>
      {!advanced && <p dir="auto">{t('ui.30DayInsightsAreIncludedInPro.ee405a')}</p>}
      <p dir="auto">
        {formatCalendarDate(start, t('en', 'ar'))} — {formatCalendarDate(end, t('en', 'ar'))}
      </p>
      <div className="insight-stats">
        <div>
          <strong dir="auto">{formatNumber(completions.length, t('en', 'ar'))}</strong>
          {t('ui.recordedTaskCompletions.cc4e24')}
        </div>
        <div>
          <strong dir="auto">{formatNumber(Math.round(seconds / 60), t('en', 'ar'))}</strong>
          {t('ui.recordedFocusMinutes.232bf3')}
        </div>
        <div>
          <strong dir="auto">
            {formatNumber(
              new Set(completions.map((x) => localDate(new Date(x.completedAt!)))).size,
              t('en', 'ar'),
            )}
          </strong>
          {t('ui.daysWithACompletion.628a37')}
        </div>
      </div>
      <h3 dir="auto">{t('ui.recordedActivityByLifeArea.dbb798')}</h3>
      <p dir="auto">{t('ui.activityCountsShowWhatYouRecordedHere.19aaec')}</p>
      {activity.map((x) => (
        <div className="insight-area" key={x.area}>
          <span>{areaLabel(x.area, t)}</span>
          <progress max={max} value={x.count} />
          <bdi>{formatNumber(x.count, t('en', 'ar'))}</bdi>
        </div>
      ))}
      <h3 dir="auto">{t('ui.habitStreaks.6aa1d9')}</h3>
      <p dir="auto">{t('ui.aStreakCountsConsecutiveScheduledCheckIns.bbfa74')}</p>
      {entries
        .filter((x) => x.kind === 'routine' && !x.archived)
        .map((routine) => (
          <p dir="auto" key={routine.id}>
            <bdi>{routine.title}</bdi> · 🔥{' '}
            {counted(
              routineStreak(routine.doneDates, routine.routineDays, end),
              'day',
              t('en', 'ar'),
            )}
          </p>
        ))}
      {!entries.some((x) => x.kind === 'routine' && !x.archived) && (
        <p dir="auto">{t('ui.createOneRoutineInPlannerToStart.0a222d')}</p>
      )}
    </section>
  );
}
