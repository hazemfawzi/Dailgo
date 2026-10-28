import { getPlanning } from './planningConfig';
import type { Dispatch, SetStateAction } from 'react';
export type Translate = (en: string, ar: string) => string;
export type Area = 'Work' | 'Family' | 'Health' | 'Learning' | 'Finance' | 'Personal';
export const areas: Area[] = ['Work', 'Family', 'Health', 'Learning', 'Finance', 'Personal'];
const arabicAreas = {
  Work: 'العمل',
  Family: 'العائلة',
  Health: 'الصحة',
  Learning: 'التعلم',
  Finance: 'المال',
  Personal: 'الأهداف الشخصية',
};
export const areaLabel = (area: Area, t: Translate) => t(area, arabicAreas[area]);
export type EntryKind =
  'project' | 'goal' | 'event' | 'routine' | 'note' | 'preference' | 'decision' | 'personal';
const labels: Record<EntryKind, [string, string]> = {
  project: ['Project', 'مشروع'],
  goal: ['Goal', 'هدف'],
  event: ['Event', 'موعد'],
  routine: ['Routine', 'روتين'],
  note: ['Note', 'ملاحظة'],
  preference: ['Preference', 'تفضيل'],
  decision: ['Decision', 'قرار'],
  personal: ['Personal information', 'معلومة شخصية'],
};
export const kindLabel = (kind: EntryKind, t: Translate) => t(...labels[kind]);
export const memoryKinds: EntryKind[] = ['note', 'preference', 'decision', 'personal'];
export type Milestone = {
  id: string;
  title: string;
  date: string;
  targetDateAcknowledgement?: string;
};
export type Entry = import('./audit').AuditFields & {
  tags?: string[];
  links?: string[];
  attachments?: { name: string; mime: string; data: string }[];
  parentGoalId?: string;
  routineDays?: number[];
  sourceLabel?: string;
  certainty?: 'explicit' | 'inferred' | 'unspecified';
  context?: string;
  expiresOn?: string;
  alternatives?: string;
  rationale?: string;
  successCriteria?: string;
  outcomeAchieved?: boolean;
  source?: import('../features/capture/model').CaptureSource;
  id: string;
  milestones?: Milestone[];
  durationMinutes?: number;
  kind: EntryKind;
  title: string;
  detail: string;
  area: Area;
  date: string;
  time: string;
  progress: number;
  archived: boolean;
  doneDates: string[];
};
export type EntrySetter = Dispatch<SetStateAction<Entry[]>>;
export function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: getPlanning().timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return ['year', 'month', 'day']
    .map((type) => parts.find((p) => p.type === type)?.value)
    .join('-');
}
export function makeEntry(kind: EntryKind, title = '', area: Area = 'Personal'): Entry {
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    detail: '',
    area,
    date: kind === 'event' ? localDate() : '',
    time: kind === 'event' ? '09:00' : '',
    progress: 0,
    archived: false,
    doneDates: [],
  };
}
export const initialEntries: Entry[] = [
  {
    ...makeEntry('event', 'Project catch-up', 'Work'),
    id: 'seed-event-work',
    time: '10:00',
    detail: 'Sample local plan · Review the project together.',
  },
  {
    ...makeEntry('event', 'A little time to learn', 'Learning'),
    id: 'seed-event-learning',
    time: '14:30',
    detail: 'Sample local plan · Read and explore.',
  },
  {
    ...makeEntry('event', 'Dinner with family', 'Family'),
    id: 'seed-event-family',
    time: '18:00',
    detail: 'Sample local plan · A little time together.',
  },
  {
    ...makeEntry('goal', 'Build a consistent reading habit', 'Learning'),
    id: 'seed-goal-learning',
    detail: 'Sample goal · Read a little every day.',
    progress: 35,
  },
  {
    ...makeEntry('goal', 'Move a little every day', 'Health'),
    id: 'seed-goal-health',
    detail: 'Sample goal · A short walk is a good start.',
    progress: 60,
  },
  {
    ...makeEntry('routine', 'Morning check-in', 'Personal'),
    id: 'seed-routine',
    detail: 'Sample routine · Choose one intention for the day.',
    time: '08:00',
  },
  {
    ...makeEntry('preference', 'Quiet mornings', 'Personal'),
    id: 'seed-memory',
    detail: 'Sample preference · Keep the first hour of the day free for focused work.',
  },
];
