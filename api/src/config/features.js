// api/src/config/features.js
// Reads from plan_features in Supabase. Falls back to hardcoded FEATURES if query fails.

import supabase from '../db.js';

export const FEATURE_ID_MAP = {
  MAX_WORKOUTS: 'max_workouts',
  LEADERBOARD_ACCESS: 'leaderboard_access',
  EXERCISE_HISTORY_DAYS: 'exercise_history',
  ADVANCED_STATS: 'advanced_stats',
};

export const FEATURES = {
  MAX_WORKOUTS: { free: 10, pro: Infinity, elite: Infinity },
  LEADERBOARD_ACCESS: { free: false, pro: true, elite: true },
  EXERCISE_HISTORY_DAYS: { free: 30, pro: Infinity, elite: Infinity },
  ADVANCED_STATS: { free: false, pro: true, elite: true },
};

async function getPlanFeature(plan, featureId) {
  const { data, error } = await supabase
    .from('plan_features')
    .select('*')
    .eq('plan_id', plan)
    .eq('feature_id', featureId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function can(user, feature) {
  const featureId = FEATURE_ID_MAP[feature] ?? feature;
  const plan = user?.plan ?? 'free';
  const pf = await getPlanFeature(plan, featureId);
  if (pf) {
    return pf.enabled === true && pf.limit_value == null;
  }
  const rule = FEATURES[feature];
  if (!rule) return false;
  const value = rule[plan];
  return value === true || value === Infinity;
}

export async function limit(user, feature) {
  const featureId = FEATURE_ID_MAP[feature] ?? feature;
  const plan = user?.plan ?? 'free';
  const pf = await getPlanFeature(plan, featureId);
  if (pf) {
    return pf.limit_value ?? Infinity;
  }
  const rule = FEATURES[feature];
  if (!rule) return 0;
  return rule[plan];
}
