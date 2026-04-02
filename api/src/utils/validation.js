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
  muscleGroups: [
    'Abs',
    'Adductors',
    'Ankles',
    'Arms',
    'Back',
    'Biceps',
    'Brachialis',
    'Calves',
    'Chest',
    'Core',
    'Forearms',
    'Front Delts',
    'Full Body',
    'Glutes',
    'Hamstrings',
    'Hip Flexors',
    'Inner Thighs',
    'IT Band',
    'Lats',
    'Legs',
    'Lower Abs',
    'Lower Back',
    'Lower Chest',
    'Obliques',
    'Outer Thighs',
    'Piriformis',
    'Quads',
    'Rear Delts',
    'Rhomboids',
    'Rotator Cuff',
    'Shoulders',
    'Side Delts',
    'Spine',
    'Thoracic Spine',
    'Traps',
    'Triceps',
    'Upper Back',
    'Upper Chest',
  ],
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

export function isValidMuscleGroups(groups) {
  if (!Array.isArray(groups)) return false;
  return groups.every((g) => ENUMS.muscleGroups.includes(g));
}

/** Default category when none supplied (valid enum). */
export const DEFAULT_EXERCISE_CATEGORY = 'Upper Body';
