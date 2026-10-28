import { formatCalendarDate, formatNumber } from '../../i18n/format';
import { GoalDateReview } from './GoalDateReview';
import { closeGoal } from './goalModel';
import { transactData } from '../../lib/storage';
import { milestoneDateIssue } from './goalDates';
import { saveEntryDraft } from '../../lib/entryPersistence';
import { History } from '../../components/History';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Flag,
  CalendarDays,
  CheckCheck,
  ArrowRight,
  Layers,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { TaskBoard } from '../tasks/TaskBoard';
import type { Task } from '../tasks/model';
import { goalStats, replaceGoalTasks } from './goalModel';
import { areaLabel, areas } from '../../lib/workspace';
import type { Entry, EntrySetter, Translate, Area, Milestone } from '../../lib/workspace';
type Props = {
  t: Translate;
  entries: Entry[];
  setEntries: EntrySetter;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  edit: (task?: Task) => void;
  setRemove: Dispatch<SetStateAction<Task | null>>;
};
export function GoalScreen({ t, entries, setEntries, tasks, setTasks, edit, setRemove }: Props) {
  const { goalId } = useParams();
  const goal = entries.find((e) => e.id === goalId && e.kind === 'goal');
  const [phase, setPhase] = useState<Milestone | null>(null);
  const [removing, setRemoving] = useState<Milestone | null>(null);
  const [draft, setDraft] = useState<Entry | null>(null);
  const [status, setStatus] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [milestoneSaving, setMilestoneSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closedNotice, setClosedNotice] = useState('');
  useEffect(() => {
    setPhase(null);
    setRemoving(null);
    setDraft(null);
    setStatus('');
  }, [goalId]);
  if (!goal)
    return (
      <section className="card scope-page">
        <Target size={30} />
        <h1 dir="auto">{t('This goal isn’t here.', 'الهدف مش موجود هنا.')}</h1>
        <p dir="auto">
          {t(
            'It may have been removed. Your tasks remain in Planner.',
            'قد يكون تم حذفه. مهامك بتفضل موجودة في المخطط.',
          )}
        </p>
        <Button asChild>
          <Link to="/life">{t('Back to my life', 'العودة لحياتي')}</Link>
        </Button>
      </section>
    );
  const stats = goalStats(tasks, goal.id);
  const phases = goal.milestones ?? [];
  const scopedTasks = tasks.filter((task) => task.goalId === goal.id);
  const setGoalTasks: Dispatch<SetStateAction<Task[]>> = (change) =>
    setTasks((old) =>
      replaceGoalTasks(
        old,
        goal.id,
        typeof change === 'function' ? change(old.filter((x) => x.goalId === goal.id)) : change,
      ),
    );
  function addTask() {
    edit({
      id: crypto.randomUUID(),
      title: '',
      category: goal!.area,
      done: false,
      archived: false,
      goalId: goal!.id,
      milestoneId: status && status !== 'unassigned' ? status : undefined,
    });
  }
  return (
    <div className="goal-page">
      <Link className="goal-back" to="/life">
        <ArrowRight size={14} />
        {t('My life', 'حياتي')}
      </Link>
      <div className="goal-page-header">
        <span className="goal-page-icon">
          <Target size={27} />
        </span>
        <div>
          <div className="eyebrow">
            {areaLabel(goal.area, t)} ·{' '}
            {goal.archived
              ? t('ARCHIVED GOAL', 'هدف مؤرشف')
              : t('YOUR NEXT CHAPTER', 'خطوتك الجاية')}
          </div>
          <h1 dir="auto">{goal.title}</h1>
        </div>
        <Button variant="outline" onClick={() => setDraft({ ...goal })}>
          <Pencil size={15} />
          {t('Edit goal', 'تعديل الهدف')}
        </Button>
      </div>
      <section className="goal-summary card">
        <div className="goal-progress-main">
          <div>
            <strong dir="auto">{formatNumber(stats.progress, t('en', 'ar'))}%</strong>
            <span>{t('From completed tasks', 'من المهام المكتملة')}</span>
          </div>
          <progress
            value={formatNumber(stats.progress, t('en', 'ar'))}
            max={100}
            aria-label={t('Automatic goal progress', 'تقدم الهدف التلقائي')}
          />
          <p dir="auto">
            {t(
              'Each non-archived task has equal weight. Subtasks are steps within a task.',
              'كل مهمة غير مؤرشفة ليها نفس الوزن. الخطوات الفرعية جزء من المهمة.',
            )}
          </p>
        </div>
        <div className="goal-summary-number">
          <CheckCheck size={20} />
          <strong dir="auto">
            {formatNumber(stats.done, t('en', 'ar'))}/{formatNumber(stats.total, t('en', 'ar'))}
          </strong>
          <span>{t('Tasks completed', 'مهام مكتملة')}</span>
        </div>
        <div className="goal-summary-number">
          <Layers size={20} />
          <strong dir="auto">{formatNumber(phases.length, t('en', 'ar'))}</strong>
          <span>{t('Milestones', 'مراحل')}</span>
        </div>
        <div className="goal-summary-number">
          <CalendarDays size={20} />
          <strong dir="auto" className="goal-date">
            {goal.date ? formatCalendarDate(goal.date, t('en', 'ar')) : t('Flexible', 'بدون موعد')}
          </strong>
          <span>{t('Target date', 'الموعد المستهدف')}</span>
        </div>
      </section>
      <div className="goal-detail-columns">
        <section className="card goal-description">
          <h3 dir="auto">{t('Why this matters', 'ليه الهدف ده مهم؟')}</h3>
          <p dir="auto">
            {goal.detail ||
              t(
                'Add your reason, your definition of success, and what comes next.',
                'اكتب السبب، وشكل النجاح، والخطوة الجاية.',
              )}
          </p>
          <Button variant="ghost" onClick={() => setDraft({ ...goal })}>
            <Pencil size={14} />
            {t('Edit notes', 'تعديل الملاحظات')}
          </Button>
        </section>
        <section className="card milestone-panel">
          <div className="home-section-title">
            <h3 dir="auto">
              <Flag size={16} />
              {t('One milestone at a time', 'مرحلة كل مرة')}
            </h3>
            <Button
              variant="ghost"
              onClick={() => setPhase({ id: crypto.randomUUID(), title: '', date: '' })}
            >
              <Plus size={15} />
              {t('Add milestone', 'إضافة مرحلة')}
            </Button>
          </div>
          {phases.map((m) => {
            const progress = goalStats(tasks, goal.id, m.id);
            return (
              <div className="milestone-row" key={m.id}>
                <div>
                  <h4 dir="auto">{m.title}</h4>
                  {goal.date && m.date > goal.date && (
                    <p dir="auto" className="capture-hint">
                      {t(
                        'Milestone is after the goal target; review its date.',
                        'المرحلة بعد موعد الهدف؛ راجع تاريخها.',
                      )}
                    </p>
                  )}
                  <span>
                    {formatNumber(progress.done, t('en', 'ar'))}/
                    {formatNumber(progress.total, t('en', 'ar'))} {t('tasks', 'مهام')}
                    {m.date && ` · ${formatCalendarDate(m.date, t('en', 'ar'))}`}
                  </span>
                  <progress
                    value={progress.progress}
                    max={100}
                    aria-label={`${t('Milestone progress', 'تقدم المرحلة')}: ${m.title}`}
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${t('Edit milestone', 'تعديل المرحلة')}: ${m.title}`}
                  onClick={() => setPhase({ ...m })}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${t('Delete milestone', 'حذف المرحلة')}: ${m.title}`}
                  onClick={() => setRemoving(m)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            );
          })}
          {!phases.length && (
            <p dir="auto" className="milestone-empty">
              {t(
                'Break the goal into a few meaningful milestones. Then assign tasks to each one.',
                'قسّم الهدف لمراحل واضحة، وبعدها اربط مهامك بكل مرحلة.',
              )}
            </p>
          )}
        </section>
      </div>
      <section className="goal-execution-banner">
        <Target size={21} />
        <div>
          <h3 dir="auto">
            {t('From an ambition to the next action.', 'من هدف كبير لخطوة عملية.')}
          </h3>
          <p dir="auto">
            {t(
              'Add a task here, or link an existing task from its editor in Planner.',
              'أضف مهمة هنا، أو اربط مهمة موجودة من محررها في المخطط.',
            )}
          </p>
        </div>
        <Button onClick={addTask}>
          <Plus size={15} />
          {t('Add linked task', 'إضافة مهمة للهدف')}
        </Button>
      </section>
      <section className="card outcome-evidence">
        <h3 dir="auto">{t('Outcome, beyond task completion', 'نتيجة الهدف، غير نسبة المهام')}</h3>
        <p dir="auto">
          {goal.successCriteria ||
            t(
              'Add a measurable success criterion in Edit goal.',
              'أضف معيار نجاح واضح من تعديل الهدف.',
            )}
        </p>
        <strong dir="auto">
          {goal.outcomeAchieved
            ? t('Outcome achieved (self-assessed)', 'النتيجة متحققة (تقييمك)')
            : t('Outcome not confirmed yet', 'تحقق النتيجة لم يتأكد بعد')}
        </strong>
        {stats.progress === 100 && !goal.outcomeAchieved && (
          <p dir="auto" className="muted">
            {t(
              'All linked tasks are complete. Review your success criteria, then confirm the outcome in Edit goal. The goal stays active until you archive it.',
              'كل المهام المرتبطة اكتملت. راجع معيار النجاح، وبعدها أكد تحقق النتيجة من تعديل الهدف. الهدف يفضل نشط لحد ما تأرشفه.',
            )}
          </p>
        )}
        <Button variant="outline" onClick={() => setDraft({ ...goal })}>
          {t('Review goal outcome', 'راجع نتيجة الهدف')}
        </Button>
        {stats.progress === 100 && !goal.archived && (
          <>
            <p dir="auto">
              {t(
                'Did you achieve the outcome? Confirm and close this goal when you are satisfied.',
                'هل حققت النتيجة؟ لو راضي عن النتيجة، أكدها وأغلق الهدف.',
              )}
            </p>
            <Button
              disabled={closing}
              onClick={async () => {
                setClosing(true);
                const ok = await transactData((data) => closeGoal(data, goal.id, goal.revision));
                setClosing(false);
                setClosedNotice(
                  ok
                    ? t(
                        '🎉 Goal outcome confirmed and goal closed.',
                        '🎉 أكدت النتيجة وأغلقت الهدف.',
                      )
                    : t(
                        'Could not close the goal. Review the latest tasks and retry.',
                        'تعذر إغلاق الهدف. راجع أحدث مهام وحاول تاني.',
                      ),
                );
              }}
            >
              {t('Confirm outcome and close goal', 'تأكيد النتيجة وإغلاق الهدف')}
            </Button>
          </>
        )}
        {closedNotice && (
          <p dir="auto" role="status">
            {closedNotice}
          </p>
        )}
      </section>
      <div className="goal-task-filter">
        <label>
          {t('Milestone filter', 'تصفية المرحلة')}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('All milestones', 'كل المراحل')}</option>
            <option value="unassigned">{t('No milestone', 'بدون مرحلة')}</option>
            {phases.map((m) => (
              <option value={m.id} key={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TaskBoard
        {...{ t, edit: (task?: Task) => (task ? edit(task) : addTask()), setRemove }}
        tasks={scopedTasks.filter(
          (task) =>
            !status || (status === 'unassigned' ? !task.milestoneId : task.milestoneId === status),
        )}
        setTasks={(change) =>
          setGoalTasks((old) => {
            const matches = (task: Task) =>
              !status ||
              (status === 'unassigned' ? !task.milestoneId : task.milestoneId === status);
            const visible = old.filter(matches);
            const next = typeof change === 'function' ? change(visible) : change;
            return [...old.filter((task) => !matches(task)), ...next];
          })
        }
      />
      <Dialog
        open={!!phase}
        onOpenChange={() => setPhase(null)}
        title={t('Shape this milestone', 'حدد المرحلة')}
        description={t(
          'Progress comes from tasks assigned to this milestone.',
          'تقدم المرحلة بيتحسب من المهام المرتبطة بيها.',
        )}
      >
        {phase && (
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!phase.title.trim() || milestoneSaving) return;
              const saved = { ...phase, title: phase.title.trim() };
              const next = {
                ...goal,
                milestones: phases.some((m) => m.id === phase.id)
                  ? phases.map((m) => (m.id === phase.id ? saved : m))
                  : [...phases, saved],
              };
              if (milestoneDateIssue(next)) return;
              setMilestoneSaving(true);
              const ok = await saveEntryDraft(next);
              setMilestoneSaving(false);
              setSaveError(!ok);
              if (ok) setPhase(null);
            }}
          >
            <label>
              {t('Milestone title', 'عنوان المرحلة')}
              <input
                dir="auto"
                autoFocus
                required
                maxLength={160}
                value={phase.title}
                onChange={(e) => setPhase({ ...phase, title: e.target.value })}
              />
            </label>
            <label>
              {t('Target date (optional)', 'التاريخ المستهدف (اختياري)')}
              <input
                type="date"
                value={phase.date}
                onChange={(e) =>
                  setPhase({ ...phase, date: e.target.value, targetDateAcknowledgement: undefined })
                }
              />
            </label>
            {phase.date && goal.date && phase.date > goal.date && (
              <>
                <p dir="auto" role="alert">
                  {t(
                    'This milestone is after the goal target. You can explicitly keep this date, or change the goal target.',
                    'المرحلة بعد موعد الهدف. تقدر تحفظ التاريخ ده بموافقة صريحة، أو تغيّر موعد الهدف.',
                  )}
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={phase.targetDateAcknowledgement === `${goal.date}/${phase.date}`}
                    onChange={(e) =>
                      setPhase({
                        ...phase,
                        targetDateAcknowledgement: e.target.checked
                          ? `${goal.date}/${phase.date}`
                          : undefined,
                      })
                    }
                  />
                  {t(
                    'Keep this milestone after the goal target',
                    'احفظ المرحلة بعد موعد الهدف بموافقتي',
                  )}
                </label>
              </>
            )}
            {saveError && (
              <p dir="auto" role="alert">
                {t(
                  'Could not save the milestone. Review the latest goal and retry.',
                  'تعذر حفظ المرحلة. راجع أحدث نسخة من الهدف وحاول تاني.',
                )}
              </p>
            )}
            <div className="dialog-actions">
              <Button type="button" variant="outline" onClick={() => setPhase(null)}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                disabled={
                  milestoneSaving ||
                  !phase.title.trim() ||
                  !!milestoneDateIssue({ date: goal.date, milestones: [phase] })
                }
              >
                {t('Save milestone', 'حفظ المرحلة')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
      <Dialog
        open={!!removing}
        onOpenChange={() => setRemoving(null)}
        title={t('Remove this milestone?', 'حذف المرحلة؟')}
        description={t(
          'Tasks are kept under this goal without a milestone.',
          'المهام هتفضل مرتبطة بالهدف، لكن بدون مرحلة.',
        )}
      >
        <p dir="auto">{removing?.title}</p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setRemoving(null)}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            onClick={() => {
              setEntries((old) =>
                old.map((x) =>
                  x.id === goal.id
                    ? { ...x, milestones: phases.filter((m) => m.id !== removing?.id) }
                    : x,
                ),
              );
              setTasks((old) =>
                old.map((x) =>
                  x.goalId === goal.id && x.milestoneId === removing?.id
                    ? { ...x, milestoneId: undefined }
                    : x,
                ),
              );
              setStatus('');
              setRemoving(null);
            }}
          >
            {t('Remove milestone', 'حذف المرحلة')}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={!!draft}
        onOpenChange={() => setDraft(null)}
        title={t('Give your goal a clear direction', 'وضح اتجاه هدفك')}
        description={t(
          'Progress is calculated automatically from linked tasks.',
          'نسبة التقدم بتتحسب تلقائياً من المهام المرتبطة.',
        )}
      >
        {draft && (
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!draft.title.trim()) return;
              const ok = await saveEntryDraft(draft);
              setSaveError(!ok);
              if (ok) setDraft(null);
            }}
          >
            <label>
              {t('Goal title', 'عنوان الهدف')}
              <input
                dir="auto"
                autoFocus
                required
                maxLength={160}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label>
              {t('Notes and success criteria', 'الملاحظات ومعيار النجاح')}
              <textarea
                dir="auto"
                rows={6}
                maxLength={3000}
                value={draft.detail}
                onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
              />
            </label>
            <label>
              {t('Life area', 'مجال الحياة')}
              <select
                value={draft.area}
                onChange={(e) => setDraft({ ...draft, area: e.target.value as Area })}
              >
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {areaLabel(a, t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Success criteria', 'معيار تحقق الهدف')}
              <textarea
                dir="auto"
                rows={3}
                maxLength={2000}
                value={draft.successCriteria ?? ''}
                onChange={(e) => setDraft({ ...draft, successCriteria: e.target.value })}
              />
            </label>
            <label className="pin-option">
              <input
                type="checkbox"
                checked={!!draft.outcomeAchieved}
                onChange={(e) => setDraft({ ...draft, outcomeAchieved: e.target.checked })}
              />
              {t('Outcome achieved (my assessment)', 'النتيجة تحققت (تقييمي الشخصي)')}
            </label>
            <History item={goal} t={t} />
            {saveError && (
              <p dir="auto" role="alert">
                {t(
                  'Save failed or goal changed elsewhere. Copy your draft and reopen the latest version.',
                  'تعذر الحفظ أو الهدف اتغير في مكان تاني. انسخ مسودتك وافتح النسخة الأحدث.',
                )}
              </p>
            )}
            <label>
              {t('Target date (optional)', 'التاريخ المستهدف (اختياري)')}
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <GoalDateReview goal={draft} onChange={setDraft} t={t} />
            <div className="dialog-actions">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button disabled={!draft.title.trim() || !!milestoneDateIssue(draft)}>
                {t('Save goal', 'حفظ الهدف')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
