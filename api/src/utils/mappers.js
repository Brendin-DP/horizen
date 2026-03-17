/**
 * Mappers: snake_case DB rows → camelCase API responses.
 * toDb helpers: camelCase payloads → snake_case for inserts/updates.
 */

function mapMember(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return {
    id: rest.id,
    name: rest.name,
    email: rest.email,
    role: rest.role,
    plan: rest.plan,
    planExpiresAt: rest.plan_expires_at ?? null,
    avatarUrl: rest.avatar_url ?? null,
    createdAt: rest.created_at ?? null,
  };
}

function mapPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    priceMonthly: row.price_monthly ?? 0,
  };
}

function mapFeature(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
  };
}

function mapPlanFeature(row) {
  if (!row) return null;
  return {
    planId: row.plan_id,
    featureId: row.feature_id,
    enabled: row.enabled ?? false,
    limit: row.limit_value ?? null,
  };
}

function mapStarAward(row) {
  if (!row) return null;
  return {
    id: row.id,
    memberId: row.member_id,
    awardedBy: row.awarded_by,
    reason: row.reason ?? null,
    createdAt: row.created_at ?? null,
  };
}

function mapExercise(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? null,
    muscleGroups: row.muscle_groups ?? [],
    equipment: row.equipment ?? null,
    unit: row.unit ?? null,
    createdAt: row.created_at ?? null,
  };
}

function mapWorkout(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name ?? null,
    status: row.status ?? 'in_progress',
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at ?? null,
  };
}

function mapWorkoutExercise(row) {
  if (!row) return null;
  return {
    id: row.id,
    workoutId: row.workout_id,
    exerciseId: row.exercise_id,
    order: row.order_index ?? row.order ?? 0,
    notes: row.notes ?? null,
    createdAt: row.created_at ?? null,
  };
}

function mapSet(row) {
  if (!row) return null;
  return {
    id: row.id,
    workoutExerciseId: row.workout_exercise_id,
    setNumber: row.set_number ?? 0,
    reps: row.reps ?? null,
    weightKg: row.weight_kg ?? null,
    durationSeconds: row.duration_seconds ?? null,
    distanceMeters: row.distance_meters ?? null,
    completed: row.completed ?? true,
    createdAt: row.created_at ?? null,
  };
}

// --- toDb helpers (camelCase → snake_case) ---

function toDbMember(payload) {
  const out = {};
  if (payload.id !== undefined) out.id = payload.id;
  if (payload.name !== undefined) out.name = payload.name;
  if (payload.email !== undefined) out.email = payload.email;
  if (payload.passwordHash !== undefined) out.password_hash = payload.passwordHash;
  if (payload.role !== undefined) out.role = payload.role;
  if (payload.plan !== undefined) out.plan = payload.plan;
  if (payload.planExpiresAt !== undefined) out.plan_expires_at = payload.planExpiresAt === '' ? null : payload.planExpiresAt;
  if (payload.avatarUrl !== undefined) out.avatar_url = payload.avatarUrl === '' ? null : payload.avatarUrl;
  if (payload.createdAt !== undefined) out.created_at = payload.createdAt;
  return out;
}

function toDbWorkout(payload) {
  const out = {};
  if (payload.id !== undefined) out.id = payload.id;
  if (payload.userId !== undefined) out.user_id = payload.userId;
  if (payload.name !== undefined) out.name = payload.name;
  if (payload.status !== undefined) out.status = payload.status;
  if (payload.startedAt !== undefined) out.started_at = payload.startedAt;
  if (payload.completedAt !== undefined) out.completed_at = payload.completedAt;
  if (payload.notes !== undefined) out.notes = payload.notes;
  if (payload.createdAt !== undefined) out.created_at = payload.createdAt;
  return out;
}

function toDbWorkoutExercise(payload) {
  const out = {};
  if (payload.id !== undefined) out.id = payload.id;
  if (payload.workoutId !== undefined) out.workout_id = payload.workoutId;
  if (payload.exerciseId !== undefined) out.exercise_id = payload.exerciseId;
  if (payload.order !== undefined) out.order_index = payload.order;
  if (payload.notes !== undefined) out.notes = payload.notes;
  if (payload.createdAt !== undefined) out.created_at = payload.createdAt;
  return out;
}

function toDbSet(payload) {
  const out = {};
  if (payload.id !== undefined) out.id = payload.id;
  if (payload.workoutExerciseId !== undefined) out.workout_exercise_id = payload.workoutExerciseId;
  if (payload.setNumber !== undefined) out.set_number = payload.setNumber;
  if (payload.reps !== undefined) out.reps = payload.reps;
  if (payload.weightKg !== undefined) out.weight_kg = payload.weightKg;
  if (payload.durationSeconds !== undefined) out.duration_seconds = payload.durationSeconds;
  if (payload.distanceMeters !== undefined) out.distance_meters = payload.distanceMeters;
  if (payload.completed !== undefined) out.completed = payload.completed;
  if (payload.createdAt !== undefined) out.created_at = payload.createdAt;
  return out;
}

function toDbStarAward(payload) {
  const out = {};
  if (payload.id !== undefined) out.id = payload.id;
  if (payload.memberId !== undefined) out.member_id = payload.memberId;
  if (payload.awardedBy !== undefined) out.awarded_by = payload.awardedBy;
  if (payload.reason !== undefined) out.reason = payload.reason;
  if (payload.createdAt !== undefined) out.created_at = payload.createdAt;
  return out;
}

function toDbPlanFeature(payload) {
  const out = {};
  if (payload.planId !== undefined) out.plan_id = payload.planId;
  if (payload.featureId !== undefined) out.feature_id = payload.featureId;
  if (payload.enabled !== undefined) out.enabled = payload.enabled;
  if (payload.limit !== undefined) out.limit_value = payload.limit;
  return out;
}

module.exports = {
  mapMember,
  mapPlan,
  mapFeature,
  mapPlanFeature,
  mapStarAward,
  mapExercise,
  mapWorkout,
  mapWorkoutExercise,
  mapSet,
  toDbMember,
  toDbWorkout,
  toDbWorkoutExercise,
  toDbSet,
  toDbStarAward,
  toDbPlanFeature,
};
