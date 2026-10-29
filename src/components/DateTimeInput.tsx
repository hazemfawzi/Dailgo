import { useEffect, useState, useRef } from 'react';
import type { ChangeEvent, ComponentProps } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStorageState } from '../lib/storage';
import { formatCalendarDate, formatTime, formatNumber } from '../i18n/format';
import { createTranslator } from '../i18n/translate';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
function latin(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (digit) =>
    String(
      '٠١٢٣٤٥٦٧٨٩'.includes(digit) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(digit) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit),
    ),
  );
}
function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) > 0 &&
    !Number.isNaN(Date.parse(value + 'T12:00:00Z')) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
  );
}
function editValue(value: string, time: boolean) {
  const result = time || !validDate(value) ? value : value.split('-').reverse().join('/');
  return result.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}
export function DateTimeInput(props: ComponentProps<'input'>) {
  const { data } = useStorageState();
  const ar = data['personal-os.language'] !== 'en';
  const language = ar ? 'ar' : 'en';
  const t = createTranslator(language);
  const [uncontrolled, setUncontrolled] = useState(
    typeof props.defaultValue === 'string' ? props.defaultValue : '',
  );
  const value = typeof props.value === 'string' ? props.value : uncontrolled;
  const { defaultValue: _defaultValue, ...inputProps } = props;
  const time = props.type === 'time';
  const [draft, setDraft] = useState(editValue(value, time));
  const [invalid, setInvalid] = useState(false);
  const field = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState('');
  useEffect(() => {
    setDraft(editValue(value, time));
    setInvalid(false);
    field.current?.setCustomValidity('');
  }, [value, time, language]);
  const preview = value
    ? time
      ? formatTime(value, language)
      : formatCalendarDate(value, language)
    : '';
  const allowed = (day: string) =>
    (!props.min || day >= String(props.min)) && (!props.max || day <= String(props.max));
  // Custom controls preserve the existing ISO-value onChange contract, independent of display language.
  function emit(next: string) {
    const input = document.createElement('input');
    input.type = props.type ?? 'text';
    input.name = props.name ?? '';
    input.value = next;
    if (props.value === undefined) setUncontrolled(next);
    props.onChange?.({ target: input, currentTarget: input } as ChangeEvent<HTMLInputElement>);
  }
  function change(text: string) {
    setDraft(text);
    let next = latin(text.trim());
    if (!time && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(next)) {
      const [day, month, year] = next.split('/');
      next = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const valid =
      !next || ((time ? /^([01]\d|2[0-3]):[0-5]\d$/.test(next) : validDate(next)) && allowed(next));
    setInvalid(!valid);
    field.current?.setCustomValidity(valid ? '' : t('datePicker.invalid'));
    if (valid) emit(next);
  }
  const anchor =
    month || (validDate(value) ? value.slice(0, 7) : new Date().toISOString().slice(0, 7));
  const first = new Date(anchor + '-01T12:00:00Z');
  const planning = data['personal-os.planning.v1'] as { weekStartsOn?: number } | undefined;
  const start = planning?.weekStartsOn ?? (ar ? 6 : 1);
  const offset = (first.getUTCDay() - start + 7) % 7;
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  function moveMonth(by: number) {
    const next = new Date(first);
    next.setUTCMonth(first.getUTCMonth() + by);
    if (next.getUTCFullYear() > 0 && next.getUTCFullYear() < 10000)
      setMonth(next.toISOString().slice(0, 7));
  }
  return (
    <span className="localized-date-field">
      {ar ? (
        <span className="arabic-date-control" dir="rtl">
          <input
            {...inputProps}
            name={undefined}
            ref={field}
            type="text"
            lang="ar"
            dir="rtl"
            inputMode="text"
            placeholder={time ? 'ساعة:دقيقة (٢٤ ساعة)' : 'يوم/شهر/سنة'}
            value={draft}
            aria-invalid={invalid || undefined}
            onChange={(event) => change(event.target.value)}
          />
          {props.name && <input type="hidden" name={props.name} value={value} />}
          {!time && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={props.disabled || props.readOnly}
              aria-label={t('datePicker.open')}
              onClick={() => {
                setMonth(validDate(value) ? value.slice(0, 7) : '');
                setOpen(true);
              }}
            >
              <CalendarDays size={18} />
            </Button>
          )}
        </span>
      ) : (
        <input
          {...props}
          lang="en-GB"
          onChange={(event) => {
            if (props.value === undefined) setUncontrolled(event.target.value);
            props.onChange?.(event);
          }}
        />
      )}
      {invalid && <small role="alert">{t('datePicker.invalid')}</small>}
      {preview && (
        <small className="localized-date-preview" dir="auto" aria-hidden="true">
          {preview}
        </small>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('datePicker.open')}
        description={
          time ? 'ساعة ودقيقة بنظام ٢٤ ساعة' : 'اختار اليوم من التقويم أو اكتب يوم/شهر/سنة.'
        }
      >
        <div className="arabic-calendar" dir="rtl">
          <div className="calendar-month-heading">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('datePicker.previous')}
              onClick={() => moveMonth(-1)}
            >
              <ChevronRight size={18} />
            </Button>
            <strong>
              {new Intl.DateTimeFormat('ar-EG', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(first)}
            </strong>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('datePicker.next')}
              onClick={() => moveMonth(1)}
            >
              <ChevronLeft size={18} />
            </Button>
          </div>
          <div className="calendar-date-grid">
            {Array.from({ length: 7 }, (_, index) => (
              <small key={'weekday' + index}>
                {new Intl.DateTimeFormat('ar-EG', { weekday: 'narrow', timeZone: 'UTC' }).format(
                  new Date(Date.UTC(2026, 10, 1 + ((start + index) % 7))),
                )}
              </small>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span key={'blank' + index} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = `${anchor}-${String(index + 1).padStart(2, '0')}`;
              return (
                <Button
                  type="button"
                  key={day}
                  variant={day === value ? 'default' : 'ghost'}
                  aria-label={formatCalendarDate(day, 'ar')}
                  aria-pressed={day === value}
                  disabled={!allowed(day)}
                  onClick={() => {
                    setDraft(editValue(day, false));
                    setInvalid(false);
                    field.current?.setCustomValidity('');
                    emit(day);
                    setOpen(false);
                  }}
                >
                  {formatNumber(index + 1, 'ar')}
                </Button>
              );
            })}
          </div>
        </div>
      </Dialog>
    </span>
  );
}
