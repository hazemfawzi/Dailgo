import {
  formatCalendarDate as localizedDate,
  formatTime as localizedTime,
} from '../../i18n/format';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { formatCalendarDate } from '../../i18n/format';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Check,
  Pin,
  Copy,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  List,
  Columns3,
  CalendarDays,
  Clock3,
  CheckCheck,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { areas, areaLabel, localDate } from '../../lib/workspace';
import type { Area, Translate } from '../../lib/workspace';
import {
  taskStates,
  statusLabel,
  isActionable,
  statusOf,
  priorityOf,
  priorityLabel,
  isOverdue,
  rankTasks,
} from './model';
import type { Task } from './model';
export function TaskBoard({
  t,
  tasks,
  setTasks,
  edit,
  setRemove,
}: {
  t: Translate;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  edit: (task?: Task) => void;
  setRemove: Dispatch<SetStateAction<Task | null>>;
}) {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') || 'open';
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [area, setArea] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState('smart');
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  useEffect(() => {
    setQuery(params.get('q') ?? '');
  }, [params.get('q')]);
  const filters = [
    ['open', t('ui.open.ec80f4')],
    ['today', t('ui.dueToday.6c50f4')],
    ['overdue', t('ui.overdue.918363')],
    ['doing', t('ui.inProgress.63d24b')],
    ['waiting', t('ui.waiting.656ea8')],
    ['blocked', t('ui.blocked.486a9f')],
    ['deferred', t('ui.deferred.7d343e')],
    ['cancelled', t('ui.cancelled.00a275')],
    ['done', t('ui.completed.bba94f')],
    ['all', t('ui.all.edbf9b')],
    ['archived', t('ui.archive.468a31')],
  ];
  const filtered = tasks.filter(
    (task) =>
      (filter === 'archived'
        ? task.archived
        : !task.archived &&
          (filter === 'all' ||
            (filter === 'done' && task.done) ||
            (filter === 'today' && isActionable(task) && task.dueDate === localDate()) ||
            (filter === 'overdue' && isOverdue(task)) ||
            (filter === 'doing' && statusOf(task) === 'doing') ||
            (filter === 'open' && isActionable(task)) ||
            (['waiting', 'blocked', 'deferred', 'cancelled'].includes(filter) &&
              statusOf(task) === filter))) &&
      (area === 'all' || task.category === area) &&
      (priority === 'all' || priorityOf(task) === priority) &&
      `${task.title} ${task.description ?? ''} ${(task.tags ?? []).join(' ')}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const visible =
    sort === 'smart'
      ? rankTasks(filtered)
      : [...filtered].sort((a, b) =>
          sort === 'title'
            ? a.title.localeCompare(b.title)
            : (a.dueDate || '9999').localeCompare(b.dueDate || '9999'),
        );
  const selectedVisible = selected.filter((id) => visible.some((x) => x.id === id));
  const update = (id: string, patch: Partial<Task>) =>
    setTasks((old) => old.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  function bulk(patch: Partial<Task>) {
    setTasks((old) => old.map((x) => (selectedVisible.includes(x.id) ? { ...x, ...patch } : x)));
    setSelected([]);
  }
  function renderTask(task: Task) {
    return (
      <article
        draggable={!task.archived}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
        className={`task-item ${task.done ? 'finished' : ''}`}
        key={task.id}
      >
        <div className="task-item-top">
          {selectionMode && (
            <label className="task-selection">
              <input
                type="checkbox"
                aria-label={`${t('ui.selectTask.32f3e7')}: ${task.title}`}
                checked={selectedVisible.includes(task.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, task.id]
                      : selected.filter((id) => id !== task.id),
                  )
                }
              />
              {t('ui.select.726fbf')}
            </label>
          )}
          <button dir="auto" className="task-title-button" onClick={() => edit(task)}>
            {task.title}
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t('ui.pin.98b089')}: ${task.title}`}
            aria-pressed={!!task.pinned}
            onClick={() => update(task.id, { pinned: !task.pinned })}
          >
            <Pin size={15} fill={task.pinned ? 'currentColor' : 'none'} />
          </Button>
        </div>
        {task.reason && (
          <p dir="auto" className="muted">
            {task.reason} · {task.waitingFor} · {localizedDate(task.reviewDate, t('en', 'ar'))}
          </p>
        )}
        {task.description && (
          <p dir="auto" className="task-description">
            {task.description}
          </p>
        )}
        <div className="task-badges">
          <span className={`priority-badge ${priorityOf(task)}`}>
            {priorityLabel(priorityOf(task), t)}
          </span>
          <span>{areaLabel(task.category as Area, t)}</span>
          {task.plannedDate && (
            <span>
              <CalendarDays size={12} />
              {t('ui.planned.2b68c6')}: {formatCalendarDate(task.plannedDate, t('en', 'ar'))}
              {task.plannedTime && (
                <>
                  {' '}
                  · <bdi>{localizedTime(task.plannedTime, t('en', 'ar'))}</bdi>
                </>
              )}
            </span>
          )}
          {task.dueDate && (
            <span className={isOverdue(task) ? 'overdue-text' : ''}>
              <CalendarDays size={12} />
              {t('ui.due.6c34a1')}: {formatCalendarDate(task.dueDate, t('en', 'ar'))}
            </span>
          )}
          {!!task.estimate && (
            <span>
              <Clock3 size={12} />
              {localizedNumber(task.estimate, t('en', 'ar'))} {t('ui.min.bea689')}
            </span>
          )}
          {!!task.subtasks?.length && (
            <span>
              <CheckCheck size={12} />
              {localizedNumber(task.subtasks.filter((x) => x.done).length, t('en', 'ar'))}/
              {localizedNumber(task.subtasks.length, t('en', 'ar'))}
            </span>
          )}
          {task.tags?.map((tag) => (
            <span className="task-tag" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
        <div className="task-item-bottom">
          <button
            className={`task-completion-control ${task.done ? 'is-complete' : ''}`}
            aria-pressed={task.done}
            aria-label={`${t('ui.complete.e721b1')}: ${task.title}`}
            onClick={() =>
              update(task.id, { done: !task.done, status: task.done ? 'todo' : 'done' })
            }
          >
            <span className="task-completion-circle" aria-hidden="true">
              {task.done && <Check size={12} />}
            </span>
            {task.done ? t('ui.completed.bba94f') : t('ui.markComplete.d41e6a')}
          </button>
          <select
            aria-label={`${t('ui.status.7dafdc')}: ${task.title}`}
            value={statusOf(task)}
            onChange={(e) =>
              update(task.id, {
                status: e.target.value as Task['status'],
                done: e.target.value === 'done',
              })
            }
          >
            {taskStates.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, t)}
              </option>
            ))}
          </select>
          <div className="entry-actions">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t('ui.duplicate.da09ad')}: ${task.title}`}
              onClick={() =>
                setTasks((old) => [
                  ...old,
                  {
                    ...task,
                    revision: undefined,
                    result: undefined,
                    history: [],
                    createdAt: undefined,
                    updatedAt: undefined,
                    completedAt: undefined,
                    id: crypto.randomUUID(),
                    title: `${task.title} ${t('ui.copy.a4c60f')}`,
                    done: false,
                    status: 'todo',
                    archived: false,
                    pinned: false,
                    subtasks: task.subtasks?.map((x) => ({
                      ...x,
                      id: crypto.randomUUID(),
                      done: false,
                    })),
                  },
                ])
              }
            >
              <Copy size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t('ui.edit.c554f4')}: ${task.title}`}
              onClick={() => edit(task)}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${task.archived ? t('ui.restore.82172b') : t('ui.archive.b24a9a')}: ${task.title}`}
              onClick={() => update(task.id, { archived: !task.archived })}
            >
              {task.archived ? <RotateCcw size={14} /> : <Archive size={14} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t('ui.delete.010491')}: ${task.title}`}
              onClick={() => setRemove(task)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </article>
    );
  }
  return (
    <section className="task-workspace">
      <div className="collection-top">
        <div>
          <h2 dir="auto">
            {t('ui.tasks.19a9e5')}
            <span className="count">{localizedNumber(visible.length, t('en', 'ar'))}</span>
          </h2>
          <p dir="auto" className="muted">
            {t('ui.organizeTheWorkProtectYourAttention.2508ab')}
          </p>
        </div>
        <Button onClick={() => edit()}>
          <Plus size={16} />
          {t('ui.newTask.02b6c9')}
        </Button>
      </div>
      <div className="task-filter-chips">
        {filters.map(([value, label]) => (
          <button
            className={filter === value ? 'selected' : ''}
            key={value}
            onClick={() => {
              setParams(value === 'open' ? {} : { filter: value });
              setSelected([]);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="task-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            dir="auto"
            aria-label={t('ui.searchTasks.7e7b94')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('ui.searchTitlesNotesTags.d88319')}
          />
        </label>
        <select
          aria-label={t('ui.filterLifeArea.3e6905')}
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="all">{t('ui.allAreas.e2d78b')}</option>
          {areas.map((a) => (
            <option value={a} key={a}>
              {areaLabel(a, t)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('ui.filterPriority.116d44')}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="all">{t('ui.allPriorities.04ea93')}</option>
          {['high', 'medium', 'low'].map((p) => (
            <option value={p} key={p}>
              {priorityLabel(p, t)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('ui.sortTasks.fb90f9')}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="smart">{t('ui.focusFirst.1c8895')}</option>
          <option value="date">{t('ui.dueDate.3146bb')}</option>
          <option value="title">{t('ui.title.770d09')}</option>
        </select>
        <Button
          variant="outline"
          aria-pressed={selectionMode}
          onClick={() => {
            setSelectionMode(!selectionMode);
            setSelected([]);
          }}
        >
          {selectionMode ? t('ui.finishSelection.18dd5c') : t('ui.selectTasks.8e0c6f')}
        </Button>
        <div className="view-toggle">
          <Button
            variant={view === 'list' ? 'default' : 'ghost'}
            size="icon"
            aria-pressed={view === 'list'}
            aria-label={t('ui.listView.db70e6')}
            onClick={() => setView('list')}
          >
            <List size={16} />
          </Button>
          <Button
            variant={view === 'board' ? 'default' : 'ghost'}
            size="icon"
            aria-pressed={view === 'board'}
            aria-label={t('ui.boardView.328618')}
            onClick={() => setView('board')}
          >
            <Columns3 size={16} />
          </Button>
        </div>
      </div>
      {selectionMode && (
        <div className="selection-toolbar">
          <label>
            <input
              type="checkbox"
              checked={visible.length > 0 && selectedVisible.length === visible.length}
              onChange={(e) => setSelected(e.target.checked ? visible.map((x) => x.id) : [])}
            />
            {selectedVisible.length
              ? `${localizedNumber(selectedVisible.length, t('en', 'ar'))} ${t('ui.selected.fbd7e6')}`
              : t('ui.selectAllVisible.d88acb')}
          </label>
          {selectedVisible.length > 0 && (
            <div>
              <Button variant="ghost" onClick={() => bulk({ done: true, status: 'done' })}>
                <Check size={14} />
                {t('ui.complete.e721b1')}
              </Button>
              <Button variant="ghost" onClick={() => bulk({ archived: filter !== 'archived' })}>
                <Archive size={14} />
                {filter === 'archived' ? t('ui.restore.82172b') : t('ui.archive.b24a9a')}
              </Button>
              <Button variant="ghost" onClick={() => setBulkDelete(true)}>
                <Trash2 size={14} />
                {t('ui.delete.010491')}
              </Button>
            </div>
          )}
        </div>
      )}
      {view === 'list' ? (
        <div className="card task-list-expanded">{visible.map(renderTask)}</div>
      ) : (
        <div className="kanban-board">
          {taskStates.map((status) => (
            <section
              className="kanban-column"
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (tasks.some((x) => x.id === id && !x.archived))
                  update(id, { status, done: status === 'done' });
              }}
            >
              <h3 dir="auto">
                {statusLabel(status, t)}
                <span className="count">
                  {localizedNumber(
                    visible.filter((x) => statusOf(x) === status).length,
                    t('en', 'ar'),
                  )}
                </span>
              </h3>
              {visible.filter((x) => statusOf(x) === status).map(renderTask)}
            </section>
          ))}
        </div>
      )}
      {!visible.length && (
        <div className="card collection-empty">
          <CheckCheck size={30} />
          <h3 dir="auto">
            {tasks.length ? t('ui.noMatchingTasks.2c9d91') : t('ui.noTasksYet.821fb5')}
          </h3>
          <p dir="auto">{t('ui.noMatchingTasksAdjustTheFiltersOr.a8f4be')}</p>
          {tasks.length ? (
            <Button
              variant="outline"
              onClick={() => {
                setQuery('');
                setArea('all');
                setPriority('all');
                setParams({});
              }}
            >
              {t('ui.resetFilters.e12109')}
            </Button>
          ) : (
            <Button onClick={() => edit()}>{t('ui.addYourFirstTask.1556b0')}</Button>
          )}
        </div>
      )}
      <Dialog
        open={bulkDelete}
        onOpenChange={setBulkDelete}
        title={t('ui.deleteSelectedTasks.d6fc83')}
        description={t('ui.onlySelectedTasksVisibleInThisView.b58ace')}
      >
        <p dir="auto">
          {localizedNumber(selectedVisible.length, t('en', 'ar'))} {t('ui.tasks.1c126f')}
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setBulkDelete(false)}>
            {t('ui.cancel.428808')}
          </Button>
          <Button
            onClick={() => {
              setTasks((old) => old.filter((x) => !selectedVisible.includes(x.id)));
              setSelected([]);
              setBulkDelete(false);
            }}
          >
            {t('ui.deleteSelected.732de6')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
