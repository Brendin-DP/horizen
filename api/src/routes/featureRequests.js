import express from 'express';
import supabase from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const { title, description } = req.body;
  const memberId = req.member.id;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const { data, error } = await supabase
    .from('feature_requests')
    .insert({
      title: title.trim(),
      description: description.trim(),
      requested_by: memberId,
      tag: 'Feature Request',
      status: 'Requested',
    })
    .select()
    .single();

  if (error) {
    console.error('Feature request error:', error);
    return res.status(500).json({ error: 'Failed to submit request' });
  }

  return res.status(201).json({
    id: data.id,
    title: data.title,
    description: data.description,
    tag: data.tag,
    status: data.status,
    upvotes: data.upvotes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
});

export default router;
