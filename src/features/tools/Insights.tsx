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
      <h2 dir="auto">{t('Progress and focus insights', 'إحصائيات التقدم والتركيز')}</h2>
      <label>
        {t('Statistics range', 'فترة الإحصائيات')}
        <select
          aria-label={t('Statistics range', 'فترة الإحصائيات')}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>{t('Last 7 days', 'آخر ٧ أيام')}</option>
          <option value={30} disabled={!advanced}>
            {t('Last 30 days', 'آخر ٣٠ يومًا')}
          </option>
        </select>
      </label>
      {!advanced && (
        <p dir="auto">
          {t(
            '30-day insights are included in Pro. Your 7-day view and data export remain available.',
            'إحصائيات ٣٠ يومًا ضمن Pro. عرض ٧ أيام وتصدير بياناتك متاحان.',
          )}
        </p>
      )}
      <p dir="auto">
        {formatCalendarDate(start, t('en', 'ar'))} — {formatCalendarDate(end, t('en', 'ar'))}
      </p>
      <div className="insight-stats">
        <div>
          <strong dir="auto">{formatNumber(completions.length, t('en', 'ar'))}</strong>
          {t('recorded task completions', 'إنجازات مهام مسجلة')}
        </div>
        <div>
          <strong dir="auto">{formatNumber(Math.round(seconds / 60), t('en', 'ar'))}</strong>
          {t('recorded focus minutes', 'دقائق تركيز مسجلة')}
        </div>
        <div>
          <strong dir="auto">
            {formatNumber(
              new Set(completions.map((x) => localDate(new Date(x.completedAt!)))).size,
              t('en', 'ar'),
            )}
          </strong>
          {t('days with a completion', 'أيام فيها إنجاز')}
        </div>
      </div>
      <h3 dir="auto">{t('Recorded activity by life area', 'النشاط المسجل حسب مجال الحياة')}</h3>
      <p dir="auto">
        {t(
          'Activity counts show what you recorded here, not a wellbeing score.',
          'الأعداد بتوضح اللي سجلته هنا، مش تقييم لجودة حياتك.',
        )}
      </p>
      {activity.map((x) => (
        <div className="insight-area" key={x.area}>
          <span>{areaLabel(x.area, t)}</span>
          <progress max={max} value={x.count} />
          <bdi>{formatNumber(x.count, t('en', 'ar'))}</bdi>
        </div>
      ))}
      <h3 dir="auto">{t('Habit streaks', 'استمرارية العادات')}</h3>
      <p dir="auto">
        {t(
          'A streak counts consecutive scheduled check-ins. Rest days do not break it. Today can still be checked in.',
          'السلسلة بتعد التسجيلات المتتالية في الأيام المجدولة. أيام الراحة لا تقطعها، ولسه تقدر تسجل النهارده.',
        )}
      </p>
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
        <p dir="auto">
          {t(
            'Create one routine in Planner to start tracking consistency.',
            'أنشئ روتينًا في المخطط عشان تتابع الاستمرارية.',
          )}
        </p>
      )}
    </section>
  );
}
