import { DateTimeInput } from '../../components/DateTimeInput';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/serverStorage';
import { useStorageState, transactData } from '../../lib/storage';
import { localDate, makeEntry } from '../../lib/workspace';
import type { Entry, Translate, Area } from '../../lib/workspace';
import { usePlanning } from '../../lib/preferences';
import { workspaceEntries, nextDay } from '../journey/model';
import { formatCalendarDate, formatTime, formatNumber } from '../../i18n/format';
import { Button } from '../../components/ui/button';
type GoogleEvent = {
  id: string;
  title: string;
  start: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  updated?: string;
};
export function importedEvent(item: GoogleEvent, zone: string): Entry {
  let date = item.start.date ?? '',
    time = '00:00',
    duration = 1440;
  if (item.start.dateTime) {
    const start = new Date(item.start.dateTime);
    if (!Number.isFinite(start.getTime())) throw Error('invalid-google-date');
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(start);
    const part = (type: string) => parts.find((x) => x.type === type)?.value;
    date = [part('year'), part('month'), part('day')].join('-');
    time = part('hour') + ':' + part('minute');
    duration = item.end?.dateTime
      ? Math.round((Date.parse(item.end.dateTime) - start.getTime()) / 60000)
      : 30;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 1440
  )
    throw Error('unsupported-google-event');
  return {
    ...makeEntry('event', item.title, 'Work'),
    id: 'google:' + item.id,
    date,
    time,
    durationMinutes: duration,
    source: {
      text: 'Google Calendar · reviewed import',
      fragment: item.title,
      createdAt: new Date().toISOString(),
      batchId: 'google:' + item.id,
    },
  };
}
export function CalendarPanel({ t }: { t: Translate }) {
  const { data } = useStorageState();
  const [planning] = usePlanning();
  const [status, setStatus] = useState<{ enabled: boolean; connected: boolean } | null>(null);
  const [from, setFrom] = useState(localDate());
  const [to, setTo] = useState(nextDay(localDate(), 7));
  const [rows, setRows] = useState<Entry[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [page, setPage] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  const [exportId, setExportId] = useState('');
  const [exportConsent, setExportConsent] = useState(false);
  const entries = workspaceEntries(data);
  const events = entries.filter((x) => x.kind === 'event' && !x.archived);
  const target = events.find((x) => x.id === exportId);
  const [expected, setExpected] = useState<Record<string, string | undefined>>({});
  useEffect(() => {
    void apiRequest('calendar')
      .then(setStatus)
      .catch(() => setNotice(t('ui.couldNotLoadGoogleConnectionStatus.d35ff0')));
  }, []);
  async function fetchEvents(next = false) {
    setBusy(true);
    try {
      const result = await apiRequest('calendar/events', 'POST', {
        from,
        to,
        ...(next ? { pageToken: page } : {}),
      });
      let skipped = 0;
      const imported = (result.events as GoogleEvent[]).flatMap((item) => {
        try {
          return [importedEvent(item, planning.timezone)];
        } catch {
          skipped++;
          return [];
        }
      });
      setRows((old) =>
        next ? [...old, ...imported.filter((x) => !old.some((row) => row.id === x.id))] : imported,
      );
      setPage(result.nextPageToken);
      setExpected((old) => ({
        ...(next ? old : {}),
        ...Object.fromEntries(
          imported.map((item) => [item.id, entries.find((x) => x.id === item.id)?.revision]),
        ),
      }));
      if (!next) setChosen([]);
      setNotice(
        skipped
          ? t('ui.someLongOrUnsupportedEventsWereExcluded.9e92f5')
          : t('ui.reviewTheEventsAndChooseWhatTo.3538d9'),
      );
    } catch {
      setNotice(t('ui.couldNotReadGoogleCalendarReviewThe.22605b'));
    }
    setBusy(false);
  }
  return (
    <section className="card tools-section editor-form">
      <h2 dir="auto">Google Calendar</h2>
      <p dir="auto">{t('ui.connectYourOwnPrimaryCalendarWithGoogle.d472d4')}</p>
      <p dir="auto" className="integration-status">
        {status?.enabled
          ? status.connected
            ? t('ui.connected.be7abf')
            : t('ui.notConnected.f7a562')
          : t('ui.googleOauthAndServerEncryptionSetupRequired.cf3e71')}
      </p>
      <div className="tools-tabs">
        <Button
          disabled={busy || !status?.enabled}
          onClick={async () => {
            setBusy(true);
            try {
              location.assign((await apiRequest('calendar/start', 'POST', {})).url);
            } catch {
              setNotice(t('ui.couldNotStartGoogleConsent.d5a912'));
              setBusy(false);
            }
          }}
        >
          {t('ui.connectGoogleCalendar.cf22f6')}
        </Button>
        {status?.connected && (
          <Button
            disabled={busy}
            variant="ghost"
            onClick={async () => {
              if (!window.confirm(t('ui.revokeGoogleCalendarAccess.f51646'))) return;
              setBusy(true);
              try {
                await apiRequest('calendar', 'DELETE', {});
                setStatus({ ...status, connected: false });
                setRows([]);
                setNotice(t('ui.googleAccessRevokedExistingImportedRecordsRemain.d00e4e'));
              } catch {
                setNotice(t('ui.couldNotRevokeGoogleAccessRetryOr.f50930'));
              }
              setBusy(false);
            }}
          >
            {t('ui.disconnectGoogleCalendar.9fd8f8')}
          </Button>
        )}
      </div>
      {status?.connected && (
        <>
          <div className="form-pair">
            <label>
              {t('ui.importFrom.c6031d')}
              <DateTimeInput
                type="date"
                value={from}
                disabled={busy}
                onInput={(e) => setFrom(e.currentTarget.value)}
                aria-label={t('ui.importFrom.c6031d')}
              />
            </label>
            <label>
              {t('ui.importUntil.ce65cf')}
              <DateTimeInput
                type="date"
                value={to}
                disabled={busy}
                onInput={(e) => setTo(e.currentTarget.value)}
                aria-label={t('ui.importUntil.ce65cf')}
              />
            </label>
          </div>
          <Button disabled={busy} variant="outline" onClick={() => void fetchEvents()}>
            {t('ui.previewGoogleEvents.7988b5')}
          </Button>
          <ul className="tools-records">
            {rows.map((row) => (
              <li key={row.id}>
                <label>
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={chosen.includes(row.id)}
                    onChange={(e) =>
                      setChosen((old) =>
                        e.target.checked ? [...old, row.id] : old.filter((id) => id !== row.id),
                      )
                    }
                  />
                  <bdi>{row.title}</bdi> · {formatCalendarDate(row.date, t('en', 'ar'))} ·{' '}
                  {formatTime(row.time, t('en', 'ar'))}
                  {entries.some((x) => x.id === row.id)
                    ? ' · ' + t('ui.alreadyImported.261ebb')
                    : ''}
                </label>
              </li>
            ))}
          </ul>
          {page && (
            <Button disabled={busy} variant="outline" onClick={() => void fetchEvents(true)}>
              {t('ui.readNextGooglePage.14c42b')}
            </Button>
          )}
          <label>
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            {t('ui.updateSelectedPreviouslyImportedEventsPreservingRevision.997383')}
          </label>
          <Button
            disabled={busy || !chosen.length}
            onClick={async () => {
              setBusy(true);
              const ok = await transactData((current) => {
                let all = workspaceEntries(current);
                for (const row of rows.filter((x) => chosen.includes(x.id))) {
                  const old = all.find((x) => x.id === row.id);
                  if (old && !replace) continue;
                  if (old && old.revision !== expected[row.id])
                    throw Error('google-import-changed');
                  if (!old && expected[row.id]) throw Error('google-import-deleted');
                  all = old
                    ? all.map((x) =>
                        x.id === row.id
                          ? {
                              ...old,
                              title: row.title,
                              date: row.date,
                              time: row.time,
                              durationMinutes: row.durationMinutes,
                            }
                          : x,
                      )
                    : [...all, row];
                }
                return {
                  ...current,
                  'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: all },
                };
              });
              setBusy(false);
              if (ok) setChosen([]);
              setNotice(
                ok
                  ? t('ui.reviewedGoogleEventsSavedReopenThePreview.416a9b')
                  : t('ui.anEventChangedOrSavingFailedRefresh.b10c99'),
              );
            }}
          >
            {t('ui.importSelectedEvents.86531a')} · {formatNumber(chosen.length, t('en', 'ar'))}
          </Button>
          <h3 dir="auto">{t('ui.exportOneReviewedAppointment.231c63')}</h3>
          <label>
            {t('ui.appointmentToExport.268655')}
            <select
              value={exportId}
              onChange={(e) => {
                setExportId(e.target.value);
                setExportConsent(false);
              }}
            >
              <option value="">{t('ui.chooseAnAppointment.c3ab8d')}</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          {target && (
            <p dir="auto">
              {target.title} · {formatCalendarDate(target.date, t('en', 'ar'))} ·{' '}
              {formatTime(target.time, t('en', 'ar'))}
            </p>
          )}
          <label>
            <input
              type="checkbox"
              checked={exportConsent}
              onChange={(e) => setExportConsent(e.target.checked)}
            />
            {t('ui.createOrUpdateThisAppointmentInMy.b35c1b')}
          </label>
          <Button
            disabled={busy || !target || !exportConsent}
            onClick={async () => {
              setBusy(true);
              try {
                await apiRequest('calendar/export', 'POST', {
                  entryId: target!.id,
                  entryRevision: target!.revision,
                });
                setNotice(t('ui.appointmentSavedToGoogleCalendar.b43314'));
                setExportConsent(false);
              } catch {
                setNotice(t('ui.googleExportFailedOrTheAppointmentChanged.c43ef7'));
              }
              setBusy(false);
            }}
          >
            {t('ui.confirmExportToGoogle.f3640c')}
          </Button>
        </>
      )}
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
