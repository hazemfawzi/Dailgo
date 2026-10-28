import { DateTimeInput } from '../../components/DateTimeInput';
import { formatNumber } from '../../i18n/format';
import { useRef, useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { areas, areaLabel } from '../../lib/workspace';
import type { Area, Translate } from '../../lib/workspace';
import { transactData } from '../../lib/storage';
import { goalTemplates, addGoalTemplate } from '../journey/model';
export function GoalTemplates({ t }: { t: Translate }) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState('language');
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<Area>('Learning');
  const [date, setDate] = useState('');
  const [criteria, setCriteria] = useState('');
  const [tasks, setTasks] = useState<{ title: string; estimate: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const batch = useRef(crypto.randomUUID());
  function choose(id: string) {
    const value = goalTemplates.find((x) => x.id === id)!;
    setTemplate(id);
    setTitle(
      t(value.en, value.ar).replace(' — editable goal', '').replace(' — هدف قابل للتعديل', ''),
    );
    setArea(value.area);
    setTasks(
      (t('en', 'ar') === 'ar' ? value.arabic : value.titles).map((title) => ({
        title,
        estimate: 15,
      })),
    );
  }
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          batch.current = crypto.randomUUID();
          setDate('');
          setCriteria('');
          setNotice('');
          choose('language');
          setOpen(true);
        }}
      >
        {t('ui.useAGoalTemplate.a9c3be')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title={t('ui.goalTemplates.10e084')}
        description={t('ui.reviewOneGoalTwoMilestonesAndThree.ec7775')}
      >
        <div className="editor-form">
          <label>
            {t('ui.goalTemplate.4dc54f')}
            <select value={template} onChange={(e) => choose(e.target.value)}>
              {goalTemplates.map((value) => (
                <option key={value.id} value={value.id}>
                  {t(value.en, value.ar)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('ui.templateGoalTitle.d23b34')}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              dir="auto"
              maxLength={160}
            />
          </label>
          <label>
            {t('ui.templateLifeArea.1d4c22')}
            <select value={area} onChange={(e) => setArea(e.target.value as Area)}>
              {areas.map((value) => (
                <option key={value} value={value}>
                  {areaLabel(value, t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('ui.templateTargetDate.45ad3b')}
            <DateTimeInput
              type="date"
              value={date}
              onInput={(e) => setDate(e.currentTarget.value)}
              aria-label={t('ui.templateTargetDate.45ad3b')}
            />
          </label>
          <label>
            {t('ui.templateSuccessCriterion.2e4049')}
            <textarea
              dir="auto"
              rows={2}
              maxLength={2000}
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
            />
          </label>
          <p dir="auto">{t('ui.milestonesFirstStepThenProgressReviewTasks.7679d9')}</p>
          {tasks.map((task, index) => (
            <label key={index}>
              {t('ui.suggestedTask.916a83', { en0: index + 1, ar0: formatNumber(index + 1, 'ar') })}
              <input
                dir="auto"
                value={task.title}
                maxLength={160}
                onChange={(e) =>
                  setTasks((old) =>
                    old.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                  )
                }
              />
            </label>
          ))}
          <Button
            disabled={busy || !title.trim() || tasks.some((task) => !task.title.trim())}
            onClick={async () => {
              setBusy(true);
              const ok = await transactData((data) =>
                addGoalTemplate(
                  data,
                  {
                    templateId: template,
                    title,
                    goalArea: area,
                    date,
                    criteria,
                    tasks,
                    language: t('en', 'ar') as 'en' | 'ar',
                  },
                  batch.current,
                ),
              );
              setBusy(false);
              if (ok) setOpen(false);
              else setNotice(t('ui.nothingAddedReviewStorageAndRetryThis.509685'));
            }}
          >
            {t('ui.createReviewedGoalAndTasks.d26d51')}
          </Button>
          {notice && (
            <p dir="auto" role="alert">
              {notice}
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
