import type { ComponentProps } from 'react';
import { useStorageState } from '../lib/storage';
import { formatCalendarDate, formatTime } from '../i18n/format';

export function DateTimeInput(props: ComponentProps<'input'>) {
  const { data } = useStorageState();
  const language = data['personal-os.language'] === 'en' ? 'en' : 'ar';
  const value = typeof props.value === 'string' ? props.value : '';
  const preview = value
    ? props.type === 'time'
      ? formatTime(value, language)
      : formatCalendarDate(value, language)
    : '';
  return (
    <span className="localized-date-field">
      <input {...props} lang={language === 'ar' ? 'ar-EG' : 'en-GB'} />
      {preview && (
        <small className="localized-date-preview" dir="auto" aria-hidden="true">
          {preview}
        </small>
      )}
    </span>
  );
}
