import { DateTimeInput } from '../../components/DateTimeInput';
import { formatNumber as localizedNumber, formatCalendarDate } from '../../i18n/format';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { usePersisted } from '../../lib/storage';
import { localDate } from '../../lib/workspace';
import type { Translate } from '../../lib/workspace';
type Measurement = {
  captureSeconds?: number;
  reviewMinutes?: number;
  clarity?: number;
  duplicates?: number;
  lost?: number;
  notes?: string;
};
type Trial = { startedOn: string; baseline: Measurement; days: Record<string, Measurement> };
export function TrialReview({ t }: { t: Translate }) {
  const [trial, setTrial, error] = usePersisted<Trial>('personal-os.trial.v1', {
    startedOn: '',
    baseline: {},
    days: {},
  });
  const [day, setDay] = useState(localDate());
  const daily = trial.days[day] ?? {};
  const elapsed = trial.startedOn
    ? Math.max(
        1,
        Math.floor(
          (Date.parse(localDate() + 'T12:00:00Z') - Date.parse(trial.startedOn + 'T12:00:00Z')) /
            86400000,
        ) + 1,
      )
    : 0;
  const fields = [
    ['captureSeconds', t('ui.captureTimeSeconds.72d3a1')],
    ['reviewMinutes', t('ui.reviewTimeMinutes.d23163')],
    ['clarity', t('ui.clarityOfNextStep15.29ce32')],
    ['duplicates', t('ui.duplicatedItemsNoticed.ca23da')],
    ['lost', t('ui.lostItemsNoticed.389cb9')],
  ] as const;
  return (
    <section className="card daily-review">
      <details>
        <summary>{t('ui.tryItForARealWeek.9a6e14')}</summary>
        <p dir="auto" className="muted">
          {t('ui.selfReportedMeasurementsNotAutomaticProductivityScores.8e8d1c')}
        </p>
        {!trial.startedOn ? (
          <Button onClick={() => setTrial((old) => ({ ...old, startedOn: localDate() }))}>
            {t('ui.startMyTrialToday.73ab7f')}
          </Button>
        ) : (
          <>
            <p dir="auto">
              {formatCalendarDate(trial.startedOn, t('en', 'ar'))} · {t('ui.day.070e77')}{' '}
              {localizedNumber(elapsed, t('en', 'ar'))}
              {elapsed >= 7 ? ' · ' + t('ui.aFullWeekHasElapsedReviewThe.df51ad') : ''}
            </p>
            <h3 dir="auto">{t('ui.beforeUsingThisApp.cd6412')}</h3>
            <div className="review-fields">
              {fields.slice(0, 2).map(([field, label]) => (
                <label key={field}>
                  {label}
                  <input
                    type="number"
                    min={0}
                    value={trial.baseline[field] ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTrial((old) => ({
                        ...old,
                        baseline: {
                          ...old.baseline,
                          [field]: value === '' ? undefined : Math.max(0, Number(value)),
                        },
                      }));
                    }}
                  />
                </label>
              ))}
            </div>
            <label className="date-picker">
              {t('ui.measurementDay.c7d614')}
              <DateTimeInput
                type="date"
                min={trial.startedOn}
                max={localDate()}
                value={day}
                onChange={(e) => {
                  if (e.target.value) setDay(e.target.value);
                }}
                aria-label={t('ui.measurementDay.c7d614')}
              />
            </label>
            <div className="review-fields">
              {fields.map(([field, label]) => (
                <label key={field}>
                  {label}
                  <input
                    type="number"
                    min={field === 'clarity' ? 1 : 0}
                    max={field === 'clarity' ? 5 : undefined}
                    value={daily[field] ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTrial((old) => ({
                        ...old,
                        days: {
                          ...old.days,
                          [day]: {
                            ...old.days[day],
                            [field]:
                              value === ''
                                ? undefined
                                : field === 'clarity'
                                  ? Math.max(1, Math.min(5, Number(value)))
                                  : Math.max(0, Number(value)),
                          },
                        },
                      }));
                    }}
                  />
                </label>
              ))}
            </div>
            <label className="editor-form">
              {t('ui.didTheAppReduceYourEffortWhat.65ec6d')}
              <textarea
                dir="auto"
                rows={3}
                maxLength={2000}
                value={daily.notes ?? ''}
                onChange={(e) => {
                  const notes = e.target.value;
                  setTrial((old) => ({
                    ...old,
                    days: { ...old.days, [day]: { ...old.days[day], notes } },
                  }));
                }}
              />
            </label>
            <h3 dir="auto">{t('ui.yourRecordedComparison.353278')}</h3>
            {fields.slice(0, 2).map(([field, label]) => {
              const values = Object.values(trial.days)
                .map((d) => d[field])
                .filter((v): v is number => typeof v === 'number');
              return (
                <p dir="auto" key={field}>
                  {label}:{' '}
                  {trial.baseline[field] === undefined
                    ? t('ui.noBaseline.8b22b9')
                    : localizedNumber(trial.baseline[field], t('en', 'ar'))}{' '}
                  →{' '}
                  {values.length
                    ? localizedNumber(
                        values.reduce((a, b) => a + b, 0) / values.length,
                        t('en', 'ar'),
                        { minimumFractionDigits: 1, maximumFractionDigits: 1 },
                      )
                    : t('ui.notMeasured.3a12ac')}{' '}
                  · {localizedNumber(values.length, t('en', 'ar'))} {t('ui.recordedDays.8755eb')}
                </p>
              );
            })}
          </>
        )}
        {error && (
          <p dir="auto" role="alert">
            {t('ui.trialNotesCouldNotBeSaved.2716ff')}
          </p>
        )}
      </details>
    </section>
  );
}
