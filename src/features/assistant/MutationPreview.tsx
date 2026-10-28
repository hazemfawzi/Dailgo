import { formatCalendarDate } from '../../i18n/format';
import type { Message } from './engine';
import type { Translate } from '../../lib/workspace';
import { Button } from '../../components/ui/button';
export function MutationPreview({
  message,
  t,
  busy,
  confirm,
  cancel,
}: {
  message: Message;
  t: Translate;
  busy: boolean;
  confirm: () => void;
  cancel: () => void;
}) {
  const m = message.mutation!;
  const show = (value: unknown, field: string) =>
    ['plannedDate', 'dueDate'].includes(field) && typeof value === 'string'
      ? formatCalendarDate(value, t('en', 'ar'))
      : value === null
        ? t('ui.notSet.637b97')
        : typeof value === 'boolean'
          ? value
            ? t('ui.yes.35830c')
            : t('ui.no.408446')
          : String(value);
  return (
    <section className="chat-proposal">
      <h3 dir="auto">
        {t('ui.changePreview.bca99d')} · {m.title}
      </h3>
      <table className="change-table">
        <thead>
          <tr>
            <th>{t('ui.field.93e35d')}</th>
            <th>{t('ui.before.c8c77a')}</th>
            <th>{t('ui.after.2277fe')}</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(m.patch).map((k) => (
            <tr key={k}>
              <th>
                {
                  (
                    {
                      title: t('ui.title.770d09'),
                      plannedDate: t('ui.executionDate.ef35ef'),
                      dueDate: t('ui.dueDate.3146bb'),
                      detail: t('ui.details.725c0d'),
                      archived: t('ui.archived.799523'),
                    } as Record<string, string>
                  )[k]
                }
              </th>
              <td dir="auto">{show(m.before[k], k)}</td>
              <td dir="auto">{show(m.patch[k], k)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {message.status === 'pending' ? (
        <div className="proposal-actions">
          <Button disabled={busy} onClick={confirm}>
            {t('ui.confirmChange.40a6fa')}
          </Button>
          <Button variant="outline" disabled={busy} onClick={cancel}>
            {t('ui.cancelChange.94003a')}
          </Button>
        </div>
      ) : (
        <p dir="auto" role="status">
          {message.status === 'confirmed'
            ? t('ui.changeSaved.ce4b35')
            : message.status === 'reverted'
              ? t('ui.previousValuesRestored.154c26')
              : t('ui.cancelledWithoutChanges.b54465')}
        </p>
      )}
    </section>
  );
}
