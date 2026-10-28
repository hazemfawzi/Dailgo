import type { Translate } from '../lib/workspace';
export function storageText(
  t: Translate,
  key:
    | 'routines'
    | 'saved'
    | 'serverSaved'
    | 'memory'
    | 'taskEditor'
    | 'entryEditor'
    | 'focusSaved'
    | 'resultSaved'
    | 'weeklyFailed'
    | 'review'
    | 'backup',
) {
  return t('storage.' + key);
}
