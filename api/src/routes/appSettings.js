import express from 'express';
import supabase from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('app_settings').select('*').order('key');
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
  return res.json(data || []);
});

router.patch('/:key', async (req, res) => {
  const { value } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: 'value is required' });
  }

  const { data, error } = await supabase
    .from('app_settings')
    .update({ value: String(value), updated_at: new Date().toISOString() })
    .eq('key', req.params.key)
    .select()
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Setting not found' });
  }
  return res.json(data);
});

export default router;
