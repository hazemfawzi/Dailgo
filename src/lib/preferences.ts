import { usePersisted } from './storage';
import { getPlanning } from './planningConfig';
export { defaultPlanning, getPlanning } from './planningConfig';
export type { PlanningPreferences } from './planningConfig';
export const usePlanning = () => usePersisted('personal-os.planning.v1', getPlanning());
