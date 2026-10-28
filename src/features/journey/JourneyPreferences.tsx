import { DateTimeInput } from '../../components/DateTimeInput';
import type { Area, Translate } from '../../lib/workspace';
import { areas, areaLabel } from '../../lib/workspace';
import { useJourney } from './useJourney';
export function JourneyPreferences({ t }: { t: Translate }) {
  const [journey, setJourney] = useJourney();
  function toggle(area: Area) {
    setJourney((old) => ({
      ...old,
      areas: old.areas.includes(area)
        ? old.areas.filter((item) => item !== area)
        : old.areas.length < 2
          ? [...old.areas, area]
          : old.areas,
    }));
  }
  return (
    <section className="editor-form">
      <h3 dir="auto">{t('ui.dailyCyclePreferences.fa3a0c')}</h3>
      <label>
        {t('ui.wakeUpTime.b5d327')}
        <DateTimeInput
          type="time"
          value={journey.wakeTime}
          onInput={(e) => {
            const wakeTime = e.currentTarget.value;
            if (wakeTime) setJourney((old) => ({ ...old, wakeTime }));
          }}
          onChange={(e) => {
            if (e.target.value) setJourney((old) => ({ ...old, wakeTime: e.target.value }));
          }}
          aria-label={t('ui.wakeUpTime.b5d327')}
        />
      </label>
      <label>
        {t('ui.eveningReviewTime.6d03ba')}
        <DateTimeInput
          type="time"
          value={journey.eveningTime}
          onInput={(e) => {
            const eveningTime = e.currentTarget.value;
            if (eveningTime) setJourney((old) => ({ ...old, eveningTime }));
          }}
          onChange={(e) => {
            if (e.target.value) setJourney((old) => ({ ...old, eveningTime: e.target.value }));
          }}
          aria-label={t('ui.eveningReviewTime.6d03ba')}
        />
      </label>
      <fieldset>
        <legend>{t('ui.twoPreferredLifeAreas.bf142b')}</legend>
        {areas.map((area) => (
          <label key={area}>
            <input
              type="checkbox"
              checked={journey.areas.includes(area)}
              disabled={!journey.areas.includes(area) && journey.areas.length === 2}
              onChange={() => toggle(area)}
            />
            {areaLabel(area, t)}
          </label>
        ))}
      </fieldset>
      <p dir="auto" className="muted">
        {t('ui.inAppRemindersUseYourPlanningTimezone.b83ae2')}
      </p>
    </section>
  );
}
