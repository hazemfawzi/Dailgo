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
        {t('Use a goal template', 'استخدم قالب هدف')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title={t('Goal templates', 'قوالب الأهداف')}
        description={t(
          'Review one goal, two milestones and three first tasks. Nothing is added until confirmation.',
          'راجع هدفًا ومرحلتين وثلاث مهام أولى. لن يُضاف شيء قبل التأكيد.',
        )}
      >
        <div className="editor-form">
          <label>
            {t('Goal template', 'قالب الهدف')}
            <select value={template} onChange={(e) => choose(e.target.value)}>
              {goalTemplates.map((value) => (
                <option key={value.id} value={value.id}>
                  {t(value.en, value.ar)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Template goal title', 'عنوان الهدف من القالب')}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              dir="auto"
              maxLength={160}
            />
          </label>
          <label>
            {t('Template life area', 'مجال القالب')}
            <select value={area} onChange={(e) => setArea(e.target.value as Area)}>
              {areas.map((value) => (
                <option key={value} value={value}>
                  {areaLabel(value, t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Template target date', 'موعد الهدف من القالب')}
            <input type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} />
          </label>
          <label>
            {t('Template success criterion', 'معيار نجاح القالب')}
            <textarea
              dir="auto"
              rows={2}
              maxLength={2000}
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
            />
          </label>
          <p dir="auto">
            {t(
              'Milestones: first step, then progress review. Tasks remain unplanned until you choose execution days.',
              'المراحل: الخطوة الأولى ثم مراجعة التقدم. المهام تفضل بدون يوم تنفيذ لحد ما تختاره.',
            )}
          </p>
          {tasks.map((task, index) => (
            <label key={index}>
              {t(`Suggested task ${index + 1}`, `المهمة المقترحة ${formatNumber(index + 1, 'ar')}`)}
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
              else
                setNotice(
                  t(
                    'Nothing added. Review storage and retry this preview.',
                    'لم يُضف شيء. راجع التخزين وأعد نفس المعاينة.',
                  ),
                );
            }}
          >
            {t('Create reviewed goal and tasks', 'إنشاء الهدف والمهام بعد المراجعة')}
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
