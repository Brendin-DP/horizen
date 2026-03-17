const express = require('express');
const { randomUUID } = require('crypto');
const { supabase } = require('../db.js');
const { mapSet, toDbSet } = require('../utils/mappers.js');

const router = express.Router();

router.post('/:id/sets', async (req, res) => {
  const workoutExerciseId = req.params.id;

  const { data: workoutExercise } = await supabase
    .from('workout_exercises')
    .select('id')
    .eq('id', workoutExerciseId)
    .single();
  if (!workoutExercise) {
    return res.status(404).json({ error: 'Workout exercise not found' });
  }

  const {
    setNumber,
    reps,
    weightKg,
    durationSeconds,
    distanceMeters,
    completed,
  } = req.body;

  const { data: maxRow } = await supabase
    .from('sets')
    .select('set_number')
    .eq('workout_exercise_id', workoutExerciseId)
    .order('set_number', { ascending: false })
    .limit(1)
    .single();

  const maxSetNumber = maxRow?.set_number ?? 0;

  const set = {
    id: randomUUID(),
    workoutExerciseId,
    setNumber: setNumber !== undefined ? setNumber : maxSetNumber + 1,
    reps: reps ?? null,
    weightKg: weightKg ?? null,
    durationSeconds: durationSeconds ?? null,
    distanceMeters: distanceMeters ?? null,
    completed: completed !== undefined ? completed : true,
    createdAt: new Date().toISOString(),
  };

  const toDb = toDbSet(set);
  const { data: inserted, error } = await supabase
    .from('sets')
    .insert(toDb)
    .select()
    .single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(201).json(mapSet(inserted));
});

const setsIdRouter = express.Router();

setsIdRouter.patch('/:id', async (req, res) => {
  const updates = {};
  const { setNumber, reps, weightKg, durationSeconds, distanceMeters, completed } = req.body;
  if (setNumber !== undefined) updates.set_number = setNumber;
  if (reps !== undefined) updates.reps = reps;
  if (weightKg !== undefined) updates.weight_kg = weightKg;
  if (durationSeconds !== undefined) updates.duration_seconds = durationSeconds;
  if (distanceMeters !== undefined) updates.distance_meters = distanceMeters;
  if (completed !== undefined) updates.completed = completed;

  if (Object.keys(updates).length === 0) {
    const { data: set } = await supabase.from('sets').select('*').eq('id', req.params.id).single();
    if (!set) return res.status(404).json({ error: 'Set not found' });
    return res.json(mapSet(set));
  }

  const { data: updated, error } = await supabase
    .from('sets')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  if (!updated) return res.status(404).json({ error: 'Set not found' });
  res.json(mapSet(updated));
});

setsIdRouter.delete('/:id', async (req, res) => {
  const { data: existing } = await supabase
    .from('sets')
    .select('id')
    .eq('id', req.params.id)
    .single();
  if (!existing) {
    return res.status(404).json({ error: 'Set not found' });
  }
  const { error } = await supabase.from('sets').delete().eq('id', req.params.id);
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(204).send();
});

module.exports = { workoutExercisesRouter: router, setsIdRouter };
