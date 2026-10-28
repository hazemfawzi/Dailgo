import { getServerData } from './activeWorkspace';
export type PlanningPreferences = {
  weekStartsOn: number;
  capacity: number;
  buffer: number;
  timezone: string;
};
export const defaultPlanning: PlanningPreferences = {
  weekStartsOn: 1,
  capacity: 240,
  buffer: 30,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};
export function planningFor(data: Record<string, unknown>): PlanningPreferences {
  const language = data['personal-os.language'] ?? 'ar';
  return {
    ...defaultPlanning,
    weekStartsOn: language === 'ar' ? 6 : 1,
    ...((data['personal-os.planning.v1'] as Partial<PlanningPreferences>) ?? {}),
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
