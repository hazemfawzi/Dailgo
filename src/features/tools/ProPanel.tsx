import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/serverStorage';
import type { Translate } from '../../lib/workspace';
import { localeFor } from '../../i18n/format';
import { Button } from '../../components/ui/button';
export function ProPanel({ t }: { t: Translate }) {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    void apiRequest('billing')
      .then(setStatus)
      .catch(() =>
        setNotice(t('Could not load subscription status.', 'تعذر تحميل حالة الاشتراك.')),
      );
  }, []);
  return (
    <section className="card tools-section">
      <h2 dir="auto">Dailgo Pro</h2>
      <p dir="auto">
        {t(
          'Your personal records remain yours. Export and account access do not require Pro. Paid features activate only after a verified payment notification from the provider.',
          'بياناتك الشخصية بتفضل ملكك. التصدير والدخول للحساب لا يحتاجان Pro. مزايا الاشتراك بتتفعل بعد تأكيد الدفع الموثق من المزود فقط.',
        )}
      </p>
      <p dir="auto">
        {status?.pro ? t('Pro active', 'Pro نشط') : t('Free plan', 'الخطة المجانية')}
      </p>
      <ul>
        <li>
          {t(
            'Larger configured Claude allowance, with server spending limits',
            'حصة Claude أكبر حسب إعداد السيرفر وحدود الإنفاق',
          )}
        </li>
        <li>
          {t(
            'Goal sharing and advanced planning insights',
            'مشاركة الأهداف وإحصائيات التخطيط المتقدمة',
          )}
        </li>
      </ul>
      {!status?.enabled && (
        <p dir="auto">
          {t(
            'Payment setup is pending. No checkout or charge is available. Sharing and insights are available in the current beta.',
            'إعداد الدفع لسه ناقص. مفيش دفع أو خصم متاح حاليًا. المشاركة والإحصائيات متاحة في النسخة التجريبية الحالية.',
          )}
        </p>
      )}
      {status?.price && (
        <p dir="auto">
          {new Intl.NumberFormat(localeFor(t('en', 'ar')), {
            style: 'currency',
            currency: status.price.currency,
          }).format(
            status.price.amount /
              10 **
                (new Intl.NumberFormat('en', {
                  style: 'currency',
                  currency: status.price.currency,
                }).resolvedOptions().maximumFractionDigits ?? 2),
          )}{' '}
          /{' '}
          {status.price.interval === 'month'
            ? t('month', 'شهر')
            : status.price.interval === 'year'
              ? t('year', 'سنة')
              : status.price.interval}
        </p>
      )}
      <div className="tools-tabs">
        <Button
          disabled={busy || !status?.enabled || !status.price}
          onClick={async () => {
            setBusy(true);
            try {
              location.assign((await apiRequest('billing/checkout', 'POST', {})).url);
            } catch {
              setNotice(t('Could not open the provider checkout.', 'تعذر فتح صفحة الدفع.'));
              setBusy(false);
            }
          }}
        >
          {t('Open Pro checkout', 'فتح اشتراك Pro')}
        </Button>
        <Button
          disabled={busy || !status?.enabled || !status.canManage}
          variant="outline"
          onClick={async () => {
            setBusy(true);
            try {
              location.assign((await apiRequest('billing/portal', 'POST', {})).url);
            } catch {
              setNotice(t('Could not open subscription management.', 'تعذر فتح إدارة الاشتراك.'));
              setBusy(false);
            }
          }}
        >
          {t('Manage or cancel subscription', 'إدارة الاشتراك أو إلغاؤه')}
        </Button>
      </div>
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
