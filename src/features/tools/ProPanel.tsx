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
      .catch(() => setNotice(t('ui.couldNotLoadSubscriptionStatus.d25943')));
  }, []);
  return (
    <section className="card tools-section">
      <h2 dir="auto">Dailgo Pro</h2>
      <p dir="auto">{t('ui.yourPersonalRecordsRemainYoursExportAnd.e6cd21')}</p>
      <p dir="auto">{status?.pro ? t('ui.proActive.c0c544') : t('ui.freePlan.4accba')}</p>
      <ul>
        <li>{t('ui.largerConfiguredClaudeAllowanceWithServerSpending.8f5a6f')}</li>
        <li>{t('ui.goalSharingAndAdvancedPlanningInsights.789b2f')}</li>
      </ul>
      {!status?.enabled && <p dir="auto">{t('ui.paymentSetupIsPendingNoCheckoutOr.1a21a9')}</p>}
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
            ? t('ui.month.a8a289')
            : status.price.interval === 'year'
              ? t('ui.year.80a66c')
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
              setNotice(t('ui.couldNotOpenTheProviderCheckout.9d97ee'));
              setBusy(false);
            }
          }}
        >
          {t('ui.openProCheckout.b190ea')}
        </Button>
        <Button
          disabled={busy || !status?.enabled || !status.canManage}
          variant="outline"
          onClick={async () => {
            setBusy(true);
            try {
              location.assign((await apiRequest('billing/portal', 'POST', {})).url);
            } catch {
              setNotice(t('ui.couldNotOpenSubscriptionManagement.24ee78'));
              setBusy(false);
            }
          }}
        >
          {t('ui.manageOrCancelSubscription.aff2a1')}
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
