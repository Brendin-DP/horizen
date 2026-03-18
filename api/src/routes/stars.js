import express from 'express';
import { randomUUID } from 'crypto';
import supabase from '../db.js';
import { mapStarAward, toDbStarAward } from '../utils/mappers.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, requireRole('admin', 'instructor'), async (req, res) => {
  const { memberId, reason } = req.body;
  const awardedBy = req.member.id;

  if (!memberId) {
    return res.status(400).json({ error: 'memberId is required' });
  }

  const { data: member, error: memberErr } = await supabase
    .from('members')
    .select('id')
    .eq('id', memberId)
    .single();
  if (memberErr || !member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const award = {
    id: randomUUID(),
    memberId,
    awardedBy,
    reason: reason || null,
    createdAt: new Date().toISOString(),
  };
  const toDb = toDbStarAward(award);

  const { data: inserted, error } = await supabase
    .from('star_awards')
    .insert(toDb)
    .select()
    .single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(201).json(mapStarAward(inserted));
});

export default router;
