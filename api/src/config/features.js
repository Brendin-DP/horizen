// api/src/config/features.js

const FEATURES = {
  MAX_WORKOUTS: {
    free: 10,
    pro: Infinity,
    elite: Infinity,
  },
  LEADERBOARD_ACCESS: {
    free: false,
    pro: true,
    elite: true,
  },
  EXERCISE_HISTORY_DAYS: {
    free: 30,
    pro: Infinity,
    elite: Infinity,
  },
  ADVANCED_STATS: {
    free: false,
    pro: true,
    elite: true,
  },
};

function can(user, feature) {
  const rule = FEATURES[feature];
  if (!rule) return false;
  const value = rule[user.plan ?? 'free'];
  return value === true || value === Infinity;
}

function limit(user, feature) {
  const rule = FEATURES[feature];
  if (!rule) return 0;
  return rule[user.plan ?? 'free'];
}

module.exports = { FEATURES, can, limit };
