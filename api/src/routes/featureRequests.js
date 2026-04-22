import express from 'express';
import supabase from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSlackMessage, featureRequestMessage } from '../utils/slack.js';

const router = express.Router();

const VALID_STATUSES = [
  'Requested',
  'Under Consideration',
  'In Progress',
  'Done',
  'Archived',
];
const VALID_TAGS = ['Bug', 'Feature Request', 'Improvement'];

function mapFeatureRequestRow(row, requester = null) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tag: row.tag,
    status: row.status,
    upvotes: row.upvotes,
    requestedBy: requester
      ? { id: requester.id, name: requester.name, email: requester.email }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Public roadmap — must be registered before GET /:id */
router.get('/public', async (req, res) => {
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'roadmap_public')
    .maybeSingle();

  if (!setting || setting.value !== 'true') {
    return res.status(403).json({ error: 'Public roadmap is not available' });
  }

  const { data, error } = await supabase
    .from('feature_requests')
    .select('id, title, description, tag, status, upvotes, created_at')
    .neq('status', 'Archived')
    .order('upvotes', { ascending: false });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch roadmap' });
  }

  return res.json(
    (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      tag: row.tag,
      status: row.status,
      upvotes: row.upvotes,
      createdAt: row.created_at,
    }))
  );
});

/** Mobile roadmap with per-member vote flags — must be registered before /:id routes */
router.get('/roadmap', async (req, res) => {
  const { memberId } = req.query;

  if (!memberId || typeof memberId !== 'string') {
    return res.status(400).json({ error: 'memberId is required' });
  }

  const { data: requests, error } = await supabase
    .from('feature_requests')
    .select('id, title, description, tag, status, upvotes, created_at')
    .neq('status', 'Archived')
    .order('upvotes', { ascending: false });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch roadmap' });
  }

  const { data: votes, error: votesError } = await supabase
    .from('feature_request_votes')
    .select('feature_request_id')
    .eq('member_id', memberId);

  if (votesError) {
    console.error(votesError);
    return res.status(500).json({ error: 'Failed to fetch roadmap' });
  }

  const votedIds = new Set((votes || []).map((v) => v.feature_request_id));

  const result = (requests || []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    tag: r.tag,
    status: r.status,
    upvotes: r.upvotes,
    hasVoted: votedIds.has(r.id),
    createdAt: r.created_at,
  }));

  return res.json(result);
});

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { status, tag } = req.query;

  let query = supabase
    .from('feature_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (tag) query = query.eq('tag', tag);

  const { data: rows, error } = await query;
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }

  const list = rows || [];
  const ids = [...new Set(list.map((r) => r.requested_by).filter(Boolean))];
  const memberMap = {};
  if (ids.length > 0) {
    const { data: members } = await supabase
      .from('members')
      .select('id, name, email')
      .in('id', ids);
    for (const m of members || []) {
      memberMap[m.id] = m;
    }
  }

  return res.json(
    list.map((row) => mapFeatureRequestRow(row, memberMap[row.requested_by] || null))
  );
});

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

  const memberName = req.member?.name ?? 'Unknown Member';
  const titleTrim = title.trim();
  const descriptionTrim = description.trim();
  sendSlackMessage(
    featureRequestMessage({
      memberName,
      title: titleTrim,
      description: descriptionTrim,
    })
  ).catch((err) => console.error('Slack error:', err));

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

/** Toggle vote — static /:id/vote must stay before any ambiguous routes; POST only */
router.post('/:id/vote', async (req, res) => {
  const { memberId } = req.body;
  const featureRequestId = req.params.id;

  if (!memberId || typeof memberId !== 'string') {
    return res.status(400).json({ error: 'memberId is required' });
  }

  const { data: existingVote, error: lookupErr } = await supabase
    .from('feature_request_votes')
    .select('member_id')
    .eq('feature_request_id', featureRequestId)
    .eq('member_id', memberId)
    .maybeSingle();

  if (lookupErr) {
    console.error(lookupErr);
    return res.status(500).json({ error: 'Failed to check vote' });
  }

  if (existingVote) {
    const { error: delErr } = await supabase
      .from('feature_request_votes')
      .delete()
      .eq('feature_request_id', featureRequestId)
      .eq('member_id', memberId);

    if (delErr) {
      console.error(delErr);
      return res.status(500).json({ error: 'Failed to remove vote' });
    }

    const { data: newCount, error: rpcErr } = await supabase.rpc('decrement_upvotes', {
      request_id: featureRequestId,
    });

    if (rpcErr) {
      console.error(rpcErr);
      await supabase.from('feature_request_votes').insert({
        feature_request_id: featureRequestId,
        member_id: memberId,
      });
      return res.status(500).json({ error: 'Failed to update vote count' });
    }

    return res.json({ hasVoted: false, upvotes: newCount ?? 0 });
  }

  const { error: insErr } = await supabase.from('feature_request_votes').insert({
    feature_request_id: featureRequestId,
    member_id: memberId,
  });

  if (insErr) {
    console.error(insErr);
    return res.status(500).json({ error: 'Failed to save vote' });
  }

  const { data: newCount, error: rpcErr } = await supabase.rpc('increment_upvotes', {
    request_id: featureRequestId,
  });

  if (rpcErr) {
    console.error(rpcErr);
    await supabase
      .from('feature_request_votes')
      .delete()
      .eq('feature_request_id', featureRequestId)
      .eq('member_id', memberId);
    return res.status(500).json({ error: 'Failed to update vote count' });
  }

  return res.json({ hasVoted: true, upvotes: newCount ?? 0 });
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { status, tag } = req.body;

  if (status === undefined && tag === undefined) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  const updates = { updated_at: new Date().toISOString() };

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    updates.status = status;
  }

  if (tag !== undefined) {
    if (!VALID_TAGS.includes(tag)) {
      return res.status(400).json({ error: 'Invalid tag' });
    }
    updates.tag = tag;
  }

  const { data, error } = await supabase
    .from('feature_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const { data: member } = await supabase
    .from('members')
    .select('id, name, email')
    .eq('id', data.requested_by)
    .maybeSingle();

  return res.json(mapFeatureRequestRow(data, member));
});

export default router;
