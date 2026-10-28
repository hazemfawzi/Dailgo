import { formatNumber as localizedNumber } from '../i18n/format';
import { formatTimestamp } from '../i18n/format';
import type { AuditFields } from '../lib/audit';
import type { Translate } from '../lib/workspace';
export function History({ item, t }: { item: AuditFields; t: Translate }) {
  return (
    <details className="capture-original">
      <summary>
        {t('ui.changeHistory.a2db94')} · {localizedNumber(item.history?.length ?? 0, t('en', 'ar'))}
      </summary>
      {!item.createdAt && <p dir="auto">{t('ui.legacyItemHistoryBeginsWithItsNext.d980c7')}</p>}
      {item.createdAt && (
        <p dir="auto">
          {t('ui.created.7d638a')}: {formatTimestamp(item.createdAt, t('en', 'ar'))}
        </p>
      )}
      {item.completedAt && (
        <p dir="auto">
          {t('ui.completed.852ce2')}: {formatTimestamp(item.completedAt, t('en', 'ar'))}
        </p>
      )}
      {[...(item.history ?? [])].reverse().map((h, i) => (
        <details key={`${h.at}-${i}`}>
          <summary>
            {formatTimestamp(h.at, t('en', 'ar'))} · {h.fields.join(', ')}
          </summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11 }}>
            {JSON.stringify({ before: h.before, after: h.after }, null, 2)}
          </pre>
        </details>
      ))}
    </details>
  );
}
