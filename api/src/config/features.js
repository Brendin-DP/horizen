// api/src/config/features.js
// Reads from planFeatures in db.json. Falls back to hardcoded FEATURES if planFeatures is empty.

const { getDb } = require('../db.js');

// Legacy feature names (used by planCheck etc) -> planFeatures featureId
const FEATURE_ID_MAP = {
  MAX_WORKOUTS: 'max_workouts',
  LEADERBOARD_ACCESS: 'leaderboard_access',
  EXERCISE_HISTORY_DAYS: 'exercise_history',
  ADVANCED_STATS: 'advanced_stats',
};

// Fallback when planFeatures is empty or feature not found
const FEATURES = {
  MAX_WORKOUTS: { free: 10, pro: Infinity, elite: Infinity },
  LEADERBOARD_ACCESS: { free: false, pro: true, elite: true },
  EXERCISE_HISTORY_DAYS: { free: 30, pro: Infinity, elite: Infinity },
  ADVANCED_STATS: { free: false, pro: true, elite: true },
};

function getPlanFeature(plan, featureId) {
  const db = getDb();
  db.read();
  const planFeatures = db.get('planFeatures').value() || [];
  const pf = planFeatures.find(
    (p) => p.planId === plan && p.featureId === featureId
  );
  return pf;
}

function can(user, feature) {
  const featureId = FEATURE_ID_MAP[feature] ?? feature;
  const plan = user?.plan ?? 'free';
  const pf = getPlanFeature(plan, featureId);
  if (pf) {
    return pf.enabled === true && pf.limit == null;
  }
  const rule = FEATURES[feature];
  if (!rule) return false;
  const value = rule[plan];
  return value === true || value === Infinity;
}

function limit(user, feature) {
  const featureId = FEATURE_ID_MAP[feature] ?? feature;
  const plan = user?.plan ?? 'free';
  const pf = getPlanFeature(plan, featureId);
  if (pf) {
    return pf.limit ?? Infinity;
  }
  const rule = FEATURES[feature];
  if (!rule) return 0;
  return rule[plan];
}

module.exports = { FEATURES, can, limit };
