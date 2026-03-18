import express from 'express';
import { supabase } from '../db.js';
import { mapExercise } from '../utils/mappers.js';

const router = express.Router();

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
