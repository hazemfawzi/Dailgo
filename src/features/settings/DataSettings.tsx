import type { ComponentProps } from 'react';
import { OfflineSettings } from './OfflineSettings';
import { formatNumber } from '../../i18n/format';
import { JourneyPreferences } from '../journey/JourneyPreferences';
import { storageText } from '../../i18n/messages';
import { LocalServer } from './LocalServer';
import { Trash } from './Trash';
import { PlanningSettings } from './PlanningSettings';
import { useState } from 'react';
import { Download, Upload, Database } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import {
  useStorageState,
  restoreBackupData,
  refreshStorage,
  currentStorageToken,
  isServerStorage,
} from '../../lib/storage';
import { DATA_KEYS, STORE_KEY, makeBackup, parseBackup } from '../../lib/storageCore';
import type { Data } from '../../lib/storageCore';
import type { Translate } from '../../lib/workspace';
function download(value: string, name: string) {
  const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DataSettings({ t, inline = false }: { t: Translate; inline?: boolean }) {
  const { data, error } = useStorageState();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ data: Data; token: string; name: string } | null>(null);
  const [notice, setNotice] = useState('');
  function token() {
    return currentStorageToken();
  }
  const counts = (d: Data) => {
    const entries = d['personal-os.entries.v1'] as any;
    return [
      ((d['personal-os.tasks.v1'] as any[]) ?? []).length,
      (Array.isArray(entries) ? entries : (entries?.entries ?? [])).length,
      ((d['personal-os.conversations.v1'] as any[]) ?? []).length,
      Object.keys(d['personal-os.weeks.v1'] ?? {}).length,
    ]
      .map((value) => formatNumber(value, t('en', 'ar')))
      .join(' / ');
  };
  async function load(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw Error();
      const parsed = parseBackup(await file.text());
      setPreview({ data: parsed, token: token(), name: file.name });
      setNotice('');
    } catch {
      setNotice(t('ui.invalidOrUnsupportedBackupNothingChanged.f8e01e'));
    }
  }
  return (
    <>
      {!inline && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('ui.dataAndBackup.9ad2e5')}
          onClick={() => setOpen(true)}
        >
          <Database size={18} />
        </Button>
      )}
      {error && (
        <div className="data-status" role="alert">
          {error === 'corrupt'
            ? t('ui.savedDataCouldNotBeReadOriginal.621df7')
            : error === 'conflict'
              ? t('ui.dataChangedElsewhereRefreshTheWorkspaceReview.836561')
              : t('ui.saveFailedChangesWereNotSaved.1eb7d3')}{' '}
          <button onClick={() => setOpen(true)}>{t('ui.manageData.c568b7')}</button>{' '}
          {error === 'failed' && (
            <button onClick={refreshStorage}>{t('ui.retryStorage.ccc5e3')}</button>
          )}
        </div>
      )}
      <SettingsSurface
        inline={inline}
        open={open}
        onOpenChange={setOpen}
        title={t('ui.yourData.d5b913')}
        description={
          isServerStorage()
            ? storageText(t, 'backup')
            : t('ui.browserDataIsLocalTheOptionalLocal.906324')
        }
      >
        <p dir="auto">
          {t('ui.tasksItemsConversationsWeeks.bfcf5f')}: <strong dir="auto">{counts(data)}</strong>
        </p>
        <p dir="auto" className="muted">
          {t('ui.backupIncludesSettingsArchivedItemsAndLinks.1e889d')}
        </p>
        <p dir="auto" className="muted">
          {t('ui.thisIsYourPersonalBackupIncludingFinances.336112')}
        </p>
        <div className="dialog-actions">
          <Button
            disabled={error === 'corrupt'}
            onClick={() => {
              try {
                download(
                  JSON.stringify(makeBackup(data), null, 2),
                  `personal-os-backup-${new Date().toISOString().slice(0, 10)}.json`,
                );
                setNotice(t('ui.backupDownloadRequested.7a7d6a'));
              } catch {
                setNotice(t('ui.couldNotExportBackup.1fcdce'));
              }
            }}
          >
            <Download size={16} />
            {t('ui.exportBackup.69c09c')}
          </Button>
          <label className="backup-upload">
            <Upload size={16} />
            {t('ui.chooseBackup.22e2c5')}
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void load(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {error === 'corrupt' && (
          <Button
            variant="outline"
            onClick={() => {
              try {
                download(
                  JSON.stringify(
                    Object.fromEntries(
                      [STORE_KEY, ...DATA_KEYS].map((k) => [k, localStorage.getItem(k)]),
                    ),
                    null,
                    2,
                  ),
                  'personal-os-recovery-raw.json',
                );
              } catch {
                setNotice(t('ui.couldNotReadBrowserStorage.b1a274'));
              }
            }}
          >
            {t('ui.downloadOriginalDataForRecovery.eb1fdb')}
          </Button>
        )}
        {preview && (
          <section className="backup-preview">
            <h3 dir="auto">{t('ui.restorePreview.eea8cd')}</h3>
            <p dir="auto">{preview.name}</p>
            <strong dir="auto">{counts(preview.data)}</strong>
            <p dir="auto">{t('ui.replacesTheActiveWorkspaceIncludingSettingsExport.7e654a')}</p>
            <div className="dialog-actions">
              <Button
                onClick={async () => {
                  try {
                    if (token() !== preview.token) {
                      setNotice(t('ui.dataChangedSincePreviewSelectTheBackup.5722fc'));
                      setPreview(null);
                      return;
                    }
                    const ok = await restoreBackupData(preview.data, preview.token);
                    setNotice(
                      ok
                        ? t('ui.restoredSuccessfully.78088b')
                        : t('ui.restoreFailedCurrentDataWasKept.a7c00b'),
                    );
                    setPreview(null);
                  } catch {
                    setNotice(t('ui.restoreFailed.f38488'));
                  }
                }}
              >
                {t('ui.confirmReplacement.b7b96f')}
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)}>
                {t('ui.cancel.428808')}
              </Button>
            </div>
          </section>
        )}
        {notice && (
          <p dir="auto" role="status">
            {notice}
          </p>
        )}
        {!isServerStorage() && <LocalServer t={t} />}
        <OfflineSettings t={t} />
        <PlanningSettings t={t} />
        <JourneyPreferences t={t} />
        <Trash t={t} />
      </SettingsSurface>
    </>
  );
}

function SettingsSurface({
  inline,
  ...props
}: ComponentProps<typeof Dialog> & { inline: boolean }) {
  return inline ? (
    <section className="settings-panel">
      <h1>{props.title}</h1>
      <p>{props.description}</p>
      {props.children}
    </section>
  ) : (
    <Dialog {...props} />
  );
}
