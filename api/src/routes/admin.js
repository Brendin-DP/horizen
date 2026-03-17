const express = require('express');
const { getDb } = require('../db.js');
const { requireAuth, requireRole } = require('../middleware/auth.js');

const router = express.Router();

// All admin routes require auth + admin role
router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/plans', (req, res) => {
  const db = getDb();
  db.read();
  const plans = db.get('plans').value() || [];
  res.json(plans);
});

router.get('/features', (req, res) => {
  const db = getDb();
  db.read();
  const features = db.get('features').value() || [];
  res.json(features);
});

router.get('/plan-features', (req, res) => {
  const db = getDb();
  db.read();
  const planFeatures = db.get('planFeatures').value() || [];
  res.json(planFeatures);
});

router.get('/config', (req, res) => {
  const db = getDb();
  db.read();
  res.json({
    plans: db.get('plans').value() || [],
    features: db.get('features').value() || [],
    planFeatures: db.get('planFeatures').value() || [],
  });
});

router.put('/plan-features', (req, res) => {
  const { planFeatures } = req.body;
  if (!Array.isArray(planFeatures)) {
    return res.status(400).json({ error: 'planFeatures must be an array' });
  }
  const db = getDb();
  db.read();
  db.set('planFeatures', planFeatures).write();
  res.json(planFeatures);
});

router.get('/metrics', (req, res) => {
  const db = getDb();
  db.read();

  const members = db.get('members').value() || [];
  const plans = db.get('plans').value() || [];
  const starAwards = db.get('starAwards').value() || [];

  const activeMembers = members.filter((m) => {
    if (m.role !== 'member') return false;
    if (!m.planExpiresAt) return true;
    return new Date(m.planExpiresAt) >= new Date();
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
    planPrices[p.id] = p.priceMonthly || 0;
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
    (s) => new Date(s.createdAt) >= startOfMonth
  ).length;

  res.json({
    activeMembers: activeMembers.length,
    membersByPlan,
    mrr,
    arr,
    starsThisMonth,
  });
});

module.exports = router;
