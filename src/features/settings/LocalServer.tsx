import { formatNumber } from '../../i18n/format';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { useStorageState, restoreBackupData } from '../../lib/storage';
import { storageToken, validateData } from '../../lib/storageCore';
import type { Data } from '../../lib/storageCore';
import type { Translate } from '../../lib/workspace';
type Preview = {
  direction: 'upload' | 'download';
  data: Data;
  localToken: string;
  serverRevision: string;
};
export function LocalServer({ t }: { t: Translate }) {
  const { data } = useStorageState();
  const [account, setAccount] = useState<{
    configured: boolean;
    signedIn: boolean;
    setupTokenRequired?: boolean;
    setupEnabled?: boolean;
  } | null>(null);
  const [setupToken, setSetupToken] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const count = (d: Data) => {
    const entries = d['personal-os.entries.v1'] as { entries?: unknown[] } | unknown[] | undefined;
    return `${formatNumber(((d['personal-os.tasks.v1'] ?? []) as unknown[]).length, t('en', 'ar'))} / ${formatNumber((Array.isArray(entries) ? entries : (entries?.entries ?? [])).length, t('en', 'ar'))}`;
  };
  async function request(path: string, method = 'GET', body?: unknown) {
    const response = await fetch('/api/' + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw Error(String(response.status));
    return result;
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNotice('');
    try {
      await fn();
    } catch (error) {
      setNotice(
        error instanceof Error && error.message === '409'
          ? t('ui.dataChangedOrTheAccountAlreadyExists.7f4307')
          : t('ui.serverRequestFailedCheckTheConnectionAnd.b530c4'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="local-server editor-form">
      <h3 dir="auto">{t('ui.serverStorage.b8f2ed')}</h3>
      <p dir="auto" className="muted">
        {t('ui.theApplicationServerStoresASeparateSqlite.7e49ce')}
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await request('health');
            setAccount(await request('account/status'));
            setNotice(t('ui.serverIsAvailable.a78291'));
          })
        }
      >
        {t('ui.checkServer.e63942')}
      </Button>
      {account && !account.signedIn && (
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await request(account.configured ? 'account/login' : 'account/setup', 'POST', {
                username,
                password,
                setupToken: account.configured ? undefined : setupToken,
              });
              setPassword('');
              setSetupToken('');
              setAccount(await request('account/status'));
              setNotice(t('ui.signedInNoDataTransferred.994713'));
            });
          }}
        >
          <label>
            {t('ui.username.647b84')}
            <input
              dir="auto"
              required
              minLength={3}
              maxLength={80}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            {t('ui.passwordAtLeast12Characters.7401e9')}
            <input
              type="password"
              required
              minLength={12}
              maxLength={200}
              autoComplete={account.configured ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <>
            {!account.configured && account.setupEnabled === false && (
              <p dir="auto" className="notice">
                {t('ui.accountSetupIsDisabledUntilTheAdministrator.377398')}
              </p>
            )}
            {!account.configured && account.setupTokenRequired && (
              <label>
                {t('ui.privateSetupTokenFromServerConfiguration.07404f')}
                <input
                  type="password"
                  required
                  autoComplete="off"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                />
              </label>
            )}
          </>
          <Button disabled={busy || (!account.configured && account.setupEnabled === false)}>
            {account.configured ? t('ui.signIn.471dfa') : t('ui.createAccount.c108a3')}
          </Button>
        </form>
      )}
      {account?.signedIn && (
        <div className="dialog-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const remote = await request('workspace');
                setPreview({
                  direction: 'upload',
                  data: JSON.parse(JSON.stringify(data)),
                  localToken: storageToken(localStorage),
                  serverRevision: remote.revision,
                });
              })
            }
          >
            {t('ui.previewSaveToServer.1c1850')}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const remote = await request('workspace');
                if (!remote.data) {
                  setNotice(t('ui.noServerCopyYet.e54633'));
                  return;
                }
                validateData(remote.data);
                setPreview({
                  direction: 'download',
                  data: remote.data,
                  localToken: storageToken(localStorage),
                  serverRevision: remote.revision,
                });
              })
            }
          >
            {t('ui.previewLoadFromServer.e83caf')}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await request('account/logout', 'POST', {});
                setAccount(await request('account/status'));
              })
            }
          >
            {t('ui.signOut.cc0fc3')}
          </Button>
        </div>
      )}
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
      {account?.signedIn && (
        <details>
          <summary>{t('ui.changePassword.b51df8')}</summary>
          <form
            className="editor-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await request('account/password', 'POST', { currentPassword, newPassword });
                setCurrentPassword('');
                setNewPassword('');
                setNotice(t('ui.passwordChangedOtherSessionsWereSignedOut.15da42'));
              });
            }}
          >
            <label>
              {t('ui.currentPassword.08cdad')}
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={200}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label>
              {t('ui.newPassword.f7f4ac')}
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={200}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <Button disabled={busy}>{t('ui.updatePassword.b6163e')}</Button>
          </form>
        </details>
      )}
      <Dialog
        open={!!preview}
        onOpenChange={(v) => {
          if (!v && !busy) setPreview(null);
        }}
        title={t('ui.reviewLocalDataTransfer.c39320')}
        description={
          preview?.direction === 'upload'
            ? t('ui.replacesTheSeparateServerCopyWithThis.e35943')
            : t('ui.replacesAllBrowserRecordsAndSettingsWith.f42f48')
        }
      >
        <p dir="auto">
          {t('ui.browserTasksRecords.0a6a4c')}: {count(data)}
        </p>
        <p dir="auto">
          {t('ui.transferTasksRecords.ca586c')}: {preview ? count(preview.data) : ''}
        </p>
        {notice && (
          <p dir="auto" role="status">
            {notice}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>
            {t('ui.cancel.428808')}
          </Button>
          <Button
            disabled={busy || !preview}
            onClick={() =>
              void run(async () => {
                if (!preview) return;
                if (storageToken(localStorage) !== preview.localToken) throw Error('409');
                if (preview.direction === 'upload')
                  await request('workspace', 'PUT', {
                    revision: preview.serverRevision,
                    data: preview.data,
                  });
                else {
                  const latest = await request('workspace');
                  if (latest.revision !== preview.serverRevision) throw Error('409');
                  if (!(await restoreBackupData(preview.data, preview.localToken)))
                    throw Error('409');
                }
                setPreview(null);
                setNotice(t('ui.transferConfirmedAndSaved.034e76'));
              })
            }
          >
            {t('ui.confirmReplacement.b7b96f')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
