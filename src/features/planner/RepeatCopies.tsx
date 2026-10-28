import { DateTimeInput } from '../../components/DateTimeInput';
import { useState } from 'react';
import { Repeat2 } from 'lucide-react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { transactData } from '../../lib/storage';
import { localDate } from '../../lib/workspace';
import type { Translate } from '../../lib/workspace';
import { addDays } from './weekModel';
import { repeatCopies, repeatDates } from './repeatModel';
export function RepeatCopies({
  id,
  revision,
  kind,
  t,
}: {
  id: string;
  revision?: string;
  kind: 'task' | 'event';
  t: Translate;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(addDays(localDate(), 1));
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('week');
  const [count, setCount] = useState(3);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const spec = { id, revision, kind, start, interval, count };
  let dates: string[] = [];
  try {
    dates = repeatDates(spec);
  } catch {}
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setOpen(true);
          setNotice('');
        }}
      >
        <Repeat2 size={14} />
        {t('ui.repeatSavedItem.d7774f')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        title={t('ui.previewRepeatedCopies.ad43b4')}
        description={t('ui.createsAFiniteSetOfIndependentCopies.a30414')}
      >
        <div className="editor-form">
          <label>
            {t('ui.firstCopyDate.39e7e9')}
            <DateTimeInput
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              onInput={(e) => setStart(e.currentTarget.value)}
              aria-label={t('ui.firstCopyDate.39e7e9')}
            />
          </label>
          <div className="form-pair">
            <label>
              {t('ui.repeatInterval.893fa6')}
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value as typeof interval)}
              >
                <option value="day">{t('ui.daily.6084d0')}</option>
                <option value="week">{t('ui.weekly.6a00fc')}</option>
                <option value="month">{t('ui.monthly.4c43ac')}</option>
              </select>
            </label>
            <label>
              {t('ui.copies130.7be19f')}
              <input
                type="number"
                min={1}
                max={30}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
          </div>
          <ul>
            {dates.map((date) => (
              <li key={date}>{date}</li>
            ))}
          </ul>
          <p dir="auto" className="muted">
            {t('ui.taskCopiesUseExecutionDatesNotDeadlines.91dd52')}
          </p>
          {notice && (
            <p dir="auto" role="status">
              {notice}
            </p>
          )}
          <div className="dialog-actions">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              {t('ui.close.33469d')}
            </Button>
            <Button
              type="button"
              disabled={busy || !dates.length}
              onClick={async () => {
                setBusy(true);
                const ok = await transactData((data) => repeatCopies(data, spec));
                setBusy(false);
                setNotice(
                  ok
                    ? t('ui.copiesSavedExistingIdsWereSkipped.0318c0')
                    : t('ui.nothingSavedTheSourceMayHaveChanged.2a4e4b'),
                );
              }}
            >
              {t('ui.confirmCopies.b96ff3')}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
