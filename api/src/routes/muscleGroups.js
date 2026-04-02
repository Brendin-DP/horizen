import express from 'express';
import supabase from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('muscle_groups')
    .select('*')
    .order('region')
    .order('name');

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch muscle groups' });
  }

  const rows = data || [];
  const grouped = rows.reduce((acc, mg) => {
    if (!acc[mg.region]) acc[mg.region] = [];
    acc[mg.region].push({ id: mg.id, name: mg.name });
    return acc;
  }, {});

  return res.json({
    flat: rows.map((mg) => ({ id: mg.id, name: mg.name, region: mg.region })),
    grouped,
  });
});

export default router;
