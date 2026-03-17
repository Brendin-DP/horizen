const express = require('express');
const { supabase } = require('../db.js');
const { requireAuth, requireRole } = require('../middleware/auth.js');
const router = express.Router();

const envTarget = Number(process.env.FUND_TARGET) || 6000;
const envRaised = Number(process.env.FUND_RAISED) || 0;

router.get('/', async (req, res) => {
  const target = envTarget;
  const donateUrl = process.env.DONATE_URL || '';

  let raised = envRaised;
  let visible = true;

  try {
    const { data, error } = await supabase
      .from('fund_goals')
      .select('raised, visible')
      .eq('id', 'default')
      .maybeSingle();
    if (!error && data) {
      raised = Number(data.raised) || 0;
      visible = data.visible !== false;
    }
  } catch (_) {
    // Table may not exist; use env fallbacks
  }

  res.json({
    target,
    raised,
    donateUrl,
    visible,
  });
});

router.patch('/', requireAuth, requireRole('admin', 'instructor'), async (req, res) => {
  const { raised, visible } = req.body;
  const updates = {};
  if (typeof raised === 'number' && raised >= 0) {
    updates.raised = Math.round(raised);
  }
  if (typeof visible === 'boolean') {
    updates.visible = visible;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Provide raised and/or visible to update' });
  }
  updates.updated_at = new Date().toISOString();

  const { data: existing } = await supabase
    .from('fund_goals')
    .select('id')
    .eq('id', 'default')
    .maybeSingle();

  let result;
  if (existing) {
    const dbUpdates = { updated_at: updates.updated_at };
    if (updates.raised !== undefined) dbUpdates.raised = updates.raised;
    if (updates.visible !== undefined) dbUpdates.visible = updates.visible;
    const { data, error } = await supabase
      .from('fund_goals')
      .update(dbUpdates)
      .eq('id', 'default')
      .select()
      .single();
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Database error', detail: error.message });
    }
    result = data;
  } else {
    const { data, error } = await supabase
      .from('fund_goals')
      .upsert({
        id: 'default',
        raised: updates.raised ?? 0,
        visible: updates.visible ?? true,
        updated_at: updates.updated_at,
      })
      .select()
      .single();
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Database error', detail: error.message });
    }
    result = data;
  }
  res.json({
    raised: Number(result.raised) || 0,
    visible: result.visible !== false,
  });
});

module.exports = router;
