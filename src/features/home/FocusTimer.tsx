import { formatNumber as localizedNumber } from '../../i18n/format';
import { formatClockPart, formatDuration, formatTimestamp } from '../../i18n/format';
import { finishFocus, answerFocusCompletion } from './focusModel';
import type { FocusTimerState } from './focusModel';
import { storageText } from '../../i18n/messages';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { usePersisted, transactData } from '../../lib/storage';
import { isActionable } from '../tasks/model';
import type { Task } from '../tasks/model';
import type { Translate } from '../../lib/workspace';
export type FocusSession = {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt: string;
  seconds: number;
};
type Timer = FocusTimerState;
export function FocusTimer({ t, tasks }: { t: Translate; tasks: Task[] }) {
  const [timer, setTimer, error] = usePersisted<Timer>('personal-os.focus.v1', {
    ends: null,
    remaining: 1500,
  });
  const [sessions] = usePersisted<FocusSession[]>('personal-os.sessions.v1', []);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState('');
  const finalizing = useRef(false);
  useEffect(() => {
    if (timer.ends || timer.pendingCompletion)
      document.getElementById('daily-focus')?.closest('details')?.setAttribute('open', '');
  }, [timer.ends, timer.pendingCompletion?.sessionId]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = timer.ends
    ? Math.max(0, Math.ceil((timer.ends - now) / 1000))
    : timer.remaining;
  const running = !!timer.ends && remaining > 0;
  async function finish(askCompletion = false) {
    if (finalizing.current) return;
    finalizing.current = true;
    const ok = await transactData((data) =>
      finishFocus(data, timer.sessionId, Date.now(), askCompletion),
    );
    setNotice(ok ? storageText(t, 'focusSaved') : t('ui.timeWasNotSavedRetry.22fa81'));
    finalizing.current = false;
  }
  useEffect(() => {
    if (timer.ends && !timer.sessionId) {
      setTimer({ ends: null, remaining, taskId: timer.taskId });
      return;
    }
    if (timer.ends && remaining === 0 && !error) void finish(true);
  }, [timer.ends, remaining, error]);
  function start() {
    const seconds = remaining || 1500;
    setNow(Date.now());
    setTimer({
      ...timer,
      ends: Date.now() + seconds * 1000,
      remaining: seconds,
      sessionId: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      plannedSeconds: seconds,
    });
  }
  return (
    <section id="daily-focus" className="focus-widget">
      <h3 dir="auto">{t('ui.focusOnOneStep.8fccd3')}</h3>
      <select
        disabled={!!timer.ends}
        aria-label={t('ui.focusTask.5940c2')}
        value={timer.taskId ?? ''}
        onChange={(e) => setTimer({ ...timer, taskId: e.target.value || undefined })}
      >
        <option value="">{t('ui.unlinkedSession.98d06f')}</option>
        {timer.taskId && !tasks.some((x) => x.id === timer.taskId && isActionable(x)) && (
          <option value={timer.taskId}>
            {tasks.find((x) => x.id === timer.taskId)?.title ?? t('ui.taskRemoved.4c53bf')}
          </option>
        )}
        {tasks.filter(isActionable).map((task) => (
          <option key={task.id} value={task.id}>
            {task.title}
          </option>
        ))}
      </select>
      <div className="focus-time" dir="ltr">
        {formatClockPart(Math.floor(remaining / 60), t('en', 'ar'))}
        <span>:</span>
        {formatClockPart(remaining % 60, t('en', 'ar'))}
      </div>
      <div>
        <Button
          disabled={!!timer.pendingCompletion}
          variant="outline"
          onClick={() => (running ? void finish() : start())}
        >
          {running ? t('ui.pauseAndRecord.070249') : t('ui.startFocus.98a925')}
        </Button>
        <Button
          variant="ghost"
          disabled={!!timer.ends}
          onClick={() => setTimer({ ...timer, remaining: 1500 })}
        >
          {t('ui.reset.4bf2b4')}
        </Button>
      </div>
      {timer.pendingCompletion && (
        <section
          className="focus-question"
          role="group"
          aria-label={t('ui.focusCompletionQuestion.9622bf')}
        >
          <h4 dir="auto">{t('ui.didYouFinishTheTask.970982')}</h4>
          <p dir="auto">
            {tasks.find((task) => task.id === timer.pendingCompletion?.taskId)?.title}
          </p>
          <Button
            onClick={async () => {
              const ok = await transactData((data) =>
                answerFocusCompletion(data, timer.pendingCompletion!.sessionId, true),
              );
              if (!ok) setNotice(t('ui.theTaskChangedReviewItOrKeep.86eb7e'));
            }}
          >
            {t('ui.yesMarkComplete.e30ff3')}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void transactData((data) =>
                answerFocusCompletion(data, timer.pendingCompletion!.sessionId, false),
              )
            }
          >
            {t('ui.keepTaskOpen.a435b2')}
          </Button>
        </section>
      )}
      <p dir="auto" className="muted">
        {t('ui.focusSessionsAreSavedToYourWorkspace.65aa89')}
      </p>
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p dir="auto" role="alert">
          {t('ui.timerStorageFailed.bafb85')}
        </p>
      )}
      <details>
        <summary>
          {t('ui.focusLog.331793')} · {localizedNumber(sessions.length, t('en', 'ar'))}
        </summary>
        {[...sessions]
          .reverse()
          .slice(0, 20)
          .map((s) => (
            <p dir="auto" key={s.id}>
              {tasks.find((x) => x.id === s.taskId)?.title ??
                (s.taskId
                  ? t('ui.taskNoLongerAvailable.90ea24')
                  : t('ui.unlinkedSession.98d06f'))}{' '}
              · <bdi>{formatDuration(s.seconds, t('en', 'ar'))}</bdi> {t('ui.minSec.05be34')} ·{' '}
              {formatTimestamp(s.endedAt, t('en', 'ar'))}
            </p>
          ))}
      </details>
    </section>
  );
}
