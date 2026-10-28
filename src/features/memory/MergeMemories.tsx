import { formatNumber as localizedNumber } from '../../i18n/format';
import { useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { transactData } from '../../lib/storage';
import type { Entry, Translate } from '../../lib/workspace';
import { duplicateMemories, mergeMemories } from './mergeModel';
export function MergeMemories({ entries, t }: { entries: Entry[]; t: Translate }) {
  const [pair, setPair] = useState<{ a: Entry; b: Entry } | null>(null);
  const [detail, setDetail] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const duplicates = duplicateMemories(entries);
  return (
    <>
      <section className="card merge-panel">
        <h3 dir="auto">
          {t('ui.reviewDuplicateMemories.9361c1')} ·{' '}
          {localizedNumber(duplicates.length, t('en', 'ar'))}
        </h3>
        <p dir="auto" className="muted">
          {t('ui.matchingTitlesTypeAndScopeOnlyReview.d12383')}
        </p>
        {duplicates.map(({ a, b }) => (
          <div className="attachment-row" key={a.id + b.id}>
            <strong dir="auto">{a.title}</strong>
            <Button
              variant="outline"
              onClick={() => {
                setPair({ a, b });
                setDetail([a.detail, b.detail].filter(Boolean).join('\n\n'));
                setNotice('');
              }}
            >
              {t('ui.previewMerge.423f90')}
            </Button>
          </div>
        ))}
      </section>
      <Dialog
        open={!!pair}
        onOpenChange={(v) => {
          if (!v && !busy) setPair(null);
        }}
        title={t('ui.reviewMemoryMerge.e3bbf2')}
        description={t('ui.theFirstRecordStaysActiveTheSecond.c72e53')}
      >
        <div className="editor-form">
          <h3 dir="auto">{pair?.a.title}</h3>
          <div className="merge-compare">
            <p dir="auto">{pair?.a.detail}</p>
            <p dir="auto">{pair?.b.detail}</p>
          </div>
          <label>
            {t('ui.reviewedMergedDetails.117783')}
            <textarea
              dir="auto"
              rows={6}
              maxLength={6000}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
          {notice && (
            <p dir="auto" role="status">
              {notice}
            </p>
          )}
          <div className="dialog-actions">
            <Button variant="outline" disabled={busy} onClick={() => setPair(null)}>
              {t('ui.cancel.428808')}
            </Button>
            <Button
              disabled={busy || !pair}
              onClick={async () => {
                if (!pair) return;
                setBusy(true);
                const ok = await transactData((data) =>
                  mergeMemories(data, pair.a, pair.b, detail),
                );
                setBusy(false);
                if (ok) setPair(null);
                else setNotice(t('ui.nothingChangedReopenTheLatestRecordsAnd.54e2d3'));
              }}
            >
              {t('ui.confirmMerge.921685')}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
