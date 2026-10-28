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
      <strong dir="auto">{t('ui.appointmentsOverlap.2a5cbd')}</strong>
      {conflicts.map(({ a, b, minutes, estimated }) => (
        <p dir="auto" key={`${a.id}-${b.id}`}>
          {a.title} ↔ {b.title} · {localizedNumber(minutes, t('en', 'ar'))} {t('ui.min.bea689')}
          {estimated ? ` · ${t('ui.estimatedDuration.43796c')}` : ''}
        </p>
      ))}
      <Link to={`/planner?tab=calendar&date=${date}`}>
        {t('ui.reviewAndEditAppointments.54a95b')}
      </Link>
    </section>
  ) : null;
}
