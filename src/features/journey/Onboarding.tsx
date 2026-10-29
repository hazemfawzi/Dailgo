import { DateTimeInput } from '../../components/DateTimeInput';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { defaultPlanning } from '../../lib/planningConfig';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { areas, areaLabel } from '../../lib/workspace';
import type { Area, Translate } from '../../lib/workspace';
import { transactData, useStorageState } from '../../lib/storage';
import {
  completeOnboarding,
  goalTemplates,
  JOURNEY_KEY,
  journeyState,
  workspaceEntries,
} from './model';
import { useJourney } from './useJourney';
export function Onboarding({
  t,
  language,
  dark,
  onLanguage,
  onDark,
}: {
  t: Translate;
  language: 'ar' | 'en';
  dark: boolean;
  onLanguage: (language: 'ar' | 'en') => void;
  onDark: (dark: boolean) => void;
}) {
  const { data } = useStorageState();
  const [journey] = useJourney();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(1);
  const [chosen, setChosen] = useState<Area[]>(journey.areas);
  const [wake, setWake] = useState(journey.wakeTime);
  const [evening, setEvening] = useState(journey.eveningTime);
  const [week, setWeek] = useState(language === 'ar' ? 6 : 1);
  const [template, setTemplate] = useState('custom');
  const [title, setTitle] = useState('');
  const [criteria, setCriteria] = useState('');
  const [date, setDate] = useState('');
  const [area, setArea] = useState<Area>('Work');
  const [tasks, setTasks] = useState<{ title: string; estimate: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const batch = useRef(crypto.randomUUID());
  useEffect(() => {
    const show = () => {
      setDismissed(false);
      setOpen(true);
    };
    window.addEventListener('dailgo-onboarding', show);
    return () => window.removeEventListener('dailgo-onboarding', show);
  }, []);
  const empty =
    !((data['personal-os.tasks.v1'] ?? []) as unknown[]).length && !workspaceEntries(data).length;
  const active = !journey.onboardingComplete && (open || (empty && !dismissed));
  function selectTemplate(id: string) {
    const option = goalTemplates.find((option) => option.id === id)!;
    setTemplate(id);
    setArea(option.area);
    if (id !== 'custom')
      setTitle(
        language === 'ar'
          ? option.ar.replace(' — هدف قابل للتعديل', '')
          : option.en.replace(' — editable goal', ''),
      );
    setTasks(
      (language === 'ar' ? option.arabic : option.titles).map((title) => ({ title, estimate: 15 })),
    );
  }
  async function skip() {
    setBusy(true);
    const ok = await transactData((current) => ({
      ...current,
      [JOURNEY_KEY]: {
        ...journeyState(current),
        onboardingComplete: true,
        areas: chosen,
        wakeTime: wake,
        eveningTime: evening,
      },
      'personal-os.planning.v1': {
        ...defaultPlanning,
        ...((current['personal-os.planning.v1'] as object) ?? {}),
        weekStartsOn: week,
      },
    }));
    setBusy(false);
    if (ok) {
      setOpen(false);
      setDismissed(true);
    } else setError(t('ui.couldNotSaveCheckTheConnectionAnd.6c17d6'));
  }
  async function finish() {
    setBusy(true);
    setError('');
    const ok = await transactData((current) =>
      completeOnboarding(
        current,
        {
          areas: chosen,
          language,
          dark,
          wakeTime: wake,
          eveningTime: evening,
          weekStartsOn: week,
          title,
          goalArea: area,
          date,
          criteria,
          tasks,
          templateId: template,
        },
        batch.current,
      ),
    );
    setBusy(false);
    if (ok) {
      setOpen(false);
      setDismissed(true);
    } else setError(t('ui.nothingWasAddedReviewTheFieldsAnd.8f3d13'));
  }
  return (
    <Dialog
      open={active}
      onOpenChange={(value) => {
        if (!value && !busy) {
          setOpen(false);
          setDismissed(true);
        }
      }}
      title={t('ui.setUpYourFirstFiveMinutes.85a0db')}
      description={t(
        `Step ${localizedNumber(step, t('en', 'ar'))} of 3. Review the suggestions; nothing is added until you confirm.`,
        `الخطوة ${localizedNumber(step, t('en', 'ar'))} من 3. راجع الاقتراحات؛ مش هنضيف بيانات غير بعد تأكيدك.`,
      )}
    >
      <div className="journey-onboarding editor-form">
        <Button variant="ghost" disabled={busy} onClick={() => void skip()}>
          {t('ui.skipSetup.916b3c')}
        </Button>
        {step === 1 && (
          <>
            <h3 dir="auto">{t('ui.chooseYourStartingPreferences.20d787')}</h3>
            <label>
              {t('ui.language.27836c')}
              <select value={language} onChange={(e) => onLanguage(e.target.value as 'ar' | 'en')}>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              <input type="checkbox" checked={dark} onChange={(e) => onDark(e.target.checked)} />
              {t('ui.darkTheme.bdee33')}
            </label>
            <fieldset>
              <legend>{t('ui.chooseTwoLifeAreasToStartWith.a02338')}</legend>
              {areas.map((value) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(value)}
                    disabled={!chosen.includes(value) && chosen.length === 2}
                    onChange={(e) =>
                      setChosen(
                        e.target.checked
                          ? [...chosen, value]
                          : chosen.filter((area) => area !== value),
                      )
                    }
                  />
                  {areaLabel(value, t)}
                </label>
              ))}
            </fieldset>
            <label>
              {t('ui.wakeUpTime.b5d327')}
              <DateTimeInput
                type="time"
                required
                value={wake}
                onInput={(e) => setWake(e.currentTarget.value)}
                onChange={(e) => setWake(e.target.value)}
                aria-label={t('ui.wakeUpTime.b5d327')}
              />
            </label>
            <label>
              {t('ui.eveningReviewTime.6d03ba')}
              <DateTimeInput
                type="time"
                required
                value={evening}
                onInput={(e) => setEvening(e.currentTarget.value)}
                onChange={(e) => setEvening(e.target.value)}
                aria-label={t('ui.eveningReviewTime.6d03ba')}
              />
            </label>
            <label>
              {t('ui.weekStartsOn.c9c926')}
              <select value={week} onChange={(e) => setWeek(Number(e.target.value))}>
                <option value={6}>{t('ui.saturday.e29416')}</option>
                <option value={0}>{t('ui.sunday.4e830a')}</option>
                <option value={1}>{t('ui.monday.99a6de')}</option>
              </select>
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <h3 dir="auto">{t('ui.chooseOneGoal.32a9c4')}</h3>
            <label>
              {t('ui.startingTemplate.31baf9')}
              <select value={template} onChange={(e) => selectTemplate(e.target.value)}>
                {goalTemplates.map((option) => (
                  <option value={option.id} key={option.id}>
                    {language === 'ar' ? option.ar : option.en}
                  </option>
                ))}
              </select>
            </label>
            <p dir="auto" className="muted">
              {t('ui.templatesAreEditableSuggestionsNotPersonalAssessments.afeaba')}
            </p>
            <label>
              {t('ui.yourFirstGoal.3a103d')}
              <input
                dir="auto"
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              {t('ui.goalLifeArea.dad21c')}
              <select value={area} onChange={(e) => setArea(e.target.value as Area)}>
                {areas.map((value) => (
                  <option value={value} key={value}>
                    {areaLabel(value, t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('ui.successCriterion.9997a1')}
              <textarea
                dir="auto"
                rows={2}
                maxLength={1000}
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
              />
            </label>
            <label>
              {t('ui.goalTargetDateOptional.152aac')}
              <DateTimeInput
                type="date"
                value={date}
                onInput={(e) => setDate(e.currentTarget.value)}
                onChange={(e) => setDate(e.target.value)}
                aria-label={t('ui.goalTargetDateOptional.152aac')}
              />
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <h3 dir="auto">{t('ui.reviewThreeFirstTasks.8d1f34')}</h3>
            <p dir="auto">{title}</p>
            {tasks.map((task, index) => (
              <section className="onboarding-task" key={index}>
                <label>
                  {t(
                    `First task ${localizedNumber(index + 1, t('en', 'ar'))}`,
                    `المهمة الأولى ${localizedNumber(index + 1, t('en', 'ar'))}`,
                  )}
                  <input
                    dir="auto"
                    maxLength={160}
                    value={task.title}
                    onChange={(e) =>
                      setTasks((old) =>
                        old.map((item, i) =>
                          i === index ? { ...item, title: e.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  {t('ui.estimatedMinutes.606e16')}
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={task.estimate}
                    onChange={(e) =>
                      setTasks((old) =>
                        old.map((item, i) =>
                          i === index ? { ...item, estimate: Number(e.target.value) } : item,
                        ),
                      )
                    }
                  />
                </label>
              </section>
            ))}
            <p dir="auto" className="muted">
              {t('ui.confirmingCreatesOneGoalTwoMilestonesAnd.b27095')}
            </p>
          </>
        )}
        {error && (
          <p dir="auto" role="alert">
            {error}
          </p>
        )}
        {step === 1 && chosen.length !== 2 && (
          <p role="status">{t('ui.chooseTwoAreasToEnableTheNext.c8d898')}</p>
        )}
        {step === 2 && !title.trim() && (
          <p role="status">{t('ui.writeOneGoalTitleToContinue.31efa9')}</p>
        )}
        <div className="dialog-actions">
          {step > 1 && (
            <Button disabled={busy} variant="outline" onClick={() => setStep(step - 1)}>
              {t('ui.back.436170')}
            </Button>
          )}
          {step < 3 ? (
            <Button
              disabled={
                busy ||
                (step === 1 && (chosen.length !== 2 || !wake || !evening)) ||
                (step === 2 && !title.trim())
              }
              onClick={() => {
                if (step === 2 && !tasks.length) {
                  const option = goalTemplates.find((item) => item.id === template)!;
                  setTasks(
                    (language === 'ar' ? option.arabic : option.titles).map((title) => ({
                      title,
                      estimate: 15,
                    })),
                  );
                }
                setStep(step + 1);
              }}
            >
              {t('ui.next.bdd4a0')}
            </Button>
          ) : (
            <Button
              disabled={
                busy ||
                tasks.length !== 3 ||
                tasks.some((task) => !task.title.trim() || task.estimate < 1)
              }
              onClick={() => void finish()}
            >
              {t('ui.createMyStartingPlan.62242a')}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
