import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import supabase from '../db.js';
import { toPublicMember } from '../utils/members.js';
import { mapMember, mapStarAward, mapSet } from '../utils/mappers.js';
import { toDbMember } from '../utils/mappers.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { limit } from '../config/features.js';

const router = express.Router();
const PASSWORD_SALT_ROUNDS = 10;
const MIN_NEW_PASSWORD_LENGTH = 8;

/**
 * Per-log best set for exercise logs, using logging_type when unit is weight_reps.
 * weighted_or_bodyweight: prefer heaviest loaded set; if none, max reps among unloaded sets.
 */
function computeBestSetForExerciseLog(sets, loggingType, unit) {
  if (unit !== 'weight_reps') {
    let bestSet = { reps: null, weightKg: null };
    let totalVolume = 0;
    for (const s of sets) {
      if (s.reps != null && s.weight_kg != null) {
        totalVolume += s.reps * s.weight_kg;
        if (
          !bestSet.weightKg ||
          s.weight_kg > bestSet.weightKg ||
          (s.weight_kg === bestSet.weightKg && s.reps > (bestSet.reps ?? 0))
        ) {
          bestSet = { reps: s.reps, weightKg: s.weight_kg };
        }
      }
    }
    return { bestSet, totalVolume };
  }

  let totalVolume = 0;
  for (const s of sets) {
    if (s.reps != null && s.weight_kg != null && s.weight_kg > 0) {
      totalVolume += s.reps * s.weight_kg;
    }
  }

  if (loggingType === 'bodyweight') {
    let bestReps = null;
    for (const s of sets) {
      if (s.reps != null && (s.weight_kg == null || s.weight_kg === 0)) {
        if (bestReps == null || s.reps > bestReps) bestReps = s.reps;
      }
    }
    return { bestSet: { reps: bestReps, weightKg: null }, totalVolume };
  }

  if (loggingType === 'weighted') {
    let bestSet = { reps: null, weightKg: null };
    for (const s of sets) {
      if (s.reps != null && s.weight_kg != null && s.weight_kg > 0) {
        if (
          !bestSet.weightKg ||
          s.weight_kg > bestSet.weightKg ||
          (s.weight_kg === bestSet.weightKg && s.reps > (bestSet.reps ?? 0))
        ) {
          bestSet = { reps: s.reps, weightKg: s.weight_kg };
        }
      }
    }
    return { bestSet, totalVolume };
  }

  let bestWeighted = { reps: null, weightKg: null };
  for (const s of sets) {
    if (s.reps != null && s.weight_kg != null && s.weight_kg > 0) {
      if (
        !bestWeighted.weightKg ||
        s.weight_kg > bestWeighted.weightKg ||
        (s.weight_kg === bestWeighted.weightKg && s.reps > (bestWeighted.reps ?? 0))
      ) {
        bestWeighted = { reps: s.reps, weightKg: s.weight_kg };
      }
    }
  }
  if (bestWeighted.weightKg != null) {
    return { bestSet: bestWeighted, totalVolume };
  }

  let bestReps = null;
  for (const s of sets) {
    if (s.reps != null && (s.weight_kg == null || s.weight_kg === 0)) {
      if (bestReps == null || s.reps > bestReps) bestReps = s.reps;
    }
  }
  return { bestSet: { reps: bestReps, weightKg: null }, totalVolume };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.get('/', async (req, res) => {
  let query = supabase.from('members').select('*');
  const roleFilter = req.query.role;
  if (roleFilter) {
    query = query.eq('role', roleFilter);
  }
  const planFilter = req.query.plan;
  if (planFilter) {
    query = query.eq('plan', planFilter);
  }
  const { data, error } = await query;
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.json((data || []).map((m) => mapMember(m)));
});

router.patch('/me', requireAuth, async (req, res) => {
  const { name, email, avatarUrl } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl === '' ? null : avatarUrl;
  if (email !== undefined) {
    const trimmed = email.trim().toLowerCase();
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('email', trimmed)
      .neq('id', req.member.id)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    updates.email = trimmed;
  }
  if (Object.keys(updates).length === 0) {
    const { data: member } = await supabase
      .from('members')
      .select('*')
      .eq('id', req.member.id)
      .single();
    if (!member) return res.status(404).json({ error: 'Member not found' });
    return res.json(toPublicMember(mapMember(member)));
  }
  const toDb = toDbMember(updates);
  const { data: updated, error } = await supabase
    .from('members')
    .update(toDb)
    .eq('id', req.member.id)
    .select()
    .single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  if (!updated) return res.status(404).json({ error: 'Member not found' });
  res.json(toPublicMember(mapMember(updated)));
});

router.post('/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < MIN_NEW_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: `New password must be at least ${MIN_NEW_PASSWORD_LENGTH} characters`,
    });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'New password must be different from your current password' });
  }
  const { data: row, error: fetchErr } = await supabase
    .from('members')
    .select('password_hash')
    .eq('id', req.member.id)
    .single();
  if (fetchErr || !row) {
    return res.status(404).json({ error: 'Member not found' });
  }
  if (!row.password_hash) {
    return res.status(400).json({ error: 'Password change is not available for this account' });
  }
  const valid = await bcrypt.compare(currentPassword, row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
  const { error: upErr } = await supabase
    .from('members')
    .update({ password_hash: passwordHash })
    .eq('id', req.member.id);
  if (upErr) {
    console.error(upErr);
    return res.status(500).json({ error: 'Database error', detail: upErr.message });
  }
  res.json({ ok: true });
});

router.post('/me/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid image type. Use JPEG, PNG, or WebP' });
  }
  const ext = req.file.mimetype.split('/')[1];
  const path = `${req.member.id}/avatar.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

  if (upErr) {
    console.error('Avatar upload error:', JSON.stringify(upErr));
    return res.status(500).json({ error: 'Failed to upload avatar', detail: upErr.message });
  }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  const toDb = toDbMember({ avatarUrl: publicUrl });

  const { data: updated, error } = await supabase
    .from('members')
    .update(toDb)
    .eq('id', req.member.id)
    .select()
    .single();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  if (!updated) return res.status(404).json({ error: 'Member not found' });
  res.json(toPublicMember(mapMember(updated)));
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { plan, planExpiresAt, role } = req.body;
  const updates = {};
  if (plan !== undefined) updates.plan = plan;
  if (planExpiresAt !== undefined) updates.planExpiresAt = planExpiresAt === '' ? null : planExpiresAt;
  if (role !== undefined) {
    if (!['member', 'instructor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be member, instructor, or admin' });
    }
    updates.role = role;
  }
  if (Object.keys(updates).length === 0) {
    const { data: member } = await supabase
      .from('members')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!member) return res.status(404).json({ error: 'Member not found' });
    return res.json(toPublicMember(mapMember(member)));
  }
  const toDb = toDbMember(updates);
  const { data: updated, error } = await supabase
    .from('members')
    .update(toDb)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  if (!updated) return res.status(404).json({ error: 'Member not found' });
  res.json(toPublicMember(mapMember(updated)));
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return res.status(404).json({ error: 'Member not found' });
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  if (!data) return res.status(404).json({ error: 'Member not found' });
  res.json(toPublicMember(mapMember(data)));
});

router.get('/:id/stars', async (req, res) => {
  const memberId = req.params.id;
  const { data, error } = await supabase
    .from('star_awards')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  const awards = (data || []).map(mapStarAward);
  res.json(awards);
});

router.get('/:id/exercise-history/:exerciseId', async (req, res) => {
  const memberId = req.params.id;
  const exerciseId = req.params.exerciseId;

  const { data: member } = await supabase.from('members').select('plan').eq('id', memberId).single();
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select('id, unit, logging_type')
    .eq('id', exerciseId)
    .single();
  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  const loggingType = exercise.logging_type ?? 'weighted';
  const exerciseUnit = exercise.unit ?? 'weight_reps';

  let query = supabase
    .from('sessions')
    .select('*')
    .eq('member_id', memberId)
    .eq('exercise_id', exerciseId)
    .order('logged_at', { ascending: true });

  const daysLimit = await limit({ plan: member.plan }, 'EXERCISE_HISTORY_DAYS');
  if (daysLimit !== Infinity && daysLimit != null) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysLimit);
    query = query.gte('logged_at', cutoff.toISOString());
  }

  const { data: logs, error } = await query;
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }

  const logList = logs || [];
  const logIds = logList.map((l) => l.id);

  let allSets = [];
  if (logIds.length > 0) {
    const { data: setsData } = await supabase
      .from('sets')
      .select('*')
      .in('session_id', logIds)
      .order('set_number', { ascending: true });
    allSets = setsData || [];
  }

  const setsByLogId = {};
  for (const s of allSets) {
    const logId = s.session_id;
    if (!setsByLogId[logId]) setsByLogId[logId] = [];
    setsByLogId[logId].push(s);
  }

  const history = logList.map((log) => {
    const sets = setsByLogId[log.id] || [];
    const { bestSet, totalVolume } = computeBestSetForExerciseLog(sets, loggingType, exerciseUnit);

    return {
      logId: log.id,
      loggedAt: log.logged_at,
      sets: sets.map((s) => mapSet(s)),
      bestSet,
      totalVolume,
    };
  });

  res.json(history);
});

router.get('/:id/exercise-history/:exerciseId/max-weight', async (req, res) => {
  const memberId = req.params.id;
  const exerciseId = req.params.exerciseId;
  const excludeLogId = req.query.excludeLogId;

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select('id')
    .eq('id', exerciseId)
    .single();
  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  const { data: logs } = await supabase
    .from('sessions')
    .select('id')
    .eq('member_id', memberId)
    .eq('exercise_id', exerciseId);
  const logIds = (logs || []).map((l) => l.id).filter((id) => !excludeLogId || id !== excludeLogId);

  if (logIds.length === 0) {
    return res.json({ maxWeightKg: null });
  }

  const { data: sets } = await supabase
    .from('sets')
    .select('weight_kg')
    .in('session_id', logIds)
    .not('weight_kg', 'is', null)
    .gt('weight_kg', 0);

  const maxWeightKg =
    sets && sets.length > 0
      ? Math.max(...sets.map((s) => s.weight_kg))
      : null;

  res.json({ maxWeightKg });
});

/** Max single-set reps for bodyweight sets (null/zero weight) on exercise logs for this exercise. */
router.get('/:id/exercise-history/:exerciseId/max-reps', async (req, res) => {
  const memberId = req.params.id;
  const exerciseId = req.params.exerciseId;
  const excludeLogId = req.query.excludeLogId;

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select('id, logging_type')
    .eq('id', exerciseId)
    .single();
  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  const lt = exercise.logging_type ?? 'weighted';
  // All-time max reps on unloaded (bodyweight) sets — same notion for pure BW and BW+weight exercises.
  if (lt !== 'bodyweight' && lt !== 'weighted_or_bodyweight') {
    return res.json({ maxReps: null });
  }

  const { data: logs } = await supabase
    .from('sessions')
    .select('id')
    .eq('member_id', memberId)
    .eq('exercise_id', exerciseId);
  const logIds = (logs || []).map((l) => l.id).filter((id) => !excludeLogId || id !== excludeLogId);

  if (logIds.length === 0) {
    return res.json({ maxReps: null });
  }

  const { data: sets } = await supabase
    .from('sets')
    .select('reps, weight_kg')
    .in('session_id', logIds)
    .not('reps', 'is', null);

  const bodyweightSets = (sets || []).filter(
    (s) => s.reps != null && (s.weight_kg == null || s.weight_kg === 0)
  );

  const maxReps =
    bodyweightSets.length > 0 ? Math.max(...bodyweightSets.map((s) => s.reps)) : null;

  res.json({ maxReps });
});

router.get('/:id/progress/:exerciseId', async (req, res) => {
  const memberId = req.params.id;
  const exerciseId = req.params.exerciseId;

  const { data: exercise, error: exErr } = await supabase
    .from('exercise_library')
    .select('*')
    .eq('id', exerciseId)
    .single();
  if (exErr || !exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  const { data: memberWorkouts } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', memberId);
  const workoutIds = (memberWorkouts || []).map((w) => w.id);
  if (workoutIds.length === 0) {
    return res.json([]);
  }

  const { data: workoutExercises } = await supabase
    .from('workout_exercises')
    .select('*')
    .eq('exercise_id', exerciseId)
    .in('workout_id', workoutIds);

  const history = [];
  for (const we of workoutExercises || []) {
    const workout = memberWorkouts.find((w) => w.id === we.workout_id);
    if (!workout) continue;

    const { data: sets } = await supabase
      .from('sets')
      .select('*')
      .eq('workout_exercise_id', we.id)
      .order('set_number', { ascending: true });

    let bestSet = null;
    let totalVolume = 0;
    const mappedSets = (sets || []).map((s) => ({
      id: s.id,
      workoutExerciseId: s.workout_exercise_id,
      setNumber: s.set_number,
      reps: s.reps,
      weightKg: s.weight_kg,
      durationSeconds: s.duration_seconds,
      distanceMeters: s.distance_meters,
      completed: s.completed,
      createdAt: s.created_at,
    }));

    for (const s of mappedSets) {
      if (s.reps != null && s.weightKg != null) {
        const volume = s.reps * s.weightKg;
        totalVolume += volume;
        if (!bestSet || s.weightKg > bestSet.weightKg || (s.weightKg === bestSet.weightKg && s.reps > bestSet.reps)) {
          bestSet = { reps: s.reps, weightKg: s.weightKg };
        }
      }
    }

    history.push({
      workoutId: workout.id,
      workoutName: workout.name,
      workoutDate: workout.started_at,
      sets: mappedSets,
      bestSet,
      totalVolume,
    });
  }

  history.sort((a, b) => new Date(a.workoutDate) - new Date(b.workoutDate));
  res.json(history);
});

router.get('/:id/stats', async (req, res) => {
  const memberId = req.params.id;

  const { data: workouts } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', memberId);
  const totalWorkouts = (workouts || []).length;
  const workoutIds = (workouts || []).map((w) => w.id);

  if (workoutIds.length === 0) {
    return res.json({ totalWorkouts: 0, totalSets: 0, personalBests: [] });
  }

  const { data: workoutExercises } = await supabase
    .from('workout_exercises')
    .select('*')
    .in('workout_id', workoutIds);

  let totalSets = 0;
  const exerciseBest = {};

  for (const we of workoutExercises || []) {
    const { data: sets } = await supabase
      .from('sets')
      .select('*')
      .eq('workout_exercise_id', we.id);
    totalSets += (sets || []).length;

    const { data: exercise } = await supabase
      .from('exercise_library')
      .select('*')
      .eq('id', we.exercise_id)
      .single();
    if (!exercise) continue;

    for (const s of sets || []) {
      if (s.reps != null && s.weight_kg != null) {
        const key = we.exercise_id;
        if (!exerciseBest[key] || s.weight_kg > exerciseBest[key].bestWeightKg) {
          exerciseBest[key] = {
            exerciseId: we.exercise_id,
            name: exercise.name,
            bestWeightKg: s.weight_kg,
            bestReps: s.reps,
          };
        }
      }
    }
  }

  const personalBests = Object.values(exerciseBest);
  res.json({ totalWorkouts, totalSets, personalBests });
});

export default router;
