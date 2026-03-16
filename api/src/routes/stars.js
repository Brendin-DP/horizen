const express = require('express');
const { getDb } = require('../db.js');
const { randomUUID } = require('crypto');

const router = express.Router();

router.post('/', (req, res) => {
  const db = getDb();
  db.read();

  const { memberId, awardedBy, reason } = req.body;

  if (!memberId || !awardedBy) {
    return res.status(400).json({ error: 'memberId and awardedBy are required' });
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
