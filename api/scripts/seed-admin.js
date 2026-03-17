#!/usr/bin/env node
/**
 * Seed an admin user into Supabase. Run from api/: node scripts/seed-admin.js
 * Usage: node scripts/seed-admin.js [email] [password] [name]
 * Default: admin@gym.com / password123 / Admin User
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const email = process.argv[2] || 'admin@gym.com';
const password = process.argv[3] || 'password123';
const name = process.argv[4] || 'Admin User';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function seed() {
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (existing) {
    console.log(`User ${email} already exists. Use that account to login.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const member = {
    id: randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password_hash: passwordHash,
    role: 'admin',
    plan: 'elite',
    plan_expires_at: null,
    avatar_url: null,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('members').insert(member);
  if (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
  console.log(`Created admin: ${email} / ${password}`);
}

seed();
