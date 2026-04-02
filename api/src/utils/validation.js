import { randomUUID } from 'crypto';

export { randomUUID };

/** Postgres enum string values — case-sensitive. */
export const ENUMS = {
  roles: ['member', 'instructor', 'admin'],
  plans: ['free', 'pro', 'elite'],
  units: ['weight_reps', 'time', 'distance'],
  loggingTypes: ['weighted', 'bodyweight', 'weighted_or_bodyweight'],
  categories: [
    'Upper Body',
    'Lower Body',
    'Full Body',
    'Core',
    'Cardio',
    'Mobility',
  ],
  types: [
    'Push',
    'Pull',
    'Squat',
    'Hinge',
    'Lunge',
    'Isolation',
    'Core',
    'Cardio',
    'Olympic',
    'Compound',
    'Carry',
    'Mobility',
    'Plyometric',
  ],
  equipment: ['Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine', 'Kettlebell'],
  statuses: ['active', 'requested', 'rejected'],
};

export function isValidEnum(value, enumArray) {
  return enumArray.includes(value);
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value) {
  if (value == null || typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
}

/** Optional muscle group id list from `muscle_groups` table (junction uses UUIDs). */
export function isValidMuscleGroupIds(ids) {
  if (ids == null) return true;
  if (!Array.isArray(ids)) return false;
  return ids.every((id) => typeof id === 'string' && isValidUUID(id.trim()));
}

/** Default category when none supplied (valid enum). */
export const DEFAULT_EXERCISE_CATEGORY = 'Upper Body';
