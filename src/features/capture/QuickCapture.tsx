import { DateTimeInput } from '../../components/DateTimeInput';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { VoiceCapture } from './VoiceCapture';
import { counted, formatNumber } from '../../i18n/format';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight, Trash2, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { areas, areaLabel, kindLabel } from '../../lib/workspace';
import type { Translate, Area } from '../../lib/workspace';
import { transactData, useStorageState } from '../../lib/storage';
import { restoreWorkspace } from '../life/demoGoals';
import { applyCapture, captureErrors, parseCapture } from './model';
import type { CaptureItem } from './model';
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
export function QuickCapture({ t }: { t: Translate }) {
  const { data } = useStorageState();
  const goals = restoreWorkspace(data['personal-os.entries.v1']).entries.filter(
    (e) => e.kind === 'goal' && !e.archived,
  );
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [items, setItems] = useState<CaptureItem[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const batch = useRef(crypto.randomUUID());
  const saving = useRef(false);
  function reset() {
    setText('');
    setItems(null);
    setSaved(false);
    setError('');
    batch.current = crypto.randomUUID();
  }
  function patch(id: string, value: Partial<CaptureItem>) {
    setItems((old) => old?.map((x) => (x.id === id ? { ...x, ...value } : x)) ?? null);
    setError('');
  }
  function review() {
    try {
      const parsed = parseCapture(text);
      setItems(parsed);
      setError('');
    } catch {
      setError(t('ui.useAtMost20ItemsPerCapture.fc7763'));
    }
  }
  async function save() {
    if (!items || captureErrors(items) || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    const source = { text, batchId: batch.current, createdAt: new Date().toISOString() };
    const ok = await transactData((data) => applyCapture(data, items, source));
    if (ok) setSaved(true);
    else setError(t('ui.nothingWasSavedCheckStorageThenRetry.076f95'));
    saving.current = false;
    setBusy(false);
  }
  return (
    <>
      <Button
        className="quick-capture-trigger"
        size="icon"
        aria-label={t('ui.quickCapture.deac82')}
        onClick={() => setOpen(true)}
      >
        <Plus size={20} />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!saving.current) setOpen(value);
        }}
        title={t('ui.getItOffYourMind.ddf689')}
        description={t('ui.localRulesSuggestTypesReviewEverythingBefore.73e555')}
      >
        <div className="capture-content">
          {saved ? (
            <div className="capture-success" role="status">
              <Check size={32} />
              <h3 dir="auto">{t('ui.savedTogetherOnce.0edc95')}</h3>
              <p dir="auto">
                {t('ui.itemsSavedWithTheirOriginalText.6de048', {
                  en0: items?.length,
                  ar0: items?.length,
                })}
              </p>
              <div className="capture-links">
                <Link to="/planner" onClick={() => setOpen(false)}>
                  {t('ui.tasksCalendar.a3a257')}
                </Link>
                <Link to="/life" onClick={() => setOpen(false)}>
                  {t('ui.goals.2efb59')}
                </Link>
                <Link to="/memory" onClick={() => setOpen(false)}>
                  {t('ui.memory.eee0de')}
                </Link>
              </div>
              <Button onClick={reset}>{t('ui.captureSomethingElse.f165f4')}</Button>
            </div>
          ) : (
            <>
              {!items ? (
                <>
                  <VoiceCapture
                    t={t}
                    onText={(value) => setText((old) => (old ? old + ' ' + value : value))}
                  />
                  <label className="capture-label" htmlFor="capture-text">
                    {t('ui.whatIsOnYourMind.fbf932')}
                  </label>
                  <textarea
                    dir="auto"
                    id="capture-text"
                    autoFocus
                    rows={5}
                    maxLength={4000}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('ui.taskReviewProposalTomorrowEventProjectReview.cfb569')}
                  />
                  <p dir="auto" className="muted">
                    {t('ui.oneItemPerLineIsClearestSemicolons.04f164')}
                  </p>
                  <div className="dialog-actions">
                    <Button disabled={!text.trim()} onClick={review}>
                      {t('ui.reviewItems.15aa19')}
                      <ArrowRight size={15} />
                    </Button>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      {t('ui.close.33469d')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="capture-review-heading">
                    <strong dir="auto">
                      {t('ui.reviewBeforeSaving.80ac43')} ·{' '}
                      {localizedNumber(items.length, t('en', 'ar'))}
                    </strong>
                    <Button variant="ghost" disabled={busy} onClick={() => setItems(null)}>
                      {t('ui.editOriginalText.939483')}
                    </Button>
                  </div>
                  <details className="capture-original">
                    <summary>{t('ui.originalRequest.f75143')}</summary>
                    <p dir="auto">{text}</p>
                  </details>
                  <div className="capture-items">
                    {items.map((item, index) => (
                      <article key={item.id} className="capture-item">
                        <div className="capture-item-head">
                          <span>
                            {t('ui.item.39baf8')} {localizedNumber(index + 1, t('en', 'ar'))}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={busy}
                            aria-label={`${t('ui.removeItem.423f7e')} ${localizedNumber(index + 1, t('en', 'ar'))}`}
                            onClick={() =>
                              setItems((old) => old?.filter((x) => x.id !== item.id) ?? null)
                            }
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                        <div className="editor-form">
                          <label>
                            {t('ui.title.770d09')}
                            <input
                              dir="auto"
                              disabled={busy}
                              required
                              maxLength={160}
                              value={item.title}
                              onChange={(e) => patch(item.id, { title: e.target.value })}
                            />
                          </label>
                          <div className="form-pair">
                            <label>
                              {t('ui.type.28bca4')}
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
                                onChange={(e) => patch(item.id, { area: e.target.value as Area })}
                              >
                                {areas.map((a) => (
                                  <option key={a} value={a}>
                                    {areaLabel(a, t)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          {['task', 'event', 'project', 'goal'].includes(item.kind) && (
                            <label>
                              {item.kind === 'task'
                                ? t('ui.plannedDayOptionalNotADeadline.6afe9f')
                                : item.kind === 'event'
                                  ? t('ui.eventDateRequired.5eedab')
                                  : t('ui.targetDateOptional.0eb380')}
                              <DateTimeInput
                                disabled={busy}
                                type="date"
                                value={item.date}
                                onChange={(e) => patch(item.id, { date: e.target.value })}
                                onInput={(e) => patch(item.id, { date: e.currentTarget.value })}
                                aria-label={
                                  item.kind === 'task'
                                    ? t('ui.plannedDayOptionalNotADeadline.6afe9f')
                                    : item.kind === 'event'
                                      ? t('ui.eventDateRequired.5eedab')
                                      : t('ui.targetDateOptional.0eb380')
                                }
                              />
                            </label>
                          )}
                          {['event', 'routine', 'task'].includes(item.kind) && (
                            <label>
                              {item.kind === 'task'
                                ? t('ui.executionTimeOptional24Hour.0a2700')
                                : t('ui.timeRequired24Hour.9124eb')}
                              <DateTimeInput
                                disabled={busy}
                                type="time"
                                value={item.time}
                                onChange={(e) => patch(item.id, { time: e.target.value })}
                                onInput={(e) => patch(item.id, { time: e.currentTarget.value })}
                                aria-label={
                                  item.kind === 'task'
                                    ? t('ui.executionTimeOptional24Hour.0a2700')
                                    : t('ui.timeRequired24Hour.9124eb')
                                }
                              />
                            </label>
                          )}
                          {item.timeAssumed && (
                            <p dir="auto" className="capture-hint">
                              {t('ui.theUnspecifiedHourWasInterpretedAsEvening.9fe1d7')}
                            </p>
                          )}
                          {item.kind === 'event' && (!item.date || !item.time) && (
                            <p dir="auto" className="capture-hint">
                              {t('ui.chooseAnExactDateAndTimeWeekday.b938e4')}
                            </p>
                          )}
                          {item.kind === 'task' && (
                            <div className="form-pair">
                              <label>
                                {t('ui.linkedGoalOptional.726c79')}
                                <select
                                  disabled={busy}
                                  value={item.goalId ?? ''}
                                  onChange={(e) =>
                                    patch(item.id, { goalId: e.target.value || undefined })
                                  }
                                >
                                  <option value="">{t('ui.noGoal.4e6d38')}</option>
                                  {goals.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.title}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                {t('ui.estimatedMinutesOptional.ea968f')}
                                <input
                                  disabled={busy}
                                  type="number"
                                  min={0}
                                  max={1440}
                                  value={item.estimate ?? ''}
                                  onChange={(e) =>
                                    patch(item.id, {
                                      estimate:
                                        e.target.value === '' ? undefined : Number(e.target.value),
                                    })
                                  }
                                />
                              </label>
                            </div>
                          )}
                          {item.kind === 'task' && (
                            <label>
                              {t('ui.tagsCommaSeparated.1ffb77')}
                              <input
                                dir="auto"
                                disabled={busy}
                                value={(item.tags ?? []).join(', ')}
                                onChange={(e) =>
                                  patch(item.id, {
                                    tags: e.target.value
                                      .split(/[,،]/)
                                      .map((value) => value.trim())
                                      .filter(Boolean)
                                      .slice(0, 10),
                                  })
                                }
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
                      </article>
                    ))}
                  </div>
                  {captureErrors(items) && (
                    <p dir="auto" className="capture-hint">
                      {t('ui.everyItemNeedsATitleUpTo.e1d9a2')}
                    </p>
                  )}
                  <div className="dialog-actions capture-confirm">
                    <Button disabled={busy || captureErrors(items)} onClick={() => void save()}>
                      {busy
                        ? t('ui.saving.5c017d')
                        : t('ui.confirm.35b84c', {
                            en0: counted(items.length, 'item', 'en'),
                            ar0: counted(items.length, 'item', 'ar'),
                          })}
                    </Button>
                    <Button disabled={busy} variant="outline" onClick={() => setOpen(false)}>
                      {t('ui.cancelWithoutSaving.768164')}
                    </Button>
                  </div>
                </>
              )}
              {error && (
                <p dir="auto" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
