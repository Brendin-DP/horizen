import express from 'express';
import { randomUUID } from 'crypto';
import supabase from '../db.js';
import { mapExercise } from '../utils/mappers.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

const LOGGING_TYPES = new Set(['weighted', 'bodyweight', 'weighted_or_bodyweight']);
const UNITS = new Set(['weight_reps', 'time', 'distance']);

/** POST /request and GET /requests MUST be registered before /:id */

router.post('/request', requireAuth, async (req, res) => {
  const { memberId, name, category, type, requestNotes } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Exercise name is required' });
  }
  if (!memberId || memberId !== req.member.id) {
    return res.status(400).json({ error: 'memberId must match authenticated member' });
  }
  const id = randomUUID();
  const categoryVal =
    category != null && String(category).trim() ? String(category).trim() : 'General';
  const insert = {
    id,
    name: name.trim(),
    category: categoryVal,
    type: type != null && String(type).trim() ? String(type).trim() : null,
    muscle_groups: [],
    equipment: null,
    unit: 'weight_reps',
    logging_type: 'weighted',
    status: 'requested',
    requested_by: req.member.id,
    request_notes:
      requestNotes != null && String(requestNotes).trim() ? String(requestNotes).trim() : null,
  };
  const { data, error } = await supabase.from('exercise_library').insert(insert).select().single();
  if (error) {
    console.error('Exercise request error:', error);
    return res.status(500).json({ error: 'Failed to submit request', detail: error.message });
  }
  res.status(201).json(mapExercise(data));
});

router.get('/requests', requireAuth, requireRole('admin'), async (req, res) => {
  const { data: rows, error } = await supabase
    .from('exercise_library')
    .select('*')
    .eq('status', 'requested')
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
  const list = rows || [];
  const ids = [...new Set(list.map((r) => r.requested_by).filter(Boolean))];
  let membersById = {};
  if (ids.length > 0) {
    const { data: mems } = await supabase.from('members').select('id, name, email').in('id', ids);
    for (const m of mems || []) {
      membersById[m.id] = { id: m.id, name: m.name, email: m.email };
    }
  }
  const mapped = list.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    type: row.type,
    requestNotes: row.request_notes,
    requestedBy: row.requested_by ? membersById[row.requested_by] ?? null : null,
    createdAt: row.created_at,
  }));
  res.json(mapped);
});

router.get('/', async (req, res) => {
  let query = supabase.from('exercise_library').select('*').eq('status', 'active');
  const category = req.query.category;
  if (category) {
    query = query.eq('category', category);
  }
  const { data, error } = await query.order('name');
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.json((data || []).map(mapExercise));
});

router.patch('/:id/approve', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, category, type, muscleGroups, equipment, unit, loggingType } = req.body;
  const updates = { status: 'active' };
  if (name && String(name).trim()) updates.name = String(name).trim();
  if (category !== undefined && category !== null && String(category).trim()) {
    updates.category = String(category).trim();
  }
  if (type !== undefined) {
    updates.type = type && String(type).trim() ? String(type).trim() : null;
  }
  if (equipment !== undefined) {
    updates.equipment = equipment && String(equipment).trim() ? String(equipment).trim() : null;
  }
  if (unit && UNITS.has(unit)) updates.unit = unit;
  if (loggingType && LOGGING_TYPES.has(loggingType)) updates.logging_type = loggingType;
  if (muscleGroups !== undefined) {
    if (Array.isArray(muscleGroups)) {
      updates.muscle_groups = muscleGroups;
    } else if (typeof muscleGroups === 'string') {
      updates.muscle_groups = muscleGroups
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      updates.muscle_groups = [];
    }
  }
  const { data, error } = await supabase
    .from('exercise_library')
    .update(updates)
    .eq('id', id)
    .eq('status', 'requested')
    .select()
    .single();
  if (error || !data) {
    return res.status(404).json({ error: 'Request not found or already processed' });
  }
  res.json(mapExercise(data));
});

router.patch('/:id/reject', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('exercise_library')
    .update({ status: 'rejected' })
    .eq('id', id)
    .eq('status', 'requested')
    .select()
    .single();
  if (error || !data) {
    return res.status(404).json({ error: 'Request not found or already processed' });
  }
  res.json(mapExercise(data));
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { loggingType } = req.body;
  if (loggingType === undefined || loggingType === null) {
    return res.status(400).json({ error: 'loggingType is required' });
  }
  if (!LOGGING_TYPES.has(loggingType)) {
    return res.status(400).json({
      error: 'loggingType must be weighted, bodyweight, or weighted_or_bodyweight',
    });
  }
  const { data, error } = await supabase
    .from('exercise_library')
    .update({ logging_type: loggingType })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  if (!data) {
    return res.status(404).json({ error: 'Exercise not found' });
  }
  res.json(mapExercise(data));
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('exercise_library')
    .select('*')
    .eq('id', req.params.id)
    .eq('status', 'active')
    .single();
  if (error) {
    if (error.code === 'PGRST116') return res.status(404).json({ error: 'Exercise not found' });
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  if (!data) return res.status(404).json({ error: 'Exercise not found' });
  res.json(mapExercise(data));
});

export default router;
