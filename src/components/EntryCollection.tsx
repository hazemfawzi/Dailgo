import { DateTimeInput } from './DateTimeInput';
import { formatCalendarDate as localizedDate, formatTime as localizedTime } from '../i18n/format';
import { formatNumber as localizedNumber } from '../i18n/format';
import { TargetDate } from '../features/life/TargetDate';
import { GoalDateReview } from '../features/life/GoalDateReview';
import { storageText } from '../i18n/messages';
import { milestoneDateIssue } from '../features/life/goalDates';
import { MemoryFields } from '../features/memory/MemoryFields';
import { RepeatCopies } from '../features/planner/RepeatCopies';
import { saveEntryDraft } from '../lib/entryPersistence';
import { History } from './History';
import { ConflictNotice } from '../features/planner/ConflictNotice';
import { memoryKinds } from '../lib/workspace';
import { useSearchParams } from 'react-router-dom';
import { CaptureOrigin } from '../features/capture/CaptureOrigin';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Archive,
  Pencil,
  Trash2,
  RotateCcw,
  Check,
  CalendarDays,
  NotebookPen,
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { areaLabel, areas, kindLabel, localDate, makeEntry } from '../lib/workspace';
import type { Area, Entry, EntryKind, EntrySetter, Translate } from '../lib/workspace';
type Props = {
  allowCreate?: boolean;
  entries: Entry[];
  setEntries: EntrySetter;
  kinds: EntryKind[];
  t: Translate;
  area?: Area;
  date?: string;
  title: string;
  empty: string;
};
export function EntryCollection({
  entries,
  setEntries,
  kinds,
  t,
  area,
  date,
  title,
  empty,
  allowCreate = true,
}: Props) {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [archive, setArchive] = useState(params.get('archive') === '1');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setQuery(params.get('q') ?? '');
    setArchive(params.get('archive') === '1');
  }, [params.get('q'), params.get('archive')]);
  const visible = entries.filter(
    (e) =>
      kinds.includes(e.kind) &&
      (!area || e.area === area) &&
      (!date || e.date === date) &&
      e.archived === archive &&
      (filter === 'all' || e.kind === filter) &&
      `${e.title} ${e.detail} ${(e.tags ?? []).join(' ')} ${(e.links ?? []).join(' ')}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const update = (id: string, patch: Partial<Entry>) =>
    setEntries((old) => old.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  function add() {
    setDraft({ ...makeEntry(kinds[0], '', area), ...(date ? { date } : {}) });
  }
  return (
    <section className="collection">
      <div className="collection-top">
        <div>
          <h2 dir="auto">
            {title}
            <span className="count">{localizedNumber(visible.length, t('en', 'ar'))}</span>
          </h2>
          <p dir="auto" className="muted">
            {archive
              ? t('ui.yourArchivedItemsRestoreThemWheneverYou.0197ec')
              : t('ui.aLittleStructureOnYourTerms.59e555')}
          </p>
        </div>
        {allowCreate && (visible.length > 0 || !!query || archive) && (
          <Button onClick={add}>
            <Plus size={16} />
            {t('ui.addNew.4666da')}
          </Button>
        )}
      </div>
      <div className="collection-tools">
        <label className="search-field">
          <Search size={16} />
          <input
            dir="auto"
            aria-label={t('ui.searchItems.09dfb6')}
            placeholder={t('ui.searchYourSpace.2d56fb')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {kinds.length > 1 && (
          <select
            aria-label={t('ui.filterByType.1440be')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{t('ui.allTypes.09f085')}</option>
            {kinds.map((k) => (
              <option value={k} key={k}>
                {kindLabel(k, t)}
              </option>
            ))}
          </select>
        )}
        <Button variant={archive ? 'default' : 'outline'} onClick={() => setArchive(!archive)}>
          <Archive size={15} />
          {archive ? t('ui.showActive.54503f') : t('ui.archive.468a31')}
        </Button>
      </div>
      <div className="entry-grid">
        {visible.map((entry) => (
          <article className={`card entry-card kind-${entry.kind}`} key={entry.id}>
            <div className="entry-meta">
              <span>{kindLabel(entry.kind, t)}</span>
              <span>{areaLabel(entry.area, t)}</span>
            </div>
            <h3 dir="auto">
              {['goal', 'project'].includes(entry.kind) ? (
                <Link
                  to={entry.kind === 'project' ? `/projects/${entry.id}` : `/life/${entry.id}`}
                  className="goal-title-link"
                >
                  {entry.title}
                </Link>
              ) : (
                entry.title
              )}
            </h3>
            {['goal', 'project'].includes(entry.kind) && entry.date && (
              <TargetDate date={entry.date} t={t} />
            )}
            {entry.expiresOn && entry.expiresOn < localDate() && (
              <p dir="auto" className="capture-hint">
                {t('ui.expiredInformationReviewBeforeUsing.924a6d')}
              </p>
            )}
            {entry.sourceLabel && (
              <small>
                {t('ui.source.711b32')}: {entry.sourceLabel}
              </small>
            )}
            {entry.context && (
              <p dir="auto" className="muted">
                {entry.context}
              </p>
            )}
            {entry.certainty === 'inferred' && <small>{t('ui.inferenceNeedsReview.9d0dcc')}</small>}
            {entry.kind === 'decision' && (
              <p dir="auto" className="muted">
                {entry.alternatives} · {entry.rationale}
              </p>
            )}
            {['project', 'goal'].includes(entry.kind) && entry.successCriteria && (
              <p dir="auto" className="muted">
                {entry.successCriteria} ·{' '}
                {entry.outcomeAchieved
                  ? t('ui.outcomeAchieved.933071')
                  : t('ui.outcomeNotConfirmed.1b103f')}
              </p>
            )}
            {entry.detail && (
              <p dir="auto" className="entry-detail">
                {entry.detail}
              </p>
            )}
            {!!entry.tags?.length && (
              <p dir="auto" className="muted">
                {entry.tags
                  ?.filter(Boolean)
                  .map((x) => '#' + x)
                  .join(' ')}
              </p>
            )}
            {entry.links?.map((url, i) => (
              <a
                className="memory-link"
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {url}
              </a>
            ))}
            {entry.attachments?.map((file, i) => (
              <a className="memory-link" key={i} href={file.data} download={file.name}>
                {file.name}
              </a>
            ))}
            {entry.kind === 'event' && (
              <div className="entry-date">
                <CalendarDays size={14} />
                <span dir="auto">
                  {localizedDate(entry.date, t('en', 'ar'))} ·{' '}
                  {localizedTime(entry.time, t('en', 'ar'))}
                </span>
                <small>{t('ui.localPlan.17fff7')}</small>
              </div>
            )}
            {['goal', 'project'].includes(entry.kind) && (
              <div className="goal-progress">
                <div>
                  <span>{t('ui.taskBasedProgress.b5a26f')}</span>
                  <strong dir="auto">{localizedNumber(entry.progress, t('en', 'ar'))}%</strong>
                </div>
                <progress
                  max={100}
                  value={entry.progress}
                  aria-label={t('ui.goalProgress.d6089e')}
                />
                {entry.kind === 'goal' && entry.progress === 100 && !entry.outcomeAchieved && (
                  <p dir="auto" className="muted">
                    {t('ui.tasksCompleteReviewSuccessCriteriaAndConfirm.ad8c82')}{' '}
                    <Link to={`/life/${entry.id}`}>{t('ui.reviewOutcome.af74ad')}</Link>
                  </p>
                )}
              </div>
            )}
            {entry.kind === 'routine' && !archive && (
              <button
                className={`routine-check ${entry.doneDates.includes(localDate()) ? 'is-done' : ''}`}
                onClick={() =>
                  update(entry.id, {
                    doneDates: entry.doneDates.includes(localDate())
                      ? entry.doneDates.filter((d) => d !== localDate())
                      : [...entry.doneDates, localDate()],
                  })
                }
                aria-pressed={entry.doneDates.includes(localDate())}
              >
                <Check size={16} />
                {entry.doneDates.includes(localDate())
                  ? t('ui.doneTodayUndo.3211df')
                  : t('ui.markDoneToday.74780e')}
                {entry.time && <span dir="ltr">{localizedTime(entry.time, t('en', 'ar'))}</span>}
              </button>
            )}
            <div className="entry-actions">
              {['goal', 'project'].includes(entry.kind) && (
                <Link
                  className="goal-open-link"
                  to={entry.kind === 'project' ? `/projects/${entry.id}` : `/life/${entry.id}`}
                >
                  {entry.kind === 'project' ? t('ui.openProject.dae96c') : t('ui.openGoal.aad51b')}{' '}
                  ↗
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t('ui.edit.c554f4')}: ${entry.title}`}
                onClick={() => setDraft({ ...entry })}
              >
                <Pencil size={15} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${archive ? t('ui.restore.82172b') : t('ui.archive.b24a9a')}: ${entry.title}`}
                onClick={() => update(entry.id, { archived: !entry.archived })}
              >
                {archive ? <RotateCcw size={15} /> : <Archive size={15} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t('ui.delete.010491')}: ${entry.title}`}
                onClick={() => setDeleting(entry)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <div className="card collection-empty">
          <NotebookPen size={29} />
          <h3 dir="auto">
            {query
              ? t('ui.noMatchingItems.a09bbd')
              : archive
                ? t('ui.yourArchiveIsEmpty.4d3f7e')
                : empty}
          </h3>
          <p dir="auto">{t('ui.addAnItemOrAdjustYourFilters.c105f4')}</p>
          <Button variant="outline" onClick={add}>
            <Plus size={15} />
            {t('ui.createAnItem.73afc0')}
          </Button>
        </div>
      )}
      <Dialog
        open={!!draft}
        onOpenChange={() => setDraft(null)}
        title={
          draft && entries.some((e) => e.id === draft.id)
            ? t('ui.editItem.50b4ab')
            : t('ui.makeALittleSpaceForIt.f32642')
        }
        description={storageText(t, 'entryEditor')}
      >
        {draft && (
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!draft.title.trim() || saving) return;
              setSaving(true);
              const ok = await saveEntryDraft(draft);
              setSaving(false);
              setSaveError(!ok);
              if (ok) setDraft(null);
            }}
          >
            {kinds.length > 1 && (
              <label>
                {t('ui.type.28bca4')}
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as EntryKind })}
                >
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {kindLabel(k, t)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              {t('ui.title.770d09')}
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
              {t('ui.details.725c0d')}
              <textarea
                dir="auto"
                rows={4}
                maxLength={2500}
                value={draft.detail}
                onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
              />
            </label>
            <label>
              {t('ui.lifeArea.d4e236')}
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
            {draft.kind === 'project' && (
              <>
                <label>
                  {t('ui.parentGoalOptional.dba82b')}
                  <select
                    value={draft.parentGoalId ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, parentGoalId: e.target.value || undefined })
                    }
                  >
                    <option value="">{t('ui.independentProject.4c6b00')}</option>
                    {draft.parentGoalId && !entries.some((x) => x.id === draft.parentGoalId) && (
                      <option value={draft.parentGoalId}>
                        {t('ui.goalNoLongerAvailable.e8a9f9')}
                      </option>
                    )}
                    {entries
                      .filter((x) => x.kind === 'goal')
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {t('ui.workContext.1cc3a3')}
                  <input
                    dir="auto"
                    maxLength={300}
                    value={draft.context ?? ''}
                    onChange={(e) => setDraft({ ...draft, context: e.target.value })}
                  />
                </label>
                <label>
                  {t('ui.completionCriteria.a9b409')}
                  <textarea
                    dir="auto"
                    maxLength={2000}
                    rows={3}
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
                  {t('ui.projectOutcomeAchieved.a20cd8')}
                </label>
              </>
            )}
            {['goal', 'project'].includes(draft.kind) && (
              <>
                <p dir="auto" className="muted">
                  {t('ui.progressComesFromLinkedTasksOpenThe.dae92c')}
                </p>
                <label>
                  {t('ui.targetDateOptional.0eb380')}
                  <DateTimeInput
                    type="date"
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    aria-label={t('ui.targetDateOptional.0eb380')}
                  />
                </label>
              </>
            )}
            {draft.kind === 'event' && (
              <label>
                {t('ui.date.5568e5')}
                <DateTimeInput
                  type="date"
                  required
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  aria-label={t('ui.date.5568e5')}
                />
              </label>
            )}
            {draft.kind === 'event' && (
              <label>
                {t('ui.durationMinutes.5b7f68')}
                <input
                  type="number"
                  min={5}
                  max={1440}
                  required
                  value={draft.durationMinutes ?? 60}
                  onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })}
                />
              </label>
            )}
            {(draft.kind === 'event' || draft.kind === 'routine') && (
              <label>
                {t('ui.time.d46229')}
                <DateTimeInput
                  type="time"
                  required
                  value={draft.time}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  aria-label={t('ui.time.d46229')}
                />
              </label>
            )}
            {memoryKinds.includes(draft.kind) && (
              <>
                <label>
                  {t('ui.sourceReference.5eadd7')}
                  <input
                    dir="auto"
                    maxLength={500}
                    value={draft.sourceLabel ?? ''}
                    placeholder={t('ui.whereDidThisInformationComeFrom.c0f2c1')}
                    onChange={(e) => setDraft({ ...draft, sourceLabel: e.target.value })}
                  />
                </label>
                <label>
                  {t('ui.informationBasis.5b2b6c')}
                  <select
                    value={draft.certainty ?? 'unspecified'}
                    onChange={(e) =>
                      setDraft({ ...draft, certainty: e.target.value as Entry['certainty'] })
                    }
                  >
                    <option value="unspecified">{t('ui.notSpecified.e063da')}</option>
                    <option value="explicit">{t('ui.explicitlyStatedByMe.0e86eb')}</option>
                    <option value="inferred">{t('ui.anInferenceNeedsReview.a8e4fe')}</option>
                  </select>
                </label>
                <label>
                  {t('ui.contextProjectScope.c49382')}
                  <input
                    dir="auto"
                    maxLength={500}
                    value={draft.context ?? ''}
                    onChange={(e) => setDraft({ ...draft, context: e.target.value })}
                  />
                </label>
                <label>
                  {t('ui.validUntilOptional.b6582c')}
                  <DateTimeInput
                    type="date"
                    value={draft.expiresOn ?? ''}
                    onChange={(e) => setDraft({ ...draft, expiresOn: e.target.value })}
                    aria-label={t('ui.validUntilOptional.b6582c')}
                  />
                </label>
              </>
            )}
            {draft.kind === 'decision' && (
              <>
                <label>
                  {t('ui.optionsConsidered.a829a6')}
                  <textarea
                    dir="auto"
                    maxLength={2000}
                    rows={3}
                    value={draft.alternatives ?? ''}
                    onChange={(e) => setDraft({ ...draft, alternatives: e.target.value })}
                  />
                </label>
                <label>
                  {t('ui.whyThisDecision.90acf5')}
                  <textarea
                    dir="auto"
                    maxLength={2000}
                    rows={3}
                    value={draft.rationale ?? ''}
                    onChange={(e) => setDraft({ ...draft, rationale: e.target.value })}
                  />
                </label>
              </>
            )}
            {draft.kind === 'routine' && (
              <fieldset className="routine-days">
                <legend>{t('ui.repeatOnNoneSelectedMeansDaily.77020a')}</legend>
                {[
                  t('ui.sun.6fa57f'),
                  t('ui.mon.ed7a4c'),
                  t('ui.tue.80e772'),
                  t('ui.wed.8e443f'),
                  t('ui.thu.52926d'),
                  t('ui.fri.ca0ba0'),
                  t('ui.sat.5d621f'),
                ].map((day, i) => (
                  <label key={i}>
                    <input
                      type="checkbox"
                      checked={draft.routineDays?.includes(i) ?? false}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          routineDays: e.target.checked
                            ? [...(draft.routineDays ?? []), i]
                            : (draft.routineDays ?? []).filter((n) => n !== i),
                        })
                      }
                    />
                    {day}
                  </label>
                ))}
              </fieldset>
            )}
            {draft.kind === 'event' && (
              <ConflictNotice
                entries={[...entries.filter((e) => e.id !== draft.id), draft]}
                date={draft.date}
                t={t}
              />
            )}
            {draft.kind === 'event' && entries.some((x) => x.id === draft.id) && (
              <RepeatCopies id={draft.id} revision={draft.revision} kind="event" t={t} />
            )}
            {memoryKinds.includes(draft.kind) && (
              <MemoryFields draft={draft} onChange={setDraft} t={t} />
            )}
            <CaptureOrigin source={draft.source} t={t} />
            <History item={draft} t={t} />
            {saveError && (
              <p dir="auto" role="alert">
                {t('ui.saveFailedOrItemChangedElsewhereYour.9fc4a5')}
              </p>
            )}
            {draft.kind === 'goal' && <GoalDateReview goal={draft} onChange={setDraft} t={t} />}
            <div className="dialog-actions">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                {t('ui.cancel.428808')}
              </Button>
              <Button
                disabled={
                  saving ||
                  !draft.title.trim() ||
                  (draft.kind === 'goal' && !!milestoneDateIssue(draft))
                }
              >
                {t('ui.saveItem.b43e30')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title={t('ui.deleteThisItem.17ae38')}
        description={t('ui.movesTheItemToRecentlyDeletedRestore.56c582')}
      >
        <p dir="auto" className="entry-detail">
          {deleting?.title}
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            {t('ui.keepIt.d7c925')}
          </Button>
          <Button
            onClick={() => {
              setEntries((old) => old.filter((e) => e.id !== deleting?.id));
              setDeleting(null);
            }}
          >
            <Trash2 size={15} />
            {t('ui.deleteItem.ee2b64')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
