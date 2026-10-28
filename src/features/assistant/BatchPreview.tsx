import { DateTimeInput } from '../../components/DateTimeInput';
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
        <span className="eyebrow">{t('ui.multiActionPreview.875d4b')}</span>
        <strong dir="auto">
          {localizedNumber(items.length, t('en', 'ar'))} {t('ui.actions.9dd063')}
        </strong>
      </div>
      <p dir="auto">
        {pending
          ? t('ui.localRulesOnlyNoTasksEventsOr.29bf24')
          : message.status === 'confirmed'
            ? t('ui.savedTogetherInOneLocalTransaction.236d9e')
            : message.status === 'reverted'
              ? t('ui.undoCompletedEditedOrLinkedItemsMay.0b9da1')
              : t('ui.cancelledNoActionsWereExecuted.ebd2a2')}
      </p>
      <div className="batch-preview-items">
        {items.map((item, index) => (
          <section className="batch-preview-item" key={item.id}>
            <div className="batch-preview-heading">
              <span>
                {localizedNumber(index + 1, t('en', 'ar'))} ·{' '}
                {item.kind === 'task' ? t('ui.task.c7a3d8') : kindLabel(item.kind, t)}
              </span>
              {pending && (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy || items.length === 1}
                  aria-label={`${t('ui.removePreviewItem.16eeb8')} ${localizedNumber(index + 1, t('en', 'ar'))}`}
                  onClick={() => remove(item.id)}
                >
                  <Trash2 size={15} />
                </Button>
              )}
            </div>
            {pending ? (
              <div className="editor-form">
                <label>
                  {t('ui.actionTitle.f11358')}
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
                    {t('ui.actionType.2200e9')}
                    <select
                      disabled={busy}
                      value={item.kind}
                      onChange={(e) =>
                        patch(item.id, { kind: e.target.value as CaptureItem['kind'] })
                      }
                    >
                      {kinds.map((k) => (
                        <option key={k} value={k}>
                          {k === 'task' ? t('ui.task.c7a3d8') : kindLabel(k, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('ui.lifeArea.d4e236')}
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
                      ? t('ui.eventDateRequired.5eedab')
                      : item.kind === 'task'
                        ? t('ui.plannedDayOptional.54d004')
                        : t('ui.targetDateOptional.0eb380')}
                    <DateTimeInput
                      type="date"
                      disabled={busy}
                      value={item.date}
                      onChange={(e) => patch(item.id, { date: e.target.value })}
                      onInput={(e) => patch(item.id, { date: e.currentTarget.value })}
                      aria-label={
                        item.kind === 'event'
                          ? t('ui.eventDateRequired.5eedab')
                          : item.kind === 'task'
                            ? t('ui.plannedDayOptional.54d004')
                            : t('ui.targetDateOptional.0eb380')
                      }
                    />
                  </label>
                )}
                {['event', 'routine', 'task'].includes(item.kind) && (
                  <label>
                    {t('ui.timeRequired.c282e3')}
                    <DateTimeInput
                      disabled={busy}
                      type="time"
                      value={item.time}
                      onChange={(e) => patch(item.id, { time: e.target.value })}
                      onInput={(e) => patch(item.id, { time: e.currentTarget.value })}
                      aria-label={t('ui.timeRequired.c282e3')}
                    />
                  </label>
                )}
                <label>
                  {t('ui.detailsOptional.6ca244')}
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
            {t('ui.youMayEditChangeTypeOrExclude.c78f53')}
          </p>
          {captureErrors(items) && (
            <p dir="auto" className="capture-hint" role="status">
              {t('ui.completeTheTitlesAndRequiredDatesTimes.7350a7')}
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
              {t('ui.cancelAll.5aa435')}
            </Button>
          </div>
        </>
      ) : message.status === 'confirmed' ? (
        <div className="action-result" role="status">
          <Check size={15} />
          {t('ui.confirmedAndSavedLocally.60607d')}
          <Link to="/planner">{t('ui.planner.e7665d')}</Link>
          <Link to="/memory">{t('ui.memory.eee0de')}</Link>
          <Link to="/life">{t('ui.myLife.907c1a')}</Link>
        </div>
      ) : (
        <div role="status">
          {message.status === 'reverted'
            ? t('ui.revertedRemovedItemsCanBeRestoredFrom.7dd1ea')
            : t('ui.cancelledNothingExecuted.b41fbc')}
        </div>
      )}
    </div>
  );
}
