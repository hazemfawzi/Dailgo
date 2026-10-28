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
      <h3 dir="auto">{t('Daily cycle preferences', 'إعدادات الدورة اليومية')}</h3>
      <label>
        {t('Wake-up time', 'وقت الصحيان')}
        <input
          type="time"
          value={journey.wakeTime}
          onInput={(e) => {
            const wakeTime = e.currentTarget.value;
            if (wakeTime) setJourney((old) => ({ ...old, wakeTime }));
          }}
          onChange={(e) => {
            if (e.target.value) setJourney((old) => ({ ...old, wakeTime: e.target.value }));
          }}
        />
      </label>
      <label>
        {t('Evening review time', 'وقت المراجعة المسائية')}
        <input
          type="time"
          value={journey.eveningTime}
          onInput={(e) => {
            const eveningTime = e.currentTarget.value;
            if (eveningTime) setJourney((old) => ({ ...old, eveningTime }));
          }}
          onChange={(e) => {
            if (e.target.value) setJourney((old) => ({ ...old, eveningTime: e.target.value }));
          }}
        />
      </label>
      <fieldset>
        <legend>{t('Two preferred life areas', 'مجالان مفضلان')}</legend>
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
        {t(
          'In-app reminders use your planning timezone. Enable optional email or Push reminders from Life tools → Connections.',
          'التذكير داخل التطبيق حسب المنطقة الزمنية للتخطيط. فعّل تذكيرات البريد أو Push الاختيارية من أدوات الحياة ← الاتصالات.',
        )}
      </p>
    </section>
  );
}
