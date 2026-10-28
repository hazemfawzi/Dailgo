import { formatNumber as localizedNumber } from '../i18n/format';
import { useState, useSyncExternalStore } from 'react';
import { applyUndo, clearUndo, currentUndo, subscribeUndo } from '../lib/undoStore';
import { transactData } from '../lib/storage';
import type { Translate } from '../lib/workspace';
import { Button } from './ui/button';
export function UndoNotice({ t }: { t: Translate }) {
  const ticket = useSyncExternalStore(subscribeUndo, currentUndo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!ticket)
    return error ? (
      <p dir="auto" className="undo-notice" role="status">
        {error}
        <Button variant="ghost" onClick={() => setError('')}>
          {t('ui.dismiss.f9e997')}
        </Button>
      </p>
    ) : null;
  return (
    <aside className="undo-notice" role="status">
      <span>
        {t('ui.savedUndoAvailableFor20Seconds.ae5d9b')} ·{' '}
        {localizedNumber(ticket.rows.length, t('en', 'ar'))}
      </span>
      <Button
        disabled={busy}
        variant="outline"
        onClick={async () => {
          setBusy(true);
          const ok = await transactData((data) => applyUndo(data, ticket));
          setBusy(false);
          clearUndo();
          setError(ok ? '' : t('ui.couldNotUndoTheItemChangedOr.7053e0'));
        }}
      >
        {t('ui.undo.cfb7bc')}
      </Button>
      <Button variant="ghost" aria-label={t('ui.dismissUndo.9ebe1d')} onClick={clearUndo}>
        ×
      </Button>
    </aside>
  );
}
