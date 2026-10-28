import { useEffect, useState } from 'react';
import type { Translate } from '../../lib/workspace';
import { enableOfflineEditing, syncOfflineChanges, useStorageState } from '../../lib/storage';
import { offlineEnabled } from '../../lib/offlineCache';
import { Button } from '../../components/ui/button';
export function OfflineSettings({ t }: { t: Translate }) {
  const { queued, offline, syncConflicts } = useStorageState();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [choices, setChoices] = useState<Record<string, 'local' | 'server'>>({});
  const signature = JSON.stringify(syncConflicts);
  useEffect(() => setChoices({}), [signature]);
  const display = (value: unknown) =>
    value === undefined
      ? t('ui.deleted.07be81')
      : typeof value === 'string'
        ? value.slice(0, 300)
        : JSON.stringify(value).slice(0, 300);
  return (
    <section className="editor-form">
      <h3>{t('ui.useWithoutAConnection.99b1b5')}</h3>
      <label className="remember-choice">
        <input
          type="checkbox"
          checked={offlineEnabled()}
          disabled={busy || queued}
          onChange={async (e) => {
            setBusy(true);
            try {
              const ok = await enableOfflineEditing(e.target.checked);
              setNotice(ok ? '' : t('ui.syncPendingChangesFirst.2ce418'));
            } catch {
              setNotice(t('ui.couldNotPrepareStorageOnThisDevice.6f77b8'));
            }
            setBusy(false);
          }}
        />
        {t('ui.keepAPrivateCopyOnThisDevice.90cd18')}
      </label>
      <p>{t('ui.useThisOnYourOwnDevicePending.fef147')}</p>
      {queued && (
        <>
          <p role="status">
            {offline
              ? t('ui.changesAreSavedOnThisDeviceWaiting.3a58c7')
              : t('ui.pendingChangesNeedSynchronizationOrConflictReview.fd60ef')}
          </p>
          <Button
            disabled={busy || !navigator.onLine || syncConflicts.length > 0}
            onClick={async () => {
              setBusy(true);
              await syncOfflineChanges();
              setBusy(false);
            }}
          >
            {t('ui.syncNow.a8bc64')}
          </Button>
        </>
      )}
      {syncConflicts.map((conflict, index) => (
        <fieldset className="sync-conflict" key={conflict.path}>
          <legend>{t('ui.chooseTheVersionToKeep.2071bf')}</legend>
          <p>
            {t('ui.yourPendingChange.104aae')}: <bdi>{display(conflict.local)}</bdi>
          </p>
          <p>
            {t('ui.otherDeviceSChange.f215b8')}: <bdi>{display(conflict.server)}</bdi>
          </p>
          <select
            aria-label={t('ui.conflictChoice.5faf1d') + ' ' + String(index + 1)}
            value={choices[conflict.path] ?? ''}
            onChange={(e) =>
              setChoices({ ...choices, [conflict.path]: e.target.value as 'local' | 'server' })
            }
          >
            <option value="">{t('ui.reviewAndChoose.2e4e35')}</option>
            <option value="local">{t('ui.keepMyChange.fbd9f5')}</option>
            <option value="server">{t('ui.keepTheOtherChange.db00f8')}</option>
          </select>
        </fieldset>
      ))}
      {syncConflicts.length > 0 && (
        <Button
          disabled={
            busy || !navigator.onLine || syncConflicts.some((conflict) => !choices[conflict.path])
          }
          onClick={async () => {
            setBusy(true);
            const ok = await syncOfflineChanges(choices);
            setNotice(
              ok
                ? t('ui.resolvedChangesAreSynced.e8efe2')
                : t('ui.theRecordsChangedAgainReviewTheLatest.a18d31'),
            );
            setBusy(false);
          }}
        >
          {t('ui.confirmReviewedSynchronization.b3ddad')}
        </Button>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
