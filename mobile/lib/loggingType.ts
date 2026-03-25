import type { ExerciseUnit, LoggingType } from '../types';

/** Load rules only apply to weight × reps exercises. */
export function isLoadRelevantUnit(unit: ExerciseUnit): boolean {
  return unit === 'weight_reps';
}

export function showWeightInput(loggingType: LoggingType): boolean {
  return loggingType === 'weighted' || loggingType === 'weighted_or_bodyweight';
}

export function weightRequired(loggingType: LoggingType): boolean {
  return loggingType === 'weighted';
}

export function weightOptional(loggingType: LoggingType): boolean {
  return loggingType === 'weighted_or_bodyweight';
}
