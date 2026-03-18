import express from 'express';
import supabase from '../db.js';
import { toPublicMember } from '../utils/members.js';
import { mapMember, mapStarAward } from '../utils/mappers.js';
import { toDbMember } from '../utils/mappers.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

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
