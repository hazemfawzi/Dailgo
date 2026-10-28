import { waitForPendingSaves } from '../lib/storage';
import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import type { Translate } from '../lib/workspace';
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
let registration: Promise<ServiceWorkerRegistration> | undefined;
export function OfflineApp({ t }: { t: Translate }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const reload = useRef(false);
  useEffect(() => {
    let disposed = false;
    const cleanup: (() => void)[] = [];
    const network = () => setOnline(navigator.onLine);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const installed = () => {
      setInstall(null);
      setNotice(t('ui.installedOnThisDevice.3777c7'));
    };
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('beforeinstallprompt', prompt);
    window.addEventListener('appinstalled', installed);
    const checkUpdate = () => {
      if (navigator.onLine) void registration?.then((reg) => reg.update()).catch(() => {});
    };
    window.addEventListener('focus', checkUpdate);
    const changed = () => {
      if (reload.current) location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', changed);
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      registration ??= navigator.serviceWorker.register('/sw.js');
      registration
        .then((reg) => {
          if (disposed) return;
          if (reg.waiting) setWaiting(reg.waiting);
          const changedWorker = () => {
            const worker = reg.installing;
            if (!worker) return;
            const changed = () => {
              if (!disposed && worker.state === 'installed' && navigator.serviceWorker.controller)
                setWaiting(reg.waiting);
            };
            worker.addEventListener('statechange', changed);
            cleanup.push(() => worker.removeEventListener('statechange', changed));
          };
          reg.addEventListener('updatefound', changedWorker);
          cleanup.push(() => reg.removeEventListener('updatefound', changedWorker));
        })
        .catch(() => setNotice(t('ui.offlineCacheCouldNotBePreparedOnline.794ae2')));
    }
    return () => {
      disposed = true;
      cleanup.forEach((fn) => fn());
      window.removeEventListener('focus', checkUpdate);
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      window.removeEventListener('beforeinstallprompt', prompt);
      window.removeEventListener('appinstalled', installed);
      navigator.serviceWorker?.removeEventListener('controllerchange', changed);
    };
  }, []);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('ui.installAndOfflineMode.9bb65d')}
        onClick={() => setOpen(true)}
      >
        <Download size={18} />
      </Button>
      {waiting && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          {t('ui.updateAvailable.e3ce20')}
        </Button>
      )}
      {!online && (
        <span className="offline-tag" role="status">
          {t('ui.offlineSavingUnavailable.c894cf')}
        </span>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('ui.useOnThisDevice.8ec470')}
        description={t('ui.installSupportDependsOnYourBrowserThe.f003aa')}
      >
        <p dir="auto">
          {t('ui.currentAppVersion.86630b')}:{' '}
          <code dir="ltr">{import.meta.env.VITE_APP_COMMIT.slice(0, 7)}</code>
        </p>
        <p dir="auto">
          {online ? t('ui.networkAvailable.8ca28e') : t('ui.networkUnavailable.465062')}
        </p>
        {install ? (
          <Button
            onClick={async () => {
              await install.prompt();
              const choice = await install.userChoice;
              setNotice(
                choice.outcome === 'accepted'
                  ? t('ui.installationAccepted.7f7fca')
                  : t('ui.installationDismissedYouCanContinueInThe.7530b5'),
              );
              setInstall(null);
            }}
          >
            {t('ui.installApplication.108089')}
          </Button>
        ) : (
          <p dir="auto" className="muted">
            {t('ui.ifAvailableUseYourBrowserMenuTo.7ba013')}
          </p>
        )}
        {waiting && (
          <Button
            variant="outline"
            onClick={async () => {
              if (!(await waitForPendingSaves())) {
                setNotice(t('ui.finishSavingOrResolveTheSaveError.c47d44'));
                return;
              }
              reload.current = true;
              waiting.postMessage({ type: 'SKIP_WAITING' });
            }}
          >
            {t('ui.applyReadyUpdateAndReload.b6fa96')}
          </Button>
        )}
        {notice && (
          <p dir="auto" role="status">
            {notice}
          </p>
        )}
        <p dir="auto" className="muted">
          {t('ui.exportABackupBeforeClearingSiteData.0e6d76')}
        </p>
      </Dialog>
    </>
  );
}
