import { useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { validateData } from '../../lib/storageCore';
import type { Task } from '../tasks/model';
import type { Translate } from '../../lib/workspace';
import { formatNumber } from '../../i18n/format';
type Space = {
  title: string;
  data: { 'personal-os.tasks.v1': Task[] };
  members: { principal: string }[];
};
export function FamilyTransfer({
  space,
  t,
  restore,
}: {
  space: Space;
  t: Translate;
  restore: (tasks: Task[]) => Promise<boolean>;
}) {
  const [preview, setPreview] = useState<{ name: string; tasks: Task[] } | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const readId = useRef(0);
  function download() {
    const value = {
      format: 'dailgo-family-v1',
      version: 1,
      title: space.title,
      exportedAt: new Date().toISOString(),
      tasks: space.data['personal-os.tasks.v1'],
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dailgo-family-' + new Date().toISOString().slice(0, 10) + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function read(file: File | undefined) {
    if (!file) return;
    const observed = ++readId.current;
    try {
      if (file.size > 2 * 1024 * 1024) throw Error();
      const value = JSON.parse(await file.text());
      if (
        value.format !== 'dailgo-family-v1' ||
        value.version !== 1 ||
        !Array.isArray(value.tasks) ||
        value.tasks.length > 1000 ||
        value.tasks.some(
          (task: any) =>
            task.category !== 'Family' ||
            typeof task.title !== 'string' ||
            !task.title.trim() ||
            task.title.length > 160,
        )
      )
        throw Error();
      validateData({ 'personal-os.tasks.v1': value.tasks });
      const batch = crypto.randomUUID();
      const tasks: Task[] = value.tasks.map((task: Task, index: number) => {
        const {
          revision,
          history,
          createdAt,
          updatedAt,
          completedAt,
          source,
          goalId,
          projectId,
          memoryId,
          recurrenceFrom,
          recurrenceRoot,
          ...fields
        } = task;
        return {
          ...fields,
          id: `family-import:${batch}:${index}`,
          assigneeId: space.members.some((x) => x.principal === task.assigneeId)
            ? task.assigneeId
            : undefined,
        };
      });
      if (observed === readId.current) {
        setPreview({ name: file.name, tasks });
        setNotice('');
      }
    } catch {
      if (observed === readId.current) {
        setPreview(null);
        setNotice(
          t(
            'Unsupported family backup. Nothing changed.',
            'نسخة العائلة غير مدعومة. لم يتغير شيء.',
          ),
        );
      }
    }
  }
  return (
    <section className="family-transfer">
      <div className="tools-tabs">
        <Button variant="outline" onClick={download}>
          {t('Export shared tasks', 'تصدير المهام المشتركة')}
        </Button>
        <label className="button button-outline">
          {t('Preview family backup', 'معاينة نسخة العائلة')}
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
      </div>
      <p dir="auto" className="muted">
        {t(
          'Personal backups do not include shared tasks. This separate export contains this space’s tasks, not account passwords or membership invitations.',
          'النسخة الشخصية لا تشمل المهام المشتركة. التصدير المنفصل بيحتوي مهام المساحة دي، مش كلمات المرور أو دعوات العضوية.',
        )}
      </p>
      <Dialog
        open={!!preview}
        onOpenChange={(value) => {
          if (!value && !busy) {
            readId.current++;
            setPreview(null);
          }
        }}
        title={t('Review family task copies', 'راجع نسخ المهام العائلية')}
        description={t(
          'Copies tasks into this space without replacing existing tasks or changing membership. Assignments to missing members are cleared.',
          'نسخ المهام للمساحة دي بدون استبدال الموجود أو تغيير العضوية. إسناد المهام لأعضاء غير موجودين بيتشال.',
        )}
      >
        <p dir="auto">
          {preview?.name} · {formatNumber(preview?.tasks.length ?? 0, t('en', 'ar'))}
        </p>
        <ul>
          {preview?.tasks.slice(0, 20).map((task) => (
            <li dir="auto" key={task.id}>
              {task.title}
            </li>
          ))}
        </ul>
        <Button
          disabled={busy || !preview?.tasks.length}
          onClick={async () => {
            if (!preview) return;
            setBusy(true);
            const existing = new Set(space.data['personal-os.tasks.v1'].map((x) => x.id));
            const ok = await restore([
              ...space.data['personal-os.tasks.v1'],
              ...preview.tasks.filter((task) => !existing.has(task.id)),
            ]);
            setBusy(false);
            if (ok) setPreview(null);
            else
              setNotice(
                t(
                  'The space changed or copying failed. Review the latest tasks before retrying.',
                  'المساحة اتغيرت أو النسخ فشل. راجع أحدث مهام قبل المحاولة.',
                ),
              );
          }}
        >
          {t('Confirm shared task copies', 'تأكيد نسخ المهام المشتركة')}
        </Button>
      </Dialog>
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
