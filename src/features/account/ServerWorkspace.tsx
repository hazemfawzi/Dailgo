import { clearOffline, offlineEnabled } from '../../lib/offlineCache';
import { getServerAccount } from '../../lib/serverStorage';
import { createTranslator } from '../../i18n/translate';
import { createPortal } from 'react-dom';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { useEffect, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { apiRequest, ApiError, loadServerStore, replaceServerStore } from '../../lib/serverStorage';
import {
  connectServerStorage,
  connectOfflineStorage,
  disconnectServerStorage,
  startServerRefresh,
  useStorageState,
  refreshStorage,
} from '../../lib/storage';
import { readStore, storageToken } from '../../lib/storageCore';
import type { Data } from '../../lib/storageCore';
import './account.css';
type Account = {
  configured: boolean;
  signedIn: boolean;
  username?: string;
  setupTokenRequired?: boolean;
  setupEnabled?: boolean;
};
type Migration = { data: Data; token: string; revision: string };
function ConnectionBar({ onLogout }: { onLogout: () => Promise<void> }) {
  const { data, error, saving, queued, offline } = useStorageState();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.getElementById('account-controls'));
  }, []);
  const t = createTranslator(data['personal-os.language'] === 'en' ? 'en' : 'ar');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setMessage('');
    try {
      await apiRequest('account/password', 'POST', {
        currentPassword: fields.get('currentPassword'),
        newPassword: fields.get('newPassword'),
      });
      form.reset();
      setMessage('تم تغيير كلمة المرور وتسجيل خروج الأجهزة الأخرى.');
    } catch {
      setMessage('تعذر تغيير كلمة المرور. راجع كلمة المرور الحالية والاتصال.');
    } finally {
      setBusy(false);
    }
  }
  if (!target) return null;
  return createPortal(
    <div className="server-connection">
      <span className={'save-status ' + (error ? 'needs-attention' : '')} role="status">
        {saving
          ? t('ui.saving.5c017d')
          : queued
            ? t('ui.savedOnDevice.5ab857')
            : offline || error
              ? t('ui.notConnected.f7a562')
              : t('ui.saved.ecdebe')}
      </span>
      <details className="account-menu">
        <summary aria-label={t('ui.accountMenu.6f3a09')}>
          <span className="avatar small">Y</span>
          <span className="sr-only">{t('ui.account.0626a3')}</span>
        </summary>
        <div className="account-panel">
          <h3>{t('ui.yourAccount.d8ee63')}</h3>
          {error && <button onClick={refreshStorage}>{t('ui.reconnectAndReview.9b77e9')}</button>}
          <details>
            <summary>{t('ui.changePassword.b51df8')}</summary>
            <form onSubmit={password}>
              <label>
                {t('ui.currentPassword.08cdad')}
                <input
                  name="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                  maxLength={200}
                />
              </label>
              <label>
                {t('ui.newPassword.f7f4ac')}
                <input
                  name="newPassword"
                  type="password"
                  required
                  minLength={12}
                  maxLength={200}
                  autoComplete="new-password"
                />
              </label>
              <button disabled={busy}>{t('ui.changePassword.b51df8')}</button>
            </form>
          </details>
          {queued && <p>{t('ui.syncPendingChangesBeforeSigningOut.8248f6')}</p>}
          <button
            className="account-logout"
            disabled={busy || saving || queued}
            onClick={async () => {
              setBusy(true);
              try {
                await onLogout();
              } catch {
                setMessage(t('ui.couldNotSignOutTryAgain.59f5bf'));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('ui.signOut.cc0fc3')}
          </button>
          {message && <p role="status">{message}</p>}
        </div>
      </details>
    </div>,
    target,
  );
}
export function ServerWorkspace({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'login' | 'migration' | 'ready' | 'error'>(
    'loading',
  );
  const [account, setAccount] = useState<Account | null>(null);
  const [migration, setMigration] = useState<Migration | null>(null);
  const [localProblem, setLocalProblem] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function enter() {
    const remote = await loadServerStore();
    if (remote.revision === 'empty') {
      try {
        const local = readStore(localStorage);
        setMigration({
          data: local.data,
          token: storageToken(localStorage),
          revision: remote.revision,
        });
        setLocalProblem(false);
      } catch {
        setMigration({ data: {}, token: '', revision: remote.revision });
        setLocalProblem(true);
      }
      setPhase('migration');
      return;
    }
    await connectServerStorage();
    setPhase('ready');
  }
  async function check() {
    setNotice('');
    setPhase('loading');
    if (!navigator.onLine && (await connectOfflineStorage())) {
      setPhase('ready');
      return;
    }
    try {
      const result = (await apiRequest('account/status')) as Account;
      setAccount(result);
      if (result.signedIn) await enter();
      else {
        disconnectServerStorage();
        setPhase('login');
      }
    } catch (error) {
      if (!(error instanceof ApiError) && (await connectOfflineStorage())) {
        setPhase('ready');
        return;
      }
      setPhase(error instanceof ApiError && error.status === 401 ? 'login' : 'error');
    }
  }
  useEffect(() => {
    void check();
    const expired = () => {
      disconnectServerStorage();
      setNotice('الحساب اتغير أو انتهت الجلسة. سجّل الدخول مجددًا؛ لم يتم التحويل لتخزين محلي.');
      setPhase('login');
    };
    window.addEventListener('dailgo-session-expired', expired);
    return () => window.removeEventListener('dailgo-session-expired', expired);
  }, []);
  useEffect(() => (phase === 'ready' ? startServerRefresh() : undefined), [phase]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setNotice('');
    try {
      await apiRequest(account?.configured ? 'account/login' : 'account/setup', 'POST', {
        username: fields.get('username'),
        password: fields.get('password'),
        setupToken: fields.get('setupToken') || undefined,
        remember: fields.get('remember') === 'on',
      });
      const result = await apiRequest('account/status');
      setAccount(result);
      await enter();
    } catch (error) {
      setNotice(
        error instanceof ApiError && error.status === 429
          ? 'محاولات كثيرة. انتظر خمس دقائق ثم حاول مجددًا.'
          : 'تعذر الدخول أو إنشاء الحساب. راجع البيانات والاتصال؛ لو الحساب اتعمل بالفعل اضغط فحص الاتصال.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function initialize(importLocal: boolean) {
    if (!migration || busy) return;
    setBusy(true);
    setNotice('');
    try {
      if (importLocal && storageToken(localStorage) !== migration.token)
        throw Error('local-changed');
      const data = importLocal
        ? migration.data
        : {
            'personal-os.tasks.v1': [],
            'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: [] },
          };
      await replaceServerStore(data, migration.revision);
      await connectServerStorage();
      setMigration(null);
      setPhase('ready');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setNotice('ظهرت بيانات على السيرفر من جهاز آخر. أعد الفحص لفتحها بدون استبدالها.');
      } else
        setNotice(
          'تعذر النقل أو تغيرت بيانات المتصفح. أعد الفحص والمحاولة. النسخة المحلية محفوظة.',
        );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await apiRequest('account/logout', 'POST', {});
    const account = getServerAccount();
    if (account && offlineEnabled()) await clearOffline(account);
    disconnectServerStorage();
    await check();
  }
  if (phase === 'ready')
    return (
      <>
        <ConnectionBar onLogout={logout} />
        {children}
      </>
    );
  const tasks = (migration?.data['personal-os.tasks.v1'] ?? []) as unknown[];
  const entries = migration?.data['personal-os.entries.v1'] as
    { entries?: unknown[] } | unknown[] | undefined;
  const count = Array.isArray(entries) ? entries.length : (entries?.entries?.length ?? 0);
  return (
    <main className="account-screen" dir="rtl">
      <section className="account-card">
        <h1 dir="auto">Dailgo · مساحة عمل متصلة</h1>
        <p dir="auto">
          بياناتك بتتحفظ على السيرفر بعد تسجيل الدخول، وتظهر على أجهزتك عند اتصالها بنفس السيرفر.
          انقطاع الاتصال يوقف الحفظ؛ لا يتم حفظ تغييرات سرية في المتصفح بدلًا منه.
        </p>
        {phase === 'loading' && (
          <p dir="auto" role="status">
            جاري فحص الاتصال والحساب…
          </p>
        )}
        {phase === 'error' && (
          <p dir="auto" role="alert">
            السيرفر غير متاح. شغّل سيرفر التطبيق ثم أعد الفحص. بيانات المتصفح القديمة لم تتغير.
          </p>
        )}
        {phase === 'login' && (
          <form onSubmit={login}>
            <h2 dir="auto">{account?.configured ? 'تسجيل الدخول' : 'إنشاء الحساب الشخصي'}</h2>
            <label>
              اسم المستخدم
              <input
                dir="auto"
                name="username"
                required
                minLength={3}
                maxLength={80}
                autoComplete="username"
              />
            </label>
            <label>
              كلمة المرور (12 حرفًا على الأقل)
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={200}
                autoComplete={account?.configured ? 'current-password' : 'new-password'}
              />
            </label>
            {!account?.configured && account?.setupTokenRequired && (
              <label>
                رمز تهيئة الحساب الخاص
                <input name="setupToken" type="password" required autoComplete="off" />
              </label>
            )}
            {!account?.configured && account?.setupEnabled === false && (
              <p dir="auto">إنشاء الحساب معطّل حتى يضبط المشرف رمز التهيئة على السيرفر.</p>
            )}
            {account?.configured && (
              <label className="remember-choice">
                <input name="remember" type="checkbox" />
                تذكرني على هذا الجهاز
              </label>
            )}
            <button disabled={busy || (!account?.configured && account?.setupEnabled === false)}>
              {busy ? 'جاري التنفيذ…' : account?.configured ? 'دخول' : 'إنشاء الحساب'}
            </button>
          </form>
        )}
        {phase === 'migration' && (
          <>
            <h2 dir="auto">ابدأ مساحة السيرفر</h2>
            <p dir="auto">
              السيرفر لا يحتوي نسخة بعد. النسخة المحلية ستبقى كما هي، ولن يتم دمجها أو حذفها
              تلقائيًا.
            </p>
            {localProblem ? (
              <p dir="auto" role="alert">
                تعذرت قراءة بيانات المتصفح. احتفظ ببيانات الموقع ولا تمسحها؛ يمكنك البدء بمساحة
                سيرفر فارغة.
              </p>
            ) : (
              <p dir="auto">
                النسخة المحلية: {localizedNumber(tasks.length, 'ar')} مهمة و
                {localizedNumber(count, 'ar')} سجل. النقل يشمل الإعدادات والمحادثات والتخطيط
                والمحفوظات.
              </p>
            )}
            <div className="account-actions">
              <button
                disabled={busy || localProblem || !Object.keys(migration?.data ?? {}).length}
                onClick={() => void initialize(true)}
              >
                نقل نسخة المتصفح إلى السيرفر
              </button>
              <button disabled={busy} onClick={() => void initialize(false)}>
                بدء مساحة فارغة على السيرفر
              </button>
            </div>
          </>
        )}
        {notice && (
          <p dir="auto" role="alert">
            {notice}
          </p>
        )}
        {phase !== 'loading' && (
          <button className="secondary" disabled={busy} onClick={() => void check()}>
            فحص الاتصال والحساب مجددًا
          </button>
        )}
      </section>
    </main>
  );
}
