import type { Exercise } from '../types';

/** Body region (category) and movement pattern (type), e.g. `Upper · Pull`. */
export function formatExerciseCategoryType(
  exercise: Pick<Exercise, 'category' | 'type'>
): string {
  const parts = [exercise.category, exercise.type ?? null]
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}
