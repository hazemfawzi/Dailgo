import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';
import { useState } from 'react';
import { usePersisted } from '../../lib/storage';
import { localDate } from '../../lib/workspace';
import { usePlanning } from '../../lib/preferences';
import type { Translate } from '../../lib/workspace';
import { localeFor } from '../../i18n/format';
import { defaultPrayer } from './model';
import type { PrayerPreferences } from './model';
export function PrayerPanel({ t, compact = false }: { t: Translate; compact?: boolean }) {
  const [settings, setSettings] = usePersisted<PrayerPreferences>(
    'personal-os.prayer.v1',
    defaultPrayer,
  );
  const [planning] = usePlanning();
  const [error, setError] = useState('');
  const parameters = CalculationMethod[settings.method]();
  parameters.madhab = Madhab[settings.madhab];
  const times = new PrayerTimes(
    new Coordinates(settings.latitude, settings.longitude),
    new Date(localDate() + 'T12:00:00'),
    parameters,
  );
  const label = {
    fajr: t('ui.fajr.0f3aa3'),
    sunrise: t('ui.sunrise.ce7e03'),
    dhuhr: t('ui.dhuhr.e3d7d5'),
    asr: t('ui.asr.c84e4d'),
    maghrib: t('ui.maghrib.11b4f3'),
    isha: t('ui.isha.246656'),
  };
  const grid = (
    <dl className="prayer-grid">
      {Object.entries(label).map(([key, name]) => (
        <div key={key}>
          <dt>{name}</dt>
          <dd>
            {Number.isFinite((times[key as keyof typeof label] as Date).getTime())
              ? new Intl.DateTimeFormat(localeFor(t('en', 'ar')), {
                  timeZone: planning.timezone,
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(times[key as keyof typeof label] as Date)
              : t('ui.unavailable.459b9e')}
          </dd>
        </div>
      ))}
    </dl>
  );
  if (compact)
    return settings.enabled ? (
      <section className="card tools-section">
        <h3 dir="auto">{t('ui.prayerBreaks.08b46f')}</h3>
        {grid}
      </section>
    ) : null;
  return (
    <section className="card tools-section editor-form">
      <h2 dir="auto">{t('ui.prayerBreaksOptional.2fa956')}</h2>
      <label>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setSettings((old) => ({ ...old, enabled: e.target.checked }))}
        />
        {t('ui.showPrayerBreaksInMyDay.25ca02')}
      </label>
      <p dir="auto">{t('ui.calculatedLocallyFromTheCoordinatesAndMethod.b817cd')}</p>
      <div className="form-pair">
        <label>
          {t('ui.latitude.b26390')}
          <input
            type="number"
            min={-66}
            max={66}
            step="0.0001"
            value={settings.latitude}
            onChange={(e) => {
              const latitude = Number(e.target.value);
              if (Number.isFinite(latitude) && Math.abs(latitude) <= 66)
                setSettings((old) => ({ ...old, latitude }));
            }}
          />
        </label>
        <label>
          {t('ui.longitude.6907c2')}
          <input
            type="number"
            min={-180}
            max={180}
            step="0.0001"
            value={settings.longitude}
            onChange={(e) => {
              const longitude = Number(e.target.value);
              if (Number.isFinite(longitude) && Math.abs(longitude) <= 180)
                setSettings((old) => ({ ...old, longitude }));
            }}
          />
        </label>
      </div>
      <button
        className="button button-outline"
        onClick={() => {
          if (!navigator.geolocation) {
            setError(t('ui.locationIsUnavailableEnterCoordinatesManually.87d344'));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (result) => {
              if (Math.abs(result.coords.latitude) > 66) {
                setError(t('ui.thisLatitudeNeedsALocalHighLatitude.f88ca0'));
                return;
              }
              setSettings((old) => ({
                ...old,
                latitude: result.coords.latitude,
                longitude: result.coords.longitude,
              }));
            },
            () => setError(t('ui.locationPermissionWasDeclinedOrUnavailable.24003f')),
          );
        }}
      >
        {t('ui.useMyLocation.72cd55')}
      </button>
      <label>
        {t('ui.calculationMethod.c01b57')}
        <select
          value={settings.method}
          onChange={(e) =>
            setSettings((old) => ({
              ...old,
              method: e.target.value as PrayerPreferences['method'],
            }))
          }
        >
          <option value="Egyptian">{t('ui.egyptianAuthority.62137f')}</option>
          <option value="MuslimWorldLeague">{t('ui.muslimWorldLeague.fc2ecc')}</option>
          <option value="UmmAlQura">{t('ui.ummAlQura.a4389d')}</option>
        </select>
      </label>
      <label>
        {t('ui.asrMethod.1cdc60')}
        <select
          value={settings.madhab}
          onChange={(e) =>
            setSettings((old) => ({
              ...old,
              madhab: e.target.value as PrayerPreferences['madhab'],
            }))
          }
        >
          <option value="Shafi">{t('ui.standard.3a0014')}</option>
          <option value="Hanafi">{t('ui.hanafi.79aac8')}</option>
        </select>
      </label>
      {settings.enabled && grid}
      {error && (
        <p dir="auto" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
