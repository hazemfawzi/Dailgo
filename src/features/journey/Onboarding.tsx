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
    } else
      setError(
        t(
          'Could not save. Check the connection and retry.',
          'تعذر الحفظ. راجع الاتصال وحاول تاني.',
        ),
      );
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
    } else
      setError(
        t(
          'Nothing was added. Review the fields and connection, then retry.',
          'لم يُضف شيء. راجع الحقول والاتصال وحاول تاني.',
        ),
      );
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
      title={t('Set up your first five minutes', 'أول خمس دقايق في مساحتك')}
      description={t(
        `Step ${localizedNumber(step, t('en', 'ar'))} of 3. Review the suggestions; nothing is added until you confirm.`,
        `الخطوة ${localizedNumber(step, t('en', 'ar'))} من ٣. راجع الاقتراحات؛ مش هنضيف بيانات غير بعد تأكيدك.`,
      )}
    >
      <div className="journey-onboarding editor-form">
        {step === 1 && (
          <>
            <h3 dir="auto">{t('Choose your starting preferences', 'اختار بداية تناسبك')}</h3>
            <label>
              {t('Language', 'اللغة')}
              <select value={language} onChange={(e) => onLanguage(e.target.value as 'ar' | 'en')}>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              <input type="checkbox" checked={dark} onChange={(e) => onDark(e.target.checked)} />
              {t('Dark theme', 'المظهر الداكن')}
            </label>
            <fieldset>
              <legend>{t('Choose two life areas to start with', 'اختار مجالين تبدأ بيهم')}</legend>
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
              {t('Wake-up time', 'وقت الصحيان')}
              <input
                type="time"
                required
                value={wake}
                onInput={(e) => setWake(e.currentTarget.value)}
                onChange={(e) => setWake(e.target.value)}
              />
            </label>
            <label>
              {t('Evening review time', 'وقت المراجعة المسائية')}
              <input
                type="time"
                required
                value={evening}
                onInput={(e) => setEvening(e.currentTarget.value)}
                onChange={(e) => setEvening(e.target.value)}
              />
            </label>
            <label>
              {t('Week starts on', 'بداية الأسبوع')}
              <select value={week} onChange={(e) => setWeek(Number(e.target.value))}>
                <option value={6}>{t('Saturday', 'السبت')}</option>
                <option value={0}>{t('Sunday', 'الأحد')}</option>
                <option value={1}>{t('Monday', 'الاثنين')}</option>
              </select>
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <h3 dir="auto">{t('Choose one goal', 'اختار هدف واحد')}</h3>
            <label>
              {t('Starting template', 'قالب البداية')}
              <select value={template} onChange={(e) => selectTemplate(e.target.value)}>
                {goalTemplates.map((option) => (
                  <option value={option.id} key={option.id}>
                    {language === 'ar' ? option.ar : option.en}
                  </option>
                ))}
              </select>
            </label>
            <p dir="auto" className="muted">
              {t(
                'Templates are editable suggestions, not personal assessments or an automatic plan.',
                'القوالب اقتراحات قابلة للتعديل، مش تقييم شخصي أو خطة تلقائية.',
              )}
            </p>
            <label>
              {t('Your first goal', 'هدفك الأول')}
              <input
                dir="auto"
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              {t('Goal life area', 'مجال الهدف')}
              <select value={area} onChange={(e) => setArea(e.target.value as Area)}>
                {areas.map((value) => (
                  <option value={value} key={value}>
                    {areaLabel(value, t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Success criterion', 'معيار النجاح')}
              <textarea
                dir="auto"
                rows={2}
                maxLength={1000}
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
              />
            </label>
            <label>
              {t('Goal target date (optional)', 'موعد الهدف (اختياري)')}
              <input
                type="date"
                value={date}
                onInput={(e) => setDate(e.currentTarget.value)}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <h3 dir="auto">{t('Review three first tasks', 'راجع أول ثلاث مهام')}</h3>
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
                  {t('Estimated minutes', 'الدقائق المتوقعة')}
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
              {t(
                'Confirming creates one goal, two milestones and these three linked tasks. You choose their execution days in your morning plan.',
                'التأكيد هيضيف هدف واحد ومرحلتين والمهام الثلاثة المرتبطة. اختار أيام التنفيذ في خطة الصبح.',
              )}
            </p>
          </>
        )}
        {error && (
          <p dir="auto" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {step > 1 && (
            <Button disabled={busy} variant="outline" onClick={() => setStep(step - 1)}>
              {t('Back', 'رجوع')}
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
              {t('Next', 'التالي')}
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
              {t('Create my starting plan', 'إنشاء خطة البداية')}
            </Button>
          )}
        </div>
        <Button variant="ghost" disabled={busy} onClick={() => void skip()}>
          {t('Skip setup', 'ابدأ بدون المعالج')}
        </Button>
      </div>
    </Dialog>
  );
}
