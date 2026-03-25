import express from 'express';
import supabase from '../db.js';
import { mapExercise } from '../utils/mappers.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

const LOGGING_TYPES = new Set(['weighted', 'bodyweight', 'weighted_or_bodyweight']);

router.get('/', async (req, res) => {
  let query = supabase.from('exercise_library').select('*');
  const category = req.query.category;
  if (category) {
    query = query.eq('category', category);
  }
  const { data, error } = await query;
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.json((data || []).map(mapExercise));
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
