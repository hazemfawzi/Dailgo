import { GoalTemplates } from './GoalTemplates';
import { activeGoals } from '../../i18n/format';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { useState } from 'react';
import {
  BriefcaseBusiness,
  Heart,
  Activity,
  BookOpen,
  Wallet,
  Flag,
  ArrowUpRight,
} from 'lucide-react';
import { EntryCollection } from '../../components/EntryCollection';
import { areas, areaLabel } from '../../lib/workspace';
import type { Area, Entry, EntrySetter, Translate } from '../../lib/workspace';
const icons = [BriefcaseBusiness, Heart, Activity, BookOpen, Wallet, Flag];
export function LifeScreen({
  entries,
  setEntries,
  t,
}: {
  entries: Entry[];
  setEntries: EntrySetter;
  t: Translate;
}) {
  const [area, setArea] = useState<Area | undefined>();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t('ui.theBiggerPicture.a3b233')}</div>
          <h1 dir="auto">{t('ui.goalsAndProjects.c6629d')}</h1>
          <p dir="auto">{t('ui.sixPartsOfLifeOnePlaceTo.b0593e')}</p>
        </div>
        <GoalTemplates t={t} />
      </div>
      <div className="context-banner">
        <Flag size={18} />
        <p dir="auto">{t('ui.openAGoalToAddMilestonesAnd.a4492b')}</p>
      </div>
      <div className="life-grid">
        {areas.map((a, i) => {
          const Icon = icons[i];
          const goals = entries.filter((e) => e.kind === 'goal' && e.area === a && !e.archived);
          const progress = goals.length
            ? Math.round(goals.reduce((sum, e) => sum + e.progress, 0) / goals.length)
            : 0;
          return (
            <button
              key={a}
              className={`card life-area area-${i} ${area === a ? 'selected' : ''}`}
              onClick={() => setArea(area === a ? undefined : a)}
              aria-pressed={area === a}
            >
              <span className="area-icon">
                <Icon size={23} />
              </span>
              <ArrowUpRight size={16} />
              <h3 dir="auto">{areaLabel(a, t)}</h3>
              <p dir="auto">{activeGoals(goals.length, t('en', 'ar'))}</p>
              <div className="area-progress">
                <span style={{ width: `${progress}%` }} />
              </div>
              <small>
                {localizedNumber(progress, t('en', 'ar'))}% {t('ui.averageProgress.8ed020')}
              </small>
            </button>
          );
        })}
      </div>
      {area && (
        <button className="text-button clear-filter" onClick={() => setArea(undefined)}>
          {t('ui.showAllLifeAreas.1ec9e1')}
        </button>
      )}
      <EntryCollection
        key={area ?? 'all'}
        {...{ entries, setEntries, t, area }}
        kinds={['goal']}
        title={area ? `${areaLabel(area, t)} · ${t('ui.goals.2efb59')}` : t('ui.yourGoals.73b57b')}
        empty={t('ui.noGoalsYetAddAnOutcomeYou.d9faac')}
      />
      <EntryCollection
        key={'projects-' + (area ?? 'all')}
        {...{ entries, setEntries, t, area }}
        kinds={['project']}
        title={t('ui.projectsWithAFinishLine.171b28')}
        empty={t('ui.createAProjectForADefinedPiece.ce9fd3')}
      />
    </>
  );
}
