import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/serverStorage';
import type { Translate } from '../../lib/workspace';
import { Button } from '../../components/ui/button';
type Settings = {
  email: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  morning: boolean;
  evening: boolean;
  tasks: boolean;
  events: boolean;
  showDetails: boolean;
  verified: boolean;
};
type Status = {
  settings: Settings;
  pushAvailable: boolean;
  emailAvailable: boolean;
  vapidPublicKey: string | null;
  subscriptions: number;
};
export function NotificationsPanel({ t }: { t: Translate }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const value = await apiRequest('notifications');
      setStatus(value);
      setSettings(value.settings);
    } catch {
      setNotice(t('ui.couldNotLoadReminderSettings.e8f285'));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function subscribe() {
    setBusy(true);
    try {
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      )
        throw Error();
      if ((await Notification.requestPermission()) !== 'granted') throw Error();
      const registration = await navigator.serviceWorker.ready;
      const raw = status!.vapidPublicKey!.replace(/-/g, '+').replace(/_/g, '/');
      const key = Uint8Array.from(atob(raw), (char) => char.charCodeAt(0));
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      try {
        await apiRequest('notifications/subscribe', 'POST', subscription.toJSON());
      } catch (error) {
        await subscription.unsubscribe();
        throw error;
      }
      setNotice(t('ui.thisDeviceIsRegisteredEnablePushAnd.4d282f'));
      await load();
    } catch {
      setNotice(t('ui.pushRegistrationFailedOrPermissionWasDeclined.b73095'));
    }
    setBusy(false);
  }
  return (
    <section className="card tools-section editor-form">
      <h2 dir="auto">{t('ui.pushAndEmailReminders.c01ac6')}</h2>
      <p dir="auto">{t('ui.externalDeliveryIsOptInKeepTask.5b3420')}</p>
      {settings && status && (
        <>
          <p dir="auto" className="integration-status">
            Push:{' '}
            {status.pushAvailable ? t('ui.available.080863') : t('ui.serverSetupRequired.38c3bc')} ·{' '}
            {t('ui.email.c3657f')}:{' '}
            {status.emailAvailable ? t('ui.available.080863') : t('ui.serverSetupRequired.38c3bc')}
          </p>
          <label>
            {t('ui.reminderEmail.837e4d')}
            <input
              type="email"
              value={settings.email}
              maxLength={254}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            />
          </label>
          <p dir="auto">
            {settings.verified
              ? t('ui.emailVerified.949aa1')
              : t('ui.saveYourEmailThenRequestItsConfirmation.90d41c')}
          </p>
          <div className="tools-tabs">
            <Button
              disabled={busy || !status.emailAvailable || !settings.email}
              variant="outline"
              onClick={async () => {
                setBusy(true);
                try {
                  await apiRequest('notifications', 'PUT', settings);
                  await apiRequest('notifications/verify', 'POST', {});
                  setNotice(t('ui.confirmationEmailSentOpenItsLinkThen.0e8e63'));
                } catch {
                  setNotice(t('ui.couldNotSendVerificationReviewTheEmail.6b638c'));
                }
                setBusy(false);
              }}
            >
              {t('ui.sendEmailConfirmation.ddfa2b')}
            </Button>
            <Button disabled={busy} variant="ghost" onClick={() => void load()}>
              {t('ui.refreshReminderStatus.80131e')}
            </Button>
          </div>
          {(
            [
              'emailEnabled',
              'pushEnabled',
              'morning',
              'evening',
              'tasks',
              'events',
              'showDetails',
            ] as const
          ).map((key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={settings[key]}
                disabled={
                  (key === 'emailEnabled' && !status.emailAvailable) ||
                  (key === 'pushEnabled' && !status.pushAvailable)
                }
                onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
              />
              {
                {
                  emailEnabled: t('ui.emailReminders.4e9839'),
                  pushEnabled: t('ui.pushReminders.685d97'),
                  morning: t('ui.morningPlan.d97e9c'),
                  evening: t('ui.eveningReview.31ee28'),
                  tasks: t('ui.dueAndPlannedTasksUpTo10.fab6c4'),
                  events: t('ui.appointmentsStartingNowUpTo10Per.ac2308'),
                  showDetails: t('ui.includeTaskTitlesInNotifications.c53314'),
                }[key]
              }
            </label>
          ))}
          <p dir="auto">{t('ui.morningAndEveningTimesFollowYourDaily.a3dada')}</p>
          <div className="tools-tabs">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const value = await apiRequest('notifications', 'PUT', settings);
                  setStatus(value);
                  setSettings(value.settings);
                  setNotice(t('ui.reminderPreferencesSaved.0c3b9f'));
                } catch {
                  setNotice(t('ui.couldNotSaveReminders.bbc0a3'));
                }
                setBusy(false);
              }}
            >
              {t('ui.saveReminderPreferences.7bafb8')}
            </Button>
            <Button
              disabled={busy || !status.pushAvailable}
              variant="outline"
              onClick={() => void subscribe()}
            >
              {t('ui.registerThisDeviceForPush.59bbb4')}
            </Button>
            <Button
              disabled={busy}
              variant="ghost"
              onClick={async () => {
                setBusy(true);
                try {
                  const registration = await navigator.serviceWorker?.getRegistration();
                  const subscription = await registration?.pushManager.getSubscription();
                  if (subscription) {
                    await apiRequest('notifications/subscribe', 'DELETE', {
                      endpoint: subscription.endpoint,
                    });
                    await subscription.unsubscribe();
                  }
                  await load();
                  setNotice(t('ui.thisDeviceWasUnregistered.e0cca7'));
                } catch {
                  setNotice(t('ui.couldNotUnregisterThisDevice.b0532f'));
                }
                setBusy(false);
              }}
            >
              {t('ui.unregisterThisDevice.045d17')}
            </Button>
            <Button
              disabled={busy || (!status.emailAvailable && !status.pushAvailable)}
              variant="outline"
              onClick={async () => {
                setBusy(true);
                try {
                  await apiRequest('notifications/test', 'POST', {});
                  setNotice(t('ui.requestedTestNotificationSent.8cfe7f'));
                } catch {
                  setNotice(t('ui.noVerifiedDestinationOrDeliveryFailedCheck.d220ae'));
                }
                setBusy(false);
              }}
            >
              {t('ui.sendOneTestReminder.743884')}
            </Button>
          </div>
        </>
      )}
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
