import express from 'express';
import { randomUUID } from 'crypto';
import supabase from '../db.js';
import { mapExerciseLog, mapExercise, mapSet, toDbSet } from '../utils/mappers.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { memberId, exerciseId, notes, loggedAt } = req.body;

  if (!memberId || !exerciseId) {
    return res.status(400).json({ error: 'memberId and exerciseId are required' });
  }

  const { data: member } = await supabase.from('members').select('id').eq('id', memberId).single();
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select('id')
    .eq('id', exerciseId)
    .single();
  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  const log = {
    id: randomUUID(),
    member_id: memberId,
    exercise_id: exerciseId,
    logged_at: loggedAt || new Date().toISOString(),
    notes: notes || null,
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabase.from('exercise_logs').insert(log).select().single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(201).json(mapExerciseLog(inserted));
});

router.get('/', async (req, res) => {
  const memberId = req.query.memberId;
  if (!memberId) {
    return res.status(400).json({ error: 'memberId query is required' });
  }

  const { data: logs, error } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('member_id', memberId)
    .order('logged_at', { ascending: false });
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }

  const { data: exercises } = await supabase.from('exercise_library').select('*');
  const exerciseMap = {};
  for (const e of exercises || []) {
    exerciseMap[e.id] = mapExercise(e);
  }

  const result = (logs || []).map((row) => ({
    ...mapExerciseLog(row),
    exercise: exerciseMap[row.exercise_id] ?? null,
  }));
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const { data: log, error } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error || !log) {
    return res.status(404).json({ error: 'Exercise log not found' });
  }

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select('*')
    .eq('id', log.exercise_id)
    .single();
  const { data: sets } = await supabase
    .from('sets')
    .select('*')
    .eq('exercise_log_id', log.id)
    .order('set_number', { ascending: true });

  res.json({
    ...mapExerciseLog(log),
    exercise: exercise ? mapExercise(exercise) : null,
    sets: (sets || []).map(mapSet),
  });
});

router.delete('/:id', async (req, res) => {
  const { data: existing } = await supabase
    .from('exercise_logs')
    .select('id')
    .eq('id', req.params.id)
    .single();
  if (!existing) {
    return res.status(404).json({ error: 'Exercise log not found' });
  }
  const { error } = await supabase.from('exercise_logs').delete().eq('id', req.params.id);
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(204).send();
});

router.post('/:id/sets', async (req, res) => {
  const exerciseLogId = req.params.id;
  const { setNumber, reps, weightKg, durationSeconds, distanceMeters, completed } = req.body;

  const { data: log } = await supabase
    .from('exercise_logs')
    .select('id')
    .eq('id', exerciseLogId)
    .single();
  if (!log) {
    return res.status(404).json({ error: 'Exercise log not found' });
  }

  const { data: maxRow } = await supabase
    .from('sets')
    .select('set_number')
    .eq('exercise_log_id', exerciseLogId)
    .order('set_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxSetNumber = maxRow?.set_number ?? 0;
  const set = {
    id: randomUUID(),
    exerciseLogId,
    setNumber: setNumber !== undefined ? setNumber : maxSetNumber + 1,
    reps: reps ?? null,
    weightKg: weightKg ?? null,
    durationSeconds: durationSeconds ?? null,
    distanceMeters: distanceMeters ?? null,
    completed: completed !== undefined ? completed : true,
    createdAt: new Date().toISOString(),
  };

  const toDb = toDbSet(set);
  const { data: inserted, error } = await supabase.from('sets').insert(toDb).select().single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(201).json(mapSet(inserted));
});

export default router;
