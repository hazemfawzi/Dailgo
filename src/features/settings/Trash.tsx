import { formatNumber as localizedNumber } from '../../i18n/format';
import { formatTimestamp } from '../../i18n/format';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { transactData, useStorageState, purgeTrashRecord } from '../../lib/storage';
import type { Translate } from '../../lib/workspace';
export type TrashItem = {
  id: string;
  collection: string;
  deletedAt: string;
  item: { id: string; title: string; [key: string]: unknown };
};
export function Trash({ t }: { t: Translate }) {
  const { data } = useStorageState();
  const items = (data['personal-os.trash.v1'] ?? []) as TrashItem[];
  const [purging, setPurging] = useState<TrashItem | null>(null);
  const [notice, setNotice] = useState('');
  async function restore(record: TrashItem) {
    const ok = await transactData((current) => {
      const value = current[record.collection] as any;
      const existing = Array.isArray(value) ? value : (value?.entries ?? []);
      if (existing.some((x: any) => x.id === record.item.id)) throw Error('exists');
      return {
        ...current,
        [record.collection]:
          Array.isArray(value) || record.collection !== 'personal-os.entries.v1'
            ? [...existing, record.item]
            : { ...value, entries: [...existing, record.item] },
        'personal-os.trash.v1': ((current['personal-os.trash.v1'] ?? []) as TrashItem[]).filter(
          (x) => x.id !== record.id,
        ),
      };
    });
    setNotice(
      ok ? t('ui.restoredToItsOriginalSection.ce04c6') : t('ui.couldNotRestoreDataWasKept.f9ad34'),
    );
  }
  return (
    <section>
      <h3 dir="auto">
        {t('ui.recentlyDeleted.eed3db')} · {localizedNumber(items.length, t('en', 'ar'))}
      </h3>
      <p dir="auto" className="muted">
        {t('ui.deletedItemsStayHereUntilYouPermanently.c32816')}
      </p>
      {items.map((item) => (
        <div className="trash-item" key={item.id}>
          <strong dir="auto">{item.item.title}</strong>
          <small>{formatTimestamp(item.deletedAt, t('en', 'ar'))}</small>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => void restore(item)}>
              {t('ui.restore.82172b')}
            </Button>
            <Button variant="ghost" onClick={() => setPurging(item)}>
              {t('ui.deleteForever.2aa5f0')}
            </Button>
          </div>
        </div>
      ))}
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
      <Dialog
        open={!!purging}
        onOpenChange={() => setPurging(null)}
        title={t('ui.permanentlyDelete.bf3708')}
        description={t('ui.removesTheRecoveryCopyDirectLinksAssociated.6eb422')}
      >
        <p dir="auto">{purging?.item.title}</p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setPurging(null)}>
            {t('ui.keepRecoveryCopy.0f3092')}
          </Button>
          <Button
            onClick={async () => {
              const ok = await purgeTrashRecord(purging!.id);
              setNotice(ok ? t('ui.recoveryCopyRemoved.3aa959') : t('ui.deleteFailed.ac4d52'));
              setPurging(null);
            }}
          >
            {t('ui.confirmPermanentDeletion.61d401')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
