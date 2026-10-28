import { formatTimestamp } from '../../i18n/format';
import type { CaptureSource } from './model';
import type { Translate } from '../../lib/workspace';
export function CaptureOrigin({ source, t }: { source?: CaptureSource; t: Translate }) {
  return source ? (
    <details className="capture-original">
      <summary>{t('ui.capturedFromYourRequest.e3f44e')}</summary>
      <p dir="auto">{source.fragment}</p>
      <small>{formatTimestamp(source.createdAt, t('en', 'ar'))}</small>
      <details>
        <summary>{t('ui.fullRequest.d0d920')}</summary>
        <p dir="auto">{source.text}</p>
      </details>
    </details>
  ) : null;
}
