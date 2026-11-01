import { usePersisted } from './storage';
import { getPlanning, WEEK_START } from './planningConfig';
export { defaultPlanning, getPlanning } from './planningConfig';
export type { PlanningPreferences } from './planningConfig';
export function usePlanning() {
  const [settings, setSettings, error] = usePersisted('personal-os.planning.v1', getPlanning());
  return [{ ...settings, weekStartsOn: WEEK_START }, setSettings, error] as const;
}
