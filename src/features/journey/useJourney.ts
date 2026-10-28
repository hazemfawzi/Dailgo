import { usePersisted } from '../../lib/storage';
import { defaultJourney, JOURNEY_KEY } from './model';
export const useJourney = () => usePersisted(JOURNEY_KEY, defaultJourney);
