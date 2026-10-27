import { WidgetPanel } from './WidgetPanel';
import { CalendarPanel } from './CalendarPanel';
import { NotificationsPanel } from './NotificationsPanel';
import { ProPanel } from './ProPanel';
import { FamilyPanel } from './FamilyPanel';
import { GoalSharing } from './GoalSharing';
import { Link,useSearchParams } from 'react-router-dom';
import type { Translate } from '../../lib/workspace';
import { FinanceScreen } from './FinanceScreen';
import { PrayerPanel } from './PrayerPanel';
import { Insights } from './Insights';
export function ToolsScreen({t}:{t:Translate}){const [params,setParams]=useSearchParams();const tab=params.get('tab')??'insights';return <><div className="page-heading"><div><h1 dir="auto">{t('Life tools','أدوات حياتك')}</h1><p dir="auto">{t('Understand your progress, manage simple records and connect your planning tools.','افهم تقدمك، ونظم سجلاتك البسيطة، واربط أدوات التخطيط.')}</p></div><Link to="/">{t('Today','اليوم')}</Link></div><nav className="tools-tabs" aria-label={t('Life tools sections','أقسام أدوات الحياة')}>{[['insights',t('Insights','الإحصائيات')],['finance',t('Finance','المالية')],['prayer',t('Prayer breaks','فواصل الصلاة')],['family',t('Family','العائلة')],['sharing',t('Goal sharing','مشاركة الأهداف')],['connections',t('Connections','الربط والتذكيرات')],['widgets',t('Home screen','الشاشة الرئيسية')],['pro','Pro']].map(([key,label])=><button key={key} aria-current={tab===key?'page':undefined} onClick={()=>setParams({tab:key})}>{label}</button>)}</nav>{tab==='widgets'?<WidgetPanel t={t}/>:tab==='connections'?<><CalendarPanel t={t}/><NotificationsPanel t={t}/></>:tab==='pro'?<ProPanel t={t}/>:tab==='family'?<FamilyPanel t={t}/>:tab==='sharing'?<GoalSharing t={t}/>:tab==='finance'?<FinanceScreen t={t}/>:tab==='prayer'?<PrayerPanel t={t}/>:<Insights t={t}/>}</>;}
