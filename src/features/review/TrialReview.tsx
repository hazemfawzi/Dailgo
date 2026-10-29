import { DateTimeInput } from '../../components/DateTimeInput';
import { formatNumber, formatCalendarDate } from '../../i18n/format';
import { useState } from 'react';
import { FlaskConical, ArrowLeft, Check, Timer } from 'lucide-react';
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
  const lang = t('en', 'ar');
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
  function update(field: keyof Measurement, text: string, baseline = false) {
    const value =
      text === ''
        ? undefined
        : field === 'clarity'
          ? Math.max(1, Math.min(5, Number(text)))
          : Math.max(0, Number(text));
    setTrial((old) =>
      baseline
        ? { ...old, baseline: { ...old.baseline, [field]: value } }
        : { ...old, days: { ...old.days, [day]: { ...old.days[day], [field]: value } } },
    );
  }
  return (
    <section className="trial-review" aria-label={t('home.trial.title')}>
      <header className="review-panel-heading">
        <span className="review-panel-mark">
          <FlaskConical size={22} />
        </span>
        <div>
          <h3>{t('ui.tryItForARealWeek.9a6e14')}</h3>
          <p className="muted">
            {t('ui.selfReportedMeasurementsNotAutomaticProductivityScores.8e8d1c')}
          </p>
        </div>
      </header>
      {!trial.startedOn ? (
        <div className="trial-start">
          <Timer size={32} />
          <h4>{t('trial.start.title')}</h4>
          <p>{t('trial.start.description')}</p>
          <Button onClick={() => setTrial((old) => ({ ...old, startedOn: localDate() }))}>
            {t('ui.startMyTrialToday.73ab7f')}
            <ArrowLeft size={16} />
          </Button>
        </div>
      ) : (
        <>
          <div className="trial-timeline">
            <span>{formatCalendarDate(trial.startedOn, lang)}</span>
            <progress value={Math.min(elapsed, 7)} max={7} />
            <strong>
              {t('ui.day.070e77')} {formatNumber(elapsed, lang)}
            </strong>
          </div>
          {elapsed >= 7 && (
            <p className="trial-complete">
              <Check size={18} />
              {t('ui.aFullWeekHasElapsedReviewThe.df51ad')}
            </p>
          )}
          <div className="trial-workspace">
            <section className="trial-baseline">
              <header>
                <span className="review-step">01</span>
                <div>
                  <h4>{t('ui.beforeUsingThisApp.cd6412')}</h4>
                  <p>{t('trial.baseline.help')}</p>
                </div>
              </header>
              <div className="trial-baseline-fields">
                {fields.slice(0, 2).map(([field, label]) => (
                  <label className="review-field" key={field}>
                    {label}
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      aria-label={t('ui.beforeUsingThisApp.cd6412') + ': ' + label}
                      placeholder="—"
                      value={trial.baseline[field] ?? ''}
                      onChange={(event) => update(field, event.target.value, true)}
                    />
                  </label>
                ))}
              </div>
            </section>
            <section className="trial-daily">
              <header>
                <span className="review-step">02</span>
                <div>
                  <h4>{t('trial.daily.title')}</h4>
                  <p>{t('trial.daily.help')}</p>
                </div>
                <label className="review-field trial-day">
                  {t('ui.measurementDay.c7d614')}
                  <DateTimeInput
                    type="date"
                    min={trial.startedOn}
                    max={localDate()}
                    value={day}
                    onChange={(event) => {
                      if (event.target.value) setDay(event.target.value);
                    }}
                    aria-label={t('ui.measurementDay.c7d614')}
                  />
                </label>
              </header>
              <div className="trial-metrics">
                {fields.map(([field, label]) => (
                  <label className="review-field" key={field}>
                    {label}
                    <input
                      type="number"
                      inputMode="decimal"
                      min={field === 'clarity' ? 1 : 0}
                      max={field === 'clarity' ? 5 : undefined}
                      placeholder="—"
                      value={daily[field] ?? ''}
                      onChange={(event) => update(field, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label className="review-field trial-note">
                {t('ui.didTheAppReduceYourEffortWhat.65ec6d')}
                <textarea
                  dir="auto"
                  rows={4}
                  maxLength={2000}
                  placeholder={t('trial.note.placeholder')}
                  value={daily.notes ?? ''}
                  onChange={(event) => {
                    const notes = event.target.value;
                    setTrial((old) => ({
                      ...old,
                      days: { ...old.days, [day]: { ...old.days[day], notes } },
                    }));
                  }}
                />
              </label>
            </section>
          </div>
          <section className="trial-comparison">
            <h4>{t('ui.yourRecordedComparison.353278')}</h4>
            <div>
              {fields.slice(0, 2).map(([field, label]) => {
                const values = Object.values(trial.days)
                  .map((value) => value[field])
                  .filter((value): value is number => typeof value === 'number');
                return (
                  <article key={field}>
                    <span>{label}</span>
                    <div>
                      <strong>
                        {trial.baseline[field] === undefined
                          ? t('ui.noBaseline.8b22b9')
                          : formatNumber(trial.baseline[field], lang)}
                      </strong>
                      <ArrowLeft size={18} />
                      <strong>
                        {values.length
                          ? formatNumber(values.reduce((a, b) => a + b, 0) / values.length, lang, {
                              maximumFractionDigits: 1,
                            })
                          : t('ui.notMeasured.3a12ac')}
                      </strong>
                    </div>
                    <small>
                      {formatNumber(values.length, lang)} {t('ui.recordedDays.8755eb')}
                    </small>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
      <footer className="trial-save-status" role={error ? 'alert' : 'status'}>
        <Check size={15} />
        {error ? t('ui.trialNotesCouldNotBeSaved.2716ff') : t('trial.autosave')}
      </footer>
    </section>
  );
}
