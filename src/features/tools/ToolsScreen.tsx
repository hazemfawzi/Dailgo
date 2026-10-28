import { WidgetPanel } from './WidgetPanel';
import { CalendarPanel } from './CalendarPanel';
import { NotificationsPanel } from './NotificationsPanel';
import { ProPanel } from './ProPanel';
import { FamilyPanel } from './FamilyPanel';
import { GoalSharing } from './GoalSharing';
import { Link, useSearchParams } from 'react-router-dom';
import type { Translate } from '../../lib/workspace';
import { FinanceScreen } from './FinanceScreen';
import { PrayerPanel } from './PrayerPanel';
import { Insights } from './Insights';
export function ToolsScreen({ t }: { t: Translate }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'insights';
  return (
    <>
      <div className="page-heading">
        <div>
          <h1 dir="auto">{t('ui.lifeTools.2ae7ad')}</h1>
          <p dir="auto">{t('ui.understandYourProgressManageSimpleRecordsAnd.033afb')}</p>
        </div>
        <Link to="/">{t('ui.today.7981a9')}</Link>
      </div>
      <nav className="tools-tabs" aria-label={t('ui.lifeToolsSections.b0447a')}>
        {[
          ['insights', t('ui.insights.de2e70')],
          ['finance', t('ui.finance.097a53')],
          ['prayer', t('ui.prayerBreaks.08b46f')],
          ['family', t('ui.family.d1b531')],
          ['sharing', t('ui.goalSharing.c309ca')],
          ['connections', t('ui.connections.2545fd')],
          ['widgets', t('ui.homeScreen.306cfb')],
          ['pro', 'Pro'],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setParams({ tab: key })}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'widgets' ? (
        <WidgetPanel t={t} />
      ) : tab === 'connections' ? (
        <>
          <CalendarPanel t={t} />
          <NotificationsPanel t={t} />
        </>
      ) : tab === 'pro' ? (
        <ProPanel t={t} />
      ) : tab === 'family' ? (
        <FamilyPanel t={t} />
      ) : tab === 'sharing' ? (
        <GoalSharing t={t} />
      ) : tab === 'finance' ? (
        <FinanceScreen t={t} />
      ) : tab === 'prayer' ? (
        <PrayerPanel t={t} />
      ) : (
        <Insights t={t} />
      )}
    </>
  );
}
