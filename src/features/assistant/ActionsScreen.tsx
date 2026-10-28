import { DateTimeInput } from '../../components/DateTimeInput';
import { aiRecord } from './ai/plan';
import { formatCalendarDate, formatTime, formatTimestamp } from '../../i18n/format';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Search, RotateCcw, ArrowUpRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { useStorageState, transactData } from '../../lib/storage';
import { localDate, kindLabel } from '../../lib/workspace';
import type { Translate } from '../../lib/workspace';
import { actionRecords, undoPreview, undoAction } from './actionModel';
import type { UndoPreview } from './actionModel';

export function ActionsScreen({ t }: { t: Translate }) {
  const { data, error } = useStorageState();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<UndoPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const records = actionRecords(data);
  const statusText = (value: string) =>
    ({
      pending: t('ui.pending.f49e76'),
      confirmed: t('ui.executed.990b9c'),
      cancelled: t('ui.cancelled.a64cde'),
      reverted: t('ui.reverted.efdf94'),
    })[value] ?? value;
  const shown = records
    .filter(({ conversation, message: m }) => {
      const day =
        m.createdAt && !Number.isNaN(Date.parse(m.createdAt))
          ? localDate(new Date(m.createdAt))
          : '';
      return (
        (status === 'all' || (m.status ?? 'pending') === status) &&
        (!from || (!!day && day >= from)) &&
        (!to || (!!day && day <= to)) &&
        [
          conversation.title,
          m.text,
          m.batchSource,
          m.proposal?.title,
          m.mutation?.title,
          m.ai?.summary,
          ...(m.batch ?? []).map((x) => x.title + ' ' + x.detail),
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())
      );
    })
    .sort((a, b) => (b.message.createdAt ?? '').localeCompare(a.message.createdAt ?? ''));
  function review(conversationId: string, messageId: string) {
    try {
      setPreview(undoPreview(data, conversationId, messageId));
      setNotice('');
    } catch {
      setNotice(t('ui.thisActionIsNoLongerAvailable.544312'));
    }
  }
  async function confirm() {
    if (!preview || busy) return;
    setBusy(true);
    const ok = await transactData((latest) => undoAction(latest, preview));
    setBusy(false);
    if (ok) {
      const restoring = preview.mode === 'restore' || preview.mode === 'ai';
      setPreview(null);
      setNotice(
        restoring
          ? t('ui.previousValuesRestored.7c64ce')
          : t('ui.undoSavedRemovedItemsAreInRecently.150882'),
      );
    } else {
      setNotice(t('ui.nothingChangedDataMayHaveChangedSince.c8322b'));
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <History size={15} />
            {t('ui.youAreInControl.0904b1')}
          </div>
          <h1 dir="auto">{t('ui.assistantActionCenter.1ebe94')}</h1>
          <p dir="auto">{t('ui.reviewLocalRequestsTheirResultsAndSafe.e62cf2')}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/assistant">
            {t('ui.backToAssistant.d0a423')}
            <ArrowUpRight size={15} />
          </Link>
        </Button>
      </div>
      <div className="action-center-stats">
        {['pending', 'confirmed', 'cancelled', 'reverted'].map((value) => (
          <button
            className="card"
            key={value}
            aria-pressed={status === value}
            onClick={() => setStatus(status === value ? 'all' : value)}
          >
            <span>{statusText(value)}</span>
            <strong dir="auto">
              {localizedNumber(
                records.filter((x) => (x.message.status ?? 'pending') === value).length,
                t('en', 'ar'),
              )}
            </strong>
          </button>
        ))}
      </div>
      <section className="card action-center-tools">
        <label>
          <span>
            <Search size={14} />
            {t('ui.searchActions.9a9aba')}
          </span>
          <input
            dir="auto"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={300}
          />
        </label>
        <label>
          {t('ui.actionStatus.d7ca82')}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t('ui.allStatuses.11633c')}</option>
            {['pending', 'confirmed', 'cancelled', 'reverted'].map((value) => (
              <option key={value} value={value}>
                {statusText(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('ui.fromDate.b3b615')}
          <DateTimeInput
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            onInput={(e) => setFrom(e.currentTarget.value)}
            aria-label={t('ui.fromDate.b3b615')}
          />
        </label>
        <label>
          {t('ui.toDate.77d654')}
          <DateTimeInput
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onInput={(e) => setTo(e.currentTarget.value)}
            aria-label={t('ui.toDate.77d654')}
          />
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setQuery('');
            setStatus('all');
            setFrom('');
            setTo('');
          }}
        >
          {t('ui.clearFilters.c87752')}
        </Button>
      </section>
      {from && to && from > to && (
        <p dir="auto" role="alert" className="notice">
          {t('ui.theStartDateMustPrecedeTheEnd.83dee3')}
        </p>
      )}
      {error && (
        <p dir="auto" role="alert" className="notice">
          {t('ui.storageNeedsAttention.0ec9c9')}
        </p>
      )}
      {notice && !preview && (
        <p dir="auto" className="notice" role="status">
          {notice}
        </p>
      )}
      <p dir="auto" className="muted">
        {localizedNumber(shown.length, t('en', 'ar'))}{' '}
        {t('ui.matchingRequestsIncludingArchivedConversationsDatesWithout.6c0854')}
      </p>
      <div className="action-center-list">
        {shown.map(({ conversation, message: m }) => {
          const items = m.ai
            ? m.ai.actions.map((action) => ({
                kind:
                  action.kind === 'create_goal' || action.kind === 'update_goal'
                    ? ('goal' as const)
                    : ('task' as const),
                title: aiRecord(action).title,
                date:
                  action.kind === 'create_goal'
                    ? action.goal.date
                    : action.kind === 'update_goal'
                      ? action.patch.date
                      : action.kind === 'update_task'
                        ? (action.patch.plannedDate ?? '')
                        : (action.task.plannedDate ?? ''),
                time: action.kind === 'create_task' ? (action.task.plannedTime ?? '') : '',
              }))
            : (m.batch ??
              (m.proposal
                ? [m.proposal]
                : m.mutation
                  ? [{ kind: m.mutation.kind, title: m.mutation.title, date: '', time: '' }]
                  : []));
          return (
            <article className="card action-center-item" key={conversation.id + m.id}>
              <header>
                <div>
                  <strong dir="auto">{conversation.title}</strong>
                  <small>
                    {m.createdAt && !Number.isNaN(Date.parse(m.createdAt))
                      ? formatTimestamp(m.createdAt, t('en', 'ar'))
                      : t('ui.timeNotRecorded.5bf62a')}
                    {conversation.archived ? ' · ' + t('ui.archivedConversation.973a34') : ''}
                  </small>
                </div>
                <span className={'action-state state-' + m.status}>
                  {statusText(m.status ?? 'pending')}
                  {m.undo?.keptIds.length ? ' · ' + t('ui.partial.f07654') : ''}
                </span>
              </header>
              <p dir="auto">
                {localizedNumber(items.length, t('en', 'ar'))} {t('ui.actions.9dd063')} ·{' '}
                {items.map((x) => x.title).join(' · ')}
              </p>
              <details>
                <summary>{t('ui.requestAndActionDetails.29e073')}</summary>
                <p dir="auto">
                  {m.batchSource ??
                    conversation.messages[conversation.messages.findIndex((x) => x.id === m.id) - 1]
                      ?.text ??
                    m.text}
                </p>
                <ul>
                  {items.map((item, i) => (
                    <li key={i}>
                      <strong dir="auto">{item.title}</strong>
                      <small>
                        {item.kind === 'task' ? t('ui.task.c7a3d8') : kindLabel(item.kind, t)}
                        {item.date ? ' · ' + formatCalendarDate(item.date, t('en', 'ar')) : ''}
                        {item.time && ['event', 'routine'].includes(item.kind)
                          ? ' · ' + formatTime(item.time, t('en', 'ar'))
                          : ''}
                      </small>
                    </li>
                  ))}
                </ul>
                {m.mutation && (
                  <div className="merge-compare">
                    <pre>{JSON.stringify(m.mutation.before, null, 2)}</pre>
                    <pre>{JSON.stringify(m.mutation.patch, null, 2)}</pre>
                  </div>
                )}
                {m.undo && (
                  <p dir="auto">
                    {t('ui.removed.bcd6b6')}:{' '}
                    {localizedNumber(m.undo.removedIds.length, t('en', 'ar'))} ·{' '}
                    {t('ui.kept.2b4170')}: {localizedNumber(m.undo.keptIds.length, t('en', 'ar'))} ·{' '}
                    {new Date(m.undo.at).toLocaleString()}
                  </p>
                )}
              </details>
              <div className="dialog-actions">
                <Button asChild variant="outline">
                  <Link
                    to={`/assistant?conversation=${encodeURIComponent(conversation.id)}&message=${encodeURIComponent(m.id)}`}
                  >
                    {m.status === 'pending'
                      ? t('ui.reviewInConversation.0327fc')
                      : t('ui.openConversation.d34158')}
                  </Link>
                </Button>
                {m.status === 'confirmed' && (
                  <Button
                    variant="outline"
                    disabled={!!error}
                    onClick={() => review(conversation.id, m.id)}
                  >
                    <RotateCcw size={14} />
                    {t('ui.previewUndo.6a1c34')}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!shown.length && (
        <section className="card action-center-empty">
          <History size={28} />
          <h3 dir="auto">{t('ui.noMatchingActions.b42eb9')}</h3>
          <p dir="auto">{t('ui.adjustFiltersOrOpenTheAssistantOnly.99b001')}</p>
          <Button asChild variant="outline">
            <Link to="/assistant">{t('ui.openAssistant.a29a99')}</Link>
          </Button>
        </section>
      )}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open && !busy) setPreview(null);
        }}
        title={t('ui.reviewUndo.4e3a85')}
        description={
          preview?.mode === 'restore'
            ? t('ui.restoresPreviousValuesOnlyIfThisRecord.99c6bf')
            : t('ui.onlyUnchangedItemsWithAReliableCreation.6a3052')
        }
      >
        <div className="undo-preview">
          {preview?.rows.map((row) => (
            <div key={row.id}>
              <strong dir="auto">{row.title}</strong>
              <small>
                {row.state === 'safe'
                  ? preview.mode === 'restore' || preview.mode === 'ai'
                    ? t('ui.previousValuesWillBeRestored.268c63')
                    : t('ui.willMoveToRecentlyDeleted.f0a8e2')
                  : row.state === 'edited'
                    ? t('ui.keptEditedOrCreationHistoryIsUnknown.752fe3')
                    : row.state === 'linked'
                      ? t('ui.keptUsedByAnotherRecordOrFocus.88d8b2')
                      : t('ui.alreadyRemovedOrUnavailable.4c55c0')}
              </small>
            </div>
          ))}
          {!preview?.rows.length && (
            <p dir="auto">{t('ui.legacyActionHasNoReliableTargetReferences.6315a6')}</p>
          )}
        </div>
        {notice && (
          <p dir="auto" role="alert" className="notice">
            {notice}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>
            {t('ui.keepEverything.4b1fc9')}
          </Button>
          <Button
            disabled={busy || !preview?.rows.some((x) => x.state === 'safe')}
            onClick={() => void confirm()}
          >
            {t('ui.confirmUndo.3e3e37')} (
            {localizedNumber(
              preview?.rows.filter((x) => x.state === 'safe').length ?? 0,
              t('en', 'ar'),
            )}
            )
          </Button>
        </div>
      </Dialog>
    </>
  );
}
