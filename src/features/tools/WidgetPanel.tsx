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
      setNotice(t('Could not load widget devices.', 'تعذر تحميل أجهزة الـWidget.'));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="card tools-section">
      <h2 dir="auto">{t('Home screen · Today widget', 'الشاشة الرئيسية · Widget اليوم')}</h2>
      <p dir="auto">
        {t(
          'The web shortcut opens a compact Today view. A native Android/iPhone widget uses a separate read-only device token; it cannot change your tasks. Tokens expire after 30 days and can be revoked here. Widget refresh timing is controlled by the phone.',
          'اختصار الويب بيفتح عرض اليوم المختصر. Widget أندرويد أو iPhone الأصلي يستخدم رمز جهاز مستقل للقراءة فقط؛ لا يعدّل مهامك. الرمز ينتهي بعد ٣٠ يومًا وتقدر تلغيه من هنا. الهاتف بيتحكم في مواعيد تحديث الـWidget.',
        )}
      </p>
      <Link className="button button-outline" to="/today">
        {t('Open compact Today view', 'فتح عرض اليوم المختصر')}
      </Link>
      <p dir="auto">
        {t(
          'Install the native companion on your phone, then copy the server address and a new token into its setup screen. Anyone holding the token can read the titles of today’s tasks; do not share it in messages.',
          'ثبّت التطبيق المصاحب الأصلي على الهاتف، وبعدها انسخ عنوان السيرفر ورمزًا جديدًا إلى شاشة إعداده. أي شخص معاه الرمز يقدر يقرأ عناوين مهام اليوم؛ ما تشاركوش في الرسائل.',
        )}
      </p>
      <p dir="ltr">{location.origin}</p>
      <Button
        onClick={async () => {
          try {
            const value = await apiRequest('widgets', 'POST', {});
            setToken(value.token);
            await load();
          } catch {
            setNotice(t('Could not create a widget token.', 'تعذر إنشاء رمز Widget.'));
          }
        }}
      >
        {t('Create read-only widget token', 'إنشاء رمز Widget للقراءة فقط')}
      </Button>
      {token && (
        <aside>
          <p dir="auto">
            {t(
              'Shown once in this screen. Copy it into your own phone only.',
              'بيظهر هنا مرة واحدة. انسخه لهاتفك فقط.',
            )}
          </p>
          <code className="tools-secret-link">{token}</code>
          <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(token)}>
            {t('Copy device token', 'نسخ رمز الجهاز')}
          </Button>
          <Button variant="ghost" onClick={() => setToken('')}>
            {t('Hide device token', 'إخفاء رمز الجهاز')}
          </Button>
        </aside>
      )}
      <ul className="tools-records">
        {devices.map((device) => (
          <li key={device.id}>
            <span>
              {t('Device token expires', 'انتهاء رمز الجهاز')}:{' '}
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
                  setNotice(t('Could not revoke the device token.', 'تعذر إلغاء رمز الجهاز.'));
                }
              }}
            >
              {t('Revoke widget device', 'إلغاء جهاز Widget')}
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
