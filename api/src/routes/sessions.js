import express from 'express';
import { randomUUID } from 'crypto';
import supabase from '../db.js';
import { mapSession, mapExercise, mapSet, toDbSet } from '../utils/mappers.js';
import { getMuscleGroupsForExercises, getExerciseMuscleGroups, attachMuscleGroups } from '../utils/exerciseHelpers.js';
import { normalizeSetCreatedAt } from '../utils/setCreatedAt.js';
import { isValidUUID } from '../utils/validation.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { memberId, exerciseId, notes, loggedAt } = req.body;

  if (!memberId || !exerciseId) {
    return res.status(400).json({ error: 'memberId and exerciseId are required' });
  }
  if (!isValidUUID(memberId) || !isValidUUID(exerciseId)) {
    return res.status(400).json({ error: 'memberId and exerciseId must be valid UUIDs' });
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

  const sessionRow = {
    id: randomUUID(),
    member_id: memberId,
    exercise_id: exerciseId,
    logged_at: loggedAt || new Date().toISOString(),
    notes: notes || null,
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabase.from('sessions').insert(sessionRow).select().single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(201).json(mapSession(inserted));
});

router.get('/', async (req, res) => {
  const memberId = req.query.memberId;
  const exerciseId = req.query.exerciseId;
  if (!memberId) {
    return res.status(400).json({ error: 'memberId query is required' });
  }
  if (!isValidUUID(String(memberId))) {
    return res.status(400).json({ error: 'memberId must be a valid UUID' });
  }
  if (exerciseId != null && String(exerciseId) !== '' && !isValidUUID(String(exerciseId))) {
    return res.status(400).json({ error: 'exerciseId must be a valid UUID' });
  }

  let query = supabase
    .from('sessions')
    .select('*')
    .eq('member_id', memberId)
    .order('logged_at', { ascending: false });

  if (exerciseId) {
    query = query.eq('exercise_id', exerciseId);
  }

  const { data: sessions, error } = await query;
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }

  const { data: exercises } = await supabase.from('exercise_library').select('*');
  const exerciseMap = {};
  for (const e of exercises || []) {
    exerciseMap[e.id] = mapExercise(e);
  }
  const mgMap = await getMuscleGroupsForExercises(Object.keys(exerciseMap));
  for (const eid of Object.keys(exerciseMap)) {
    exerciseMap[eid] = attachMuscleGroups(exerciseMap[eid], mgMap[eid]);
  }

  const sessionList = sessions || [];
  const sessionIds = sessionList.map((s) => s.id);

  let allSets = [];
  if (sessionIds.length > 0) {
    const { data: setsData } = await supabase
      .from('sets')
      .select('*')
      .in('session_id', sessionIds)
      .order('set_number', { ascending: true });
    allSets = setsData || [];
  }

  const setsBySessionId = {};
  for (const s of allSets) {
    const sid = s.session_id;
    if (!setsBySessionId[sid]) setsBySessionId[sid] = [];
    setsBySessionId[sid].push(s);
  }

  const result = sessionList.map((row) => ({
    ...mapSession(row),
    exercise: exerciseMap[row.exercise_id] ?? null,
    sets: (setsBySessionId[row.id] || []).map(mapSet),
  }));
  res.json(result);
});

router.get('/:id', async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid session id' });
  }
  const { data: sessionRow, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error || !sessionRow) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select('*')
    .eq('id', sessionRow.exercise_id)
    .single();
  const { data: sets } = await supabase
    .from('sets')
    .select('*')
    .eq('session_id', sessionRow.id)
    .order('set_number', { ascending: true });

  let exercisePayload = null;
  if (exercise) {
    const mgs = await getExerciseMuscleGroups(exercise.id);
    exercisePayload = attachMuscleGroups(mapExercise(exercise), mgs);
  }

  res.json({
    ...mapSession(sessionRow),
    exercise: exercisePayload,
    sets: (sets || []).map(mapSet),
  });
});

router.delete('/:id', async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid session id' });
  }
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', req.params.id)
    .single();
  if (!existing) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const { error: setsErr } = await supabase.from('sets').delete().eq('session_id', req.params.id);
  if (setsErr) {
    console.error(setsErr);
    return res.status(500).json({ error: 'Database error', detail: setsErr.message });
  }
  const { error } = await supabase.from('sessions').delete().eq('id', req.params.id);
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(204).send();
});

router.post('/:id/sets/batch', async (req, res) => {
  const sessionId = req.params.id;
  if (!isValidUUID(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' });
  }
  const { sets: setsPayload } = req.body;

  if (!Array.isArray(setsPayload) || setsPayload.length === 0) {
    return res.status(400).json({ error: 'sets array is required and must not be empty' });
  }

  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .single();
  if (!sessionRow) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const now = new Date().toISOString();
  const toInsert = [];
  for (let idx = 0; idx < setsPayload.length; idx++) {
    const s = setsPayload[idx];
    const n = normalizeSetCreatedAt(s.createdAt, now);
    if (!n.ok) {
      return res.status(400).json({ error: n.error });
    }
    const setNumber = s.setNumber !== undefined ? s.setNumber : idx + 1;
    toInsert.push(
      toDbSet({
        id: randomUUID(),
        sessionId,
        setNumber,
        reps: s.reps ?? null,
        weightKg: s.weightKg ?? null,
        durationSeconds: s.durationSeconds ?? null,
        distanceMeters: s.distanceMeters ?? null,
        completed: s.completed !== undefined ? s.completed : true,
        createdAt: n.iso,
      })
    );
  }

  const { data: inserted, error } = await supabase.from('sets').insert(toInsert).select();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  const ordered = (inserted || []).sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0));
  res.status(201).json(ordered.map(mapSet));
});

router.post('/:id/sets', async (req, res) => {
  const sessionId = req.params.id;
  if (!isValidUUID(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' });
  }
  const { setNumber, reps, weightKg, durationSeconds, distanceMeters, completed, createdAt } = req.body;

  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .single();
  if (!sessionRow) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { data: maxRow } = await supabase
    .from('sets')
    .select('set_number')
    .eq('session_id', sessionId)
    .order('set_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxSetNumber = maxRow?.set_number ?? 0;
  const defaultCreated = new Date().toISOString();
  const n = normalizeSetCreatedAt(createdAt, defaultCreated);
  if (!n.ok) {
    return res.status(400).json({ error: n.error });
  }
  const set = {
    id: randomUUID(),
    sessionId,
    setNumber: setNumber !== undefined ? setNumber : maxSetNumber + 1,
    reps: reps ?? null,
    weightKg: weightKg ?? null,
    durationSeconds: durationSeconds ?? null,
    distanceMeters: distanceMeters ?? null,
    completed: completed !== undefined ? completed : true,
    createdAt: n.iso,
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
