import { formatNumber as localizedNumber } from '../../i18n/format';
import { titleKey } from '../../lib/text';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import type { Entry, Translate } from '../../lib/workspace';
import { kindLabel } from '../../lib/workspace';
import type { Task } from '../tasks/model';
export function GlobalSearch({
  tasks,
  entries,
  edit,
  t,
}: {
  tasks: Task[];
  entries: Entry[];
  edit: (task: Task) => void;
  t: Translate;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('dailgo-search', show);
    return () => window.removeEventListener('dailgo-search', show);
  }, []);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const needle = titleKey(query);
  const matches = (e: Task | Entry) =>
    titleKey(
      JSON.stringify([
        e.title,
        'description' in e ? e.description : '',
        'detail' in e ? e.detail : '',
        'context' in e ? e.context : '',
        e.source?.text,
      ]),
    ).includes(needle);
  const results = [
    ...tasks.filter(matches).map((task) => ({
      id: task.id,
      title: task.title,
      label: t('ui.task.c7a3d8'),
      archived: task.archived,
      open: () => edit(task),
    })),
    ...entries.filter(matches).map((entry) => ({
      id: entry.id,
      title: entry.title,
      label: kindLabel(entry.kind, t),
      archived: entry.archived,
      open: () =>
        navigate(
          entry.kind === 'project'
            ? `/projects/${entry.id}`
            : entry.kind === 'goal'
              ? `/life/${entry.id}`
              : entry.kind === 'event'
                ? `/planner?tab=calendar&date=${entry.date}&q=${encodeURIComponent(entry.title)}${entry.archived ? '&archive=1' : ''}`
                : entry.kind === 'routine'
                  ? `/planner?tab=routines&q=${encodeURIComponent(entry.title)}${entry.archived ? '&archive=1' : ''}`
                  : `/memory?q=${encodeURIComponent(entry.title)}${entry.archived ? '&archive=1' : ''}`,
        ),
    })),
  ];
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('ui.searchEverything.b6d2a1')}
        title={t('ui.search.75f522')}
        aria-keyshortcuts="/"
        onClick={() => setOpen(true)}
      >
        <Search size={18} />
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('ui.searchYourSpace.3205fa')}
        description={t('ui.tasksGoalsEventsAndMemoriesIncludingArchived.0d6911')}
      >
        <input
          dir="auto"
          className="global-search-input"
          autoFocus
          aria-label={t('ui.globalSearch.5fbfcd')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={300}
        />
        {needle && (
          <p dir="auto" className="muted">
            {localizedNumber(results.length, t('en', 'ar'))} {t('ui.results.7a27d5')}
          </p>
        )}
        <div className="global-search-results">
          {needle &&
            results.slice(0, 50).map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setOpen(false);
                  r.open();
                }}
              >
                <strong dir="auto">{r.title}</strong>
                <small>
                  {r.label}
                  {r.archived ? ` · ${t('ui.archived.799523')}` : ''}
                </small>
              </button>
            ))}
          {needle && !results.length && <p dir="auto">{t('ui.noMatches.eb3976')}</p>}
        </div>
      </Dialog>
    </>
  );
}
