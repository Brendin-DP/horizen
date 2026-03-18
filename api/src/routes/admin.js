const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { supabase } = require('../db.js');
const { mapPlan, mapFeature, mapPlanFeature, mapMember, toDbMember, toDbPlanFeature } = require('../utils/mappers.js');
const { requireAuth, requireRole } = require('../middleware/auth.js');

const router = express.Router();
const SALT_ROUNDS = 10;

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/plans', async (req, res) => {
  const { data, error } = await supabase.from('plans').select('*');
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.json((data || []).map(mapPlan));
});

router.get('/features', async (req, res) => {
  const { data, error } = await supabase.from('features').select('*');
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.json((data || []).map(mapFeature));
});

router.get('/plan-features', async (req, res) => {
  const { data, error } = await supabase.from('plan_features').select('*');
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.json((data || []).map(mapPlanFeature));
});

router.get('/config', async (req, res) => {
  const [plansRes, featuresRes, planFeaturesRes] = await Promise.all([
    supabase.from('plans').select('*'),
    supabase.from('features').select('*'),
    supabase.from('plan_features').select('*'),
  ]);
  if (plansRes.error || featuresRes.error || planFeaturesRes.error) {
    console.error(plansRes.error || featuresRes.error || planFeaturesRes.error);
    return res.status(500).json({ error: 'Database error' });
  }
  res.json({
    plans: (plansRes.data || []).map(mapPlan),
    features: (featuresRes.data || []).map(mapFeature),
    planFeatures: (planFeaturesRes.data || []).map(mapPlanFeature),
  });
});

router.put('/plan-features', async (req, res) => {
  const { planFeatures } = req.body;
  if (!Array.isArray(planFeatures)) {
    return res.status(400).json({ error: 'planFeatures must be an array' });
  }
  const planIdsToDelete = [...new Set(planFeatures.map((pf) => pf.planId))];
  if (planIdsToDelete.length === 0) {
    const { data: existing } = await supabase.from('plan_features').select('plan_id');
    planIdsToDelete.push(...new Set((existing || []).map((r) => r.plan_id)));
  }
  if (planIdsToDelete.length > 0) {
    const { error: delErr } = await supabase.from('plan_features').delete().in('plan_id', planIdsToDelete);
    if (delErr) {
      console.error(delErr);
      return res.status(500).json({ error: 'Database error', detail: delErr.message });
    }
  }
  if (planFeatures.length === 0) {
    return res.json(planFeatures);
  }
  const toInsert = planFeatures.map((pf) => toDbPlanFeature(pf));
  const { data: inserted, error } = await supabase
    .from('plan_features')
    .insert(toInsert)
    .select();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.json((inserted || []).map(mapPlanFeature));
});

router.get('/metrics', async (req, res) => {
  const [membersRes, plansRes, starAwardsRes] = await Promise.all([
    supabase.from('members').select('*'),
    supabase.from('plans').select('*'),
    supabase.from('star_awards').select('*'),
  ]);
  if (membersRes.error || plansRes.error || starAwardsRes.error) {
    console.error(membersRes.error || plansRes.error || starAwardsRes.error);
    return res.status(500).json({ error: 'Database error' });
  }
  const members = membersRes.data || [];
  const plans = plansRes.data || [];
  const starAwards = starAwardsRes.data || [];

  const activeMembers = members.filter((m) => {
    if (m.role !== 'member') return false;
    if (!m.plan_expires_at) return true;
    return new Date(m.plan_expires_at) >= new Date();
  });

  const membersByPlan = { free: 0, pro: 0, elite: 0 };
  for (const m of activeMembers) {
    const plan = m.plan || 'free';
    if (membersByPlan[plan] !== undefined) {
      membersByPlan[plan]++;
    }
  }

  const planPrices = {};
  for (const p of plans) {
    planPrices[p.id] = p.price_monthly || 0;
  }

  let mrr = 0;
  for (const m of activeMembers) {
    const plan = m.plan || 'free';
    if (plan !== 'free' && planPrices[plan] != null) {
      mrr += planPrices[plan];
    }
  }

  const arr = mrr * 12;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const starsThisMonth = starAwards.filter(
    (s) => new Date(s.created_at) >= startOfMonth
  ).length;

  res.json({
    activeMembers: activeMembers.length,
    membersByPlan,
    mrr,
    arr,
    starsThisMonth,
  });
});

router.post('/members', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }
  if (!['member', 'instructor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be member, instructor, or admin' });
  }

  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const member = {
    id: randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    role,
    plan: role === 'member' ? 'free' : 'elite',
    planExpiresAt: null,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
  };

  const toDb = toDbMember(member);
  const { data: inserted, error } = await supabase
    .from('members')
    .insert(toDb)
    .select()
    .single();
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }
  res.status(201).json(mapMember(inserted));
});

module.exports = router;
