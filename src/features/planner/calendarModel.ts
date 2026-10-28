// Calendar dates are wall-clock labels, not instants in the planning timezone.
export function calendarDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseCalendarDate(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T12:00:00`);
  return !Number.isNaN(date.getTime()) && calendarDate(date) === key ? date : null;
}
export function calendarMonth(key: string) {
  const date = parseCalendarDate(key);
  if (!date) throw Error('Invalid calendar date');
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}
