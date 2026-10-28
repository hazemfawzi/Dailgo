import type { Translate } from '../../lib/workspace';
import { Bell, Check, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { usePersisted } from '../../lib/storage';
export function Reminder({ t }: { t: Translate }) {
  const [dismissed, setDismissed, error] = usePersisted('personal-os.reminder.v1', false);
  return (
    <section className="reminder-card">
      <span className="assistant-icon">
        <Bell size={18} />
      </span>
      <div>
        <h3 dir="auto">
          {dismissed ? t('ui.aLittleMoreBreathingRoom.d58765') : t('ui.aGentleReminder.ca5d52')}
        </h3>
        <p dir="auto">
          {dismissed
            ? t('ui.reminderMarkedAsDone.163912')
            : t('ui.checkInWithFamilyThisEvening.8cea26')}{' '}
          <span>{t('ui.sampleNoNotificationWillBeSent.1d9a43')}</span>
        </p>
        {error && (
          <p dir="auto" role="alert">
            {t('ui.unableToSaveThisReminder.14d7dc')}
          </p>
        )}
      </div>
      <Button variant="ghost" onClick={() => setDismissed(!dismissed)}>
        {dismissed ? <RotateCcw size={16} /> : <Check size={16} />}
        {dismissed ? t('ui.restore.82172b') : t('ui.done.c321b7')}
      </Button>
    </section>
  );
}
