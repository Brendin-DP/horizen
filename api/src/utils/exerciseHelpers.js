import supabase from '../db.js';

/** Merge `{ id, name, region }[]` onto a mapped exercise object. */
export function attachMuscleGroups(mappedExercise, muscleGroups) {
  return { ...mappedExercise, muscleGroups: muscleGroups ?? [] };
}

function normalizeMgRow(mg) {
  if (!mg || typeof mg !== 'object') return null;
  return {
    id: mg.id,
    name: mg.name,
    region: mg.region,
  };
}

/** @returns {Promise<Array<{ id: string, name: string, region: string }>>} */
export async function getExerciseMuscleGroups(exerciseId) {
  const { data, error } = await supabase
    .from('exercise_muscle_groups')
    .select('muscle_groups(id, name, region)')
    .eq('exercise_id', exerciseId);

  if (error || !data) return [];
  return data
    .map((row) => normalizeMgRow(row.muscle_groups))
    .filter(Boolean);
}

/**
 * @param {string[]} exerciseIds
 * @returns {Promise<Record<string, Array<{ id: string, name: string, region: string }>>>}
 */
export async function getMuscleGroupsForExercises(exerciseIds) {
  const unique = [...new Set(exerciseIds)].filter(Boolean);
  if (unique.length === 0) return {};

  const { data, error } = await supabase
    .from('exercise_muscle_groups')
    .select('exercise_id, muscle_groups(id, name, region)')
    .in('exercise_id', unique);

  if (error || !data) return {};

  return data.reduce((acc, row) => {
    const mg = normalizeMgRow(row.muscle_groups);
    if (!mg) return acc;
    const eid = row.exercise_id;
    if (!acc[eid]) acc[eid] = [];
    acc[eid].push(mg);
    return acc;
  }, {});
}

/**
 * Replace all muscle group links for an exercise.
 * @param {string} exerciseId
 * @param {string[] | null | undefined} muscleGroupIds
 */
export async function setExerciseMuscleGroups(exerciseId, muscleGroupIds) {
  const { error: delErr } = await supabase
    .from('exercise_muscle_groups')
    .delete()
    .eq('exercise_id', exerciseId);

  if (delErr) throw new Error('Failed to clear muscle groups: ' + delErr.message);

  if (!muscleGroupIds || muscleGroupIds.length === 0) return;

  const rows = muscleGroupIds.map((muscleGroupId) => ({
    exercise_id: exerciseId,
    muscle_group_id: muscleGroupId,
  }));

  const { error } = await supabase.from('exercise_muscle_groups').insert(rows);

  if (error) throw new Error('Failed to set muscle groups: ' + error.message);
}
