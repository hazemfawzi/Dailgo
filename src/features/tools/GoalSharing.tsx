import { useEffect, useState } from 'react';
import { useStorageState } from '../../lib/storage';
import { apiRequest } from '../../lib/serverStorage';
import { workspaceEntries } from '../journey/model';
import type { Translate } from '../../lib/workspace';
import { Button } from '../../components/ui/button';
import { formatTimestamp } from '../../i18n/format';
export function GoalSharing({ t }: { t: Translate }) {
  const { data } = useStorageState();
  const goals = workspaceEntries(data).filter((x) => x.kind === 'goal' && !x.archived);
  const [shares, setShares] = useState<{ id: string; goal: string; expires: number }[]>([]);
  const [comments, setComments] = useState<
    Record<string, { id: string; text: string; created: number }[]>
  >({});
  const [link, setLink] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    try {
      setShares((await apiRequest('shares')).shares);
    } catch {
      setNotice(t('Could not load goal shares.', 'تعذر تحميل مشاركات الأهداف.'));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="card tools-section">
      <h2 dir="auto">
        {t('Share a goal with an accountability partner', 'شارك هدفًا مع شريك متابعة')}
      </h2>
      <p dir="auto">
        {t(
          'The private link shows the goal title, target, milestones and task counts. Anyone holding it can view and comment for seven days. You can revoke access here. No personal tasks or other goals are shared.',
          'الرابط الخاص بيعرض عنوان الهدف وموعده ومراحله وعدد مهامه. أي شخص معاه الرابط يقدر يشوف ويعلّق لمدة سبعة أيام. تقدر تلغي الوصول من هنا. مهامك الشخصية وأهدافك التانية مش بتتشارك.',
        )}
      </p>
      <form
        className="editor-form tools-inline"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const fields = new FormData(e.currentTarget);
            const result = await apiRequest('shares', 'POST', {
              goalId: String(fields.get('goal')),
              includeNotes: fields.get('notes') === 'on',
            });
            setLink(location.origin + '/share#' + result.token);
            await load();
          } catch {
            setNotice(t('Could not share the goal.', 'تعذر مشاركة الهدف.'));
          }
        }}
      >
        <label>
          {t('Goal to share', 'الهدف المطلوب مشاركته')}
          <select name="goal" required>
            {goals.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input name="notes" type="checkbox" />
          {t(
            'Also share the goal notes and success criterion',
            'مشاركة ملاحظات الهدف ومعيار النجاح أيضًا',
          )}
        </label>
        <Button disabled={!goals.length}>
          {t('Create goal sharing link', 'إنشاء رابط مشاركة الهدف')}
        </Button>
      </form>
      {link && (
        <aside>
          <a className="tools-secret-link" href={link}>
            {link}
          </a>
          <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(link)}>
            {t('Copy sharing link', 'نسخ رابط المشاركة')}
          </Button>
        </aside>
      )}
      <ul className="tools-records">
        {shares.map((share) => (
          <li key={share.id}>
            <span dir="auto">
              {goals.find((x) => x.id === share.goal)?.title ??
                t('Unavailable goal', 'هدف غير متاح')}
            </span>
            <time>{formatTimestamp(new Date(share.expires).toISOString(), t('en', 'ar'))}</time>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const result = await apiRequest('shares/' + share.id);
                  setComments((old) => ({ ...old, [share.id]: result.comments }));
                } catch {
                  setNotice(
                    t('Could not load partner comments.', 'تعذر تحميل تعليقات شريك المتابعة.'),
                  );
                }
              }}
            >
              {t('Review partner comments', 'عرض تعليقات شريك المتابعة')}
            </Button>
            {comments[share.id] && (
              <div className="share-comments">
                {comments[share.id].length ? (
                  comments[share.id].map((comment) => (
                    <blockquote key={comment.id}>
                      <p dir="auto">{comment.text}</p>
                      <small>
                        {formatTimestamp(new Date(comment.created).toISOString(), t('en', 'ar'))}
                      </small>
                    </blockquote>
                  ))
                ) : (
                  <p dir="auto">
                    {t('No partner comments yet.', 'لسه مفيش تعليقات من شريك المتابعة.')}
                  </p>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await apiRequest('shares/' + share.id, 'DELETE', {});
                  setLink('');
                  await load();
                } catch {
                  setNotice(t('Could not revoke access.', 'تعذر إلغاء الوصول.'));
                }
              }}
            >
              {t('Revoke goal access', 'إلغاء وصول الهدف')}
            </Button>
          </li>
        ))}
      </ul>
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
