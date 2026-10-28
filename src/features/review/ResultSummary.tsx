import {
  formatCalendarDate as localizedDate,
  formatTime as localizedTime,
} from '../../i18n/format';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { Link } from 'react-router-dom';
import type { Task } from '../tasks/model';
import type { Translate } from '../../lib/workspace';
export function ResultSummary({
  tasks,
  start,
  end,
  t,
}: {
  tasks: Task[];
  start: string;
  end: string;
  t: Translate;
}) {
  const results = tasks
    .filter((x) => !x.archived && x.result?.note && x.result.date >= start && x.result.date <= end)
    .sort((a, b) => b.result!.date.localeCompare(a.result!.date));
  return (
    <section className="result-summary">
      <h3 dir="auto">
        {t('ui.recordedResults.acb1e6')} · {localizedNumber(results.length, t('en', 'ar'))}
      </h3>
      <p dir="auto" className="muted">
        {t('ui.yourOwnNotesTaskCompletionAndGoal.df70a0')}
      </p>
      {!results.length && (
        <p dir="auto" className="muted">
          {t('ui.noResultsRecordedForThisPeriodYet.7e4403')}
        </p>
      )}
      {results.map((task) => (
        <article key={task.id}>
          <div>
            <strong dir="auto">{task.title}</strong>
            <Link to={`/?day=${task.result!.date}`}>
              {localizedDate(task.result!.date, t('en', 'ar'))}
            </Link>
          </div>
          <p dir="auto">{task.result!.note}</p>
          <small>{task.done ? t('ui.taskComplete.fc4326') : t('ui.taskStillOpen.46fd08')}</small>
        </article>
      ))}
    </section>
  );
}
