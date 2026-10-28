import { Link } from 'react-router-dom';
import { useStorageState, transactData } from '../../lib/storage';
import { localDate } from '../../lib/workspace';
import type { Translate } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import { isActionable } from '../tasks/model';
import { formatCalendarDate } from '../../i18n/format';
export function TodayView({ t }: { t: Translate }) {
  const { data } = useStorageState();
  const today = localDate();
  const tasks = ((data['personal-os.tasks.v1'] ?? []) as Task[]).filter(
    (task) =>
      isActionable(task) && (task.plannedDate === today || (task.dueDate && task.dueDate <= today)),
  );
  return (
    <section className="card tools-section today-compact">
      <h1 dir="auto">{t('ui.todayAtAGlance.3cb992')}</h1>
      <p dir="auto">{formatCalendarDate(today, t('en', 'ar'))}</p>
      {tasks.map((task) => (
        <button
          key={task.id}
          className="today-task"
          onClick={() =>
            void transactData((current) => ({
              ...current,
              'personal-os.tasks.v1': ((current['personal-os.tasks.v1'] ?? []) as Task[]).map(
                (item) =>
                  item.id === task.id && isActionable(item)
                    ? { ...item, done: true, status: 'done' }
                    : item,
              ),
            }))
          }
        >
          <span aria-hidden="true">○</span>
          <span dir="auto">{task.title}</span>
        </button>
      ))}
      {!tasks.length && <p dir="auto">{t('ui.noTasksNeedADecisionTodayOpen.25ecf9')}</p>}
      <Link to="/">{t('ui.openMyFullPlan.06ad85')}</Link>
    </section>
  );
}
