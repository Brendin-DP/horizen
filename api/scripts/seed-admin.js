#!/usr/bin/env node
/**
 * Seed an admin user into Supabase.
 * Run from project root: node api/scripts/seed-admin.js [email] [password] [name]
 * Or from api/: node scripts/seed-admin.js [email] [password] [name]
 * Default: admin@gym.com / password123 / Admin User
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in api/.env
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

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
