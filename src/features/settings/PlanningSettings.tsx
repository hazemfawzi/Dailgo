import { usePlanning } from '../../lib/preferences';
import type { Translate } from '../../lib/workspace';
export function PlanningSettings({ t }: { t: Translate }) {
  const [settings, setSettings] = usePlanning();
  const zones = Array.from(
    new Set([
      settings.timezone,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      'Africa/Cairo',
      'Asia/Riyadh',
      'Asia/Dubai',
      'Europe/London',
      'America/New_York',
      'UTC',
    ]),
  );
  return (
    <section className="editor-form">
      <h3 dir="auto">{t('ui.planningPreferences.fd414f')}</h3>
      <WeekStartSetting t={t} />
      <div className="form-pair">
        <label>
          {t('ui.dailyTotalMinutes.5298c2')}
          <input
            type="number"
            min={0}
            max={1440}
            value={settings.capacity}
            onChange={(e) => {
              const value = Math.max(0, Math.min(1440, Number(e.target.value)));
              setSettings((old) => ({ ...old, capacity: value }));
            }}
          />
        </label>
        <label>
          {t('week.capacity.reserve')}
          <input
            type="number"
            min={0}
            max={1440}
            value={settings.buffer}
            onChange={(e) => {
              const value = Math.max(0, Math.min(1440, Number(e.target.value)));
              setSettings((old) => ({ ...old, buffer: value }));
            }}
          />
        </label>
      </div>
      <label>
        {t('ui.planningTimezone.57137b')}
        <select
          value={settings.timezone}
          onChange={(e) => {
            const value = e.target.value;
            setSettings((old) => ({ ...old, timezone: value }));
          }}
        >
          {zones.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      </label>
      <p dir="auto" className="muted">
        {t('ui.timesAreWallClockTimesInThis.17f271')}
      </p>
    </section>
  );
}

export function WeekStartSetting({ t }: { t: Translate }) {
  const [settings, setSettings] = usePlanning();
  return (
    <label>
      {t('ui.weekStartsOn.c9c926')}
      <select
        aria-label={t('ui.weekStartsOn.c9c926')}
        value={settings.weekStartsOn}
        onChange={(e) => {
          const value = Number(e.target.value);
          setSettings((old) => ({ ...old, weekStartsOn: value }));
        }}
      >
        <option value={6}>{t('ui.saturday.e29416')}</option>
        <option value={0}>{t('ui.sunday.4e830a')}</option>
        <option value={1}>{t('ui.monday.99a6de')}</option>
      </select>
    </label>
  );
}
