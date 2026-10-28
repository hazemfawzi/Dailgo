import { localDate } from '../../lib/workspace';
import type { Entry } from '../../lib/workspace';
export const memoryCurrent = (entry: Entry) =>
  !entry.archived && (!entry.expiresOn || entry.expiresOn >= localDate());
export function memoryConflicts(entries: Entry[]) {
  const all = entries.filter(
    (e) => ['note', 'preference', 'personal'].includes(e.kind) && memoryCurrent(e),
  );
  return all.filter((e) =>
    all.some(
      (other) =>
        other.id !== e.id &&
        other.kind === e.kind &&
        other.area === e.area &&
        (other.context ?? '') === (e.context ?? '') &&
        other.title.trim().toLocaleLowerCase() === e.title.trim().toLocaleLowerCase() &&
        other.detail.trim() !== e.detail.trim(),
    ),
  );
}
