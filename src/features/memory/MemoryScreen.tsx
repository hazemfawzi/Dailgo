import { storageText } from '../../i18n/messages';
import { MergeMemories } from './MergeMemories';
import { memoryConflicts } from './model';
import { Brain, LockKeyhole } from 'lucide-react';
import { EntryCollection } from '../../components/EntryCollection';
import { memoryKinds } from '../../lib/workspace';
import type { Entry, EntrySetter, Translate } from '../../lib/workspace';
export function MemoryScreen({entries,setEntries,t}:{entries:Entry[];setEntries:EntrySetter;t:Translate}) {
 return <><div className="page-heading"><div><div className="eyebrow"><Brain size={14}/>{t('A LITTLE LESS TO REMEMBER','أشياء أقل لتتذكرها')}</div><h1>{t('Notes and memory','الملاحظات والذاكرة')}</h1><p>{t('Notes, preferences, decisions, and the details that make you, you.','ملاحظاتك وتفضيلاتك وقراراتك والتفاصيل التي تعبّر عنك.')}</p></div></div><div className="context-banner"><LockKeyhole size={18}/><p>{storageText(t,'memory')}</p></div>{memoryConflicts(entries).length>0&&<div className="notice" role="status"><strong>{t('Possible conflicting memories','معلومات قد تكون متعارضة')}</strong><p>{t('Same title and context, different details. Review and correct; no automatic merge.','نفس العنوان والمجال مع تفاصيل مختلفة. راجع وصحّح؛ بدون دمج تلقائي.')}</p>{memoryConflicts(entries).map(e=><p key={e.id}>{e.title} · {e.detail}</p>)}</div>}<MergeMemories entries={entries} t={t}/><EntryCollection {...{entries,setEntries,t}} kinds={memoryKinds} title={t('Your memory','ذاكرتك')} empty={t('Give your thoughts a place to land.','امنح أفكارك مكاناً تستقر فيه.')}/></>;
}

