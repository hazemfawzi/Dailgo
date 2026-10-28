import { formatNumber as localizedNumber } from '../../i18n/format';
import { Link, useParams } from 'react-router-dom';
import { TaskBoard } from '../tasks/TaskBoard';
import { Button } from '../../components/ui/button';
import { History } from '../../components/History';
import { EntryCollection } from '../../components/EntryCollection';
import { projectStats, replaceProjectTasks } from './projectModel';
import type { Entry, EntrySetter, Translate } from '../../lib/workspace';
import type { Task } from '../tasks/model';
import type { Dispatch, SetStateAction } from 'react';
export function ProjectScreen({
  entries,
  setEntries,
  tasks,
  setTasks,
  edit,
  setRemove,
  t,
}: {
  entries: Entry[];
  setEntries: EntrySetter;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  edit: (task?: Task) => void;
  setRemove: Dispatch<SetStateAction<Task | null>>;
  t: Translate;
}) {
  const { projectId } = useParams();
  const project = entries.find((x) => x.kind === 'project' && x.id === projectId);
  if (!project)
    return (
      <section className="card scope-page">
        <h1 dir="auto">{t('ui.projectNoLongerAvailable.7f22c1')}</h1>
        <Link to="/life">{t('ui.backToMyLife.a5a86d')}</Link>
      </section>
    );
  const stats = projectStats(tasks, project.id);
  const parent = entries.find((x) => x.id === project.parentGoalId && x.kind === 'goal');
  const related = entries.filter((x) => x.id === project.id || x.kind === 'goal');
  const addTask = () =>
    edit({
      id: crypto.randomUUID(),
      title: '',
      category: project.area,
      done: false,
      archived: false,
      projectId: project.id,
      goalId: project.parentGoalId,
      context: project.context,
    });
  return (
    <>
      <Link to="/life">← {t('ui.myLife.907c1a')}</Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {t('ui.project.3a5c5e')}
            {project.archived ? ' · ' + t('ui.archived.799523') : ''}
          </div>
          <h1 dir="auto">{project.title}</h1>
          <p dir="auto">{project.context}</p>
        </div>
        <Button onClick={addTask}>{t('ui.addProjectTask.baac63')}</Button>
      </div>
      {parent && (
        <p dir="auto">
          {t('ui.supportsGoal.ae6cd5')}: <Link to={`/life/${parent.id}`}>{parent.title}</Link>
        </p>
      )}
      <p dir="auto">
        {localizedNumber(stats.done, t('en', 'ar'))}/{localizedNumber(stats.total, t('en', 'ar'))} ·{' '}
        {localizedNumber(stats.progress, t('en', 'ar'))}%{' '}
        {t('ui.taskCompletionOutcomeIsReviewedSeparately.c0ce6a')}
      </p>
      <EntryCollection
        allowCreate={false}
        entries={related}
        {...{ setEntries, t }}
        kinds={['project']}
        title={t('ui.projectBriefAndSuccessCriteria.5a50d0')}
        empty=""
      />
      <History item={project} t={t} />
      <TaskBoard
        t={t}
        edit={(task) => (task ? edit(task) : addTask())}
        setRemove={setRemove}
        tasks={tasks.filter((x) => x.projectId === project.id)}
        setTasks={(change) =>
          setTasks((old) =>
            replaceProjectTasks(
              old,
              project.id,
              typeof change === 'function'
                ? change(old.filter((x) => x.projectId === project.id))
                : change,
            ),
          )
        }
      />
    </>
  );
}
