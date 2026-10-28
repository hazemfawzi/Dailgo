import { aiRecord } from './plan';
import type { AIPlan } from './plan';
import { formatCalendarDate, formatNumber, formatTime } from '../../../i18n/format';
import { areaLabel } from '../../../lib/workspace';
import type { Translate } from '../../../lib/workspace';
import { Button } from '../../../components/ui/button';
export function AIPlanPreview({
  plan,
  t,
  status,
  busy,
  confirm,
  cancel,
  undo,
}: {
  plan: AIPlan;
  t: Translate;
  status?: string;
  busy: boolean;
  confirm: () => void;
  cancel: () => void;
  undo: () => void;
}) {
  return (
    <section className="chat-proposal ai-plan">
      <h3 dir="auto">{t('ui.claudeProposalReviewBeforeSaving.633b70')}</h3>
      <p dir="auto">{t('ui.nothingChangesUntilYouConfirmTheComplete.145a58')}</p>
      {plan.contextTruncated && (
        <p dir="auto" className="capture-hint">
          {t('ui.theSelectedContextWasShortenedToControl.08602a')}
        </p>
      )}
      <ol>
        {plan.actions.map((action, index) => {
          const record = aiRecord(action);
          const item =
            action.kind === 'update_task' || action.kind === 'update_goal'
              ? { ...action.before, ...action.patch }
              : record;
          return (
            <li key={index}>
              <strong dir="auto">
                {action.kind === 'update_goal'
                  ? t('ui.addGoalMilestones.f4d909')
                  : action.kind === 'update_task'
                    ? t('ui.updateTask.de756c')
                    : action.kind === 'create_task'
                      ? t('ui.createTask.75da8c')
                      : t('ui.createGoal.280a46')}
                : {item.title}
              </strong>
              {action.kind === 'update_goal' ? (
                <p>
                  {action.patch.date ? formatCalendarDate(action.patch.date, t('en', 'ar')) : ''}
                </p>
              ) : action.kind === 'create_goal' ? (
                <p dir="auto">
                  {areaLabel(action.goal.area, t)}
                  {action.goal.date
                    ? ' · ' + formatCalendarDate(action.goal.date, t('en', 'ar'))
                    : ''}
                </p>
              ) : (
                <p dir="auto">
                  {'plannedDate' in item && item.plannedDate
                    ? formatCalendarDate(item.plannedDate, t('en', 'ar'))
                    : ''}
                  {'plannedTime' in item && item.plannedTime
                    ? ' · ' + formatTime(item.plannedTime, t('en', 'ar'))
                    : ''}
                  {'estimate' in item && item.estimate
                    ? ' · ' + formatNumber(item.estimate, t('en', 'ar')) + ' ' + t('ui.min.2c0d20')
                    : ''}
                  {'dueDate' in item && item.dueDate
                    ? ' · ' +
                      t('ui.due.6c34a1') +
                      ': ' +
                      formatCalendarDate(item.dueDate, t('en', 'ar'))
                    : ''}
                </p>
              )}
              {action.kind === 'update_task' && (
                <p className="muted" dir="auto">
                  {t('ui.before.c8c77a')}: {action.before.title}
                  {action.before.plannedDate
                    ? ' · ' + formatCalendarDate(action.before.plannedDate, t('en', 'ar'))
                    : ''}
                </p>
              )}
              {action.kind === 'update_goal' &&
                action.patch.milestones?.map((m) => (
                  <p dir="auto" key={m.id}>
                    {m.title}
                    {m.date ? ' · ' + formatCalendarDate(m.date, t('en', 'ar')) : ''}
                  </p>
                ))}
              {action.kind === 'create_goal' &&
                action.goal.milestones?.map((m) => (
                  <p key={m.id} dir="auto">
                    {m.title}
                    {m.date ? ' · ' + formatCalendarDate(m.date, t('en', 'ar')) : ''}
                  </p>
                ))}
            </li>
          );
        })}
      </ol>
      {status === 'pending' ? (
        <div className="proposal-actions">
          <Button disabled={busy} onClick={confirm}>
            {t('ui.confirmClaudeProposal.ea0275')}
          </Button>
          <Button disabled={busy} variant="outline" onClick={cancel}>
            {t('ui.cancelProposal.0941ab')}
          </Button>
        </div>
      ) : status === 'confirmed' ? (
        <div>
          <p dir="auto" role="status">
            {t('ui.proposalSavedHistoryIsAvailableInEach.dd8333')}
          </p>
          <Button disabled={busy} variant="outline" onClick={undo}>
            {t('ui.undoClaudeChanges.99746a')}
          </Button>
        </div>
      ) : (
        <p dir="auto">
          {status === 'reverted'
            ? t('ui.changesReverted.9e02f1')
            : t('ui.proposalCancelled.84d023')}
        </p>
      )}
    </section>
  );
}
