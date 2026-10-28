import type { Entry } from '../../lib/workspace';
const dayMs = 86400000;
export function eventInterval(event: Entry) {
  const start = Date.parse(`${event.date}T${event.time}:00Z`);
  return {
    start,
    end: start + (event.durationMinutes ?? 60) * 60000,
    estimated: event.durationMinutes === undefined,
  };
}
export function eventConflicts(entries: Entry[], date?: string) {
  const events = entries.filter((e) => e.kind === 'event' && !e.archived);
  const conflicts: { a: Entry; b: Entry; minutes: number; estimated: boolean }[] = [];
  for (let i = 0; i < events.length; i++)
    for (let j = i + 1; j < events.length; j++) {
      const a = eventInterval(events[i]),
        b = eventInterval(events[j]);
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (
        overlap > 0 &&
        (!date ||
          (Math.max(a.start, b.start) < Date.parse(`${date}T00:00:00Z`) + dayMs &&
            Math.min(a.end, b.end) > Date.parse(`${date}T00:00:00Z`)))
      )
        conflicts.push({
          a: events[i],
          b: events[j],
          minutes: Math.ceil(overlap / 60000),
          estimated: a.estimated || b.estimated,
        });
    }
  return conflicts;
}
export function eventMinutesOnDay(entries: Entry[], date: string) {
  const start = Date.parse(`${date}T00:00:00Z`);
  return entries
    .filter((e) => e.kind === 'event' && !e.archived)
    .reduce((sum, e) => {
      const interval = eventInterval(e);
      return (
        sum +
        Math.max(0, Math.min(interval.end, start + dayMs) - Math.max(interval.start, start)) / 60000
      );
    }, 0);
}
export const routineDue = (entry: Entry, date: string) =>
  !entry.routineDays?.length || entry.routineDays.includes(new Date(`${date}T12:00:00`).getDay());
export function occupiedEventMinutes(entries: Entry[], date: string) {
  const start = Date.parse(`${date}T00:00:00Z`);
  const intervals = entries
    .filter((e) => e.kind === 'event' && !e.archived)
    .map(eventInterval)
    .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end))
    .map((x) => ({ start: Math.max(start, x.start), end: Math.min(start + dayMs, x.end) }))
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let end = -Infinity;
  for (const interval of intervals) {
    total += Math.max(0, interval.end - Math.max(end, interval.start));
    end = Math.max(end, interval.end);
  }
  return total / 60000;
}
