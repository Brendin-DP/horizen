const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { getDb } = require('../db.js');
const { toPublicMember } = require('../utils/members.js');
const { JWT_SECRET } = require('../middleware/auth.js');

const router = express.Router();
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

router.post('/register', async (req, res) => {
  const db = getDb();
  db.read();

  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const existing = db.get('members').find({ email: email.trim().toLowerCase() }).value();
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const member = {
    id: randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    role: 'member',
    plan: 'free',
    planExpiresAt: null,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
  };

  db.get('members').push(member).write();

  const token = jwt.sign(
    { memberId: member.id, role: member.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  res.status(201).json({
    member: toPublicMember(member),
    token,
  });
});

router.post('/login', async (req, res) => {
  const db = getDb();
  db.read();

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const member = db.get('members').find({ email: email.trim().toLowerCase() }).value();
  if (!member || !member.passwordHash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, member.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { memberId: member.id, role: member.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  res.json({
    member: toPublicMember(member),
    token,
  });
});

module.exports = router;
