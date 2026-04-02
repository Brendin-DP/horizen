import type { Exercise, Set } from '../types';
import { weightOptional, weightRequired } from './loggingType';
import { defaultSetLocalDateIso, isValidPastOrPresentSetDate } from './setDate';

export interface SetEntry {
  id: string;
  reps: string;
  weight: string;
  duration: string;
  distance: string;
  /** For weighted_or_bodyweight: true = loaded/weight mode, false = bodyweight-only */
  addedWeight: boolean;
  /** ISO timestamp for when the set was performed (sent as `createdAt` to API). */
  loggedAtIso: string;
}

export function createEmptySet(ex: Exercise): SetEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reps: '',
    weight: '',
    duration: '',
    distance: '',
    addedWeight: weightOptional(ex.loggingType),
    loggedAtIso: defaultSetLocalDateIso(),
  };
}

export function setEntryFromApiSet(s: Set, ex: Exercise): SetEntry {
  const lt = ex.loggingType;
  const w = s.weightKg;
  const hasWeight = w != null && w > 0;
  let addedWeight = false;
  if (ex.unit === 'weight_reps' && weightOptional(lt)) {
    addedWeight = hasWeight;
  } else if (ex.unit === 'weight_reps' && weightRequired(lt)) {
    addedWeight = true;
  }
  return {
    id: s.id,
    reps: s.reps != null ? String(s.reps) : '',
    weight: s.weightKg != null ? String(s.weightKg) : '',
    duration: s.durationSeconds != null ? String(s.durationSeconds) : '',
    distance: s.distanceMeters != null ? String(s.distanceMeters) : '',
    addedWeight,
    loggedAtIso: s.createdAt
      ? new Date(s.createdAt).toISOString()
      : defaultSetLocalDateIso(),
  };
}

export function validateSetEntry(s: SetEntry, exercise: Exercise): string | null {
  if (s.loggedAtIso && !isValidPastOrPresentSetDate(s.loggedAtIso)) {
    return 'Log date cannot be in the future';
  }
  if (exercise.unit === 'weight_reps') {
    const r = parseInt(s.reps, 10);
    if (isNaN(r)) return 'Enter valid reps';
    const lt = exercise.loggingType;
    if (lt === 'bodyweight') return null;
    if (weightRequired(lt)) {
      const w = parseFloat(s.weight);
      if (isNaN(w) || w <= 0) return 'Enter weight greater than 0';
      return null;
    }
    if (weightOptional(lt)) {
      if (!s.addedWeight) return null;
      const trimmed = s.weight.trim();
      if (trimmed === '') return null;
      const w = parseFloat(trimmed);
      if (isNaN(w) || w < 0) return 'Enter valid weight or leave blank for bodyweight';
      return null;
    }
    return null;
  }
  if (exercise.unit === 'time') {
    const d = parseInt(s.duration, 10);
    if (isNaN(d) || d < 0) return 'Enter valid duration';
    return null;
  }
  if (exercise.unit === 'distance') {
    const d = parseFloat(s.distance);
    if (isNaN(d) || d < 0) return 'Enter valid distance';
    return null;
  }
  return null;
}

/** Fields for PATCH /sets/:id (standalone or workout sets). */
export function setEntryToPatchBody(entry: SetEntry, exercise: Exercise): Partial<Set> {
  const out: Partial<Set> = {
    createdAt: entry.loggedAtIso,
  };
  if (exercise.unit === 'weight_reps') {
    const r = parseInt(entry.reps, 10);
    out.reps = r;
    const lt = exercise.loggingType;
    if (lt === 'bodyweight') {
      out.weightKg = null;
    } else if (weightRequired(lt)) {
      out.weightKg = parseFloat(entry.weight);
    } else if (weightOptional(lt)) {
      if (!entry.addedWeight) {
        out.weightKg = null;
      } else {
        const trimmed = entry.weight.trim();
        if (trimmed === '') {
          out.weightKg = null;
        } else {
          const w = parseFloat(trimmed);
          out.weightKg = w === 0 ? null : w;
        }
      }
    }
  } else if (exercise.unit === 'time') {
    out.durationSeconds = parseInt(entry.duration, 10);
  } else if (exercise.unit === 'distance') {
    out.distanceMeters = parseFloat(entry.distance);
  }
  return out;
}
