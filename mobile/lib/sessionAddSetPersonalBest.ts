import { getExerciseHistory, getExerciseMaxReps, getExerciseMaxWeight } from './api';
import type { Exercise, Set } from '../types';

/** Max weight (kg) from other sessions + existing sets in this session (before the new set is saved). */
export async function getPriorMaxWeightKgBeforeAdd(
  memberId: string,
  exerciseId: string,
  sessionId: string,
  existingSets: Set[],
  token: string | null
): Promise<number> {
  let fromOthers = 0;
  try {
    const { maxWeightKg } = await getExerciseMaxWeight(memberId, exerciseId, { excludeLogId: sessionId }, token);
    fromOthers = maxWeightKg ?? 0;
  } catch {
    fromOthers = 0;
  }
  const fromSession = existingSets.reduce((m, s) => {
    const w = s.weightKg;
    return w != null && w > 0 ? Math.max(m, w) : m;
  }, 0);
  return Math.max(fromOthers, fromSession);
}

/** Max BW reps in sessions other than `sessionId` (same semantics as standalone log). */
async function maxBodyweightRepsOtherSessions(
  memberId: string,
  exerciseId: string,
  excludeSessionId: string,
  token: string | null
): Promise<number> {
  try {
    const { maxReps } = await getExerciseMaxReps(memberId, exerciseId, { excludeLogId: excludeSessionId }, token);
    if (maxReps != null) return maxReps;
  } catch {
    // history below
  }
  try {
    const hist = await getExerciseHistory(memberId, exerciseId, token);
    let max = 0;
    for (const h of hist) {
      if (h.logId === excludeSessionId) continue;
      for (const s of h.sets ?? []) {
        if (s.reps != null && (s.weightKg == null || s.weightKg === 0)) {
          if (s.reps > max) max = s.reps;
        }
      }
    }
    return max;
  } catch {
    return 0;
  }
}

/**
 * Max reps on bodyweight-only sets (null/zero weight) from other sessions + existing sets in this session.
 */
export async function getPriorMaxBodyweightRepsBeforeAdd(
  memberId: string,
  exerciseId: string,
  sessionId: string,
  existingSets: Set[],
  token: string | null
): Promise<number> {
  const fromOthers = await maxBodyweightRepsOtherSessions(memberId, exerciseId, sessionId, token);
  const fromSession = existingSets.reduce((m, s) => {
    if (s.reps != null && (s.weightKg == null || s.weightKg === 0)) {
      return Math.max(m, s.reps);
    }
    return m;
  }, 0);
  return Math.max(fromOthers, fromSession);
}

/**
 * Whether a set is a new personal best (weight or bodyweight reps), same rules as standalone log.
 * Pass other sets in the same session only (excluding the set being evaluated): for add, sets
 * before the new one; for edit, all sets except the row being updated.
 */
export async function evaluatePersonalBestAfterSessionAdd(
  exercise: Exercise,
  created: Set,
  existingBeforeAdd: Set[],
  memberId: string,
  sessionId: string,
  token: string | null
): Promise<{ kind: 'weight' | 'reps'; value: number } | null> {
  if (exercise.unit !== 'weight_reps') return null;

  if (exercise.loggingType !== 'bodyweight') {
    const newW = created.weightKg != null && created.weightKg > 0 ? created.weightKg : 0;
    if (newW > 0) {
      const prior = await getPriorMaxWeightKgBeforeAdd(
        memberId,
        exercise.id,
        sessionId,
        existingBeforeAdd,
        token
      );
      if (newW > prior) return { kind: 'weight', value: newW };
    }
    if (exercise.loggingType === 'weighted_or_bodyweight') {
      const bwOnly = created.weightKg == null || created.weightKg === 0;
      if (bwOnly && created.reps != null && created.reps > 0) {
        const priorReps = await getPriorMaxBodyweightRepsBeforeAdd(
          memberId,
          exercise.id,
          sessionId,
          existingBeforeAdd,
          token
        );
        if (created.reps > priorReps) return { kind: 'reps', value: created.reps };
      }
    }
    return null;
  }

  if (created.reps != null && created.reps > 0) {
    const priorReps = await getPriorMaxBodyweightRepsBeforeAdd(
      memberId,
      exercise.id,
      sessionId,
      existingBeforeAdd,
      token
    );
    if (created.reps > priorReps) return { kind: 'reps', value: created.reps };
  }
  return null;
}
