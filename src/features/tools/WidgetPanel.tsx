import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/serverStorage';
import type { Translate } from '../../lib/workspace';
import { formatTimestamp } from '../../i18n/format';
import { Button } from '../../components/ui/button';
export function WidgetPanel({ t }: { t: Translate }) {
  const [devices, setDevices] = useState<{ id: string; created: number; expires: number }[]>([]);
  const [token, setToken] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    try {
      setDevices((await apiRequest('widgets')).devices);
    } catch {
      setNotice(t('ui.couldNotLoadWidgetDevices.1cce4c'));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="card tools-section">
      <h2 dir="auto">{t('ui.homeScreenTodayWidget.0aa0ef')}</h2>
      <p dir="auto">{t('ui.theWebShortcutOpensACompactToday.00c300')}</p>
      <Link className="button button-outline" to="/today">
        {t('ui.openCompactTodayView.d40e33')}
      </Link>
      <p dir="auto">{t('ui.installTheNativeCompanionOnYourPhone.bbafad')}</p>
      <p dir="ltr">{location.origin}</p>
      <Button
        onClick={async () => {
          try {
            const value = await apiRequest('widgets', 'POST', {});
            setToken(value.token);
            await load();
          } catch {
            setNotice(t('ui.couldNotCreateAWidgetToken.226fad'));
          }
        }}
      >
        {t('ui.createReadOnlyWidgetToken.41396a')}
      </Button>
      {token && (
        <aside>
          <p dir="auto">{t('ui.shownOnceInThisScreenCopyIt.2023c6')}</p>
          <code className="tools-secret-link">{token}</code>
          <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(token)}>
            {t('ui.copyDeviceToken.0af730')}
          </Button>
          <Button variant="ghost" onClick={() => setToken('')}>
            {t('ui.hideDeviceToken.fa3e01')}
          </Button>
        </aside>
      )}
      <ul className="tools-records">
        {devices.map((device) => (
          <li key={device.id}>
            <span>
              {t('ui.deviceTokenExpires.118509')}:{' '}
              {formatTimestamp(new Date(device.expires).toISOString(), t('en', 'ar'))}
            </span>
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await apiRequest('widgets/' + device.id, 'DELETE', {});
                  setToken('');
                  await load();
                } catch {
                  setNotice(t('ui.couldNotRevokeTheDeviceToken.43af09'));
                }
              }}
            >
              {t('ui.revokeWidgetDevice.8dd868')}
            </Button>
          </li>
        ))}
      </ul>
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
