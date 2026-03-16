const express = require('express');
const { getDb } = require('../db.js');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.read();
  const members = db.get('members').value();
  res.json(members);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  db.read();
  const member = db.get('members').find({ id: req.params.id }).value();
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }
  res.json(member);
});

router.get('/:id/stars', (req, res) => {
  const db = getDb();
  db.read();

  const memberId = req.params.id;
  const awards = db
    .get('starAwards')
    .filter({ memberId })
    .orderBy(['createdAt'], ['desc'])
    .value();

  res.json(awards);
});

module.exports = router;
