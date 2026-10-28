import { formatNumber as localizedNumber } from '../../i18n/format';
import { Link } from 'react-router-dom';
import { eventConflicts } from './scheduling';
import type { Entry, Translate } from '../../lib/workspace';
export function ConflictNotice({
  entries,
  date,
  t,
}: {
  entries: Entry[];
  date: string;
  t: Translate;
}) {
  const conflicts = eventConflicts(entries, date);
  return conflicts.length ? (
    <section className="notice" role="status">
      <strong dir="auto">{t('Appointments overlap', 'فيه مواعيد متداخلة')}</strong>
      {conflicts.map(({ a, b, minutes, estimated }) => (
        <p dir="auto" key={`${a.id}-${b.id}`}>
          {a.title} ↔ {b.title} · {localizedNumber(minutes, t('en', 'ar'))} {t('min', 'د')}
          {estimated ? ` · ${t('estimated duration', 'مدة تقديرية')}` : ''}
        </p>
      ))}
      <Link to={`/planner?tab=calendar&date=${date}`}>
        {t('Review and edit appointments', 'راجع المواعيد وعدّل وقتها')}
      </Link>
    </section>
  ) : null;
}
