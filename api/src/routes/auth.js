import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { supabase } from '../db.js';
import { mapMember, toDbMember } from '../utils/mappers.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
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
    role: 'member',
    plan: 'free',
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

  const token = jwt.sign(
    { memberId: member.id, role: member.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  res.status(201).json({
    member: mapMember(inserted),
    token,
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .single();

  if (error) {
    console.error('Login DB error:', error);
    return res.status(500).json({
      error: 'Database error',
      detail: error.message,
      hint: error.code === 'PGRST301' ? 'Check RLS policies or use SUPABASE_SERVICE_ROLE_KEY' : undefined,
    });
  }
  if (!member || !member.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, member.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { memberId: member.id, role: member.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  res.json({
    member: mapMember(member),
    token,
  });
});

export default router;
