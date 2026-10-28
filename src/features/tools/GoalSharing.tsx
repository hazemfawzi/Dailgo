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
      setNotice(t('ui.couldNotLoadGoalShares.b9df5b'));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="card tools-section">
      <h2 dir="auto">{t('ui.shareAGoalWithAnAccountabilityPartner.22c774')}</h2>
      <p dir="auto">{t('ui.thePrivateLinkShowsTheGoalTitle.3b4bce')}</p>
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
            setNotice(t('ui.couldNotShareTheGoal.925128'));
          }
        }}
      >
        <label>
          {t('ui.goalToShare.a0e5f5')}
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
          {t('ui.alsoShareTheGoalNotesAndSuccess.b9d5e4')}
        </label>
        <Button disabled={!goals.length}>{t('ui.createGoalSharingLink.a92029')}</Button>
      </form>
      {link && (
        <aside>
          <a className="tools-secret-link" href={link}>
            {link}
          </a>
          <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(link)}>
            {t('ui.copySharingLink.d54359')}
          </Button>
        </aside>
      )}
      <ul className="tools-records">
        {shares.map((share) => (
          <li key={share.id}>
            <span dir="auto">
              {goals.find((x) => x.id === share.goal)?.title ?? t('ui.unavailableGoal.660f13')}
            </span>
            <time>{formatTimestamp(new Date(share.expires).toISOString(), t('en', 'ar'))}</time>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const result = await apiRequest('shares/' + share.id);
                  setComments((old) => ({ ...old, [share.id]: result.comments }));
                } catch {
                  setNotice(t('ui.couldNotLoadPartnerComments.5a40e1'));
                }
              }}
            >
              {t('ui.reviewPartnerComments.6d5731')}
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
                  <p dir="auto">{t('ui.noPartnerCommentsYet.3f91f6')}</p>
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
                  setNotice(t('ui.couldNotRevokeAccess.d0d9f1'));
                }
              }}
            >
              {t('ui.revokeGoalAccess.19a91a')}
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
