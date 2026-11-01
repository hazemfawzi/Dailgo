import { getServerData } from './activeWorkspace';
export type PlanningPreferences = {
  weekStartsOn: number;
  capacity: number;
  buffer: number;
  timezone: string;
};
export const WEEK_START = 6;
export const defaultPlanning: PlanningPreferences = {
  weekStartsOn: WEEK_START,
  capacity: 240,
  buffer: 30,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};
export function planningFor(data: Record<string, unknown>): PlanningPreferences {
  return {
    ...defaultPlanning,
    ...((data['personal-os.planning.v1'] as Partial<PlanningPreferences>) ?? {}),
    weekStartsOn: WEEK_START,
  };
}
export function getPlanning(): PlanningPreferences {
  try {
    const active = getServerData();
    if (active) return planningFor(active);
    if (typeof localStorage === 'undefined') return defaultPlanning;
    const raw = localStorage.getItem('personal-os.workspace.v3');
    return planningFor(raw ? (JSON.parse(raw).data ?? {}) : {});
  } catch {
    return defaultPlanning;
  }
}
