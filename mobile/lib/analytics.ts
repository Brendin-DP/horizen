/**
 * Central PostHog event names + typed payloads for the mobile app.
 * Use optional chaining at call sites: `trackX(posthog, …)`.
 *
 * Exercise lifecycle (standalone / exercises tab):
 * - started_standalone_log — user opened the log flow
 * - logged_exercise — session saved with sets
 * - exercise_deleted — user confirmed delete on exercises tab (all sessions for that exercise removed)
 */

import type { PostHog } from 'posthog-react-native';
import type { PostHogEventProperties } from '@posthog/core';

type PosthogLike = PostHog | null | undefined;

function capture(posthog: PosthogLike, event: string, properties?: PostHogEventProperties) {
  posthog?.capture(event, properties);
}

export function trackLoggedExercise(
  posthog: PosthogLike,
  payload: {
    sessionId: string;
    exerciseId: string;
    exerciseName: string;
    setCount: number;
    source: 'standalone_log';
  }
) {
  capture(posthog, 'logged_exercise', payload);
}

export function trackPersonalBest(
  posthog: PosthogLike,
  payload: {
    exerciseId: string;
    exerciseName: string;
    pbType: 'weight' | 'reps';
    weightKg?: number;
    reps?: number;
    sessionId?: string;
    source: 'standalone_log';
  }
) {
  const { pbType, weightKg, reps, ...rest } = payload;
  capture(posthog, 'personal_best_achieved', {
    ...rest,
    pbType,
    ...(pbType === 'weight' && weightKg != null ? { weightKg } : {}),
    ...(pbType === 'reps' && reps != null ? { reps } : {}),
  });
}

export function trackSessionUpdated(
  posthog: PosthogLike,
  payload: {
    sessionId: string;
    exerciseId: string;
    exerciseName: string;
    setsAdded: number;
    setsRemoved: number;
    setsUpdated: number;
    source: 'session_edit_screen';
  }
) {
  capture(posthog, 'session_updated', payload);
}

export function trackSessionSetSaved(
  posthog: PosthogLike,
  payload: {
    sessionId: string;
    exerciseId: string;
    setId: string;
    source: 'session_detail_modal';
  }
) {
  capture(posthog, 'session_set_saved', payload);
}

export function trackSessionSetDeleted(
  posthog: PosthogLike,
  payload: {
    sessionId: string;
    exerciseId: string;
    setId: string;
    source: 'session_detail_swipe';
  }
) {
  capture(posthog, 'session_set_deleted', payload);
}

export function trackSavedSet(
  posthog: PosthogLike,
  payload: {
    workoutId?: string;
    workoutExerciseId: string;
    exerciseName?: string;
    context: 'workout_detail' | 'workout_exercise_screen';
  }
) {
  capture(posthog, 'saved_set', {
    ...(payload.workoutId != null && payload.workoutId !== ''
      ? { workoutId: payload.workoutId }
      : {}),
    workoutExerciseId: payload.workoutExerciseId,
    ...(payload.exerciseName != null && payload.exerciseName !== ''
      ? { exerciseName: payload.exerciseName }
      : {}),
    context: payload.context,
  });
}

export function trackStartedStandaloneLog(
  posthog: PosthogLike,
  payload: { source: 'exercises_tab' | 'exercise_detail' }
) {
  capture(posthog, 'started_standalone_log', payload);
}

/** Fires after API success when the user deletes an exercise row (swipe → Delete) on the exercises tab. */
export function trackExerciseDeleted(
  posthog: PosthogLike,
  payload: {
    exerciseId: string;
    exerciseName: string;
    /** Sessions removed (standalone history cleared for this exercise). */
    sessionCount: number;
    source: 'exercises_tab_swipe';
  }
) {
  capture(posthog, 'exercise_deleted', payload);
}

export function trackOpenedSessionEdit(
  posthog: PosthogLike,
  payload: { sessionId: string; source: 'session_detail_footer' }
) {
  capture(posthog, 'opened_session_edit', payload);
}
