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
      pending: t('Pending', 'معلّق'),
      confirmed: t('Executed', 'منفّذ'),
      cancelled: t('Cancelled', 'ملغي'),
      reverted: t('Reverted', 'تم التراجع'),
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
      setNotice(t('This action is no longer available.', 'الإجراء لم يعد متاحًا.'));
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
          ? t('Previous values restored.', 'تمت استعادة القيم السابقة.')
          : t(
              'Undo saved. Removed items are in Recently deleted; edited and linked items were kept.',
              'تم حفظ التراجع. العناصر المستبعدة موجودة في المحذوفات القابلة للاستعادة، والعناصر المعدّلة والمرتبطة اتسابوا.',
            ),
      );
    } else {
      setNotice(
        t(
          'Nothing changed. Data may have changed since preview. Close it and review the latest state.',
          'لم يتغير شيء. البيانات ممكن تكون اتعدّلت بعد المعاينة. اقفلها وافتح أحدث معاينة.',
        ),
      );
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <History size={15} />
            {t('YOU ARE IN CONTROL', 'التحكم في إيدك')}
          </div>
          <h1 dir="auto">{t('Assistant action center', 'مركز إجراءات المساعد')}</h1>
          <p dir="auto">
            {t(
              'Review local requests, their results, and safe undo previews.',
              'راجع الطلبات المحلية ونتايجها ومعاينة التراجع قبل التأكيد.',
            )}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/assistant">
            {t('Back to assistant', 'العودة للمساعد')}
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
            {t('Search actions', 'بحث في الإجراءات')}
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
          {t('Action status', 'حالة الإجراء')}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t('All statuses', 'كل الحالات')}</option>
            {['pending', 'confirmed', 'cancelled', 'reverted'].map((value) => (
              <option key={value} value={value}>
                {statusText(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('From date', 'من تاريخ')}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            onInput={(e) => setFrom(e.currentTarget.value)}
          />
        </label>
        <label>
          {t('To date', 'إلى تاريخ')}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onInput={(e) => setTo(e.currentTarget.value)}
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
          {t('Clear filters', 'مسح التصفية')}
        </Button>
      </section>
      {from && to && from > to && (
        <p dir="auto" role="alert" className="notice">
          {t('The start date must precede the end date.', 'تاريخ البداية لازم يسبق تاريخ النهاية.')}
        </p>
      )}
      {error && (
        <p dir="auto" role="alert" className="notice">
          {t('Storage needs attention.', 'التخزين محتاج مراجعة.')}
        </p>
      )}
      {notice && !preview && (
        <p dir="auto" className="notice" role="status">
          {notice}
        </p>
      )}
      <p dir="auto" className="muted">
        {localizedNumber(shown.length, t('en', 'ar'))}{' '}
        {t(
          'matching requests, including archived conversations. Dates without a recorded timestamp are excluded by date filters.',
          'طلبات مطابقة، شاملة المحادثات المؤرشفة. الطلبات اللي وقتها مش محفوظ بتُستبعد عند تصفية التاريخ.',
        )}
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
                      : t('Time not recorded', 'الوقت غير محفوظ')}
                    {conversation.archived
                      ? ' · ' + t('Archived conversation', 'محادثة مؤرشفة')
                      : ''}
                  </small>
                </div>
                <span className={'action-state state-' + m.status}>
                  {statusText(m.status ?? 'pending')}
                  {m.undo?.keptIds.length ? ' · ' + t('Partial', 'جزئي') : ''}
                </span>
              </header>
              <p dir="auto">
                {localizedNumber(items.length, t('en', 'ar'))} {t('actions', 'إجراءات')} ·{' '}
                {items.map((x) => x.title).join(' · ')}
              </p>
              <details>
                <summary>{t('Request and action details', 'تفاصيل الطلب والإجراءات')}</summary>
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
                        {item.kind === 'task' ? t('Task', 'مهمة') : kindLabel(item.kind, t)}
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
                    {t('Removed', 'تم استبعاد')}:{' '}
                    {localizedNumber(m.undo.removedIds.length, t('en', 'ar'))} ·{' '}
                    {t('Kept', 'تم الاحتفاظ')}:{' '}
                    {localizedNumber(m.undo.keptIds.length, t('en', 'ar'))} ·{' '}
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
                      ? t('Review in conversation', 'راجع في المحادثة')
                      : t('Open conversation', 'فتح المحادثة')}
                  </Link>
                </Button>
                {m.status === 'confirmed' && (
                  <Button
                    variant="outline"
                    disabled={!!error}
                    onClick={() => review(conversation.id, m.id)}
                  >
                    <RotateCcw size={14} />
                    {t('Preview undo', 'معاينة التراجع')}
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
          <h3 dir="auto">{t('No matching actions', 'مفيش إجراءات مطابقة')}</h3>
          <p dir="auto">
            {t(
              'Adjust filters or open the assistant. Only requests with an action preview appear here.',
              'غيّر التصفية أو افتح المساعد. هنا بتظهر الطلبات اللي ليها معاينة إجراء فقط.',
            )}
          </p>
          <Button asChild variant="outline">
            <Link to="/assistant">{t('Open assistant', 'افتح المساعد')}</Link>
          </Button>
        </section>
      )}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open && !busy) setPreview(null);
        }}
        title={t('Review undo', 'راجع التراجع')}
        description={
          preview?.mode === 'restore'
            ? t(
                'Restores previous values only if this record has not changed since the assistant action.',
                'يستعيد القيم السابقة فقط لو السجل ما اتعدّلش بعد إجراء المساعد.',
              )
            : t(
                'Only unchanged items with a reliable creation record and no later dependencies will move to Recently deleted. Nothing is permanently erased.',
                'العناصر اللي ما اتعدّلتش وليها سجل إنشاء موثوق وبدون ارتباطات لاحقة بس هتنتقل للمحذوفات القابلة للاستعادة. مفيش حذف نهائي.',
              )
        }
      >
        <div className="undo-preview">
          {preview?.rows.map((row) => (
            <div key={row.id}>
              <strong dir="auto">{row.title}</strong>
              <small>
                {row.state === 'safe'
                  ? preview.mode === 'restore' || preview.mode === 'ai'
                    ? t('Previous values will be restored', 'هتستعيد القيم السابقة')
                    : t('Will move to Recently deleted', 'هينتقل للمحذوفات القابلة للاستعادة')
                  : row.state === 'edited'
                    ? t(
                        'Kept: edited or creation history is unknown',
                        'هيفضل: اتعدّل أو سجل الإنشاء غير معروف',
                      )
                    : row.state === 'linked'
                      ? t(
                          'Kept: used by another record or focus session',
                          'هيفضل: مستخدم في سجل تاني أو جلسة تركيز',
                        )
                      : t('Already removed or unavailable', 'محذوف بالفعل أو غير متاح')}
              </small>
            </div>
          ))}
          {!preview?.rows.length && (
            <p dir="auto">
              {t(
                'Legacy action has no reliable target references. Undo is unavailable.',
                'الإجراء القديم مالوش مراجع موثوقة للعناصر. التراجع غير متاح.',
              )}
            </p>
          )}
        </div>
        {notice && (
          <p dir="auto" role="alert" className="notice">
            {notice}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>
            {t('Keep everything', 'احتفظ بكل شيء')}
          </Button>
          <Button
            disabled={busy || !preview?.rows.some((x) => x.state === 'safe')}
            onClick={() => void confirm()}
          >
            {t('Confirm undo', 'تأكيد التراجع')} (
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
