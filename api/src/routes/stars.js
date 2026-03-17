const express = require('express');
const { getDb } = require('../db.js');
const { randomUUID } = require('crypto');
const { requireAuth, requireRole } = require('../middleware/auth.js');

const router = express.Router();

router.post('/', requireAuth, requireRole('admin', 'instructor'), (req, res) => {
  const db = getDb();
  db.read();

  const { memberId, reason } = req.body;
  const awardedBy = req.member.id;

  if (!memberId) {
    return res.status(400).json({ error: 'memberId is required' });
  }

  const member = db.get('members').find({ id: memberId }).value();
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const award = {
    id: randomUUID(),
    memberId,
    awardedBy,
    reason: reason || null,
    createdAt: new Date().toISOString(),
  };

  db.get('starAwards').push(award).write();
  res.status(201).json(award);
});

module.exports = router;
