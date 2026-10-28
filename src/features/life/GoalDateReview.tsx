import { Button } from '../../components/ui/button';
import type { Entry, Translate } from '../../lib/workspace';
import { acknowledgeLateMilestones, milestoneDateIssue } from './goalDates';
export function GoalDateReview({
  goal,
  onChange,
  t,
}: {
  goal: Entry;
  onChange: (goal: Entry) => void;
  t: Translate;
}) {
  const issue = milestoneDateIssue(goal);
  const late = goal.date && goal.milestones?.some((m) => m.date > goal.date);
  return (
    <>
      {late && (
        <section className="goal-date-review">
          <p dir="auto" role="alert">
            {t('ui.someMilestonesAreAfterThisTargetExtend.6afe1f')}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({
                ...goal,
                date: goal.milestones!.reduce(
                  (last, m) => (m.date > last ? m.date : last),
                  goal.date,
                ),
              })
            }
          >
            {t('ui.extendGoalToTheLastMilestone.276e31')}
          </Button>
          <label>
            <input
              type="checkbox"
              checked={issue !== 'after-goal'}
              onChange={(e) => onChange(acknowledgeLateMilestones(goal, e.target.checked))}
            />
            {t('ui.keepMilestonesAfterTheGoalTarget.4d48d9')}
          </label>
        </section>
      )}
      {issue === 'invalid-date' && (
        <p dir="auto" role="alert">
          {t('ui.useValidCalendarDates.ae09b0')}
        </p>
      )}
    </>
  );
}
