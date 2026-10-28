import {
  formatCalendarDate as localizedDate,
  formatTime as localizedTime,
} from '../../i18n/format';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { Check, X, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { areas, areaLabel, kindLabel } from '../../lib/workspace';
import type { Translate } from '../../lib/workspace';
import { captureErrors } from '../capture/model';
import type { CaptureItem } from '../capture/model';
import type { Message } from './engine';

const kinds: CaptureItem['kind'][] = [
  'task',
  'event',
  'note',
  'project',
  'goal',
  'decision',
  'routine',
  'preference',
  'personal',
];
export function BatchPreview({
  message,
  t,
  busy,
  patch,
  remove,
  confirm,
  cancel,
}: {
  message: Message;
  t: Translate;
  busy: boolean;
  patch: (id: string, values: Partial<CaptureItem>) => void;
  remove: (id: string) => void;
  confirm: () => void;
  cancel: () => void;
}) {
  const items = message.batch ?? [];
  const pending = message.status === 'pending';
  return (
    <div className="chat-proposal batch-preview">
      <div className="batch-preview-heading">
        <span className="eyebrow">{t('MULTI-ACTION PREVIEW', 'معاينة إجراءات متعددة')}</span>
        <strong dir="auto">
          {localizedNumber(items.length, t('en', 'ar'))} {t('actions', 'إجراءات')}
        </strong>
      </div>
      <p dir="auto">
        {pending
          ? t(
              'Local rules only. No tasks, events or notes have been created from this preview.',
              'قواعد محلية فقط. المعاينة دي لسه ما أنشأتش مهام أو مواعيد أو ملاحظات.',
            )
          : message.status === 'confirmed'
            ? t('Saved together in one local transaction.', 'اتحفظوا مع بعض في عملية محلية واحدة.')
            : message.status === 'reverted'
              ? t(
                  'Undo completed. Edited or linked items may have been kept. See the action center for details.',
                  'تم التراجع. العناصر المعدّلة أو المرتبطة ممكن تكون اتسابوا؛ التفاصيل في مركز الإجراءات.',
                )
              : t('Cancelled. No actions were executed.', 'تم الإلغاء. لم يتم تنفيذ الإجراءات.')}
      </p>
      <div className="batch-preview-items">
        {items.map((item, index) => (
          <section className="batch-preview-item" key={item.id}>
            <div className="batch-preview-heading">
              <span>
                {localizedNumber(index + 1, t('en', 'ar'))} ·{' '}
                {item.kind === 'task' ? t('Task', 'مهمة') : kindLabel(item.kind, t)}
              </span>
              {pending && (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy || items.length === 1}
                  aria-label={`${t('Remove preview item', 'استبعاد عنصر المعاينة')} ${localizedNumber(index + 1, t('en', 'ar'))}`}
                  onClick={() => remove(item.id)}
                >
                  <Trash2 size={15} />
                </Button>
              )}
            </div>
            {pending ? (
              <div className="editor-form">
                <label>
                  {t('Action title', 'عنوان الإجراء')}
                  <input
                    dir="auto"
                    maxLength={160}
                    disabled={busy}
                    value={item.title}
                    onChange={(e) => patch(item.id, { title: e.target.value })}
                  />
                </label>
                <div className="form-pair">
                  <label>
                    {t('Action type', 'نوع الإجراء')}
                    <select
                      disabled={busy}
                      value={item.kind}
                      onChange={(e) =>
                        patch(item.id, { kind: e.target.value as CaptureItem['kind'] })
                      }
                    >
                      {kinds.map((k) => (
                        <option key={k} value={k}>
                          {k === 'task' ? t('Task', 'مهمة') : kindLabel(k, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('Life area', 'مجال الحياة')}
                    <select
                      disabled={busy}
                      value={item.area}
                      onChange={(e) =>
                        patch(item.id, { area: e.target.value as CaptureItem['area'] })
                      }
                    >
                      {areas.map((a) => (
                        <option key={a} value={a}>
                          {areaLabel(a, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {['task', 'event', 'goal', 'project'].includes(item.kind) && (
                  <label>
                    {item.kind === 'event'
                      ? t('Event date (required)', 'تاريخ الموعد (مطلوب)')
                      : item.kind === 'task'
                        ? t('Planned day (optional)', 'يوم التنفيذ (اختياري)')
                        : t('Target date (optional)', 'التاريخ المستهدف (اختياري)')}
                    <input
                      type="date"
                      disabled={busy}
                      value={item.date}
                      onChange={(e) => patch(item.id, { date: e.target.value })}
                      onInput={(e) => patch(item.id, { date: e.currentTarget.value })}
                    />
                  </label>
                )}
                {['event', 'routine', 'task'].includes(item.kind) && (
                  <label>
                    {t('Time (required)', 'الوقت (مطلوب)')}
                    <input
                      disabled={busy}
                      type="time"
                      value={item.time}
                      onChange={(e) => patch(item.id, { time: e.target.value })}
                      onInput={(e) => patch(item.id, { time: e.currentTarget.value })}
                    />
                  </label>
                )}
                <label>
                  {t('Details (optional)', 'تفاصيل (اختياري)')}
                  <textarea
                    dir="auto"
                    disabled={busy}
                    rows={2}
                    maxLength={2500}
                    value={item.detail}
                    onChange={(e) => patch(item.id, { detail: e.target.value })}
                  />
                </label>
              </div>
            ) : (
              <>
                <strong dir="auto">{item.title}</strong>
                {item.date && (
                  <small>
                    {localizedDate(item.date, t('en', 'ar'))}{' '}
                    {localizedTime(item.time, t('en', 'ar'))}
                  </small>
                )}
                {item.detail && <p dir="auto">{item.detail}</p>}
              </>
            )}
          </section>
        ))}
      </div>
      {pending ? (
        <>
          <p dir="auto" className="muted">
            {t(
              'You may edit, change type or exclude items. All remaining items must be valid before saving any of them.',
              'تقدر تعدّل أو تغيّر النوع أو تستبعد عنصر. لازم كل العناصر المتبقية تكون صحيحة قبل حفظ أي منها.',
            )}
          </p>
          {captureErrors(items) && (
            <p dir="auto" className="capture-hint" role="status">
              {t(
                'Complete the titles and required dates/times. Nothing has been executed.',
                'كمّل العناوين والتواريخ والأوقات المطلوبة. لم يتم تنفيذ شيء.',
              )}
            </p>
          )}
          <div className="proposal-actions">
            <Button disabled={busy || captureErrors(items)} onClick={confirm}>
              <Check size={15} />
              {t(
                `Confirm ${localizedNumber(items.length, t('en', 'ar'))} actions`,
                `تأكيد ${localizedNumber(items.length, t('en', 'ar'))} إجراءات`,
              )}
            </Button>
            <Button variant="outline" disabled={busy} onClick={cancel}>
              <X size={15} />
              {t('Cancel all', 'إلغاء الكل')}
            </Button>
          </div>
        </>
      ) : message.status === 'confirmed' ? (
        <div className="action-result" role="status">
          <Check size={15} />
          {t('Confirmed and saved locally', 'تم التأكيد والحفظ محليًا')}
          <Link to="/planner">{t('Planner', 'المخطط')}</Link>
          <Link to="/memory">{t('Memory', 'الذاكرة')}</Link>
          <Link to="/life">{t('My life', 'حياتي')}</Link>
        </div>
      ) : (
        <div role="status">
          {message.status === 'reverted'
            ? t(
                'Reverted · Removed items can be restored from Data and backup',
                'تم التراجع · العناصر المستبعدة قابلة للاستعادة من البيانات والنسخ الاحتياطي',
              )
            : t('Cancelled · Nothing executed', 'ملغي · لم يتم تنفيذ شيء')}
        </div>
      )}
    </div>
  );
}
