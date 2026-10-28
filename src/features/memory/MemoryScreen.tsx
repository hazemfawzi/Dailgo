import { storageText } from '../../i18n/messages';
import { MergeMemories } from './MergeMemories';
import { memoryConflicts } from './model';
import { Brain, LockKeyhole } from 'lucide-react';
import { EntryCollection } from '../../components/EntryCollection';
import { memoryKinds } from '../../lib/workspace';
import type { Entry, EntrySetter, Translate } from '../../lib/workspace';
export function MemoryScreen({
  entries,
  setEntries,
  t,
}: {
  entries: Entry[];
  setEntries: EntrySetter;
  t: Translate;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Brain size={14} />
            {t('ui.aLittleLessToRemember.2c98f7')}
          </div>
          <h1 dir="auto">{t('ui.notesAndMemory.1c45af')}</h1>
          <p dir="auto">{t('ui.notesPreferencesDecisionsAndTheDetailsThat.56aede')}</p>
        </div>
      </div>
      <div className="context-banner">
        <LockKeyhole size={18} />
        <p dir="auto">{storageText(t, 'memory')}</p>
      </div>
      {memoryConflicts(entries).length > 0 && (
        <div className="notice" role="status">
          <strong dir="auto">{t('ui.possibleConflictingMemories.287f1a')}</strong>
          <p dir="auto">{t('ui.sameTitleAndContextDifferentDetailsReview.35c35a')}</p>
          {memoryConflicts(entries).map((e) => (
            <p dir="auto" key={e.id}>
              {e.title} · {e.detail}
            </p>
          ))}
        </div>
      )}
      <MergeMemories entries={entries} t={t} />
      <EntryCollection
        {...{ entries, setEntries, t }}
        kinds={memoryKinds}
        title={t('ui.yourMemory.3d8a05')}
        empty={t('ui.giveYourThoughtsAPlaceToLand.640f29')}
      />
    </>
  );
}
