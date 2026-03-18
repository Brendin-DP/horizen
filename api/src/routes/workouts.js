import express from 'express';
import { randomUUID } from 'crypto';
import { supabase } from '../db.js';
import { mapWorkout, mapWorkoutExercise, mapExercise, mapSet, toDbWorkout, toDbWorkoutExercise } from '../utils/mappers.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId query is required' });
  }

  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.json((data || []).map(mapWorkout));
});

router.post('/', async (req, res) => {
  const { userId, name } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const workout = {
    id: randomUUID(),
    userId,
    name: name || null,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    completedAt: null,
    notes: null,
    createdAt: new Date().toISOString(),
  };

  const toDb = toDbWorkout(workout);
  const { data: inserted, error } = await supabase
    .from('workouts')
    .insert(toDb)
    .select()
    .single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(201).json(mapWorkout(inserted));
});

router.get('/:id', async (req, res) => {
  const { data: workout, error: workoutErr } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (workoutErr || !workout) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  const { data: workoutExercises } = await supabase
    .from('workout_exercises')
    .select('*')
    .eq('workout_id', workout.id)
    .order('order_index', { ascending: true });

  const { data: exercises } = await supabase.from('exercise_library').select('*');
  const exerciseMap = {};
  for (const e of exercises || []) {
    exerciseMap[e.id] = mapExercise(e);
  }

  const workoutExercisesWithDetails = [];
  for (const we of workoutExercises || []) {
    const { data: sets } = await supabase
      .from('sets')
      .select('*')
      .eq('workout_exercise_id', we.id)
      .order('set_number', { ascending: true });
    workoutExercisesWithDetails.push({
      ...mapWorkoutExercise(we),
      exercise: exerciseMap[we.exercise_id] ?? null,
      sets: (sets || []).map(mapSet),
    });
  }

  res.json({
    ...mapWorkout(workout),
    workoutExercises: workoutExercisesWithDetails,
  });
});

router.patch('/:id', async (req, res) => {
  const { name, status, completedAt, notes } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (status !== undefined) updates.status = status;
  if (completedAt !== undefined) updates.completedAt = completedAt;
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    const { data: workout } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    return res.json(mapWorkout(workout));
  }

  const toDb = toDbWorkout(updates);
  const { data: updated, error } = await supabase
    .from('workouts')
    .update(toDb)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  if (!updated) return res.status(404).json({ error: 'Workout not found' });
  res.json(mapWorkout(updated));
});

router.delete('/:id', async (req, res) => {
  const { data: workout } = await supabase
    .from('workouts')
    .select('id')
    .eq('id', req.params.id)
    .single();
  if (!workout) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  const { data: workoutExercises } = await supabase
    .from('workout_exercises')
    .select('id')
    .eq('workout_id', req.params.id);
  const weIds = (workoutExercises || []).map((we) => we.id);

  if (weIds.length > 0) {
    await supabase.from('sets').delete().in('workout_exercise_id', weIds);
  }
  await supabase.from('workout_exercises').delete().eq('workout_id', req.params.id);
  const { error } = await supabase.from('workouts').delete().eq('id', req.params.id);
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(204).send();
});

router.post('/:id/exercises', async (req, res) => {
  const { data: workout } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (!workout) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  const { exerciseId, order } = req.body;
  if (!exerciseId) {
    return res.status(400).json({ error: 'exerciseId is required' });
  }

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select('id')
    .eq('id', exerciseId)
    .single();
  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  const { data: existing } = await supabase
    .from('workout_exercises')
    .select('id')
    .eq('workout_id', req.params.id)
    .eq('exercise_id', exerciseId);
  if (existing && existing.length > 0) {
    return res.status(409).json({ error: 'Exercise already added to workout' });
  }

  const { data: maxRows } = await supabase
    .from('workout_exercises')
    .select('order_index')
    .eq('workout_id', req.params.id)
    .order('order_index', { ascending: false })
    .limit(1);
  const maxOrderVal = maxRows?.[0]?.order_index ?? -1;
  const nextOrder = order !== undefined ? order : maxOrderVal + 1;

  const workoutExercise = {
    id: randomUUID(),
    workoutId: req.params.id,
    exerciseId,
    order: nextOrder,
    notes: null,
    createdAt: new Date().toISOString(),
  };

  const toDb = toDbWorkoutExercise(workoutExercise);
  const { data: inserted, error } = await supabase
    .from('workout_exercises')
    .insert(toDb)
    .select()
    .single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(201).json(mapWorkoutExercise(inserted));
});

router.patch('/:workoutId/exercises/:id', async (req, res) => {
  const { data: we, error: fetchErr } = await supabase
    .from('workout_exercises')
    .select('*')
    .eq('id', req.params.id)
    .eq('workout_id', req.params.workoutId)
    .single();
  if (fetchErr || !we) {
    return res.status(404).json({ error: 'Workout exercise not found' });
  }

  const { order, notes } = req.body;
  const updates = {};
  if (order !== undefined) updates.order_index = order;
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    return res.json(mapWorkoutExercise(we));
  }

  const { data: updated, error } = await supabase
    .from('workout_exercises')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.json(mapWorkoutExercise(updated));
});

router.delete('/:workoutId/exercises/:id', async (req, res) => {
  const { data: we } = await supabase
    .from('workout_exercises')
    .select('id')
    .eq('id', req.params.id)
    .eq('workout_id', req.params.workoutId)
    .single();
  if (!we) {
    return res.status(404).json({ error: 'Workout exercise not found' });
  }

  await supabase.from('sets').delete().eq('workout_exercise_id', we.id);
  const { error } = await supabase.from('workout_exercises').delete().eq('id', we.id);
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(204).send();
});

export default router;
