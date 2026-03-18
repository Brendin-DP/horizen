// api/src/middleware/planCheck.js
// Usage: router.post('/workouts', planCheck('MAX_WORKOUTS'), handler)
// Drop this into any route that needs PLG gating — not wired up yet, ready when needed

import { can, limit } from '../config/features.js';

export function planCheck(feature) {
  return (req, res, next) => {
    // TODO: replace with real auth user once auth is implemented
    // For now this middleware is a no-op placeholder — it passes through
    next();
  };
}
